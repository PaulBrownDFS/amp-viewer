var amp = require('./namespace');
/*jshint browserify: true */
var quickLinkMap = {
    spinset: 'amp-spinset',
    video: 'amp-video-holder',
    recliner: 'amp-recliner',
    box: 'amp-box'
};

var QuickLinksController = function (navController, zoomController, videoController, $main,
        $quicklinks, currentSlide, getMainChildren, openFullscreen) {
    this.quicklinkModel = {};
    this.ui = {
        $main: $main,
        $quicklinks: $quicklinks,
        currentSlide: currentSlide,
        getMainChildren: getMainChildren
    };

    if (this.ui.$quicklinks.$fullscreenLink && this.ui.$quicklinks.$fullscreenLink.length) {
        this.ui.$quicklinks.$fullscreenLink.css('display', 'block');
        this.ui.$quicklinks.$fullscreenLink.click(openFullscreen);
    }
    this.navController = navController;
    this.zoomController = zoomController;
    this.videoController = videoController;

    this.init();
};

QuickLinksController.prototype = {
    _spinsetIsSpinning: false,
    _spinsetSpinningEvent: function () {
        var self = this;
        self._spinningTimeout = null;
        amp.stats.bind([
            {'type': 'spin', 'event': 'change', 'cb': function () {
                    self._spinsetIsSpinning = true;
                    if (self._spinningTimeout) {
                        clearTimeout(self._spinningTimeout);
                    }
                    self._spinningTimeout = setTimeout(function () {
                        self._spinsetIsSpinning = false;
                    }, 100);

                }
            }
        ]);
    },
    init: function () {
        for (var p in quickLinkMap) {
            var model = {name: p, class: quickLinkMap[p], open: false};
            if (p === 'recliner' || p === 'spinset') {
                model.action = 'spin';
            } else {
                model.action = p;
            }
            this.quicklinkModel['$' + p + 'Link'] = model;
        }
        this.ui.$quicklinks.$boxLink.find('.amp-icon-box-close').css('display', 'none');
        this.ui.$quicklinks.$boxLink.find('.amp-icon-box-open').css('display', 'block');
        this._bindEvents();
    },
    _bindEvents: function () {
        var self = this;

        for (var p in this.ui.$quicklinks) {

            var model = this.quicklinkModel[p];
            if (!model) {
                continue;
            }

            this.ui.$quicklinks[p].unbind('click');
            var index = self.ui.$main.find('.' + model.class).first().parent('li').index();
            this.ui.$quicklinks[p].css('display', 'none');
            if (index >= 0) {
                this.ui.$quicklinks[p].css('display', 'block');
            }

            this.ui.$quicklinks[p].click(this.action.bind(this, index, model));

            this._spinsetSpinningEvent();
        }
    },
    action: function (index, model) {
        if (typeof this[model.action + 'Action'] === 'function') {
            this[model.action + 'Action'](index, model);
        } else {
            this.navController.select.call(this.navController, index);
        }
    },
    videoAction: function (index, model) {
        var self = this;
        var currentSlide = this.ui.currentSlide();
        this.navController.select.call(this.navController, index);
        var $videoHolder = currentSlide.find('.' + model.class);
        if ($videoHolder.length === 0) {
            this.navController.select.call(this.navController, index);
            setTimeout(function () {
                self.videoController.play();
            }, 300);

        }
    },
    boxAction: function (index, model) {
        var self = this;
        clearTimeout(this.timeout);
        var currentSlide = this.ui.currentSlide();
        if (currentSlide.find('.' + model.class).length === 0) {
            this.navController.select.call(this.navController, index);
            setTimeout(function () {
                self.boxToggle(index, model);
            }, 300);
        } else {
            this.boxToggle(currentSlide.index(), model);
        }
    },
    boxToggle: function (index, model) {
        model.open = !model.open;
        if (model.open) {
            this.ui.getMainChildren().eq(index).find('.' + model.class).ampStack('goTo', 2);
            this.ui.$quicklinks.$boxLink.find('.amp-icon-box-open').css('display', 'none');
            this.ui.$quicklinks.$boxLink.find('.amp-icon-box-close').css('display', '');
        } else {
            this.ui.getMainChildren().eq(index).find('.' + model.class).ampStack('goTo', 1);
            this.ui.$quicklinks.$boxLink.find('.amp-icon-box-open').css('display', '');
            this.ui.$quicklinks.$boxLink.find('.amp-icon-box-close').css('display', 'none');
        }
    },
    spinAction: function (index, model) {
        var $spin;
        var currentSlide = this.ui.currentSlide();
        if (currentSlide.find('.' + model.class).length === 0) {
            this.navController.select.call(this.navController, index);
        } else {
            if (this._spinsetIsSpinning) {
                return false;
            }
            $spin = currentSlide.find('.' + model.class);
            $spin.ampSpin('playRepeat', 1);
        }
    },
    reset: function ($lastSlide) {
        if ($lastSlide && $lastSlide.find('.' + quickLinkMap.box).length > 0) {
            var index = $lastSlide.index();
            this.quicklinkModel.$boxLink.open = true;
            this.boxToggle(index, this.quicklinkModel.$boxLink);
        }
    }
};

module.exports = QuickLinksController;
