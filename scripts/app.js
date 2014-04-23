/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

window.addEventListener('load', function() {
  this.dorudonDb.init(function successCb() {
    alert('Success!');
  }, function failureCb(aErrorName) {
    alert(aErrorName);
  });
});
