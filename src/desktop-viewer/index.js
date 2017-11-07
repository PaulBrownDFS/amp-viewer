var BaseViewer = require('../common/baseViewer');
var FullscreenViewer = require('../fullscreen-viewer/index');
var $ = require('../common/jquery');
var roundels = require('../common/roundels');
var capabilityDetection = require('../common/capabilities');

var DesktopViewer = function DesktopViewer(config) {
    this.viewerType = 'desktop';
    config.parentViewer = this;
    this.roundels = config.roundels;
    this.config = config;

    if ($(window).width() >= 1366) {
        this.templates = config.templates.wideDesktop;
    }

    return BaseViewer.apply(this, arguments);
};

DesktopViewer.prototype = Object.create(BaseViewer.prototype);

DesktopViewer.prototype._getThumbsContainerHeight = function () {
    if ($(window).width() < 1366) {
        return this.thumbsContainerHeight.small;
    }
    return this.thumbsContainerHeight.big;
};

DesktopViewer.prototype._resize = function () {
    var self = this;

    if (!this._resizeNavThumbsFunction) {
        this._resizeNavThumbsFunction = this.ui.controllers.navController._resizeNavThumbsOverflow();
    }

    this._resizeNavThumbsFunction();
    this.ui.$nav.ampCarousel('redraw');
    this.ui.$nav.css({
        height: self._getThumbsContainerHeight()
    });
};

DesktopViewer.prototype._initViewerComponents = function () {
    var self = this;
    var mainCarouselOptions = {
        'preloadNext': false,
        'width': 600,
        'height': 318,
        'onActivate': {'goTo': false, 'select': false},
        'loop': false,
        'animate': true,
        'gesture': {'enabled': true, 'fingers': 1}
    };

    //TODO: Get rid of ASAP :(
    if (capabilityDetection.getIsIE()) {
        mainCarouselOptions.no3D = true;
    }

    this.ui.$main.ampCarousel(mainCarouselOptions);

    this.thumbsContainerHeight = {
        small: 46,
        big: 53
    };

    this.ui.$nav.ampCarousel({
        'onActivate': {'select': false, 'goTo': false},
        'preloadNext': false,
        'dir': 'horz',
        'responsive': false,
        'loop': false,
        'height': self._getThumbsContainerHeight(),
        'easing': 'ease-in-out',
        'animDuration': 600
    });
    $(window).on('resize.amp.desktop.resize', this._resizeBase.bind(this));
};

DesktopViewer.prototype._destroyViewerComponents = function () {
    $(window).off('resize.amp.desktop.resize');
};

DesktopViewer.prototype._cacheViewerDom = function ($renderedDom) {
    var self = this;
    $.extend(true, self.ui, {
        $roundels: $renderedDom.find('.amp-roundels'),
        quickLinks: {
            $fullscreenLink: $renderedDom.find('.amp-quicklink-fullscreen')
        },
        openFullscreenViewer: function () {

            if (!self.fullscreen || self.fullscreen.setData.items.length !== self.setData.items.length) {
                self.fullscreen = null;
                var currentSlideIndex = self.ui.currentSlide().index();                     //////  Remember current slide
                self.fullscreen = new FullscreenViewer(self.config);                        //////  Sets current slide to 0 in desktop viewer
                self.fullscreen.ui.controllers.navController.select(currentSlideIndex);     //////  Restore current slide
            } else {
                if (self.fullscreen.$currentSlide) {
                    var indexOfBaseView = self.fullscreen.$currentSlide.index();
                    var indexOfFullView = self.$currentSlide.index();

                    if (indexOfBaseView !== indexOfFullView) {
                        self.fullscreen._updateViewer(self.setData);
                    }
                }

            }
            if (self.setData.name !== self.fullscreen.setData.name) {
                self.fullscreen._updateViewer(self.setData);
            }
            self.ui.controllers.videoController.pause();
            self.fullscreen.open();
            self.fullscreen.ui.controllers.zoomController.reset(self.fullscreen.ui.currentSlide());
        },
        closeFullscreenViewer: function () {
            self.fullscreen.close();
        }
    });
    roundels.render(self.ui.$roundels, self.roundels);
};

module.exports = DesktopViewer;
