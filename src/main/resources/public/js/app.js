"use strict";

// var onresize = window.onresize;
// window.onresize = function(event) { if (typeof onresize === 'function') onresize(); /** ... */ }

var addEvent = function(object, type, callback) {
	if (object == null || typeof (object) == 'undefined')
		return;
	if (object.addEventListener) {
		object.addEventListener(type, callback, false);
	} else if (object.attachEvent) {
		object.attachEvent("on" + type, callback);
	} else {
		object["on" + type] = callback;
	}
};

/*
 * WARNING: This is called in realtime while user is resizing so always throttle back any processing so that you don't
 * do any actual processing in here unless you want it VERY live, because it is.
 */
function windowResize() {
	// console.log("WindowResize: w=" + window.innerWidth + " h=" + window.innerHeight);
}

addEvent(window, "resize", windowResize);

// This is our template element in index.html
var app = document.querySelector('#app');

// Listen for template bound event to know when bindings
// have resolved and content has been stamped to the page
app.addEventListener('dom-change', function() {
	console.log('app ready event!');
});

window.addEventListener('polymer-ready', function(e) {
	console.log('polymer-ready event!');
});
