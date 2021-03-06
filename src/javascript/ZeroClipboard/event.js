/*
 * Bridge from the Flash object back to the JavaScript
 *
 * returns nothing
 */
ZeroClipboard.dispatch = function (eventName, args) {
  if (typeof eventName === "string" && eventName) {
    // TODO: Update this to get an array of clients that have been glued to the `currentElement`
    var client = ZeroClipboard.prototype._singleton;

    // Sanitize the event name
    var cleanEventName = eventName.toLowerCase().replace(/^on/, "");

    // receive event from Flash movie, send to client
    if (cleanEventName) {
      _receiveEvent.call(client, cleanEventName, args);
    }
  }
};

/*
 * Add an event to the client.
 *
 * returns object instance
 */
ZeroClipboard.prototype.on = function (eventName, func) {
  // add user event listener for event
  var events = eventName.toString().split(/\s/g),
      added = {};
  for (var i = 0, len = events.length; i < len; i++) {
    eventName = events[i].toLowerCase().replace(/^on/, '');
    added[eventName] = true;
    if (!this.handlers[eventName]) {
      this.handlers[eventName] = func;
    }
  }

  // The following events must be memorized and fired immediately if relevant as they only occur
  // once per Flash object load.

  // If we don't have Flash, tell an adult
  if (added.noflash && flashState.global.noflash) {
    _receiveEvent.call(this, "onNoFlash", {});
  }
  // If we have old Flash,
  if (added.wrongflash && flashState.global.wrongflash) {
    _receiveEvent.call(this, "onWrongFlash", {
      flashVersion: flashState.global.version
    });
  }
  // If the SWF was already loaded, we're à gogo!
  if (added.load && flashState.clients[this.options.moviePath].ready) {
    _receiveEvent.call(this, "onLoad", {
      flashVersion: flashState.global.version
    });
  }

  return this;
};
// shortcut to old stuff
ZeroClipboard.prototype.addEventListener = ZeroClipboard.prototype.on;

/*
 * Remove an event from the client.
 *
 * returns object instance
 */
ZeroClipboard.prototype.off = function (eventName, func) {
  // remove user event listener for event
  var events = eventName.toString().split(/\s/g);
  for (var i = 0; i < events.length; i++) {
    eventName = events[i].toLowerCase().replace(/^on/, "");
    for (var event in this.handlers) {
      if (event === eventName && this.handlers[event] === func) {
        delete this.handlers[event];
      }
    }
  }

  return this;
};
// shortcut to old stuff
ZeroClipboard.prototype.removeEventListener = ZeroClipboard.prototype.off;

/*
 * Receive an event for a specific client.
 *
 * returns nothing
 */
var _receiveEvent = function (eventName, args) {
  // receive event from flash
  eventName = eventName.toString().toLowerCase().replace(/^on/, '');

  var element = currentElement;
  var performCallbackAsync = true;

  // special behavior for certain events
  switch (eventName) {
    case 'load':
      if (args && args.flashVersion) {
        // If the flash version is less than 10, throw event.
        if (!_isFlashVersionSupported(args.flashVersion)) {
          _receiveEvent.call(this, "onWrongFlash", { flashVersion: args.flashVersion });
          return;
        }
        flashState.clients[this.options.moviePath].ready = true;
        flashState.global.version = args.flashVersion;
      }
      break;

    case 'wrongflash':
      if (args && args.flashVersion && !_isFlashVersionSupported(args.flashVersion)) {
        flashState.global.wrongflash = true;
        flashState.global.version = args.flashVersion;
      }
      break;

    case 'mouseover':
      _addClass(element, this.options.hoverClass);
      break;

    case 'mouseout':
      _removeClass(element, this.options.hoverClass);
      this.resetBridge();
      break;

    case 'mousedown':
      _addClass(element, this.options.activeClass);
      break;

    case 'mouseup':
      _removeClass(element, this.options.activeClass);
      break;

    case 'datarequested':
      var targetId = element.getAttribute('data-clipboard-target'),
          targetEl = !targetId ? null : document.getElementById(targetId);
      if (targetEl) {
        var textContent = targetEl.value || targetEl.textContent || targetEl.innerText;
        if (textContent) {
          this.setText(textContent);
        }
      }
      else {
        var defaultText = element.getAttribute('data-clipboard-text');
        if (defaultText) {
          this.setText(defaultText);
        }
      }

      // This callback cannot be performed asynchronously as it would prevent the
      // user from being able to call `.setText` successfully before the pending
      // clipboard injection associated with this event fires.
      performCallbackAsync = false;
      break;

    case 'complete':
      this.options.text = null;
      break;
  } // switch eventName

  if (this.handlers[eventName]) {
    var func = this.handlers[eventName];

    // If the user provided a string for their callback, grab that function
    if (typeof func === 'string' && typeof window[func] === 'function') {
      func = window[func];
    }
    if (typeof func === 'function') {
      // actual function reference
      _dispatchCallback(func, element, this, args, performCallbackAsync);
    }
  } // user defined handler for event
};

/*
 * Register new element(s) to the object.
 *
 * returns object instance
 */
ZeroClipboard.prototype.glue = function (elements) {

  elements = _prepGlue(elements);

  for (var i = 0; i < elements.length ; i++) {
    if (elements[i] && elements[i].nodeType === 1) {
      // if the element has not been glued
      if (_inArray(elements[i], gluedElements) === -1) {

        // push to glued elements
        gluedElements.push(elements[i]);

        _addEventHandler(elements[i], "mouseover", _elementMouseOver);
      }
    }
  }

  return this;
};

/*
 * Unregister the clipboard actions of an element on the page
 *
 * returns object instance
 */
ZeroClipboard.prototype.unglue = function (elements) {

  elements = _prepGlue(elements);

  for (var i = 0; i < elements.length; i++) {

    _removeEventHandler(elements[i], "mouseover", _elementMouseOver);

    // get the index of the item
    var arrayIndex = _inArray(elements[i], gluedElements);

    // if the index is not -1, remove from array
    if (arrayIndex !== -1) gluedElements.splice(arrayIndex, 1);
  }

  return this;
};


function _isFlashVersionSupported(flashVersion) {
  return parseFloat(flashVersion.replace(/,/g, ".").replace(/[^0-9\.]/g, "")) >= 10.0;
}
