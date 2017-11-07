var $ = require('../common/jquery');
var amp = require('../common/namespace');
var ZoomController = require('../common/zoomController');
var BaseViewer = require('../common/baseViewer');

var FullscreenViewer = function FullscreenViewer(config) {
    this.viewerType = 'fullscreen';
    this.parentViewer = config.parentViewer;
    //changing fullscreen wrapper so client doesn't need to add a div first
    this.ui = {
        $el: $('.amp-fullscreen-wrapper')
    };

    if (!this.ui.$el.length) {
        this.ui.$el = $('<div class="amp-fullscreen-wrapper" style="display:none"></div>');
        $('body').append(this.ui.$el);
    }

    this.templates = config.templates.fullScreen;
    return BaseViewer.apply(this, arguments);
};

FullscreenViewer.prototype = Object.create(BaseViewer.prototype);

FullscreenViewer.prototype._bindViewerEvents = function () {
    this.ui.controls.$close.on('click', this.close.bind(this));
    this.ui.controllers.zoomController = new ZoomController(
        this.ui.controls.$zoomIn,
        this.ui.controls.$zoomOut,
        this.ui.currentSlide
    );
    amp.stats.bind([
        {'type': 'stack', 'event': 'change', 'cb': this._onMainSlideChange.bind(this)}
    ]);
};

FullscreenViewer.prototype._beforeViewerCreated = function () {
    this.disableTouchScroll();
    this.disableCssScroll();
};

FullscreenViewer.prototype._initViewerComponents = function () {
    this.ui.$main.ampStack({
        'loop': false,
        'gesture': {'enabled': true, 'fingers': 1}
    });

    this.ui.$main.ampStack('visible', true);

    this.ui.$nav.ampCarousel({
        'onActivate': {'select': false, 'goTo': false},
        'preloadNext': false,
        'dir': 'horz',
        'loop': false,
        'height': 55,
        'width': 450,
        'responsive': false,
        'easing': 'ease-in-out',
        'animDuration': 600
    });

    this.ui.$main.find('.amp-zoomable').ampZoomInline({
        'scaleSteps': true,
        'events': {'zoomIn': 'none', 'zoomOut': 'none', 'move': 'none'},
        'pan': true,
        'pinch': true,
        'transforms': this.templates.imageZoom
    });

};

FullscreenViewer.prototype._destroyViewerComponents = function () {
    this.ui.$main.find('.amp-zoomable').ampZoomInline('destroy');
    this.$currentSlide = void 0;
};

FullscreenViewer.prototype._cacheViewerDom = function ($renderedDom) {
    var self = this;
    $.extend(true, this.ui, {
        controls: {
            $close: $renderedDom.find('.amp-close'),
            $zoomIn: $renderedDom.find('.amp-zoom-in'),
            $zoomOut: $renderedDom.find('.amp-zoom-out')
        },
        getMainChildren: function () {
            return self.ui.$main.children();
        },
        mainSelect: function (slideIndex) {
            self.ui.$main.ampStack('goTo', slideIndex);
        },
        currentSlide: function () {
            return self.ui.$main.children('.amp-layer.amp-selected');
        }
    });
};

FullscreenViewer.prototype._resize = function () {
    this.ui.controllers.zoomController.zoomOutFull(true);
    this._maintainAspectRatio();
};

FullscreenViewer.prototype._maintainAspectRatio = function () {
    var cw = this.ui.$main.width();
    var ch = this.ui.$main.height();
    var oas = 600 / 318;
    var cas = cw / ch;
    if (cas >= oas) {
        this.ui.$main.find('[data-amp-src]').css({'height': '100%', 'width': 'auto'});
    } else {
        this.ui.$main.find('[data-amp-src]').css({'width': '100%', 'height': 'auto'});
    }
};

FullscreenViewer.prototype.open = function () {
    this.disableTouchScroll();
    this.disableCssScroll();
    this.ui.$el.css({display: 'block'});
    this._maintainAspectRatio();
    this.ui.controllers.videoController._resizeCurrentVideo();
    $(window).on('resize.amp.fullscreen.resize', this._resizeBase.bind(this));
};

FullscreenViewer.prototype.close = function () {
    this.enableTouchScroll();
    this.enableCssScroll();
    this.ui.controllers.videoController.pause();
    this.ui.controllers.zoomController.reset(this.ui.currentSlide());
    $(window).off('resize.amp.fullscreen.resize');
    this.ui.$el.css({display: 'none'});
    this.ui.controllers.videoController._resizeCurrentVideo();
};

module.exports = FullscreenViewer;
