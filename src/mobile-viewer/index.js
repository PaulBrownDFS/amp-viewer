var templates = require('../templates/templates.compiled');
var $ = require('../common/jquery');
var BaseViewer = require('../common/baseViewer');
var ZoomController = require('../common/zoomController');

var MobileViewer = function MobileViewer(config) {
    this.viewerType = 'mobile';
    this.templates = config.templates.mobileView;
    this.templateNavItem = templates['_template-nav-item-alt'];
    return BaseViewer.apply(this, arguments);
};

MobileViewer.prototype = Object.create(BaseViewer.prototype);

MobileViewer.prototype._resize = function () {
    this.ui.controllers.zoomController.zoomOutFull(true);
};

MobileViewer.prototype._bindViewerEvents = function () {
    var self = this;

    self.ui.controllers.zoomController = new ZoomController(
        self.ui.controls.$zoomIn,
        self.ui.controls.$zoomOut,
        self.ui.currentSlide
    );
};

MobileViewer.prototype._initViewerComponents = function () {
    this.ui.$main.ampCarousel({
        'width': 600,
        'height': 318,
        'onActivate': {'goTo': false, 'select': false},
        'loop': false,
        'animate': true,
        'gesture': {'enabled': true, 'fingers': 1}
    });

    this.ui.$nav.ampCarousel({
        'onActivate': {'select': false, 'goTo': false},
        'preloadNext': false,
        'dir': 'horz',
        'loop': false,
        'height': 16,
        'responsive': false,
        'width': 104
    });

    this.ui.$main.find('.amp-zoomable').ampZoomInline({
        'scaleSteps': true,
        'events': {'zoomIn': 'none', 'zoomOut': 'none', 'move': 'none'},
        'pan': true,
        'pinch': true,
        'transforms': this.templates.imageZoom
    });

    $(window).on('resize.amp.mobile.resize', this._resizeBase.bind(this));
};

MobileViewer.prototype._destroyViewerComponents = function () {
    this.ui.$main.find('.amp-zoomable').ampZoomInline('destroy');
    this.$currentSlide = void 0;

    $(window).off('resize.amp.mobile.resize');
};

MobileViewer.prototype._cacheViewerDom = function ($renderedDom) {
    $.extend(true, this.ui, {
        controls: {
            $zoomIn: $renderedDom.find('.amp-zoom-in'),
            $zoomOut: $renderedDom.find('.amp-zoom-out')
        }
    });

};
module.exports = MobileViewer;
