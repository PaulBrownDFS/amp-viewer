var $ = require('../common/jquery');
var BaseViewer = require('../common/baseViewer');
var ZoomController = require('../common/zoomController');
var capabilityDetection = require('../common/capabilities');

var QuickViewer = function QuickViewer(config) {
    this.viewerType = 'quickview';
    this.templates = config.templates.quickView;
    return BaseViewer.apply(this, arguments);
};

QuickViewer.prototype = Object.create(BaseViewer.prototype);

QuickViewer.prototype._resize = function () {
    this.ui.controllers.zoomController.zoomOutFull(true);
    if (!this._resizeNavThumbsFunction) {
        this._resizeNavThumbsFunction = this.ui.controllers.navController._resizeNavThumbsOverflow();
    }

    this._resizeNavThumbsFunction();
};

QuickViewer.prototype._bindViewerEvents = function () {
    var self = this;

    this.ui.controls.$close.on('click', function () {
        self.ui.controllers.videoController.pause();
        self._destroyComponents();
        $(window).off('resize.amp.quickview.resize');
    });

    this.ui.controllers.zoomController = new ZoomController(
            this.ui.controls.$zoomIn,
            this.ui.controls.$zoomOut,
            this.ui.currentSlide
            );
};

QuickViewer.prototype._beforeViewerCreated = function () {

};

QuickViewer.prototype._initViewerComponents = function () {

    var mainCarouselOptions = {
        'preloadNext': false,
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

    this.ui.$nav.ampCarousel({
        'onActivate': {'select': false, 'goTo': false},
        'preloadNext': false,
        'dir': 'horz',
        'loop': false,
        'height': 46,
        'width': 380,
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

    $(window).on('resize.amp.quickview.resize', this._resizeBase.bind(this));
};

QuickViewer.prototype._destroyViewerComponents = function () {
    this.ui.$main.find('.amp-zoomable').ampZoomInline('destroy');
    this.$currentSlide = void 0;
};

QuickViewer.prototype._cacheViewerDom = function ($renderedDom) {
    $.extend(true, this.ui, {
        controls: {
            $close: $renderedDom.find('.amp-close'),
            $zoomIn: $renderedDom.find('.amp-zoom-in'),
            $zoomOut: $renderedDom.find('.amp-zoom-out')
        }
    });
};

module.exports = QuickViewer;
