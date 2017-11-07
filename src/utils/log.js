/* global console */
/* jshint -W097 */

// set up safe console
var logFns = ['log', 'error', 'warn', 'info'];

var log = {
    history: []
};

var fallback = function () {
    log.history.push(arguments);
};

var ieLegacy = function () {
    Function.prototype.call.call(console.log, console, Array.prototype.slice.call(arguments));
};

var specializedFn;
var defaultFn;

for (var i = 0; i < logFns.length; i++) {

    if (typeof console !== 'undefined' && typeof console.log === 'object') {
        // ie8 + ie9
        log[logFns[i]] = ieLegacy;
    } else if (typeof console !== 'undefined' && typeof console.log === 'function') {
        specializedFn = window.console && window.console[logFns[i]] && window.console[logFns[i]].bind(window.console);
        defaultFn = window.console && window.console.log && window.console.log.bind(window.console);

        log[logFns[i]] = specializedFn || defaultFn || fallback;
    } else {
        log[logFns[i]] = fallback;
    }
}

// put this on global scope to allow interrogation of history for fallback
window.ampLog = log;

module.exports = log;
