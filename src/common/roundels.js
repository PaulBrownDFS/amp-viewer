var log = require('../utils/log');
var templates = require('../templates/templates.compiled');

var roundels = {
    parsePosition: function(positionText) {
        // pity we can't base this on ordinal.
        // start switch at pos 9 after 'position'
        // ie. we expect positions by spec to be
        // positionOne, positionTwo, ...
        switch (positionText.substring(9).toLowerCase()) {
            case 'one':
                return 0;
            case 'two':
                return 1;
            case 'three':
                return 2;
            case 'four':
                return 3;
            case 'five':
                return 4;
            case 'six':
                return 5;
            default:
                return 0;
        }
    },

    render: function($target, config) {
        var parsedRoundels = [];

        for (var i = 0, len = config.length; i < len; i++) {
            // expect a roundel to have a position, class and description
            if (config[i].length !== 3) {
                log.warn('expected roundel to have a position, class and description.  Received',
                    JSON.stringify(config[i])
                );
                continue;
            }

            parsedRoundels.push({
                index: roundels.parsePosition(config[i][0]),
                position: config[i][0],
                className: config[i][1],
                description: config[i][2]
            });
        }

        parsedRoundels.sort(function compareIndex(a, b) {
            return a.index - b.index;
        });

        var roundelsTemplate = templates['template-roundels'];
        var renderedDom = roundelsTemplate({
            roundels: parsedRoundels
        });

        $target
            .empty()
            .append(renderedDom)
            .addClass('amp-roundels-' + parsedRoundels.length);
    }
};

module.exports = roundels;
