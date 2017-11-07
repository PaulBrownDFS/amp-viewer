var log = require('../utils/log');

var Handlebars = window.Handlebars;
Handlebars.registerHelper('renderPartial', function (partialName, options) {
    if (!partialName) {
        log.error('No partial name given.');
        return '';
    }
    var partial = Handlebars.partials[partialName];
    if (!partial) {
        log.error('Couldnt find the compiled partial: ' + partialName);
        return '';
    }
    return new Handlebars.SafeString(partial(options.hash));
});

Handlebars.registerHelper('compare', function (lvalue, operator, rvalue, options) {

    var operators;
    var result;

    if (arguments.length < 3) {
        throw new Error('Handlerbars Helper "compare" needs 2 parameters');
    }

    if (options === undefined) {
        options = rvalue;
        rvalue = operator;
        operator = '===';
    }

    operators = {
        '===': function (l, r) { return l === r; },
        '!==': function (l, r) { return l !== r; },
        '<': function (l, r) { return l < r; },
        '>': function (l, r) { return l > r; },
        '<=': function (l, r) { return l <= r; },
        '>=': function (l, r) { return l >= r; },
        'typeof': function (l, r) { return typeof l === r; }
    };

    if (!operators[operator]) {
        throw new Error('Handlerbars Helper "compare" doesn\'t know the operator ' + operator);
    }

    result = operators[operator](lvalue, rvalue);

    if (result) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }

});

module.exports = Handlebars;
