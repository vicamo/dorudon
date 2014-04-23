/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

(function(exports) {
  'use strict';

  var elemDbInitSession;

  var DbInitUI = {
    init: function() {
      elemDbInitSession = document.getElementById('db-init-section');
    },

    show: function() {
      var fileInput = document.getElementById('db-init-file-input');
      var submitBtn = document.getElementById('db-init-submit-button');

      fileInput.onchange = function() {
        var file = fileInput.files[0];
        if (file) {
          submitBtn.disabled = false;
        }
      };
      submitBtn.onclick = function() {
        // Only re-enabled in |fileInput.onchange|.
        submitBtn.disabled = true;

        var file = fileInput.files[0];
        exports.DorudonDb.loadFromFile(file, function onsuccess() {
          elemDbInitSession.classList.add('hide');
        }, function onprogress(aPercentage, aStatusStr) {
          window.dump('progress: ' + aPercentage + '%, ' + aStatusStr);
        }, function onerror(aErrorName) {
          //window.dump('Failed to load \'' + file.name + '\': ' + aErrorName);
          alert('Failed to load \'' + file.name + '\': ' + aErrorName);
        });
      };

      elemDbInitSession.classList.remove('hide');
    }
  };

  exports.DbInitUI = DbInitUI;
})(this);
