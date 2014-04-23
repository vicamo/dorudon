/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

(function(exports) {
  'use strict';

  var DB_NAME = 'dorudon';
  var DB_VERSION = 1;

  var STORE_NAME_DICT = 'dict';

  var IM_CANGJIE = 0;
  var IM_CHEUNG_BAUER = 1;
  var IM_CIHAI_T = 2;
  var IM_FENN = 3;
  var IM_FOUR_CORNER_CODE = 4;
  var IM_FREQUENCY = 5;
  var IM_GRADE_LEVEL = 6;
  var IM_HDZ_RAD_BREAK = 7;
  var IM_HK_GLYPH = 8;
  var IM_PHONETIC = 9;
  var IM_TOTAL_STROKES = 10;

  var KNOWN_IMS = {
    kCangjie: IM_CANGJIE,
    kCheungBauer: IM_CHEUNG_BAUER,
    kCihaiT: IM_CIHAI_T,
    kFenn: IM_FENN,
    kFourCornerCode: IM_FOUR_CORNER_CODE,
    kFrequency: IM_FREQUENCY,
    kGradeLevel: IM_GRADE_LEVEL,
    kHDZRadBreak: IM_HDZ_RAD_BREAK,
    kHKGlyph: IM_HK_GLYPH,
    kPhonetic: IM_PHONETIC,
    kTotalStrokes: IM_TOTAL_STROKES
  };

  var READONLY = 'readonly';
  var READWRITE = 'readwrite';

  var _db = null;
  var _populated = false;

  var upgradeFuncs = {
    upgradeSchema0: function(aDb, aTxn, aCallback) {
      /**
       * Create 'dict' store.
       *
       * Record schema: {
       *   code: <numeric char code>,
       *   im: <numeric IM_*>
       *   value: <object>
       * }
       */
      var dictStore = aDb.createObjectStore(STORE_NAME_DICT);
      // For enumerate IMEs supported.
      dictStore.createIndex('code', 'code');
      // For enumerate completed char codes for a specific im.
      dictStore.createIndex('im-code', ['im', 'code'], { unique: true });
      // For pick-up value of a specific im of a specific char code.
      dictStore.createIndex('code-im', ['code', 'im'], { unique: true });

      aCallback();
    }
  };

  function openDb(aSuccessCb, aFailureCb) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = function(aEvent) {
      _db = aEvent.target.result;
      aSuccessCb && aSuccessCb();
    };
    req.onupgradeneeded = function (aEvent) {
      function upgradeSchema(aDb, aTxn, aOldVersion, aNewVersion) {
        if (aOldVersion < aNewVersion) {
          var next =
            upgradeSchema.bind(null, aDb, aTxn, aOldVersion + 1, aNewVersion);
          upgradeFuncs['upgradeSchema' + aOldVersion](aDb, aTxn, next);
          return;
        }

        if (aOldVersion == aNewVersion) {
          return;
        }

        aTxn.abort();
      }

      upgradeSchema(aEvent.target.result, aEvent.target.transaction,
                    aEvent.oldVersion, aEvent.newVersion);
    };
    req.onerror = function(aEvent) {
      aFailureCb && aFailureCb(aEvent.target.error.name);
    };
  }

  function ensureDB(aSuccessCb, aFailureCb) {
    if (_db) {
      aSuccessCb && aSuccessCb();
      return;
    }
    openDb(aSuccessCb, aFailureCb);
  }

  function newTxn(aStoreNames, aMode, aCallback, aSuccessCb, aFailureCb) {
    ensureDB(function() {
      var txn = _db.transaction(aStoreNames, aMode);
      txn.oncomplete = function (aEvent) {
        aSuccessCb && aSuccessCb(aEvent.target.result);
      };
      txn.onabort = function (aEvent) {
        /**
         * aEvent.target.error may be null if txn was aborted by calling
         * txn.abort().
         */
        if (!aFailureCb) {
          return;
        }

        if (aEvent.target.error) {
          aFailureCb(aEvent.target.error.name);
        } else {
          aFailureCb('UnknownError');
        }
      };

      if (aCallback) {
        aCallback(txn, aStoreNames.map(function(aStoreName) {
          return txn.objectStore(aStoreName);
        }));
      }
    }, aFailureCb);
  }

  function initDb(aSuccessCb, aFailureCb) {
    var req;
    newTxn([STORE_NAME_DICT], READONLY, function(aTxn, aStores) {
      req = aStores[0].count();
    }, function() {
      _populated = req.result != 0;
      aSuccessCb && aSuccessCb();
    }, aFailureCb);
  }

  function closeDb() {
    if (_db) {
      _db.close();
      _db = null;
    }
  }

  function loadFileAsString(aFile, aEncoding, aSuccessCb, aFailureCb) {
    var reader;

    try {
      reader = new FileReader();
      reader.readAsText(aFile, aEncoding);
    } catch(e) {
      aFailureCb && aFailureCb(e.name);
      return;
    }

    reader.onload = function(aEvent) {
      aSuccessCb && aSuccessCb(aEvent.target.result);
    };
    reader.onerror = function(aEvent) {
      aFailureCb && aFailureCb(aEvent.target.error.name);
    };
  }

  function parseDictionaryLikeData(aString, aSuccessCb, aFailureCb) {
    var lines = aString.split('\n');
    var entries = [];
    var re = new RegExp("^U\\+([0-9A-F]+)\\t(\\w+)\\t(.+)$");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // Skip lines begin with '#' and empty lines.
      if (!line.length || line.charAt(0) === '#') {
        continue;
      }

      var result;
      if (!(result = line.match(re))) {
        aFailureCb && aFailureCb('SyntaxError');
        return;
      }

      entries.push({
        code: parseInt(result[1], 16),
        im: result[2],
        value: result[3],
      });
    }

    aSuccessCb && aSuccessCb(entries);
  }

  function populateDb(aEntries, aSuccessCb, aProgressCb, aFailureCb) {
    if (!aEntries.length) {
      aSuccessCb && aSuccessCb();
      return;
    }

    newTxn([STORE_NAME_DICT], READWRITE, function(aTxn, aStores) {
      return;
      var dictStore = aStores[0];
      var percentage = 0;

      (function step(aIndex) {
        var req = dictStore.put(aEntries[aIndex]);
        if (aProgressCb) {
          var p = Math.floor(aIndex / aEntries.length);
          if (p != percentage) {
            req.onsuccess = function() {
              percentage = p;
              try {
                aProgressCb(percentage, "record put");
              } catch(e) {
                // Do nothing.
              }

              step(aIndex + 1);
            };
            return;
          }
        }

        step(aIndex + 1);
      })(0);
    }, aSuccessCb, aFailureCb);
  }

  var DorudonDb = {
    init: function(aSuccessCb, aFailureCb) {
      initDb(aSuccessCb, aFailureCb);
    },

    isPopulated: function() {
      return _populated;
    },

    loadFromFile: function(aFile, aSuccessCb, aProgressCb, aFailureCb) {
      if (this.isPopulated()) {
        aFailureCb && aFailureCb('AlreadyPopulatedError');
        return;
      }

      loadFileAsString(aFile, 'ascii', function(aString) {
        aProgressCb && aProgressCb(0, "file loaded");

        parseDictionaryLikeData(aString, function(aEntries) {
          populateDb(aEntries, aSuccessCb, aProgressCb, aFailureCb);
        }, aFailureCb);
      }, aFailureCb);
    }
  };

  exports.DorudonDb = DorudonDb;
})(this);
