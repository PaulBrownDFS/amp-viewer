/*jshint browserify: true */
var $ = require('./jquery');
var BoxController = function ($main, $boxLink, quickLinksController) {
    this.ui = {
        $main: $main,
        $boxLink: $boxLink
    };

    this._bindEvents();
    this.quickLinksController = quickLinksController;
};

BoxController.prototype = {
    _bindEvents: function () {
        var self = this;

        self.ui.$main.find('.amp-box').click(function () {
            var $this = $(this);
            var selectedIndex = $this.find('.amp-selected').index();
            var toggledIndex = !selectedIndex;
            if ($this.data('amp-ampStack')) {
                self.quickLinksController.quicklinkModel.$boxLink.open = toggledIndex;
                $this.ampStack('goTo', toggledIndex + 1);
                self.ui.$boxLink.find('.amp-icon-box-open').toggle();
                self.ui.$boxLink.find('.amp-icon-box-close').toggle();
            }
        });
    },

    reset: function () {
        this._bindEvents();
    }

};

module.exports = BoxController;
