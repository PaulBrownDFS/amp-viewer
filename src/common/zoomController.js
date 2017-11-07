/*jshint browserify: true */
var amp = require('../common/namespace');
var $ = require('./jquery');

var ZoomController = function ($zoomIn, $zoomOut, currentSlide) {
    this.ui = {
        $zoomIn: $zoomIn,
        $zoomOut: $zoomOut,
        currentSlide: currentSlide
    };

    this._bindEvents();
};

ZoomController.prototype = {
    $cachedCurrentSlide: null,
    _bindEvents: function () {
        var self = this;

        self.ui.$zoomIn.click(self.zoomIn.bind(self));
        self.ui.$zoomOut.click(self.zoomOut.bind(self));

        amp.stats.bind({
            'type': 'zoom', 'event': 'zoomedIn', 'cb': function (a, b, c, zoomInfo) {
                self._invalidateZoomButtons(zoomInfo);
            }
        });

        amp.stats.bind({
            'type': 'zoom', 'event': 'zoomedOut', 'cb': function (a, b, c, zoomInfo) {
                self._invalidateZoomButtons(zoomInfo);
            }
        });
    },
    _slideToggleZoomedClass: function (opts) {
        var self = this;
        var className = opts.class || 'amp-zoomed-in';
        self.$cachedCurrentSlide[opts.action + 'Class'](className);
    },
    _invalidateZoomButtons: function (zoomInfo) {
        var $zoom = this.currentZoom();
        if (!$zoom.length) {
            this.ui.$zoomIn.css('visibility', 'hidden');
            this.ui.$zoomOut.css('visibility', 'hidden');
            return;
        } else {
            this.ui.$zoomIn.css('visibility', 'visible');
            this.ui.$zoomOut.css('visibility', 'visible');
            if (!zoomInfo) {
                zoomInfo = $zoom.ampZoomInline('state');
            }
        }

        if (zoomInfo.scale === zoomInfo.scaleMax) {
            this.ui.$zoomIn.addClass('disabled');
            this.ui.$zoomOut.removeClass('disabled');

            this._slideToggleZoomedClass({
                action: 'add'
            });

        } else {
            this.ui.$zoomIn.removeClass('disabled');
            this.ui.$zoomOut.removeClass('disabled');

            this._slideToggleZoomedClass({
                action: 'add'
            });
        }

        if (zoomInfo.scale === 1) {
            this.ui.$zoomIn.removeClass('disabled');
            this.ui.$zoomOut.addClass('disabled');

            this._slideToggleZoomedClass({
                    action: 'remove'
                });
        }
    },
    currentZoom: function (slide) {
        var $slide = slide || this.ui.currentSlide();
        this.$cachedCurrentSlide = $slide;
        var $zoom;

        if ($slide.find('.amp-spinset').length) {
            $zoom = $slide.find('.amp-selected .amp-zoomable');
        } else {
            $zoom = $slide.find('.amp-zoomable');
        }
        return $zoom;
    },
    zoomAuto: function () {
        var $zoom = this.currentZoom();

        if ($zoom.length) {
            var zoomState = $zoom.ampZoomInline('state');
            if (zoomState.scale >= zoomState.scaleMax) {
                $zoom.ampZoomInline('zoomOutFull');
            } else {
                $zoom.ampZoomInline('zoomIn');
            }
        }
    },
    reset: function (oldSlide) {
        if (oldSlide && oldSlide.length) {
            var $zoom = this.currentZoom(oldSlide);
            $zoom.ampZoomInline('zoomOutFull');

            if (oldSlide.find('.amp-spinset').length) {
                var $allZooms = oldSlide.find('.amp-zoomable');
                var index = $allZooms.index($zoom);
                var indexPrev = (index > 0) ? (index - 1) : ($allZooms.length - 1);
                var indexNext = (index < $allZooms.length - 1) ? (index + 1) : (0);
                $($allZooms[indexPrev]).ampZoomInline('zoomOutFull');
                $($allZooms[indexNext]).ampZoomInline('zoomOutFull');
            }
        }

        this._invalidateZoomButtons();
    },
    zoomOutFull: function (ignoreInZoomCheck) {
        var $currentZoom = this.currentZoom();

        if ($currentZoom.length) {
            var $zoomContainer = $currentZoom.parent().children('.amp-zoomed-container');
            var inZoom = $zoomContainer.length && $zoomContainer.css('display') !== 'none';

            if (inZoom || ignoreInZoomCheck) {
                $zoomContainer.css('display', 'none');
                $currentZoom.ampZoomInline('zoomOutFull');
                this._invalidateZoomButtons();
            }
        }
    },
    zoomIn: function () {
        var $zoom = this.currentZoom();
        $zoom.ampZoomInline('zoomIn');
    },
    zoomOut: function () {
        var $zoom = this.currentZoom();
        $zoom.ampZoomInline('zoomOut');
    }
};

module.exports = ZoomController;
