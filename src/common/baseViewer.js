require('./hbsHelpers');
var $ = require('./jquery');
var amp = require('./namespace');
var templates = require('../templates/templates.compiled');
var DiService = require('./diService');
var log = require('../utils/log');
var capabilityDetection = require('./capabilities');
var NavController = require('../common/navController');
var QuickLinksController = require('../common/quickLinksController');
var UiHintController = require('../common/uiHintController');
var BoxController = require('../common/boxController');
var VideoController = require('../common/videoController');

//TODO:Find a better way to prevent video widget calcing size
$.amp.ampVideo.prototype._calcSize = function () {
};

//Common functionality between viewers
var BaseViewer = function BaseViewer(config) {
    this.configParams = config;
    this.setData = null;
    this.template = templates['template-' + this.viewerType];
    this.templateNavItem = this.templateNavItem || templates['_template-nav-item'];
    this.templateMainItem = this.templateMainItem || templates['_template-main-item'];
    this.assetsPath = config.assetsPath;
    this.productName = config.productName;
    this.rangeName = config.rangeName;
    this.templates = this.templates || config.templates;
    // init timers from config for mobile information overlays. May be {Object} or {Boolean}false - if not specified
    this.uiHintTimers = config.uiHintTimers || false;

    this.ui = this.ui || {
        $el: $(config.target)
    };

    if (!this.ui.$el.length) {
        log.warn(this.viewerType + ' no target element defined.');
        return;
    }

    if (typeof this._beforeViewerCreated === 'function') {
        this._beforeViewerCreated();
    }

    this.ui.$el.empty();

    this.diService = new DiService({
        account: config.account,
        path: config.server,
        errImgName: config.errImgName,
        cacheBust: config.cacheBust,
        videoSortOrder: config.videoSortOrder
    });

    //no need to get set for child viewer, just pass through data
    if (this.parentViewer && this.parentViewer.setData) {
        this._createViewer(this.parentViewer.setData);
    } else {
        this._getSet(config.setName, this._createViewer);
    }
};

BaseViewer.prototype = {
    _getSet: function (setName, callback) {
        var self = this;
        if (!setName) {
            log.warn(this.viewerType + ' no setName defined.');
            return;
        }
        this.setName = setName;
        this.diService.getMediaSet(setName,
                function (setData) {
                    self._updateSetData(setData, callback);
                }, function (err) {
            log.warn(self.viewerType + ' error retrieving mediaSet \"' + setName + '\". ', err);
            err[setName].items = [
                {src: self.diService.errImgURL}
            ];
            callback.call(self, err[setName]);
        });
    },
    updateMediaSet: function (setName) {
        this._getSet(setName, this._updateViewer);
    },
    _createViewer: function (setData) {
        this.setData = setData;
        this._enrichWithTemplateData(setData);
        var $renderedDom = $(this.template(setData));

        this.ui.$el.html($renderedDom);

        this._cacheDom($renderedDom);
        this._initComponents(true);
        this._bindEvents();
        this.preventSwipe();

        //pause all amp-video we have access to
        this.ui.controllers.videoController.pauseAllVideo();
    },
    _updateViewer: function (setData) {
        this.setData = setData;
        var mainItems = '';
        var navItems = '';

        for (var i = 0, len = setData.items.length; i < len; i++) {
            var itemViewModel = {item: setData.items[i], templates: this.templates, productName: this.productName};
            mainItems += this.templateMainItem(itemViewModel);
            navItems += this.templateNavItem(itemViewModel);
        }

        //temporarily set height to parent container, which will be unset later
        this.ui.$main.closest('.amp-main-container').css({
            height: this.ui.$main.css('height'),
            overflow: 'hidden'
        });

        this._destroyComponents();
        this.ui.$main.html(mainItems);
        this.ui.$nav.html(navItems);
        this._initComponents();
        this._onMainSlideChange();
        this.ui.controllers.navController.reset();
        this.ui.controllers.quickLinksController.init();
        this.ui.controllers.boxController.reset();

        if (this.ui.controllers.uiHintController) {
            this.ui.controllers.uiHintController.init(this);
        }

        if (this.ui.controllers.zoomController) {
            this.ui.controllers.zoomController.reset();
        }

        //pause all amp-video we have access to
        this.ui.controllers.videoController.pauseAllVideo();

        //init sizes for all video
        this.ui.controllers.videoController._resizeAllVideo();

        this.preventSwipe();

        this.ui.$el.find('.amp-moz-invisible').removeClass('amp-moz-invisible');
    },
    _resizeBase: function () {
        if (typeof this._resize === 'function') {
            this._resize();
        }
        this.ui.controllers.videoController._debouncedResizeVideo();
    },
    _parentCurrentSlideSpinset: function () {
        var self = this;
        if (self.parentViewer && self.viewerType === 'fullscreen') {
            var $parentSlide = self.parentViewer.$currentSlide;
            if ($parentSlide.find('.amp-spinset').length > 0) {
                return true;
            }
        }
        return false;
    },
    _initComponents: function () {
        var self = this;
        self.ui.$main.find('[data-amp-src]').ampImage();

        //call viewer specific
        if (typeof this._initViewerComponents === 'function') {
            this._initViewerComponents();
        }

        var spinsetAutoplay = this._parentCurrentSlideSpinset() ? false : true;
        var preloadType = 'visible';
        var spinsetPreloadFirst = false;

        this.ui.$main.find('.amp-spinset').each(function () {
            if (self.ui.currentSlide().find('.amp-spinset').length > 0 && !spinsetPreloadFirst) {
                preloadType = 'created';
            } else {
                preloadType = 'visible';
            }

            spinsetPreloadFirst = true;

            $(this).ampSpin({
                'preload': preloadType,
                'gesture': {'enabled': true, 'fingers': 1},
                'play': {'onLoad': spinsetAutoplay, 'onVisible': false, 'repeat': 1},
                'change': function () {
                    var $currentSlide = self.ui.currentSlide();
                    if (self.ui.controllers.zoomController && $currentSlide.find('.amp-spinset').length > 0) {
                        self.ui.controllers.zoomController.reset($currentSlide);
                    }
                }
            });
        });

        this.ui.$main.find('.amp-box').ampStack();

        var reclinerPreloadFirst = false;

        this.ui.$main.find('.amp-recliner').each(function () {
            if (self.ui.currentSlide().find('.amp-recliner').length > 0 && !reclinerPreloadFirst) {
                preloadType = 'created';
            } else {
                preloadType = 'visible';
            }

            reclinerPreloadFirst = true;

            $(this).ampSpin({
                'preload': preloadType,
                'delay': 600,
                'momentum': false,
                'dragDistance': 600,
                'gesture': {'enabled': true, 'fingers': 1},
                'play': {'onLoad': spinsetAutoplay, 'onVisible': false, 'repeat': 1},
                'change': function () {
                    if (self.ui.controllers.zoomController) {
                        self.ui.controllers.zoomController.reset(self.ui.currentSlide());
                    }
                }
            });
        });

        this.ui.$main.find('[data-amp-src]').ampImage();

        this.ui.$main.find('.amp-video').ampVideo({
            'pauseOnHide': false,
            'responsive': false,
            'skin': 'amp-video-skin',
            'swfUrl': this.assetsPath,
            'loop': false,
            'enableSoftStates': false,
            'preload': self.configParams.preloadVideos
        });

        var videos = this.ui.$main.find('video');
        var arrVideos = videos.toArray();
        var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        var touchPlBtn = $('.amp-ui-touch').find('.vjs-big-play-button');

        if (!iOS) {
            touchPlBtn.css('display', 'none', 'important');
        }
        //removing poster attribute after first play
        //for fixing ipad bug
        if (!iOS) {
            touchPlBtn.css('display', 'none', 'important');
        }

        arrVideos.forEach(function (el) {
            $(el).on('play', function () {
                $(el).removeAttr('poster');
                $(el).off('play');
            });
        });
    },
    _updateSetData: function (setData, callback) {
        setData = setData[this.setName];
        var iterator = setData.items.length;

        while (iterator--) {
            var item = setData.items[iterator];
            if (this._isSpecialSet(item)) {
                if (item.set && item.set.items.length !== 2) {
                    item.recliner = true;
                } else {
                    item.box = true;
                }
            } else if (item.mimeType === 'text/html') {
                if (capabilityDetection.canWebGL()) {
                    item.content = true;
                } else {
                    setData.items.splice(iterator, 1);
                }
            } else if (item.media) {
                item.vidWidth = item.media[0].width;
                item.vidHeight = item.media[0].height;
            }
        }
        callback.call(this, setData);
    },
    _getNameFromUrl: function (src) {
        return src.substring(src.lastIndexOf('/') + 1, src.length);
    },
    _cacheDom: function ($renderedDom) {
        var self = this;
        $.extend(self.ui, {
            $main: $renderedDom.find('.amp-viewer-main'),
            $nav: $renderedDom.find('.amp-navigation-main'),
            controls: {
                $next: $renderedDom.find('.amp-nav-prev'),
                $prev: $renderedDom.find('.amp-nav-next')
            },
            quickLinks: {
                $spinsetLink: $renderedDom.find('.amp-quicklink-spinset'),
                $reclinerLink: $renderedDom.find('.amp-quicklink-recliner'),
                $boxLink: $renderedDom.find('.amp-quicklink-box'),
                $videoLink: $renderedDom.find('.amp-quicklink-video')
            },
            controllers: {
                navController: null,
                uiHintController: null
            },
            mainSelect: function (slideIndex) {
                self.ui.$main.ampCarousel('select', slideIndex);
            },
            getMainChildren: function () {
                return self.ui.$main.find('.amp-anim-container').children();
            },
            currentSlide: function () {
                return self.ui.$main.find('.amp-slide.amp-visible');
            }
        });

        //call viewer specific dom caching
        if (typeof this._cacheViewerDom === 'function') {
            this._cacheViewerDom($renderedDom);
        }
    },
    _bindEvents: function () {
        var self = this;

        this.ui.controllers.navController = new NavController(
                this.ui.$nav,
                this.ui.$main,
                this.ui.controls.$prev,
                this.ui.controls.$next,
                this.ui.mainSelect
                );

        setTimeout(function() {
            self.ui.$el.find('.amp-moz-invisible').removeClass('amp-moz-invisible');
        }, 250);

        this.ui.controllers.videoController = new VideoController(this.ui.$main, this.ui.currentSlide);

        this.ui.controllers.quickLinksController = new QuickLinksController(
                this.ui.controllers.navController,
                this.ui.controllers.zoomController,
                this.ui.controllers.videoController,
                this.ui.$main,
                this.ui.quickLinks,
                this.ui.currentSlide,
                this.ui.getMainChildren,
                this.ui.openFullscreenViewer
                );
        this.ui.controllers.uiHintController = new UiHintController(
                {
                    // pass timers for mobile information overlays. May be {Object} or {Boolean}false if timers are not set
                    uiHintTimers: self.uiHintTimers
                }
        );

        /* init uiHintController */
        this.ui.controllers.uiHintController.init(self);

        this.ui.controllers.boxController = new BoxController(
                this.ui.$main, this.ui.quickLinks.$boxLink,
                this.ui.controllers.quickLinksController
                );

        //call viewer specific event binding
        if (typeof this._bindViewerEvents === 'function') {
            this._bindViewerEvents();
        }

        this._onMainSlideChange();
        amp.stats.bind([
            {'type': 'carousel', 'event': 'change', 'cb': this._onMainSlideChange.bind(this)}
        ]);

        amp.stats.bind([
            {
                'type': 'carousel', 'event': 'created', 'cb': function () {
                    // Had to set a timeout here because the callback doesn't calculate the height of the the ui.$main properly
                    // which I think is an SDK bug and could probably be fixed later
                    setTimeout(function () {
                        self.ui.controllers.videoController._resizeAllVideo();
                        self.ui.$main.css({
                            visibility: 'visible'
                        });

                        self.ui.$main.closest('.amp-main-container').css({
                            height: '',
                            overflow: ''
                        });

                    }, 100);

                }
            }
        ]);
    },
    _enrichWithTemplateData: function (setData) {
        setData.productName = this.productName;
        setData.rangeName = this.rangeName;
        setData.templates = this.templates;
        setData.assetsPath = this.assetsPath;

        if (capabilityDetection.commonMobileDevice() || capabilityDetection.touch()) {
            setData.touch = 'amp-ui-touch';
        } else {
            setData.touch = 'amp-ui-no-touch';
        }
    },
    _isSpecialSet: function (item) {
        if (item.setType === 'spin' && /(.)*_oc[0-4]/.test(item.name)) {
            return true;
        }
        return false;
    },
    _destroyComponents: function () {
        if (this.ui.$main.data('amp-ampCarousel')) {
            this.ui.$main.css({
                visibility: 'hidden'
            });
            this.ui.$main.ampCarousel('destroy');
        }

        if (this.ui.$main.data('amp-ampStack')) {
            this.ui.$main.ampStack('destroy');
        }

        this.ui.$nav.ampCarousel('destroy');

        if (this.ui.$main.find('.amp-spinset').data('amp-ampSpin')) {
            this.ui.$main.find('.amp-spinset').ampSpin('destroy');
        }
        if (this.ui.$main.find('.amp-recliner').data('amp-ampSpin')) {
            this.ui.$main.find('.amp-recliner').ampSpin('destroy');
        }
        this.ui.$main.find('[data-amp-src]').ampImage('destroy');
        //TODO: update SDK video destroy methods so it cleans up window resize listeners
        //brute forcing no further action on window resize for now
        if (this.ui.$main.find('.amp-video').data('amp-ampVideo')) {
            this.ui.$main.find('.amp-video').data('amp-ampVideo')._calcSize = function () {
            };
            this.ui.$main.find('.amp-video').ampVideo('destroy');
        }
        //call viewer specific destroy
        if (typeof this._destroyViewerComponents === 'function') {
            this._destroyViewerComponents();
        }
    },
    _onMainSlideChange: function ($el) {
        if ($el && !$el.is(this.ui.$main)) {
            return;
        }

        var self = this;
        var $spin = null;
        var spinData = null;
        var $webgl = null;
        var $video = null;
        var hasOldSlide = false;

        self.$oldSlide = self.$currentSlide;
        self.$currentSlide = self.ui.currentSlide();

        hasOldSlide = self.$oldSlide && self.$oldSlide.length;

        $spin = self.$currentSlide.find('.amp-spin');
        spinData = $spin.data('amp-ampSpin');
        if (spinData && !spinData._loading) {
            $spin.ampSpin('playRepeat', 1);
        }

        //lazy loading webgl assets
        $webgl = self.$currentSlide.find('.amp-webgl');
        if ($webgl.length && !$webgl.html()) {
            $webgl.html($webgl.attr('data-amp-webgl'));
        } else if (hasOldSlide) {
            //remove any loaded webgl iframe when not visible because it is too resource hungry
            $webgl = self.$oldSlide.find('.amp-webgl');
            if ($webgl.length) {
                $webgl.html('');
            }
        }

        //manually adding pause on hide functionality
        if (hasOldSlide) {
            $video = self.$oldSlide.find('.amp-video');
            if ($video.length && $video.data('ampAmpVideo')) {
                $video.ampVideo('pause');
            }
        }

        // Synchronize the selected slide in the nav - change may have originated from main carousel
        var slideIndex = self.$currentSlide.index();
        var $nav = self.ui.$nav;
        var $selectedNavSlide = $nav.find('.amp-slide.amp-selected');
        if ($selectedNavSlide.index() !== slideIndex) {
            // only change nav if the selected slide is different to avoid looping
            //var thumbSlideToSelect = self.ui.$nav.find('.amp-slide')[slideIndex];
            //self.ui.controllers.navController.select(thumbSlideToSelect);
            self.ui.controllers.navController.select(slideIndex);
        }

        if (self.ui.controllers.zoomController) {
            self.ui.controllers.zoomController.reset(self.$oldSlide);
        }

        self.ui.controllers.quickLinksController.reset(self.$oldSlide);
        // reset any UI Hints for this slide

        self.ui.controllers.uiHintController.update();

        if (self.parentViewer) {
            if (self.parentViewer.ui.currentSlide().index() !== slideIndex) {
                self.parentViewer.ui.controllers.navController.select(slideIndex);
            }
        }
        if (self.fullscreen) {
            if (self.fullscreen.ui.currentSlide().index() !== slideIndex) {
                self.fullscreen.ui.controllers.navController.select(slideIndex);
            }
        }
        self.ui.controllers.videoController._resizeCurrentVideo();
    },
    preventSwipe: function () {
        //prevent swipe on area which responsible to use 'back' gestures

        if ($('.amp-main-container').children('.amp-carousel').children('div').length <= 1) {
            (function preventSwipeDublicate() {
                var sel = $('.amp-main-container').children('.amp-carousel');
                var overlayEl = $('<div id="overlaySwipe"/>');
                sel.append(overlayEl);

                $('#overlaySwipe').on('touchstart mousedown', function (e) {
                    // Prevent carousel swipe
                    e.stopPropagation();
                });

            })();
        }
    },
    disableTouchScroll: function () {
        $(document).on('touchmove.disableTouchScroll', function (evt) {
            evt.preventDefault();
        });
    },
    enableTouchScroll: function () {
        $(document).off('touchmove.disableTouchScroll');
    },
    disableCssScroll: function () {
        $('body, html').addClass('amp-overflow-hidden');
    },
    enableCssScroll: function () {
        $('body, html').removeClass('amp-overflow-hidden');
    }
};

module.exports = BaseViewer;
