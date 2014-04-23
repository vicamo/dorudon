/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

window.addEventListener('load', function() {
  var self = this;
  this.DorudonDb.init(function successCb() {
    self.DbInitUI.init();

    if (self.DorudonDb.isPopulated()) {
    } else {
      self.DbInitUI.show();
    }
  }, function failureCb(aErrorName) {
    alert(aErrorName);
  });
});
