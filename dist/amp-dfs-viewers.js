(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
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

},{"../common/boxController":2,"../common/navController":8,"../common/quickLinksController":9,"../common/uiHintController":11,"../common/videoController":12,"../templates/templates.compiled":19,"../utils/log":20,"./capabilities":3,"./diService":4,"./hbsHelpers":5,"./jquery":6,"./namespace":7}],2:[function(require,module,exports){
"use strict";
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

},{"./jquery":6}],3:[function(require,module,exports){
"use strict";
var canvas = document.createElement('canvas');
var capabilities = {
    commonMobileDevice: function () {
        // this is not conclusive, but serves rather to pick up most emulator's userAgent strings.
        // To be used in conjunction with touch detection (via OR)
        var commonDeviceRegEx = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

        return !!commonDeviceRegEx.test(navigator.userAgent.toLowerCase());
    },

    touch: function () {
        return 'ontouchstart' in window;
    },

    canWebGL: function () {
        try {
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') ||
                canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    },
    //TODO: Get rid of ASAP :(
    getIsIE: function () {
        var isIE = false;
        if (navigator.userAgent.indexOf('MSIE') !== -1 || navigator.appVersion.indexOf('Trident/') > 0) {
            isIE = true;
        }
        return isIE;
    }
};

module.exports = capabilities;

},{}],4:[function(require,module,exports){
"use strict";
/*jshint browserify: true */
var log = require('../utils/log');
var $ = require('../common/jquery');
var amp = require('../utils/namespace');

var defaultErrorSet = function () {
    return [{src:this.diService.errImgURL}];
};

var DiService = function (options) {
    if (this._validOptions(options)) {
        this.options = $.extend({}, options);

        var path = this.options.path;

        if (path.substring(path.length - 1) !== '/') {
            this.options.path = this.options.path + '/';
        }

        try {
            var initOptions = {
                'client_id': this.options.account,
                'cache_window':1,
                'di_basepath': this.options.path
            };

            if (options.cacheBust) {
                initOptions['cache_window'] = this.options.cacheBust;
            }

            amp.init(initOptions);
            this.errImgURL = amp.getAssetURL({type:'i', name:this.options.errImgName});
        } catch (e) {
            log.warn('failed to initialize Amplience DI API', e);
        }

    }
};

DiService.prototype = {
    _validOptions: function (options) {
        if (!options.account) {
            log.warn('[DiService] `account` required to initialize API');
            return false;
        }

        if (!options.path) {
            log.warn('[DiService] `path` required to initialize API');
            return false;
        }

        if (!options.path) {
            log.warn('[DiService] `contentPath` required to initialize API');
            return false;
        }

        return true;
    },

    getMediaSet: function (setName, success, error) {
        amp.get({
            name: setName,
            type: 's'
        }, success, error ? error : defaultErrorSet, this.options.videoSortOrder);
    }
};

module.exports = DiService;


},{"../common/jquery":6,"../utils/log":20,"../utils/namespace":21}],5:[function(require,module,exports){
"use strict";
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

},{"../utils/log":20}],6:[function(require,module,exports){
"use strict";
var $ = window.$;

module.exports = $;

},{}],7:[function(require,module,exports){
"use strict";
var amp = window.amp;

module.exports = amp;

},{}],8:[function(require,module,exports){
"use strict";
/*jshint browserify: true */
var $ = require('./jquery');

var NavController = function ($nav, $main, $next, $prev, mainSelect) {
    this.ui = {
        $nav: $nav,
        $main: $main,
        $next: $next,
        $prev: $prev,
        //mainSelect will call either stack select or carousel select depending on viewer
        mainSelect: mainSelect
    };

    this.updateNavUI();
    this._bindEvents();
};

NavController.prototype = {
    _bindEvents: function () {
        var self = this;

        self.ui.$nav.on('click', '.amp-slide', function () {
            self.select($(this).index());
        });

        self.ui.$prev.click($.proxy(self.prev, self));
        self.ui.$next.click($.proxy(self.next, self));
    },
    _positionVisibleThumbs: function (opts) {
        /*
         * If thumbs number is less then minimum (now it is 4),
         * then assign width to '.amp-navigation-container', so it could be centered
         * @param {Object} opts.$thumbs - All thumbs tags
         **/
        var $thumbs = opts.$thumbs;
        var thumbsLength = $thumbs.length;
        var $thumbsContainer = this.ui.$nav.find('.amp-navigation-container');
        if ($thumbs.filter('.amp-partially-visible').length > 0) {
            $thumbsContainer.css({width: ''});
            return false;
        }

        var calculatedWidth = ($thumbs.slice(0, 1).outerWidth(true) * thumbsLength) +
            (this.ui.$next.outerWidth(true) + this.ui.$prev.outerWidth(true));
        $thumbsContainer.css({
            width: calculatedWidth + 'px'
        });
    },
    _resizeNavThumbsOverflow: function () {

        var self = this;
        var $thumbs = self.ui.$nav.find('.amp-slide');
        self.resizeNavtimeout = null;
        var resizeCallback = function () {
            if (self.resizeNavtimeout) {
                clearTimeout(this.timeout);
            }
            $thumbs.addClass('amp-overflow-hidden');

            self.resizeNavtimeout = setTimeout(function () {
                $thumbs = self.ui.$nav.find('.amp-slide');
                $thumbs.removeClass('amp-overflow-hidden');
            }, 250);
        };
        return resizeCallback;
    },
    updateNavUI: function () {
        var $thumbs = this.visibleThumbs();

        if (this.visibleThumbs().length === this.numberOfThumbs()) {
            this.ui.$next.css('visibility', 'hidden');
            this.ui.$prev.css('visibility', 'hidden');
            this._positionVisibleThumbs({
                $thumbs: $thumbs
            });
            return false;
        }
        if (!this.canNext()) {
            this.ui.$next.css('visibility', 'hidden');
        } else if (this.visibleThumbs().length !== this.numberOfThumbs()) {
            this.ui.$next.css('visibility', 'visible');
        }

        if (!this.canPrev()) {
            this.ui.$prev.css('visibility', 'hidden');
        } else if (this.visibleThumbs().length !== this.numberOfThumbs()) {
            this.ui.$prev.css('visibility', 'visible');
        }

        this._positionVisibleThumbs({
            $thumbs: $thumbs
        });
    },
    canNext: function () {
        return this.currentIndex() < this.numberOfThumbs() - 1;
    },
    canPrev: function () {
        return this.currentIndex() > 0;
    },
    currentIndex: function () {
        return this.ui.$nav.find('.amp-slide.amp-selected').index();
    },
    visibleThumbs: function () {
        return this.ui.$nav.find('.amp-slide.amp-visible');
    },
    totalThumbsArr: function () {
        var arr = [];
        for (var i = 1; i < this.numberOfThumbs() + 1; i++) {
            arr.push(i);
        }
        return arr;
    },
    getVisibleArr: function () {
        var rootNavEl = this.ui.$nav.find('.amp-anim-container');
        var assets = Array.prototype.slice.call(rootNavEl[0].children);
        var result = [];
        assets.forEach(function (el, index) {
            if ($(el).hasClass('amp-visible')) {
                result.push(index + 1);
            }
        });
        return result;
    },
    currentThumbArr: function (index) {
        var total = this.totalThumbsArr();
        var visibleAssets = this.getVisibleArr();

        var answer = {};

        var centralEl = Math.floor(visibleAssets.length / 2);
        var direction = visibleAssets[centralEl] - index;

        if (direction < 0 && index !== total[total.length - 1]) {
            answer.next = Math.abs(direction);
        } else if (direction > 0 && index !== total[0]) {
            answer.prev = Math.abs(direction);
        } else {
            answer.next = 0;
            answer.prev = 0;
        }
        return answer;
    },
    numberOfThumbs: function () {
        return this.ui.$nav.find('.amp-slide').length;
    },
    next: function () {
        var currIndex = this.currentIndex() + 1;

        if (currIndex < this.numberOfThumbs()) {
            if (!this.currentThumbArr(currIndex + 1).next) {
                this.ui.$nav.ampCarousel('select', ++currIndex);
            } else {
                this.ui.$nav.ampCarousel('next');
                this.ui.$nav.ampCarousel('select', ++currIndex);
            }
        }

        this.ui.mainSelect(currIndex);
        this.updateNavUI();
    },
    prev: function () {
        var currIndex = this.currentIndex();

        if (currIndex > 0) {
            // select starts at 1 so this will select previous
            this.ui.$nav.ampCarousel('select', currIndex);
        }

        if (this.currentThumbArr(currIndex).prev) {
            this.ui.$nav.ampCarousel('prev');
        }

        this.ui.mainSelect(currIndex);
        this.updateNavUI();
    },
    select: function (elIndex) {
        var index = elIndex + 1;
        var central = Math.floor(this.visibleThumbs().length / 2);
        var arr = this.getVisibleArr();
        var diff = index - arr[arr.length - 1];

        //construction to fix IE9 unnatural transition animation
        if (this.currentIndex() + 1 - index < 0 && index > arr[arr.length - 1]) {
            if (diff <= central) {
                for (var count = diff; count > 0; count--) {
                    this.ui.$nav.ampCarousel('next');
                }
            } else {
                this.ui.$nav.ampCarousel('select', index - 1);
            }
        }

        this.ui.$nav.ampCarousel('select', index);
        var currIndex = this.currentIndex();
        var answer = this.currentThumbArr(currIndex + 1);

        if (answer.next) {
            for (var i = answer.next; i > 0; i--) {
                this.ui.$nav.ampCarousel('next');
            }
        } else if (answer.prev) {
            for (var j = answer.prev; j > 0; j--) {
                this.ui.$nav.ampCarousel('prev');
            }
        }

        this.ui.mainSelect(index);
        this.updateNavUI();
    },
    reset: function () {
        this.updateNavUI();
    }
};

module.exports = NavController;

},{"./jquery":6}],9:[function(require,module,exports){
"use strict";
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

},{"./namespace":7}],10:[function(require,module,exports){
"use strict";
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

},{"../templates/templates.compiled":19,"../utils/log":20}],11:[function(require,module,exports){
"use strict";
/*jshint browserify: true */
var $ = require('./jquery');

var UiHintController = function (configObject) {
    this.config = configObject || {};
};

UiHintController.prototype = {
    _overlayTimeouts: {
        //store hide timeout with initial false

    },
    hideMobileOverlayTimeout: function (opts) {
        var self = this;
        var $overlay = opts.$overlay;

        if (self._overlayTimeouts[self._baseViewer.viewerType]) {
            clearTimeout(self._overlayTimeouts[self._baseViewer.viewerType]);
        }

        self.showMobileOverlay($overlay);

        self._overlayTimeouts[self._baseViewer.viewerType] = setTimeout(function () {
            self.hideMobileOverlay($overlay);
        }, self.config.uiHintTimers.displayTimer);
    },
    _createUi: function () {
        // set ui
        var self = this;

        this.ui = {
            $viewer: self._baseViewer.ui.$el.find('.amp-viewer'),
            $main: self._baseViewer.ui.$main,
            uiHints: {
                $clickTraps: self._baseViewer.ui.$el.find('.amp-cover-box.amp-double-tap-prompt'),
                $exitHints: self._baseViewer.ui.$el.find('.amp-cover-box.amp-exit-prompt')
            },
            currentSlide: self._baseViewer.ui.currentSlide
        };
    },
    showMobileOverlay: function ($overlay, callback) {
        var self = this;
        $overlay
                .css('display', 'block')
                .removeClass('hidden');
        $overlay.animate({
            opacity: 1
        }, self.config.uiHintTimers.transitionTimer, function () {
            if (callback) {
                callback.call(self);
            }
        });
    },
    hideMobileOverlay: function ($overlay, callback) {
        var self = this;
        $overlay.animate({
            opacity: 0
        }, self.config.uiHintTimers.transitionTimer, function () {
            $overlay
                    .css('display', 'none')
                    .addClass('hidden');

            if (callback) {
                callback.call(self);
            }
        });
    },
    _doubleTapBehavior: function (opts) {
        var self = this;
        var ts = opts.e.timeStamp;
        var oldTime = opts.$tag.data('ampTouchTimestamp');
        if (oldTime) {
            if (ts - oldTime < 250) {
                opts.e.preventDefault();
                opts.callback.call(self, opts.$tag);
            }
        }
        opts.$tag.data('ampTouchTimestamp', ts);
    },
    _eventHelpers: {
        showSpinModeClickTrap: function ($target) {
            var self = this;
            if (self.ui.$viewer.hasClass('amp-ui-touch')) {
                var $clickTrap = $target.parent().find('.amp-cover-box.amp-double-tap-prompt');
                self.showMobileOverlay($clickTrap);
                self.hideMobileOverlayTimeout({
                    $overlay: $clickTrap.find('.amp-message')
                });
            }
        },
        showExitSpinModeHint: function ($target) {
            var self = this;
            var $exitHint = $target.parent().find('.amp-exit-prompt');
            self.showMobileOverlay($exitHint);
            self.hideMobileOverlayTimeout({
                $overlay: $exitHint
            });
        }
    },
    _bindEvents: function () {
        var self = this;
        var $uiHints = self.ui.$main.find('.amp-ui-hint');

        // provide touch friendly double tap to exit spin mode
        $uiHints.on('touchstart', function (e) {
            var $this = $(this);
            self._doubleTapBehavior({
                e: e,
                $tag: $this,
                callback: function ($tag) {
                    self._eventHelpers.showSpinModeClickTrap.call(self, $tag);
                }
            });
        });

        self.ui.uiHints.$exitHints.on('touchstart', function (e) {

            var $this = $(this);
            self.hideMobileOverlay($this, function () {
                self._doubleTapBehavior({
                    e: e,
                    $tag: $this,
                    callback: function ($tag) {
                        self._eventHelpers.showSpinModeClickTrap.call(self, $tag);
                    }
                });
            });

            // access private method on spin widget to start the drag
            // behind the prompt's click trap layer
            $this.parent().find('ul').data()['ampAmpSpin']._startDrag(e);
        });

        // provide touch friendly double tap to enter spin mode
        self.ui.uiHints.$clickTraps.on('touchstart', function (e) {
            var $this = $(this);
            self._doubleTapBehavior({
                e: e,
                $tag: $this,
                callback: function ($tag) {
                    self.hideMobileOverlay($tag, function () {
                        self._eventHelpers.showExitSpinModeHint.call(self, $tag);
                    });
                }
            });

        });

        // allow user to enter spin mode using double click if they are on
        // a mixed pointer input device
        self.ui.uiHints.$clickTraps.on('dblclick', function () {
            var $this = $(this);
            self.hideMobileOverlay($this, function () {
                self._eventHelpers.showExitSpinModeHint.call(self, $this);
            });
        });
    },
    update: function () {
        var $currentSlide = this.ui.currentSlide();
        var isHintSlide = $currentSlide.find('.amp-ui-hint').length;
        var self = this;

        if (isHintSlide && this.ui.$viewer.hasClass('amp-ui-touch')) {
            var $showOverlay = $currentSlide.find('.amp-cover-box.amp-double-tap-prompt');
            var $hideOverlay = $currentSlide.find('.amp-exit-prompt');
            // Show 'double tap' init overlay
            self.showMobileOverlay($showOverlay);

            //hide 'double tap' hider overlay
            self.hideMobileOverlay($hideOverlay);

            //hide 'double tap init' overlay after specified timeout
            self.hideMobileOverlayTimeout({
                $overlay: $showOverlay.find('.amp-message')
            });
        }
    },
    init: function (baseViewer) {
        var self = this;
        //cache baseViewer object
        self._baseViewer = baseViewer;
        //initAll
        this._createUi();
        this.update();
        this._bindEvents();
    }
};

module.exports = UiHintController;

},{"./jquery":6}],12:[function(require,module,exports){
"use strict";
/*jshint browserify: true */
var $ = require('./jquery');
var amp = require('../common/namespace');

var VideoController = function ($main, currentSlide) {
    this.timer = null;
    this.ui = {
        $main: $main,
        $currentPiPSlide: null,
        currentSlide: currentSlide
    };

    this._bindEvents();
};

VideoController.prototype = {
    _bindEvents: function () {
        var self = this;
        //had to set timeout here because it doesn't calculate 98 of main container properly,
        // as carousel was not fully loaded
        setTimeout(self._resizeAllVideo.bind(self), 100);
        amp.stats.bind({
            'type': 'video', 'event': 'fullScreenChange', 'cb': self._resizeVideo.bind(self)
        });

        //ios9 PiP pause video if not current video
        var $allVideo = self.ui.$main.find('.amp-video video');
        if ($allVideo && $allVideo.length) {
            if ($allVideo[0].webkitSupportsPresentationMode &&
                    typeof $allVideo[0].webkitSetPresentationMode === 'function') {
                $allVideo.each(function () {
                    $(this).bind('webkitpresentationmodechanged', (function ($video) {
                        return function () {
                            if ($video[0].webkitPresentationMode === 'picture-in-picture') {
                                self.ui.$currentPiPSlide = self.ui.currentSlide();
                            }
                            if ($video[0].webkitPresentationMode === 'inline') {
                                if (self.ui.$currentPiPSlide.index() !== self.ui.currentSlide().index()) {
                                    var $vidWidget = self.ui.$currentPiPSlide.find('.amp-video');
                                    if ($vidWidget.data('ampAmpVideo')) {
                                        $vidWidget.ampVideo('pause');
                                    }
                                }
                            }
                        };
                    })($(this)));
                });
            }
        }
    },
    play: function () {
        var $currentVideoSlide = this.ui.currentSlide().find('.amp-video');
        var VIDEO_PAUSED = 2;
        var VIDEO_STOPPED = 0;

        if ($currentVideoSlide.length) {
            var currentState = $currentVideoSlide.ampVideo('state');
            if (currentState === VIDEO_PAUSED || currentState === VIDEO_STOPPED) {
                $currentVideoSlide.ampVideo('play');
            } else {
                $currentVideoSlide
                        .ampVideo('pause');

                setTimeout(function () {
                    $currentVideoSlide
                            .ampVideo('seek', 0)
                            .ampVideo('play');
                }, 1);
            }
        }
    },
    pause: function () {
        var $currentSlide = this.ui.currentSlide();
        var $currentVideoSlide = $currentSlide.find('.amp-video');

        if ($currentVideoSlide.length) {
            $currentVideoSlide.ampVideo('pause');
        }
    },
    pauseAllVideo: function () {
        $('body').find('.amp-viewer .amp-video').each(function () {
            var $video = $(this);
            if ($video.data('amp-ampVideo') && $video.find('.vjs-playing').length > 0) {
                $video.ampVideo('pause');
            }
        });
    },
    _debouncedResizeVideo: function () {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.timer = setTimeout(this._resizeCurrentVideo.bind(this, arguments), 20);
    },
    _resizeAllVideo: function () {
        var self = this;
        this.ui.$main.find('.amp-video-holder').each(function () {
            var $videoHolder = $(this);
            var $ampVideo = $videoHolder.find('.amp-video');
            $ampVideo
                    .css({
                        visibility: 'hidden'
                    })
                    .removeClass('amp-hidden');
            self._resizeVideo($videoHolder);
            setTimeout(function () {
                $ampVideo.css({
                    visibility: 'visible'
                });
            }, 200);
        });
    },
    _resizeCurrentVideo: function () {
        var $currentSlide = this.ui.currentSlide();
        var $videoHolder = $currentSlide.find('.amp-video-holder');
        this._resizeVideo($videoHolder);
    },
    _resizeVideo: function ($videoHolder) {
        var $videoEl;
        var containerSize = {};
        var originalMediaSize = {};
        var aspectFit = {};

        if (!$videoHolder.length) {
            return;
        }

        $videoEl = $videoHolder.find('.video-js');

        originalMediaSize.width = $videoHolder.attr('data-amp-width');
        originalMediaSize.height = $videoHolder.attr('data-amp-height');
        containerSize.width = this.ui.$main.width();
        containerSize.height = this.ui.$main.height();

        originalMediaSize.aspectRatio = originalMediaSize.width / originalMediaSize.height;
        containerSize.aspectRatio = containerSize.width / containerSize.height;

        if (containerSize.aspectRatio >= originalMediaSize.aspectRatio) {
            aspectFit.height = containerSize.height;
            aspectFit.width = originalMediaSize.aspectRatio * containerSize.height;
        } else {
            aspectFit.height = (originalMediaSize.height / originalMediaSize.width) * containerSize.width;
            aspectFit.width = containerSize.width;
        }

        $videoHolder
                .find('.amp-video .video-js, video')
                .css({
                    'height': aspectFit.height,
                    'width': aspectFit.width
                });
    }
};

module.exports = VideoController;

},{"../common/namespace":7,"./jquery":6}],13:[function(require,module,exports){
"use strict";
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

},{"../common/namespace":7,"./jquery":6}],14:[function(require,module,exports){
"use strict";
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

},{"../common/baseViewer":1,"../common/capabilities":3,"../common/jquery":6,"../common/roundels":10,"../fullscreen-viewer/index":15}],15:[function(require,module,exports){
"use strict";
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

},{"../common/baseViewer":1,"../common/jquery":6,"../common/namespace":7,"../common/zoomController":13}],16:[function(require,module,exports){
"use strict";
var templates = require('../templates/templates.compiled');
var $ = require('../common/jquery');

var IntegrationViewer = function IntegrationViewer(config) {
    var template = templates['template-integration'];

    var integrationKeys = ['mobile', 'quickView', 'productName', 'rangeName', 'locale', 'setName'];

    var viewModel = {
        integrationPoints: [],
        viewerOptions: []
    };

    for (var i = 0, len = integrationKeys.length; i < len; i++) {
        viewModel.integrationPoints.push({
            key: integrationKeys[i],
            value: integrationKeys[i] && config[integrationKeys[i]].toString()
        });
    }

    viewModel.viewerOptions.push({
        key: 'product',
        value: config.product
    });

    viewModel.viewerOptions.push({
        key: 'roundels',
        value: JSON.stringify(config.roundels, null, 2)
    });

    viewModel.viewerOptions.push({
        key: 'templates',
        value: JSON.stringify(config.templates, null, 2)
    });

    viewModel.viewerOptions.push({
        key: 'server',
        value: config.server
    });

    viewModel.viewerOptions.push({
        key: 'account',
        value: config.account
    });

    viewModel.viewerOptions.push({
        key: 'videoSortOrder',
        value: JSON.stringify(config.videoSortOrder)
    });

    $(config.target).html(template(viewModel));
};

module.exports = IntegrationViewer;

},{"../common/jquery":6,"../templates/templates.compiled":19}],17:[function(require,module,exports){
"use strict";
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

},{"../common/baseViewer":1,"../common/jquery":6,"../common/zoomController":13,"../templates/templates.compiled":19}],18:[function(require,module,exports){
"use strict";
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

},{"../common/baseViewer":1,"../common/capabilities":3,"../common/jquery":6,"../common/zoomController":13}],19:[function(require,module,exports){
"use strict";
this["amp"] = this["amp"] || {};
this["amp"]["templates"] = this["amp"]["templates"] || {};
this["amp"]["templates"]["dfs"] = this["amp"]["templates"]["dfs"] || {};

Handlebars.registerPartial("_template-main-item", this["amp"]["templates"]["dfs"]["_template-main-item"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "       <ul class=\"amp-recliner amp-ui-hint\">\n"
    + ((stack1 = helpers.blockHelperMissing.call(depth0,container.lambda(((stack1 = ((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1)) != null ? stack1.items : stack1), depth0),{"name":"item.set.items","hash":{},"fn":container.program(2, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n        <div class=\"amp-cover-box amp-exit-prompt hidden\">\n            <div class=\"amp-message\">\n                <span class=\"amp-message-tagline\">Double tap to exit</span>\n            </div>\n        </div>\n        <div class=\"amp-cover-box amp-double-tap-prompt\">\n            <div class=\"amp-message\">\n                <span class=\"amp-message-tagline\">Double tap for Recliner spin</span>\n                <div class=\"amp-message-icon amp-icon-recliner\">"
    + ((stack1 = container.invokePartial(partials["icons-recliner"],depth0,{"name":"icons-recliner","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n";
},"2":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "                <li>\n                    <div class=\"amp-image-container\">\n                        <span class=\"amp-centerer\"></span>\n"
    + ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.program(5, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "                    </div>\n                </li>\n";
},"3":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                            <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"5":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                            <img data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"7":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.box : stack1),{"name":"if","hash":{},"fn":container.program(8, data, 0, blockParams, depths),"inverse":container.program(14, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "");
},"8":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "               <ul class=\"amp-box\">\n"
    + ((stack1 = helpers.blockHelperMissing.call(depth0,container.lambda(((stack1 = ((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1)) != null ? stack1.items : stack1), depth0),{"name":"item.set.items","hash":{},"fn":container.program(9, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n";
},"9":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "                        <li>\n                            <div class=\"amp-image-container\">\n                                <span class=\"amp-centerer\"></span>\n"
    + ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(10, data, 0, blockParams, depths),"inverse":container.program(12, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "                            </div>\n                        </li>\n";
},"10":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                    <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"12":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                    <img data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"14":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1),{"name":"if","hash":{},"fn":container.program(15, data, 0, blockParams, depths),"inverse":container.program(21, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "");
},"15":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "                    <ul class=\"amp-spinset amp-ui-hint\">\n"
    + ((stack1 = helpers.blockHelperMissing.call(depth0,container.lambda(((stack1 = ((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1)) != null ? stack1.items : stack1), depth0),{"name":"item.set.items","hash":{},"fn":container.program(16, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                    </ul>\n                    <div class=\"amp-cover-box amp-exit-prompt hidden\">\n                        <div class=\"amp-message\">\n                            <span class=\"amp-message-tagline\">Double tap to exit</span>\n                        </div>\n                    </div>\n                    <div class=\"amp-cover-box amp-double-tap-prompt\">\n                        <div class=\"amp-message\">\n                            <span class=\"amp-message-tagline\">Double tap for 360&deg; spin</span>\n                            <div class=\"amp-message-icon amp-icon-360\">"
    + ((stack1 = container.invokePartial(partials["icons-360"],depth0,{"name":"icons-360","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                        </div>\n                    </div>\n";
},"16":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "                            <li>\n                                <div class=\"amp-image-container\">\n                                    <span class=\"amp-centerer\"></span>\n"
    + ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(17, data, 0, blockParams, depths),"inverse":container.program(19, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "                                </div>\n                            </li>\n";
},"17":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                        <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-zoomable amp-main-img\">\n";
},"19":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                        <img data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-zoomable amp-main-img\">\n";
},"21":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.media : stack1),{"name":"if","hash":{},"fn":container.program(22, data, 0),"inverse":container.program(25, data, 0),"data":data})) != null ? stack1 : "");
},"22":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                        <div class=\"amp-video-holder\" data-amp-width=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.vidWidth : stack1), depth0))
    + "\" data-amp-height=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.vidHeight : stack1), depth0))
    + "\">\n                            <div class=\"amp-video amp-hidden\">\n                                <video poster=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageMain : stack1), depth0))
    + "&w="
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.vidWidth : stack1), depth0))
    + "&h="
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.vidHeight : stack1), depth0))
    + "\" preload=\"none\">\n"
    + ((stack1 = helpers.blockHelperMissing.call(depth0,alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.media : stack1), depth0),{"name":"item.media","hash":{},"fn":container.program(23, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                                </video>\n                            </div>\n                        </div>\n";
},"23":function(container,depth0,helpers,partials,data) {
    var helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "                                        <source data-quality-label=\""
    + alias3(((helper = (helper = helpers.profileLabel || (depth0 != null ? depth0.profileLabel : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"profileLabel","hash":{},"data":data}) : helper)))
    + "\" data-bitrate=\""
    + alias3(((helper = (helper = helpers.bitrate || (depth0 != null ? depth0.bitrate : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"bitrate","hash":{},"data":data}) : helper)))
    + "\" data-res=\""
    + alias3(((helper = (helper = helpers.profileLabel || (depth0 != null ? depth0.profileLabel : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"profileLabel","hash":{},"data":data}) : helper)))
    + "\" src=\""
    + alias3(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"src","hash":{},"data":data}) : helper)))
    + "\" type=\""
    + alias3(((helper = (helper = helpers.htmlCodec || (depth0 != null ? depth0.htmlCodec : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"htmlCodec","hash":{},"data":data}) : helper)))
    + "\">\n";
},"25":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.content : stack1),{"name":"if","hash":{},"fn":container.program(26, data, 0),"inverse":container.program(28, data, 0),"data":data})) != null ? stack1 : "");
},"26":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "                            <div class=\"amp-webgl  amp-ui-hint\" data-amp-webgl=\""
    + container.escapeExpression(container.lambda(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.value : stack1), depth0))
    + "\"></div>\n                            <div class=\"amp-cover-box amp-double-tap-prompt\">\n                                <div class=\"amp-message\">\n                                    <span class=\"amp-message-tagline\">Double tap to activate 3D</span>\n                                    <div class=\"amp-message-icon amp-icon-webgl\">"
    + ((stack1 = container.invokePartial(partials["icons-webgl"],depth0,{"name":"icons-webgl","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                                </div>\n                            </div>\n";
},"28":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "                            <div class=\"amp-image-container\">\n                                <span class=\"amp-centerer\"></span>\n"
    + ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(29, data, 0),"inverse":container.program(31, data, 0),"data":data})) != null ? stack1 : "")
    + "\n                            </div>\n";
},"29":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                                    <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-zoomable amp-main-img\">\n";
},"31":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                                    <img data-amp-src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-zoomable amp-main-img\">\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "<li>\n"
    + ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.recliner : stack1),{"name":"if","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.program(7, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "</li>\n";
},"usePartial":true,"useData":true,"useDepths":true}));

Handlebars.registerPartial("_template-nav-item-alt", this["amp"]["templates"]["dfs"]["_template-nav-item-alt"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"amp-nav-link-container\">\n    <div class=\"amp-nav-link\"></div>\n</div>";
},"useData":true}));

Handlebars.registerPartial("_template-nav-item", this["amp"]["templates"]["dfs"]["_template-nav-item"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "            <div class=\"amp-icon amp-icon-recliner\">"
    + ((stack1 = container.invokePartial(partials["icons-recliner"],depth0,{"name":"icons-recliner","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            <img src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "/1?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageThumb : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"3":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.box : stack1),{"name":"if","hash":{},"fn":container.program(4, data, 0),"inverse":container.program(6, data, 0),"data":data})) != null ? stack1 : "");
},"4":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                <div class=\"amp-icon amp-icon-box-open\">"
    + ((stack1 = container.invokePartial(partials["icons-box-open"],depth0,{"name":"icons-box-open","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <img src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "/1?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageThumb : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"6":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1),{"name":"if","hash":{},"fn":container.program(7, data, 0),"inverse":container.program(9, data, 0),"data":data})) != null ? stack1 : "");
},"7":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                    <div class=\"amp-icon amp-icon-360\">"
    + ((stack1 = container.invokePartial(partials["icons-360"],depth0,{"name":"icons-360","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                    <img src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "/1?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageThumb : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"9":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.media : stack1),{"name":"if","hash":{},"fn":container.program(10, data, 0),"inverse":container.program(12, data, 0),"data":data})) != null ? stack1 : "");
},"10":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                        <div class=\"amp-icon amp-icon-video\">"
    + ((stack1 = container.invokePartial(partials["icons-video"],depth0,{"name":"icons-video","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                        <img src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageThumb : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"12":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.content : stack1),{"name":"if","hash":{},"fn":container.program(13, data, 0),"inverse":container.program(15, data, 0),"data":data})) != null ? stack1 : "");
},"13":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "                            <div class=\"amp-icon amp-icon-webgl\">"
    + ((stack1 = container.invokePartial(partials["icons-webgl"],depth0,{"name":"icons-webgl","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                            <div class=\"amp-main-img\"></div>\n";
},"15":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=container.lambda, alias2=container.escapeExpression;

  return "                            <img src=\""
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.src : stack1), depth0))
    + "?"
    + alias2(alias1(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageThumb : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "<li>\n    <div class=\"amp-thumb-image-container amp-moz-invisible\">\n"
    + ((stack1 = helpers["if"].call(depth0,((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.recliner : stack1),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data})) != null ? stack1 : "")
    + "    </div>\n</li>";
},"usePartial":true,"useData":true}));

Handlebars.registerPartial("_template-quicklinks", this["amp"]["templates"]["dfs"]["_template-quicklinks"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "<div class=\"amp-quicklinks-container\">\n    <div class=\"amp-quicklinks-wrapper\">\n        <div class=\"amp-quicklink amp-quicklink-fullscreen\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n        <div class=\"amp-quicklink amp-quicklink-video\">"
    + ((stack1 = container.invokePartial(partials["icons-video"],depth0,{"name":"icons-video","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n        <div class=\"amp-quicklink amp-quicklink-recliner\">"
    + ((stack1 = container.invokePartial(partials["icons-recliner"],depth0,{"name":"icons-recliner","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n        <div class=\"amp-quicklink amp-quicklink-box\">\n            <div class=\"amp-icon-box-open\">"
    + ((stack1 = container.invokePartial(partials["icons-box-open"],depth0,{"name":"icons-box-open","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            <div class=\"amp-icon-box-close\">"
    + ((stack1 = container.invokePartial(partials["icons-box-close"],depth0,{"name":"icons-box-close","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n        </div>\n        <div class=\"amp-quicklink amp-quicklink-spinset\">"
    + ((stack1 = container.invokePartial(partials["icons-360"],depth0,{"name":"icons-360","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n    </div>\n</div>";
},"usePartial":true,"useData":true}));

Handlebars.registerPartial("icons-360", this["amp"]["templates"]["dfs"]["icons-360"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n    <g>\n        \n        <g>\n            <path d=\"m124.5,126.5c28.299988,-2.899994 48.5,-10.299988 48.5,-19c0,-5.399994 -7.799988,-10.399994 -20.600006,-14l0,-4c18.600006,4.899994 30.399994,12.200012 30.399994,20.399994c0,11.899994 -24.5,21.800018 -58.399994,25.300018l0.100006,-8.700012z\" fill=\"#6B6B6B\"/>\n        </g>\n        <path d=\"m101.5,136.5c-0.899994,0 -1.899994,0 -2.799988,0c-46.500015,0 -84.200012,-11.899994 -84.200012,-26.600006c0,-8.799988 13.600006,-16.600006 34.5,-21.5l0,4c-15.199997,3.700012 -24.800003,9.100006 -24.800003,15.100006c0,11.200012 33.300003,20.299988 74.400009,20.299988c1,0 2,0 3,0l0,-8.799988l12.700012,13.200012l-12.800018,13.299988l0,-9z\" fill=\"#6B6B6B\"/>\n        <text x=\"-194\" y=\"-326\" font-size=\"55.8251\" font-family=\"'HelveticaNeue-Bold'\" fill=\"#6B6B6B\" transform=\"matrix(1,0,0,1,244.6686,434.4716) \">36</text>\n        <text x=\"-194\" y=\"-326\" font-size=\"55.8251\" font-family=\"'HelveticaNeue-Bold'\" fill=\"#6B6B6B\" transform=\"matrix(1,0,0,1,306.7799,434.4716) \">0</text>\n        <text x=\"-194\" y=\"-326\" font-size=\"55.8251\" font-family=\"'HelveticaNeue-Bold'\" fill=\"#6B6B6B\" transform=\"matrix(1,0,0,1,336.3517,434.4716) \">&#176;</text>\n    </g>\n</svg>\n\n";
},"useData":true}));

Handlebars.registerPartial("icons-box-close", this["amp"]["templates"]["dfs"]["icons-box-close"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">\n    <g>\n        \n        <g>\n            <path stroke=\"#4C4C4C\" d=\"m146.469559,110.587593l0,20.769707l-46.71431,20.839615c0,0 -10.699562,8.461716 -26.993629,0l-48.952175,-21.399078l0,-23.077446c0,0 -0.559444,-3.007057 5.384747,-3.426651c0,0 -5.454672,-6.084061 -5.454672,-12.238037l0,-10.979279c0,0 0.559456,-7.482681 10.489748,-9.370834l45.24577,-13.426868c0,0 4.685432,-1.608448 12.377914,0l45.945084,12.447826c0,0 8.4617,0.559441 8.671524,6.014122l0,12.937355c0,0 1.538513,12.238052 -5.594528,13.007294c0,0 5.594528,-3.146927 5.594528,7.902275z\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" fill=\"none\"/>\n            <path stroke=\"#4C4C4C\" d=\"m144.161835,101.076881l-48.112991,21.81868c-3.70636,1.678368 -6.993156,2.377663 -9.650551,2.517525c-4.475624,0.279747 -7.20295,-0.839157 -7.20295,-0.839157s-46.994087,-18.601837 -52.099104,-19.16127\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" fill=\"none\"/>\n            <line stroke=\"#4C4C4C\" y2=\"102.685313\" x2=\"85.629037\" y1=\"155.903305\" x1=\"86.328354\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" fill=\"none\"/>\n            <path stroke=\"#4C4C4C\" d=\"m143.392624,75.691696l-48.113022,21.818687c-3.706383,1.678345 -6.993179,2.37767 -9.650558,2.517525c-4.475624,0.279747 -7.202965,-0.83918 -7.202965,-0.83918s-46.994078,-18.601807 -52.099091,-19.161263\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" fill=\"none\"/>\n            <path d=\"m169.826736,105.972092l-7.69249,-11.888374l4.195908,-0.699318c0,0 3.846268,-24.126419 -26.364212,-48.043037c0,0 33.427338,16.853512 32.378357,47.064003l4.405701,-0.629379l-6.923264,14.196106z\" fill=\"#4C4C4C\"/>\n        </g>\n    </g>\n</svg>";
},"useData":true}));

Handlebars.registerPartial("icons-box-open", this["amp"]["templates"]["dfs"]["icons-box-open"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n <g>\n     \n     <g>\n      <path d=\"m50.699997,112.5l35.099991,-10.100006c0,0 8.600006,-4 22.100006,0l35.600006,10.100006c0,0 6.600006,2.600006 6.100006,12.600006l0,18.5l-41.600006,18.600006c0,0 -9.600006,7.600006 -24.100006,0l-43.699997,-19.100006l0,-20.600006c0,0 0.600006,-3.5 4,-6.599976c1.5,-1.300018 3.699997,-2.600037 6.5,-3.400024z\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" stroke=\"#6B6B6B\" fill=\"none\"/>\n      <path d=\"m147.899994,116.600006l-42.899994,19.5c-3.299988,1.5 -6.200012,2.100006 -8.600006,2.200012c-4,0.199982 -6.399994,-0.700012 -6.399994,-0.700012s-42,-16.600006 -46.600006,-17.100006\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" stroke=\"#6B6B6B\" fill=\"none\"/>\n      <polyline points=\"96.29998779296875,102.10000610351562 96.29998779296875,114.20001220703125 128.60000610351562,123.79998779296875 \" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" stroke=\"#6B6B6B\" fill=\"none\"/>\n      <line y2=\"126.1\" x2=\"59.8\" y1=\"113.6\" x1=\"96.9\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" stroke=\"#6B6B6B\" fill=\"none\"/>\n      <path d=\"m92.899994,90.299988c0,0 -4.700012,0.700012 -12.299988,4.200012l-41.200012,20.5l-8.800003,-20.299988c0,0 -2.199997,-4.200012 6,-8.5l45.099991,-19.400024l52.100006,-17l10.100006,22.100006l-50.399994,18.399994l-11.5,-22.199982\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" stroke=\"#6B6B6B\" fill=\"none\"/>\n      <line y2=\"139.8\" x2=\"95.7\" y1=\"165.6\" x1=\"96.3\" stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-width=\"7\" stroke=\"#6B6B6B\" fill=\"none\"/>\n      <path d=\"m123.399994,30.200012l6.200012,11l2.199982,-3c0,0 20.700012,7.100006 27,40.799988c0,0 0.600006,-33.399994 -23.699982,-45.099976l2.399994,-3.200012l-14.100006,-0.5z\" fill=\"#6B6B6B\"/>\n     </g>\n </g>\n</svg>";
},"useData":true}));

Handlebars.registerPartial("icons-caret-left", this["amp"]["templates"]["dfs"]["icons-caret-left"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg viewBox=\"0 0 64 93\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n  <g>\n   <path id=\"svg_1\" d=\"m14.65002,46.05286l35,-35c0,0 4.29999,-5 0,-9.80002c0,0 -4.79999,-3.5 -9.79999,1.20001l-37.60001,37.60001c0,0 -6.60001,5.19998 0,12.10001l39.79999,38.29999c0,0 5.80002,5.3 10.5,1c0,0 5.20001,-4.79999 -2.29999,-12.2l-35.60001,-33.19998l0.00001,-0.00001l0,-0.00001z\" fill=\"#5C2C91\"/>\n  </g>\n </svg>";
},"useData":true}));

Handlebars.registerPartial("icons-caret-right", this["amp"]["templates"]["dfs"]["icons-caret-right"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg viewBox=\"0 0 64 93\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n  <g>\n   <path id=\"svg_1\" d=\"m47.65536,46.05286l-35,-35c0,0 -4.29999,-5 0,-9.80002c0,0 4.79999,-3.5 9.79999,1.20001l37.60001,37.60001c0,0 6.60001,5.19998 0,12.10001l-39.79999,38.29999c0,0 -5.80002,5.29999 -10.5,1c0,0 -5.20001,-4.79999 2.29999,-12.20001l35.60001,-33.19998z\" fill=\"#5C2C91\"/>\n  </g>\n </svg>";
},"useData":true}));

Handlebars.registerPartial("icons-close", this["amp"]["templates"]["dfs"]["icons-close"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n    <g>\n        \n        <g>\n            <path fill=\"#6D6D6C\" d=\"m147.062088,65.286598l-79.455261,79.455254c-1.570251,1.570251 -3.341545,2.311523 -3.985329,1.66774l-9.785526,-9.785522c-0.643787,-0.643784 0.097481,-2.415085 1.667736,-3.985336l79.455246,-79.455254c1.570282,-1.570286 3.341461,-2.311432 3.985245,-1.667648l9.785538,9.785526c0.643784,0.643784 -0.097382,2.414967 -1.667648,3.985241z\"/>\n            <path fill=\"#6D6D6C\" d=\"m134.958939,144.741898l-79.455196,-79.455193c-1.57024,-1.570236 -2.311516,-3.341545 -1.667732,-3.985329l9.785526,-9.785526c0.643784,-0.643784 2.415092,0.097492 3.985329,1.667732l79.455193,79.455196c1.570313,1.570313 2.311447,3.341476 1.667664,3.98526l-9.785522,9.785522c-0.643784,0.643784 -2.414948,-0.097351 -3.98526,-1.667664z\"/>\n        </g>\n    </g>\n</svg>";
},"useData":true}));

Handlebars.registerPartial("icons-recliner", this["amp"]["templates"]["dfs"]["icons-recliner"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n    <g>\n        \n        <g>\n            <path\n                  d=\"m142.300018,143.399963l0,-34.299988l24,-35.799988c0,0 11.200012,-18.200012 -7.100006,-21.700012l-38.899994,-6.100006c0,0 -11.899994,0.899994 -8.399994,18.899994c0,0 -11.600006,5 -26.399994,29.400024l0.600006,-12.400024c0,0 -0.200012,-5.099976 -8.100006,-2.199982l-34.800003,13.299988c0,0 -7.200012,1.200012 -7.400009,15.100006c0,0 0.199997,13.399994 0.199997,13.399994c-0.099991,0.100006 -9,7.200012 -8.799988,15.100006l30.199997,16.5c0,0 7.600006,4.200012 19.399994,-9.200012l8.800018,3.300018l0,6.299988l17.799988,7.200012l38.899994,-16.800018z\"\n                  stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path d=\"m162.800018,52.599976c0,0 -15,-2.100006 -12.799988,19.899994l-38.200012,-8.100006\"\n                  stroke-miterlimit=\"10\" stroke-linejoin=\"round\" stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path d=\"m150,72.499969c0,0 -6.700012,5 -16,21.5\" stroke-miterlimit=\"10\" stroke-width=\"6\"\n                  stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path\n                  d=\"m142.300018,109.099976c0,-12.200012 -8.399994,-15.100006 -8.399994,-15.100006c-6,-4 -14,-0.899994 -14,-0.899994l-14.299988,6.600006l-20.400024,-6l-35.499985,16.199982c0,0 -7.400009,3.300018 -14.100006,11\"\n                  stroke-miterlimit=\"10\" stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path\n                  d=\"m76.5,143.399963c9.799988,-12.299988 8.799988,-18.799988 8.799988,-18.799988l-35.499985,-14.600006l0,-8.899994c0,0 1.199997,-10.700012 -8.100006,-8.200012\"\n                  stroke-miterlimit=\"10\" stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path d=\"m85.400024,124.499969c0,0 -16.299988,-0.300018 -27.199982,28.399994\"\n                  stroke-miterlimit=\"10\" stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path\n                  d=\"m85.400024,146.599976l0.100006,-25.700012c0,0 -0.5,-13.399994 5.799988,-14.699982c0,0 10.800018,-2.800018 11.899994,7.699982l0,44.700012\"\n                  stroke-miterlimit=\"10\" stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <line y2=\"106.199976\" x2=\"91.200012\" y1=\"99.699976\" x1=\"105.800012\" stroke-miterlimit=\"10\"\n                  stroke-width=\"6\" stroke=\"#6B6B6B\" fill=\"none\"/>\n            <path\n                  d=\"m90.400024,66.099976c0,0 8.100006,-25.600006 34.299988,-31.600006l0,2.100006l8.600006,-4.700012l-8.600006,-4.099976l0,2.299988c0,0.100006 -30.5,2.899994 -34.299988,36z\"\n                  fill=\"#6B6B6B\"/>\n            <path\n                  d=\"m58.399994,167.699982l-0.5,2.200012l-7.599976,-5.800018l9.399994,-2.799988l-0.399994,2c0,0 13.699982,0.5 20.699982,-13.200012c-0.099976,0.100006 -0.299988,17.5 -21.600006,17.600006z\"\n                  fill=\"#6B6B6B\"/>\n        </g>\n    </g>\n</svg>\n";
},"useData":true}));

Handlebars.registerPartial("icons-video", this["amp"]["templates"]["dfs"]["icons-video"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n    <g>\n        <g>\n            <path\n                d=\"m65.299988,68.200012c0,-7 5,-9.899994 11.100006,-6.399994l62.299988,36c6.100006,3.600006 6.100006,9.299988 0,12.699982l-62.299988,36c-6.100006,3.600006 -11.100006,0.600006 -11.100006,-6.399994l0,-71.899994z\"\n                fill=\"#6D6D6C\"/>\n        </g>\n    </g>\n</svg>\n";
},"useData":true}));

Handlebars.registerPartial("icons-webgl", this["amp"]["templates"]["dfs"]["icons-webgl"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewbox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n\n <g>\n     \n     <g>\n      <text x=\"-240.545567\" y=\"-327\" font-size=\"53.8919\" font-family=\"'HelveticaNeue-Bold'\" fill=\"#6B6B6B\" transform=\"matrix(0.8065,0,0,1,262.5151,472.5182) \">3D</text>\n      <path d=\"m139.799988,130.399994l0,10.899994c0,0 38.399994,-3.899994 39.200012,-15.899994c0,0 3.5,-11.700012 -43.800018,-20.700012c0,0 -68.299988,-9.5 -108.899994,10.100006c0,0 -34.199997,19.100006 37.899994,34.200012c0,0 -58.299988,-4.200012 -53.799988,-27.299988c0,0 7.199997,-17.800018 75,-21.800018c0,0 67.399994,-2.399994 93.600006,15.100006c0,0 20.399994,9.700012 -4.900024,22.799988c0,0 -8.5,3.900024 -34.199982,8.5l0,10.300018l-13.300018,-12.800018l13.200012,-13.399994z\" fill=\"#6B6B6B\"/>\n      <g>\n       <path d=\"m78.299988,105.700012c0.700012,-11.5 1.700012,-19 1.700012,-19c9,-47.299988 20.699982,-43.799988 20.699982,-43.799988c11.899994,0.799988 15.899994,39.199982 15.899994,39.199982l-11,0l13.5,13l12.800018,-13.299988l-10.300018,0c-4.5,-25.700012 -8.5,-34.200012 -8.5,-34.200012c-13,-25.199982 -22.799988,-4.899994 -22.799988,-4.899994c-9.700012,14.5 -13.299988,41.600006 -14.5,62.899994l2.5,0.100006l0,0l0,0z\" fill=\"#828282\"/>\n      </g>\n     </g>\n </g>\n</svg>";
},"useData":true}));

Handlebars.registerPartial("icons-zoom-in", this["amp"]["templates"]["dfs"]["icons-zoom-in"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n    <g>\n        \n        <g>\n            <circle fill=\"none\" stroke=\"#6D6D6C\" stroke-width=\"9\" stroke-miterlimit=\"10\" cx=\"87.525001\" cy=\"85.362332\" r=\"50.462687\"/>\n            <path fill=\"#6D6D6C\" d=\"m173.131363,157.271667l-14.59816,14.59816c-3.063766,3.063766 -7.929825,3.063766 -10.813431,0l-36.40519,-36.405243c-3.06382,-3.063812 -3.06382,-7.92984 0,-10.813438l14.598099,-14.59816c3.063835,-3.063766 7.929893,-3.063766 10.813438,0l36.405243,36.405251c2.883545,3.063797 2.883545,7.749664 0,10.813431z\"/>\n            <path fill=\"#6D6D6C\" d=\"m110.954124,94.914177l-45.596626,0c-0.901123,0 -1.622047,-0.720871 -1.622047,-1.621994l0,-13.697029c0,-0.901123 0.720924,-1.622002 1.622047,-1.622002l45.596626,0c0.901115,0 1.621994,0.720879 1.621994,1.622002l0,13.697029c0,0.901123 -0.720879,1.621994 -1.621994,1.621994z\"/>\n            <path fill=\"#6D6D6C\" d=\"m79.77536,109.332092l0,-45.59663c0,-0.901119 0.720879,-1.622044 1.621994,-1.622044l13.697037,0c0.901115,0 1.621994,0.720924 1.621994,1.622044l0,45.59663c0,0.901115 -0.720879,1.621994 -1.621994,1.621994l-13.697037,0c-0.901115,-0.180183 -1.621994,-0.720879 -1.621994,-1.621994z\"/>\n        </g>\n    </g>\n</svg>";
},"useData":true}));

Handlebars.registerPartial("icons-zoom-out", this["amp"]["templates"]["dfs"]["icons-zoom-out"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<svg class=\"amp-svg-icon\" viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\">\n    <g>\n        \n        <g>\n            <circle fill=\"none\" stroke=\"#6D6D6C\" stroke-width=\"9\" stroke-miterlimit=\"10\" cx=\"87.525001\" cy=\"85.362332\" r=\"50.462687\"/>\n            <path fill=\"#6D6D6C\" d=\"m173.131363,157.271667l-14.59816,14.59816c-3.063766,3.063766 -7.929825,3.063766 -10.813431,0l-36.40519,-36.405243c-3.06382,-3.063812 -3.06382,-7.92984 0,-10.813438l14.598099,-14.59816c3.063835,-3.063766 7.929893,-3.063766 10.813438,0l36.405243,36.405251c2.883545,3.063797 2.883545,7.749664 0,10.813431z\"/>\n            <path fill=\"#6D6D6C\" d=\"m110.954124,94.914177l-45.596626,0c-0.901123,0 -1.622047,-0.720871 -1.622047,-1.621994l0,-13.697029c0,-0.901123 0.720924,-1.622002 1.622047,-1.622002l45.596626,0c0.901115,0 1.621994,0.720879 1.621994,1.622002l0,13.697029c0,0.901123 -0.720879,1.621994 -1.621994,1.621994z\"/>\n        </g>\n    </g>\n</svg>";
},"useData":true}));

this["amp"]["templates"]["dfs"]["template-desktop"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                        "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-nav-item",{"name":"renderPartial","hash":{"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "<section class=\"amp-viewer amp-desktop-viewer "
    + alias3(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header class=\"amp-header\">\n        <div class=\"amp-header-wrapper\">\n            <div class=\"amp-header-product-title\">\n                <h3>"
    + alias3(((helper = (helper = helpers.rangeName || (depth0 != null ? depth0.rangeName : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"rangeName","hash":{},"data":data}) : helper)))
    + ": "
    + alias3(((helper = (helper = helpers.productName || (depth0 != null ? depth0.productName : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"productName","hash":{},"data":data}) : helper)))
    + "</h3>\n            </div>\n            <div class=\"amp-roundels\"></div>\n        </div>\n    </header>\n\n    <div class=\"amp-main-container\">\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            <div class=\"amp-prev amp-nav-prev amp-nav-button amp-moz-invisible\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n            <div class=\"amp-nav-thumbs\">\n                <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n            </div>\n            <div class=\"amp-next amp-nav-next amp-nav-button amp-moz-invisible\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"            ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-fullscreen"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "               "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                        "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-nav-item",{"name":"renderPartial","hash":{"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "<section class=\"amp-viewer amp-fullscreen-viewer "
    + alias3(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header>\n    <h3>"
    + alias3(((helper = (helper = helpers.rangeName || (depth0 != null ? depth0.rangeName : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"rangeName","hash":{},"data":data}) : helper)))
    + ": "
    + alias3(((helper = (helper = helpers.productName || (depth0 != null ? depth0.productName : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"productName","hash":{},"data":data}) : helper)))
    + "</h3>\n     <div class=\"amp-toplinks-container\">\n            <div class=\"amp-toplinks-wrapper\">\n                <div class=\"amp-toplinks amp-close\">"
    + ((stack1 = container.invokePartial(partials["icons-close"],depth0,{"name":"icons-close","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-out\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-out"],depth0,{"name":"icons-zoom-out","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-in\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n    </header>\n    <div class=\"amp-main-container\">\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            \n            <div class=\"amp-prev amp-nav-prev amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n            <div class=\"amp-nav-thumbs\">\n                <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n            </div>\n            <div class=\"amp-next amp-nav-next amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"            ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-integration"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "    <li class=\"key-value-pair\">\n        <span class=\"key\">"
    + alias3(((helper = (helper = helpers.key || (depth0 != null ? depth0.key : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"key","hash":{},"data":data}) : helper)))
    + "</span>\n        <span class=\"value\"><pre>"
    + alias3(((helper = (helper = helpers.value || (depth0 != null ? depth0.value : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"value","hash":{},"data":data}) : helper)))
    + "</pre></span>\n    </li>\n";
},"3":function(container,depth0,helpers,partials,data) {
    var helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "        <li class=\"key-value-pair\">\n            <span class=\"key\">"
    + alias3(((helper = (helper = helpers.key || (depth0 != null ? depth0.key : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"key","hash":{},"data":data}) : helper)))
    + "</span>\n            <span class=\"value\"><pre>"
    + alias3(((helper = (helper = helpers.value || (depth0 != null ? depth0.value : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"value","hash":{},"data":data}) : helper)))
    + "</pre></span>\n        </li>\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "<h1>Amplience DFS Viewer</h1>\n\n<h2>Integration Debug View</h2>\n<ul class=\"key-value-pair-list\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.integrationPoints : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</ul>\n\n<h2>Viewer Options</h2>\n<ul class=\"key-value-pair-list\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.viewerOptions : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</ul>\n\n";
},"useData":true});

this["amp"]["templates"]["dfs"]["template-mobile"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = container.invokePartial(partials["_template-nav-item-alt"],depth0,{"name":"_template-nav-item-alt","data":data,"indent":"                            ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "");
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper;

  return "<section class=\"amp-viewer amp-mobile-viewer "
    + container.escapeExpression(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header>\n        <div class=\"amp-toplinks-container\">\n            <div class=\"amp-toplinks-wrapper\">\n                <div class=\"amp-toplinks amp-zoom-out\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-out"],depth0,{"name":"icons-zoom-out","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-in\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n    </header>\n    <div class=\"amp-main-container\" >\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            <div class=\"amp-navigation-container\">\n                 <div class=\"amp-prev amp-nav-prev amp-nav-button\">\n                     <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                     ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                     </div>\n                 </div>\n                 <div class=\"amp-nav-links\">\n                     <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                     </ul>\n                 </div>\n                 <div class=\"amp-next amp-nav-next amp-nav-button\">\n                     <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                     ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                     </div>\n                 </div>\n            </div>\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"           ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-quickview"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                        "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0,"_template-nav-item",{"name":"renderPartial","hash":{"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "<section class=\"amp-viewer amp-quickview-viewer "
    + alias3(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header>\n        <h3>"
    + alias3(((helper = (helper = helpers.rangeName || (depth0 != null ? depth0.rangeName : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"rangeName","hash":{},"data":data}) : helper)))
    + ": "
    + alias3(((helper = (helper = helpers.productName || (depth0 != null ? depth0.productName : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"productName","hash":{},"data":data}) : helper)))
    + "</h3>\n        <div class=\"amp-toplinks-container\">\n            <div class=\"amp-toplinks-wrapper\">\n                <div class=\"amp-toplinks amp-close close\">"
    + ((stack1 = container.invokePartial(partials["icons-close"],depth0,{"name":"icons-close","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-out\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-out"],depth0,{"name":"icons-zoom-out","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-in\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n    </header>\n    <div class=\"amp-main-container\" >\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            <div class=\"amp-prev amp-nav-prev amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n            <div class=\"amp-nav-thumbs\">\n                <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n            </div>\n            <div class=\"amp-next amp-nav-next amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"           ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-roundels"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=helpers.helperMissing, alias2="function", alias3=container.escapeExpression;

  return "	<div class=\"amp-dfs-roundel "
    + alias3(((helper = (helper = helpers.position || (depth0 != null ? depth0.position : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"position","hash":{},"data":data}) : helper)))
    + " "
    + alias3(((helper = (helper = helpers.className || (depth0 != null ? depth0.className : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"className","hash":{},"data":data}) : helper)))
    + "\">\n		<span>"
    + alias3(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : alias1),(typeof helper === alias2 ? helper.call(depth0,{"name":"description","hash":{},"data":data}) : helper)))
    + "</span>\n	</div>\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "<div class=\"roundels\">\n"
    + ((stack1 = helpers.each.call(depth0,(depth0 != null ? depth0.roundels : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</div>\n\n";
},"useData":true});

module.exports = this["amp"]["templates"]["dfs"];
},{}],20:[function(require,module,exports){
"use strict";
/* global console */
/* jshint -W097 */

// set up safe console
var logFns = ['log', 'error', 'warn', 'info'];

var log = {
    history: []
};

var fallback = function () {
    log.history.push(arguments);
};

var ieLegacy = function () {
    Function.prototype.call.call(console.log, console, Array.prototype.slice.call(arguments));
};

var specializedFn;
var defaultFn;

for (var i = 0; i < logFns.length; i++) {

    if (typeof console !== 'undefined' && typeof console.log === 'object') {
        // ie8 + ie9
        log[logFns[i]] = ieLegacy;
    } else if (typeof console !== 'undefined' && typeof console.log === 'function') {
        specializedFn = window.console && window.console[logFns[i]] && window.console[logFns[i]].bind(window.console);
        defaultFn = window.console && window.console.log && window.console.log.bind(window.console);

        log[logFns[i]] = specializedFn || defaultFn || fallback;
    } else {
        log[logFns[i]] = fallback;
    }
}

// put this on global scope to allow interrogation of history for fallback
window.ampLog = log;

module.exports = log;

},{}],21:[function(require,module,exports){
"use strict";
/* jshint -W097 */
// provides the namespace to use for this app

var namespace = window.amp = window.amp || {};

module.exports = namespace;

},{}],22:[function(require,module,exports){
"use strict";
var amp = require('./utils/namespace');
var $ = require('./common/jquery');
var QuickViewer = require('./quick-viewer');
var DesktopViewer = require('./desktop-viewer');
var MobileViewer = require('./mobile-viewer');
var IntegrationViewer = require('./integration-viewer/index');

amp.createViewer = function viewerFactory(config) {
    var defaultConfig = {
        server: '//i1.adis.ws',
        errImgName: 'img404',
        account: 'dfs',
        mobile: false,
        quickView: false,
        debug: false,
        rangeName: '',
        productName: '',
        preloadVideos: 'none', // or 'auto' will preload at page load
        templates: {
            imageMain: '$pdp-main$',
            imageThumb: '$pdp-thumb$',
            wideDesktop: {
                imageMain: '$pdp-main-wide$',
                imageThumb: '$pdp-thumb-wide$'
            },
            fullScreen: {
                screenWidth : true,
                imageMain: '$pdp-fullscreen$',
                imageThumb: '$pdp-thumb$'
            },
            quickView: {
                imageMain: '$pdp-quickview$',
                imageThumb: '$pdp-thumb$'
            },
            mobileView: {
                imageMain: '$pdp-mobile$'
            }
        },
        roundels: [],
        // defaults for ui hide and fadeOut timers
        uiHintTimers: {
            displayTimer : 3000,
            transitionTimer : 400
        }
    };

    var mergedConfig = $.extend(true, {}, defaultConfig, config);

    if (config.mobile) {
        // create mobile viewer
        return new MobileViewer(mergedConfig);
    } else if (config.quickView) {
        return new QuickViewer(mergedConfig);
    } else if (config.debug) {
        return new IntegrationViewer(mergedConfig);
    } else {
        return new DesktopViewer(mergedConfig);
    }
};

},{"./common/jquery":6,"./desktop-viewer":14,"./integration-viewer/index":16,"./mobile-viewer":17,"./quick-viewer":18,"./utils/namespace":21}]},{},[22])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY29tbW9uL2Jhc2VWaWV3ZXIuanMiLCJzcmMvY29tbW9uL2JveENvbnRyb2xsZXIuanMiLCJzcmMvY29tbW9uL2NhcGFiaWxpdGllcy5qcyIsInNyYy9jb21tb24vZGlTZXJ2aWNlLmpzIiwic3JjL2NvbW1vbi9oYnNIZWxwZXJzLmpzIiwic3JjL2NvbW1vbi9qcXVlcnkuanMiLCJzcmMvY29tbW9uL25hbWVzcGFjZS5qcyIsInNyYy9jb21tb24vbmF2Q29udHJvbGxlci5qcyIsInNyYy9jb21tb24vcXVpY2tMaW5rc0NvbnRyb2xsZXIuanMiLCJzcmMvY29tbW9uL3JvdW5kZWxzLmpzIiwic3JjL2NvbW1vbi91aUhpbnRDb250cm9sbGVyLmpzIiwic3JjL2NvbW1vbi92aWRlb0NvbnRyb2xsZXIuanMiLCJzcmMvY29tbW9uL3pvb21Db250cm9sbGVyLmpzIiwic3JjL2Rlc2t0b3Atdmlld2VyL2luZGV4LmpzIiwic3JjL2Z1bGxzY3JlZW4tdmlld2VyL2luZGV4LmpzIiwic3JjL2ludGVncmF0aW9uLXZpZXdlci9pbmRleC5qcyIsInNyYy9tb2JpbGUtdmlld2VyL2luZGV4LmpzIiwic3JjL3F1aWNrLXZpZXdlci9pbmRleC5qcyIsInNyYy90ZW1wbGF0ZXMvdGVtcGxhdGVzLmNvbXBpbGVkLmpzIiwic3JjL3V0aWxzL2xvZy5qcyIsInNyYy91dGlscy9uYW1lc3BhY2UuanMiLCJzcmMvdmlld2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6aUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbmZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcInVzZSBzdHJpY3RcIjtcbnJlcXVpcmUoJy4vaGJzSGVscGVycycpO1xudmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeScpO1xudmFyIGFtcCA9IHJlcXVpcmUoJy4vbmFtZXNwYWNlJyk7XG52YXIgdGVtcGxhdGVzID0gcmVxdWlyZSgnLi4vdGVtcGxhdGVzL3RlbXBsYXRlcy5jb21waWxlZCcpO1xudmFyIERpU2VydmljZSA9IHJlcXVpcmUoJy4vZGlTZXJ2aWNlJyk7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdXRpbHMvbG9nJyk7XG52YXIgY2FwYWJpbGl0eURldGVjdGlvbiA9IHJlcXVpcmUoJy4vY2FwYWJpbGl0aWVzJyk7XG52YXIgTmF2Q29udHJvbGxlciA9IHJlcXVpcmUoJy4uL2NvbW1vbi9uYXZDb250cm9sbGVyJyk7XG52YXIgUXVpY2tMaW5rc0NvbnRyb2xsZXIgPSByZXF1aXJlKCcuLi9jb21tb24vcXVpY2tMaW5rc0NvbnRyb2xsZXInKTtcbnZhciBVaUhpbnRDb250cm9sbGVyID0gcmVxdWlyZSgnLi4vY29tbW9uL3VpSGludENvbnRyb2xsZXInKTtcbnZhciBCb3hDb250cm9sbGVyID0gcmVxdWlyZSgnLi4vY29tbW9uL2JveENvbnRyb2xsZXInKTtcbnZhciBWaWRlb0NvbnRyb2xsZXIgPSByZXF1aXJlKCcuLi9jb21tb24vdmlkZW9Db250cm9sbGVyJyk7XG5cbi8vVE9ETzpGaW5kIGEgYmV0dGVyIHdheSB0byBwcmV2ZW50IHZpZGVvIHdpZGdldCBjYWxjaW5nIHNpemVcbiQuYW1wLmFtcFZpZGVvLnByb3RvdHlwZS5fY2FsY1NpemUgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG4vL0NvbW1vbiBmdW5jdGlvbmFsaXR5IGJldHdlZW4gdmlld2Vyc1xudmFyIEJhc2VWaWV3ZXIgPSBmdW5jdGlvbiBCYXNlVmlld2VyKGNvbmZpZykge1xuICAgIHRoaXMuY29uZmlnUGFyYW1zID0gY29uZmlnO1xuICAgIHRoaXMuc2V0RGF0YSA9IG51bGw7XG4gICAgdGhpcy50ZW1wbGF0ZSA9IHRlbXBsYXRlc1sndGVtcGxhdGUtJyArIHRoaXMudmlld2VyVHlwZV07XG4gICAgdGhpcy50ZW1wbGF0ZU5hdkl0ZW0gPSB0aGlzLnRlbXBsYXRlTmF2SXRlbSB8fCB0ZW1wbGF0ZXNbJ190ZW1wbGF0ZS1uYXYtaXRlbSddO1xuICAgIHRoaXMudGVtcGxhdGVNYWluSXRlbSA9IHRoaXMudGVtcGxhdGVNYWluSXRlbSB8fCB0ZW1wbGF0ZXNbJ190ZW1wbGF0ZS1tYWluLWl0ZW0nXTtcbiAgICB0aGlzLmFzc2V0c1BhdGggPSBjb25maWcuYXNzZXRzUGF0aDtcbiAgICB0aGlzLnByb2R1Y3ROYW1lID0gY29uZmlnLnByb2R1Y3ROYW1lO1xuICAgIHRoaXMucmFuZ2VOYW1lID0gY29uZmlnLnJhbmdlTmFtZTtcbiAgICB0aGlzLnRlbXBsYXRlcyA9IHRoaXMudGVtcGxhdGVzIHx8IGNvbmZpZy50ZW1wbGF0ZXM7XG4gICAgLy8gaW5pdCB0aW1lcnMgZnJvbSBjb25maWcgZm9yIG1vYmlsZSBpbmZvcm1hdGlvbiBvdmVybGF5cy4gTWF5IGJlIHtPYmplY3R9IG9yIHtCb29sZWFufWZhbHNlIC0gaWYgbm90IHNwZWNpZmllZFxuICAgIHRoaXMudWlIaW50VGltZXJzID0gY29uZmlnLnVpSGludFRpbWVycyB8fCBmYWxzZTtcblxuICAgIHRoaXMudWkgPSB0aGlzLnVpIHx8IHtcbiAgICAgICAgJGVsOiAkKGNvbmZpZy50YXJnZXQpXG4gICAgfTtcblxuICAgIGlmICghdGhpcy51aS4kZWwubGVuZ3RoKSB7XG4gICAgICAgIGxvZy53YXJuKHRoaXMudmlld2VyVHlwZSArICcgbm8gdGFyZ2V0IGVsZW1lbnQgZGVmaW5lZC4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5fYmVmb3JlVmlld2VyQ3JlYXRlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB0aGlzLl9iZWZvcmVWaWV3ZXJDcmVhdGVkKCk7XG4gICAgfVxuXG4gICAgdGhpcy51aS4kZWwuZW1wdHkoKTtcblxuICAgIHRoaXMuZGlTZXJ2aWNlID0gbmV3IERpU2VydmljZSh7XG4gICAgICAgIGFjY291bnQ6IGNvbmZpZy5hY2NvdW50LFxuICAgICAgICBwYXRoOiBjb25maWcuc2VydmVyLFxuICAgICAgICBlcnJJbWdOYW1lOiBjb25maWcuZXJySW1nTmFtZSxcbiAgICAgICAgY2FjaGVCdXN0OiBjb25maWcuY2FjaGVCdXN0LFxuICAgICAgICB2aWRlb1NvcnRPcmRlcjogY29uZmlnLnZpZGVvU29ydE9yZGVyXG4gICAgfSk7XG5cbiAgICAvL25vIG5lZWQgdG8gZ2V0IHNldCBmb3IgY2hpbGQgdmlld2VyLCBqdXN0IHBhc3MgdGhyb3VnaCBkYXRhXG4gICAgaWYgKHRoaXMucGFyZW50Vmlld2VyICYmIHRoaXMucGFyZW50Vmlld2VyLnNldERhdGEpIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlVmlld2VyKHRoaXMucGFyZW50Vmlld2VyLnNldERhdGEpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2dldFNldChjb25maWcuc2V0TmFtZSwgdGhpcy5fY3JlYXRlVmlld2VyKTtcbiAgICB9XG59O1xuXG5CYXNlVmlld2VyLnByb3RvdHlwZSA9IHtcbiAgICBfZ2V0U2V0OiBmdW5jdGlvbiAoc2V0TmFtZSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBpZiAoIXNldE5hbWUpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKHRoaXMudmlld2VyVHlwZSArICcgbm8gc2V0TmFtZSBkZWZpbmVkLicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0TmFtZSA9IHNldE5hbWU7XG4gICAgICAgIHRoaXMuZGlTZXJ2aWNlLmdldE1lZGlhU2V0KHNldE5hbWUsXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKHNldERhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5fdXBkYXRlU2V0RGF0YShzZXREYXRhLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgbG9nLndhcm4oc2VsZi52aWV3ZXJUeXBlICsgJyBlcnJvciByZXRyaWV2aW5nIG1lZGlhU2V0IFxcXCInICsgc2V0TmFtZSArICdcXFwiLiAnLCBlcnIpO1xuICAgICAgICAgICAgZXJyW3NldE5hbWVdLml0ZW1zID0gW1xuICAgICAgICAgICAgICAgIHtzcmM6IHNlbGYuZGlTZXJ2aWNlLmVyckltZ1VSTH1cbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICBjYWxsYmFjay5jYWxsKHNlbGYsIGVycltzZXROYW1lXSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgdXBkYXRlTWVkaWFTZXQ6IGZ1bmN0aW9uIChzZXROYW1lKSB7XG4gICAgICAgIHRoaXMuX2dldFNldChzZXROYW1lLCB0aGlzLl91cGRhdGVWaWV3ZXIpO1xuICAgIH0sXG4gICAgX2NyZWF0ZVZpZXdlcjogZnVuY3Rpb24gKHNldERhdGEpIHtcbiAgICAgICAgdGhpcy5zZXREYXRhID0gc2V0RGF0YTtcbiAgICAgICAgdGhpcy5fZW5yaWNoV2l0aFRlbXBsYXRlRGF0YShzZXREYXRhKTtcbiAgICAgICAgdmFyICRyZW5kZXJlZERvbSA9ICQodGhpcy50ZW1wbGF0ZShzZXREYXRhKSk7XG5cbiAgICAgICAgdGhpcy51aS4kZWwuaHRtbCgkcmVuZGVyZWREb20pO1xuXG4gICAgICAgIHRoaXMuX2NhY2hlRG9tKCRyZW5kZXJlZERvbSk7XG4gICAgICAgIHRoaXMuX2luaXRDb21wb25lbnRzKHRydWUpO1xuICAgICAgICB0aGlzLl9iaW5kRXZlbnRzKCk7XG4gICAgICAgIHRoaXMucHJldmVudFN3aXBlKCk7XG5cbiAgICAgICAgLy9wYXVzZSBhbGwgYW1wLXZpZGVvIHdlIGhhdmUgYWNjZXNzIHRvXG4gICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMudmlkZW9Db250cm9sbGVyLnBhdXNlQWxsVmlkZW8oKTtcbiAgICB9LFxuICAgIF91cGRhdGVWaWV3ZXI6IGZ1bmN0aW9uIChzZXREYXRhKSB7XG4gICAgICAgIHRoaXMuc2V0RGF0YSA9IHNldERhdGE7XG4gICAgICAgIHZhciBtYWluSXRlbXMgPSAnJztcbiAgICAgICAgdmFyIG5hdkl0ZW1zID0gJyc7XG5cbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHNldERhdGEuaXRlbXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBpdGVtVmlld01vZGVsID0ge2l0ZW06IHNldERhdGEuaXRlbXNbaV0sIHRlbXBsYXRlczogdGhpcy50ZW1wbGF0ZXMsIHByb2R1Y3ROYW1lOiB0aGlzLnByb2R1Y3ROYW1lfTtcbiAgICAgICAgICAgIG1haW5JdGVtcyArPSB0aGlzLnRlbXBsYXRlTWFpbkl0ZW0oaXRlbVZpZXdNb2RlbCk7XG4gICAgICAgICAgICBuYXZJdGVtcyArPSB0aGlzLnRlbXBsYXRlTmF2SXRlbShpdGVtVmlld01vZGVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vdGVtcG9yYXJpbHkgc2V0IGhlaWdodCB0byBwYXJlbnQgY29udGFpbmVyLCB3aGljaCB3aWxsIGJlIHVuc2V0IGxhdGVyXG4gICAgICAgIHRoaXMudWkuJG1haW4uY2xvc2VzdCgnLmFtcC1tYWluLWNvbnRhaW5lcicpLmNzcyh7XG4gICAgICAgICAgICBoZWlnaHQ6IHRoaXMudWkuJG1haW4uY3NzKCdoZWlnaHQnKSxcbiAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJ1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9kZXN0cm95Q29tcG9uZW50cygpO1xuICAgICAgICB0aGlzLnVpLiRtYWluLmh0bWwobWFpbkl0ZW1zKTtcbiAgICAgICAgdGhpcy51aS4kbmF2Lmh0bWwobmF2SXRlbXMpO1xuICAgICAgICB0aGlzLl9pbml0Q29tcG9uZW50cygpO1xuICAgICAgICB0aGlzLl9vbk1haW5TbGlkZUNoYW5nZSgpO1xuICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLm5hdkNvbnRyb2xsZXIucmVzZXQoKTtcbiAgICAgICAgdGhpcy51aS5jb250cm9sbGVycy5xdWlja0xpbmtzQ29udHJvbGxlci5pbml0KCk7XG4gICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMuYm94Q29udHJvbGxlci5yZXNldCgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVpLmNvbnRyb2xsZXJzLnVpSGludENvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMudWlIaW50Q29udHJvbGxlci5pbml0KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudWkuY29udHJvbGxlcnMuem9vbUNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMuem9vbUNvbnRyb2xsZXIucmVzZXQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vcGF1c2UgYWxsIGFtcC12aWRlbyB3ZSBoYXZlIGFjY2VzcyB0b1xuICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnZpZGVvQ29udHJvbGxlci5wYXVzZUFsbFZpZGVvKCk7XG5cbiAgICAgICAgLy9pbml0IHNpemVzIGZvciBhbGwgdmlkZW9cbiAgICAgICAgdGhpcy51aS5jb250cm9sbGVycy52aWRlb0NvbnRyb2xsZXIuX3Jlc2l6ZUFsbFZpZGVvKCk7XG5cbiAgICAgICAgdGhpcy5wcmV2ZW50U3dpcGUoKTtcblxuICAgICAgICB0aGlzLnVpLiRlbC5maW5kKCcuYW1wLW1vei1pbnZpc2libGUnKS5yZW1vdmVDbGFzcygnYW1wLW1vei1pbnZpc2libGUnKTtcbiAgICB9LFxuICAgIF9yZXNpemVCYXNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fcmVzaXplID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNpemUoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnZpZGVvQ29udHJvbGxlci5fZGVib3VuY2VkUmVzaXplVmlkZW8oKTtcbiAgICB9LFxuICAgIF9wYXJlbnRDdXJyZW50U2xpZGVTcGluc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKHNlbGYucGFyZW50Vmlld2VyICYmIHNlbGYudmlld2VyVHlwZSA9PT0gJ2Z1bGxzY3JlZW4nKSB7XG4gICAgICAgICAgICB2YXIgJHBhcmVudFNsaWRlID0gc2VsZi5wYXJlbnRWaWV3ZXIuJGN1cnJlbnRTbGlkZTtcbiAgICAgICAgICAgIGlmICgkcGFyZW50U2xpZGUuZmluZCgnLmFtcC1zcGluc2V0JykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIF9pbml0Q29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHNlbGYudWkuJG1haW4uZmluZCgnW2RhdGEtYW1wLXNyY10nKS5hbXBJbWFnZSgpO1xuXG4gICAgICAgIC8vY2FsbCB2aWV3ZXIgc3BlY2lmaWNcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9pbml0Vmlld2VyQ29tcG9uZW50cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5faW5pdFZpZXdlckNvbXBvbmVudHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzcGluc2V0QXV0b3BsYXkgPSB0aGlzLl9wYXJlbnRDdXJyZW50U2xpZGVTcGluc2V0KCkgPyBmYWxzZSA6IHRydWU7XG4gICAgICAgIHZhciBwcmVsb2FkVHlwZSA9ICd2aXNpYmxlJztcbiAgICAgICAgdmFyIHNwaW5zZXRQcmVsb2FkRmlyc3QgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLnVpLiRtYWluLmZpbmQoJy5hbXAtc3BpbnNldCcpLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYudWkuY3VycmVudFNsaWRlKCkuZmluZCgnLmFtcC1zcGluc2V0JykubGVuZ3RoID4gMCAmJiAhc3BpbnNldFByZWxvYWRGaXJzdCkge1xuICAgICAgICAgICAgICAgIHByZWxvYWRUeXBlID0gJ2NyZWF0ZWQnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkVHlwZSA9ICd2aXNpYmxlJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3BpbnNldFByZWxvYWRGaXJzdCA9IHRydWU7XG5cbiAgICAgICAgICAgICQodGhpcykuYW1wU3Bpbih7XG4gICAgICAgICAgICAgICAgJ3ByZWxvYWQnOiBwcmVsb2FkVHlwZSxcbiAgICAgICAgICAgICAgICAnZ2VzdHVyZSc6IHsnZW5hYmxlZCc6IHRydWUsICdmaW5nZXJzJzogMX0sXG4gICAgICAgICAgICAgICAgJ3BsYXknOiB7J29uTG9hZCc6IHNwaW5zZXRBdXRvcGxheSwgJ29uVmlzaWJsZSc6IGZhbHNlLCAncmVwZWF0JzogMX0sXG4gICAgICAgICAgICAgICAgJ2NoYW5nZSc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyICRjdXJyZW50U2xpZGUgPSBzZWxmLnVpLmN1cnJlbnRTbGlkZSgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51aS5jb250cm9sbGVycy56b29tQ29udHJvbGxlciAmJiAkY3VycmVudFNsaWRlLmZpbmQoJy5hbXAtc3BpbnNldCcpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudWkuY29udHJvbGxlcnMuem9vbUNvbnRyb2xsZXIucmVzZXQoJGN1cnJlbnRTbGlkZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLWJveCcpLmFtcFN0YWNrKCk7XG5cbiAgICAgICAgdmFyIHJlY2xpbmVyUHJlbG9hZEZpcnN0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXJlY2xpbmVyJykuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi51aS5jdXJyZW50U2xpZGUoKS5maW5kKCcuYW1wLXJlY2xpbmVyJykubGVuZ3RoID4gMCAmJiAhcmVjbGluZXJQcmVsb2FkRmlyc3QpIHtcbiAgICAgICAgICAgICAgICBwcmVsb2FkVHlwZSA9ICdjcmVhdGVkJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcHJlbG9hZFR5cGUgPSAndmlzaWJsZSc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlY2xpbmVyUHJlbG9hZEZpcnN0ID0gdHJ1ZTtcblxuICAgICAgICAgICAgJCh0aGlzKS5hbXBTcGluKHtcbiAgICAgICAgICAgICAgICAncHJlbG9hZCc6IHByZWxvYWRUeXBlLFxuICAgICAgICAgICAgICAgICdkZWxheSc6IDYwMCxcbiAgICAgICAgICAgICAgICAnbW9tZW50dW0nOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAnZHJhZ0Rpc3RhbmNlJzogNjAwLFxuICAgICAgICAgICAgICAgICdnZXN0dXJlJzogeydlbmFibGVkJzogdHJ1ZSwgJ2ZpbmdlcnMnOiAxfSxcbiAgICAgICAgICAgICAgICAncGxheSc6IHsnb25Mb2FkJzogc3BpbnNldEF1dG9wbGF5LCAnb25WaXNpYmxlJzogZmFsc2UsICdyZXBlYXQnOiAxfSxcbiAgICAgICAgICAgICAgICAnY2hhbmdlJzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51aS5jb250cm9sbGVycy56b29tQ29udHJvbGxlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi51aS5jb250cm9sbGVycy56b29tQ29udHJvbGxlci5yZXNldChzZWxmLnVpLmN1cnJlbnRTbGlkZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnVpLiRtYWluLmZpbmQoJ1tkYXRhLWFtcC1zcmNdJykuYW1wSW1hZ2UoKTtcblxuICAgICAgICB0aGlzLnVpLiRtYWluLmZpbmQoJy5hbXAtdmlkZW8nKS5hbXBWaWRlbyh7XG4gICAgICAgICAgICAncGF1c2VPbkhpZGUnOiBmYWxzZSxcbiAgICAgICAgICAgICdyZXNwb25zaXZlJzogZmFsc2UsXG4gICAgICAgICAgICAnc2tpbic6ICdhbXAtdmlkZW8tc2tpbicsXG4gICAgICAgICAgICAnc3dmVXJsJzogdGhpcy5hc3NldHNQYXRoLFxuICAgICAgICAgICAgJ2xvb3AnOiBmYWxzZSxcbiAgICAgICAgICAgICdlbmFibGVTb2Z0U3RhdGVzJzogZmFsc2UsXG4gICAgICAgICAgICAncHJlbG9hZCc6IHNlbGYuY29uZmlnUGFyYW1zLnByZWxvYWRWaWRlb3NcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIHZpZGVvcyA9IHRoaXMudWkuJG1haW4uZmluZCgndmlkZW8nKTtcbiAgICAgICAgdmFyIGFyclZpZGVvcyA9IHZpZGVvcy50b0FycmF5KCk7XG4gICAgICAgIHZhciBpT1MgPSAvaVBhZHxpUGhvbmV8aVBvZC8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSAmJiAhd2luZG93Lk1TU3RyZWFtO1xuICAgICAgICB2YXIgdG91Y2hQbEJ0biA9ICQoJy5hbXAtdWktdG91Y2gnKS5maW5kKCcudmpzLWJpZy1wbGF5LWJ1dHRvbicpO1xuXG4gICAgICAgIGlmICghaU9TKSB7XG4gICAgICAgICAgICB0b3VjaFBsQnRuLmNzcygnZGlzcGxheScsICdub25lJywgJ2ltcG9ydGFudCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vcmVtb3ZpbmcgcG9zdGVyIGF0dHJpYnV0ZSBhZnRlciBmaXJzdCBwbGF5XG4gICAgICAgIC8vZm9yIGZpeGluZyBpcGFkIGJ1Z1xuICAgICAgICBpZiAoIWlPUykge1xuICAgICAgICAgICAgdG91Y2hQbEJ0bi5jc3MoJ2Rpc3BsYXknLCAnbm9uZScsICdpbXBvcnRhbnQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFyclZpZGVvcy5mb3JFYWNoKGZ1bmN0aW9uIChlbCkge1xuICAgICAgICAgICAgJChlbCkub24oJ3BsYXknLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgJChlbCkucmVtb3ZlQXR0cigncG9zdGVyJyk7XG4gICAgICAgICAgICAgICAgJChlbCkub2ZmKCdwbGF5Jyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBfdXBkYXRlU2V0RGF0YTogZnVuY3Rpb24gKHNldERhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgIHNldERhdGEgPSBzZXREYXRhW3RoaXMuc2V0TmFtZV07XG4gICAgICAgIHZhciBpdGVyYXRvciA9IHNldERhdGEuaXRlbXMubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlIChpdGVyYXRvci0tKSB7XG4gICAgICAgICAgICB2YXIgaXRlbSA9IHNldERhdGEuaXRlbXNbaXRlcmF0b3JdO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2lzU3BlY2lhbFNldChpdGVtKSkge1xuICAgICAgICAgICAgICAgIGlmIChpdGVtLnNldCAmJiBpdGVtLnNldC5pdGVtcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5yZWNsaW5lciA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5ib3ggPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXRlbS5taW1lVHlwZSA9PT0gJ3RleHQvaHRtbCcpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FwYWJpbGl0eURldGVjdGlvbi5jYW5XZWJHTCgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uY29udGVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2V0RGF0YS5pdGVtcy5zcGxpY2UoaXRlcmF0b3IsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXRlbS5tZWRpYSkge1xuICAgICAgICAgICAgICAgIGl0ZW0udmlkV2lkdGggPSBpdGVtLm1lZGlhWzBdLndpZHRoO1xuICAgICAgICAgICAgICAgIGl0ZW0udmlkSGVpZ2h0ID0gaXRlbS5tZWRpYVswXS5oZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCBzZXREYXRhKTtcbiAgICB9LFxuICAgIF9nZXROYW1lRnJvbVVybDogZnVuY3Rpb24gKHNyYykge1xuICAgICAgICByZXR1cm4gc3JjLnN1YnN0cmluZyhzcmMubGFzdEluZGV4T2YoJy8nKSArIDEsIHNyYy5sZW5ndGgpO1xuICAgIH0sXG4gICAgX2NhY2hlRG9tOiBmdW5jdGlvbiAoJHJlbmRlcmVkRG9tKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgJC5leHRlbmQoc2VsZi51aSwge1xuICAgICAgICAgICAgJG1haW46ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLXZpZXdlci1tYWluJyksXG4gICAgICAgICAgICAkbmF2OiAkcmVuZGVyZWREb20uZmluZCgnLmFtcC1uYXZpZ2F0aW9uLW1haW4nKSxcbiAgICAgICAgICAgIGNvbnRyb2xzOiB7XG4gICAgICAgICAgICAgICAgJG5leHQ6ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLW5hdi1wcmV2JyksXG4gICAgICAgICAgICAgICAgJHByZXY6ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLW5hdi1uZXh0JylcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBxdWlja0xpbmtzOiB7XG4gICAgICAgICAgICAgICAgJHNwaW5zZXRMaW5rOiAkcmVuZGVyZWREb20uZmluZCgnLmFtcC1xdWlja2xpbmstc3BpbnNldCcpLFxuICAgICAgICAgICAgICAgICRyZWNsaW5lckxpbms6ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLXF1aWNrbGluay1yZWNsaW5lcicpLFxuICAgICAgICAgICAgICAgICRib3hMaW5rOiAkcmVuZGVyZWREb20uZmluZCgnLmFtcC1xdWlja2xpbmstYm94JyksXG4gICAgICAgICAgICAgICAgJHZpZGVvTGluazogJHJlbmRlcmVkRG9tLmZpbmQoJy5hbXAtcXVpY2tsaW5rLXZpZGVvJylcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb250cm9sbGVyczoge1xuICAgICAgICAgICAgICAgIG5hdkNvbnRyb2xsZXI6IG51bGwsXG4gICAgICAgICAgICAgICAgdWlIaW50Q29udHJvbGxlcjogbnVsbFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1haW5TZWxlY3Q6IGZ1bmN0aW9uIChzbGlkZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgc2VsZi51aS4kbWFpbi5hbXBDYXJvdXNlbCgnc2VsZWN0Jywgc2xpZGVJbmRleCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0TWFpbkNoaWxkcmVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYudWkuJG1haW4uZmluZCgnLmFtcC1hbmltLWNvbnRhaW5lcicpLmNoaWxkcmVuKCk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY3VycmVudFNsaWRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbGYudWkuJG1haW4uZmluZCgnLmFtcC1zbGlkZS5hbXAtdmlzaWJsZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvL2NhbGwgdmlld2VyIHNwZWNpZmljIGRvbSBjYWNoaW5nXG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fY2FjaGVWaWV3ZXJEb20gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhY2hlVmlld2VyRG9tKCRyZW5kZXJlZERvbSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9iaW5kRXZlbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLm5hdkNvbnRyb2xsZXIgPSBuZXcgTmF2Q29udHJvbGxlcihcbiAgICAgICAgICAgICAgICB0aGlzLnVpLiRuYXYsXG4gICAgICAgICAgICAgICAgdGhpcy51aS4kbWFpbixcbiAgICAgICAgICAgICAgICB0aGlzLnVpLmNvbnRyb2xzLiRwcmV2LFxuICAgICAgICAgICAgICAgIHRoaXMudWkuY29udHJvbHMuJG5leHQsXG4gICAgICAgICAgICAgICAgdGhpcy51aS5tYWluU2VsZWN0XG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi51aS4kZWwuZmluZCgnLmFtcC1tb3otaW52aXNpYmxlJykucmVtb3ZlQ2xhc3MoJ2FtcC1tb3otaW52aXNpYmxlJyk7XG4gICAgICAgIH0sIDI1MCk7XG5cbiAgICAgICAgdGhpcy51aS5jb250cm9sbGVycy52aWRlb0NvbnRyb2xsZXIgPSBuZXcgVmlkZW9Db250cm9sbGVyKHRoaXMudWkuJG1haW4sIHRoaXMudWkuY3VycmVudFNsaWRlKTtcblxuICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnF1aWNrTGlua3NDb250cm9sbGVyID0gbmV3IFF1aWNrTGlua3NDb250cm9sbGVyKFxuICAgICAgICAgICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMubmF2Q29udHJvbGxlcixcbiAgICAgICAgICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnpvb21Db250cm9sbGVyLFxuICAgICAgICAgICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMudmlkZW9Db250cm9sbGVyLFxuICAgICAgICAgICAgICAgIHRoaXMudWkuJG1haW4sXG4gICAgICAgICAgICAgICAgdGhpcy51aS5xdWlja0xpbmtzLFxuICAgICAgICAgICAgICAgIHRoaXMudWkuY3VycmVudFNsaWRlLFxuICAgICAgICAgICAgICAgIHRoaXMudWkuZ2V0TWFpbkNoaWxkcmVuLFxuICAgICAgICAgICAgICAgIHRoaXMudWkub3BlbkZ1bGxzY3JlZW5WaWV3ZXJcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnVpSGludENvbnRyb2xsZXIgPSBuZXcgVWlIaW50Q29udHJvbGxlcihcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHBhc3MgdGltZXJzIGZvciBtb2JpbGUgaW5mb3JtYXRpb24gb3ZlcmxheXMuIE1heSBiZSB7T2JqZWN0fSBvciB7Qm9vbGVhbn1mYWxzZSBpZiB0aW1lcnMgYXJlIG5vdCBzZXRcbiAgICAgICAgICAgICAgICAgICAgdWlIaW50VGltZXJzOiBzZWxmLnVpSGludFRpbWVyc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgKTtcblxuICAgICAgICAvKiBpbml0IHVpSGludENvbnRyb2xsZXIgKi9cbiAgICAgICAgdGhpcy51aS5jb250cm9sbGVycy51aUhpbnRDb250cm9sbGVyLmluaXQoc2VsZik7XG5cbiAgICAgICAgdGhpcy51aS5jb250cm9sbGVycy5ib3hDb250cm9sbGVyID0gbmV3IEJveENvbnRyb2xsZXIoXG4gICAgICAgICAgICAgICAgdGhpcy51aS4kbWFpbiwgdGhpcy51aS5xdWlja0xpbmtzLiRib3hMaW5rLFxuICAgICAgICAgICAgICAgIHRoaXMudWkuY29udHJvbGxlcnMucXVpY2tMaW5rc0NvbnRyb2xsZXJcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgIC8vY2FsbCB2aWV3ZXIgc3BlY2lmaWMgZXZlbnQgYmluZGluZ1xuICAgICAgICBpZiAodHlwZW9mIHRoaXMuX2JpbmRWaWV3ZXJFdmVudHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRWaWV3ZXJFdmVudHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uTWFpblNsaWRlQ2hhbmdlKCk7XG4gICAgICAgIGFtcC5zdGF0cy5iaW5kKFtcbiAgICAgICAgICAgIHsndHlwZSc6ICdjYXJvdXNlbCcsICdldmVudCc6ICdjaGFuZ2UnLCAnY2InOiB0aGlzLl9vbk1haW5TbGlkZUNoYW5nZS5iaW5kKHRoaXMpfVxuICAgICAgICBdKTtcblxuICAgICAgICBhbXAuc3RhdHMuYmluZChbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJ3R5cGUnOiAnY2Fyb3VzZWwnLCAnZXZlbnQnOiAnY3JlYXRlZCcsICdjYic6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSGFkIHRvIHNldCBhIHRpbWVvdXQgaGVyZSBiZWNhdXNlIHRoZSBjYWxsYmFjayBkb2Vzbid0IGNhbGN1bGF0ZSB0aGUgaGVpZ2h0IG9mIHRoZSB0aGUgdWkuJG1haW4gcHJvcGVybHlcbiAgICAgICAgICAgICAgICAgICAgLy8gd2hpY2ggSSB0aGluayBpcyBhbiBTREsgYnVnIGFuZCBjb3VsZCBwcm9iYWJseSBiZSBmaXhlZCBsYXRlclxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudWkuY29udHJvbGxlcnMudmlkZW9Db250cm9sbGVyLl9yZXNpemVBbGxWaWRlbygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi51aS4kbWFpbi5jc3Moe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6ICd2aXNpYmxlJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYudWkuJG1haW4uY2xvc2VzdCgnLmFtcC1tYWluLWNvbnRhaW5lcicpLmNzcyh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdmVyZmxvdzogJydcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIH0sIDEwMCk7XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0sXG4gICAgX2VucmljaFdpdGhUZW1wbGF0ZURhdGE6IGZ1bmN0aW9uIChzZXREYXRhKSB7XG4gICAgICAgIHNldERhdGEucHJvZHVjdE5hbWUgPSB0aGlzLnByb2R1Y3ROYW1lO1xuICAgICAgICBzZXREYXRhLnJhbmdlTmFtZSA9IHRoaXMucmFuZ2VOYW1lO1xuICAgICAgICBzZXREYXRhLnRlbXBsYXRlcyA9IHRoaXMudGVtcGxhdGVzO1xuICAgICAgICBzZXREYXRhLmFzc2V0c1BhdGggPSB0aGlzLmFzc2V0c1BhdGg7XG5cbiAgICAgICAgaWYgKGNhcGFiaWxpdHlEZXRlY3Rpb24uY29tbW9uTW9iaWxlRGV2aWNlKCkgfHwgY2FwYWJpbGl0eURldGVjdGlvbi50b3VjaCgpKSB7XG4gICAgICAgICAgICBzZXREYXRhLnRvdWNoID0gJ2FtcC11aS10b3VjaCc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXREYXRhLnRvdWNoID0gJ2FtcC11aS1uby10b3VjaCc7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9pc1NwZWNpYWxTZXQ6IGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIGlmIChpdGVtLnNldFR5cGUgPT09ICdzcGluJyAmJiAvKC4pKl9vY1swLTRdLy50ZXN0KGl0ZW0ubmFtZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuICAgIF9kZXN0cm95Q29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy51aS4kbWFpbi5kYXRhKCdhbXAtYW1wQ2Fyb3VzZWwnKSkge1xuICAgICAgICAgICAgdGhpcy51aS4kbWFpbi5jc3Moe1xuICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMudWkuJG1haW4uYW1wQ2Fyb3VzZWwoJ2Rlc3Ryb3knKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnVpLiRtYWluLmRhdGEoJ2FtcC1hbXBTdGFjaycpKSB7XG4gICAgICAgICAgICB0aGlzLnVpLiRtYWluLmFtcFN0YWNrKCdkZXN0cm95Jyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVpLiRuYXYuYW1wQ2Fyb3VzZWwoJ2Rlc3Ryb3knKTtcblxuICAgICAgICBpZiAodGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXNwaW5zZXQnKS5kYXRhKCdhbXAtYW1wU3BpbicpKSB7XG4gICAgICAgICAgICB0aGlzLnVpLiRtYWluLmZpbmQoJy5hbXAtc3BpbnNldCcpLmFtcFNwaW4oJ2Rlc3Ryb3knKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXJlY2xpbmVyJykuZGF0YSgnYW1wLWFtcFNwaW4nKSkge1xuICAgICAgICAgICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXJlY2xpbmVyJykuYW1wU3BpbignZGVzdHJveScpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudWkuJG1haW4uZmluZCgnW2RhdGEtYW1wLXNyY10nKS5hbXBJbWFnZSgnZGVzdHJveScpO1xuICAgICAgICAvL1RPRE86IHVwZGF0ZSBTREsgdmlkZW8gZGVzdHJveSBtZXRob2RzIHNvIGl0IGNsZWFucyB1cCB3aW5kb3cgcmVzaXplIGxpc3RlbmVyc1xuICAgICAgICAvL2JydXRlIGZvcmNpbmcgbm8gZnVydGhlciBhY3Rpb24gb24gd2luZG93IHJlc2l6ZSBmb3Igbm93XG4gICAgICAgIGlmICh0aGlzLnVpLiRtYWluLmZpbmQoJy5hbXAtdmlkZW8nKS5kYXRhKCdhbXAtYW1wVmlkZW8nKSkge1xuICAgICAgICAgICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXZpZGVvJykuZGF0YSgnYW1wLWFtcFZpZGVvJykuX2NhbGNTaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMudWkuJG1haW4uZmluZCgnLmFtcC12aWRlbycpLmFtcFZpZGVvKCdkZXN0cm95Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy9jYWxsIHZpZXdlciBzcGVjaWZpYyBkZXN0cm95XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy5fZGVzdHJveVZpZXdlckNvbXBvbmVudHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lWaWV3ZXJDb21wb25lbnRzKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9vbk1haW5TbGlkZUNoYW5nZTogZnVuY3Rpb24gKCRlbCkge1xuICAgICAgICBpZiAoJGVsICYmICEkZWwuaXModGhpcy51aS4kbWFpbikpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyICRzcGluID0gbnVsbDtcbiAgICAgICAgdmFyIHNwaW5EYXRhID0gbnVsbDtcbiAgICAgICAgdmFyICR3ZWJnbCA9IG51bGw7XG4gICAgICAgIHZhciAkdmlkZW8gPSBudWxsO1xuICAgICAgICB2YXIgaGFzT2xkU2xpZGUgPSBmYWxzZTtcblxuICAgICAgICBzZWxmLiRvbGRTbGlkZSA9IHNlbGYuJGN1cnJlbnRTbGlkZTtcbiAgICAgICAgc2VsZi4kY3VycmVudFNsaWRlID0gc2VsZi51aS5jdXJyZW50U2xpZGUoKTtcblxuICAgICAgICBoYXNPbGRTbGlkZSA9IHNlbGYuJG9sZFNsaWRlICYmIHNlbGYuJG9sZFNsaWRlLmxlbmd0aDtcblxuICAgICAgICAkc3BpbiA9IHNlbGYuJGN1cnJlbnRTbGlkZS5maW5kKCcuYW1wLXNwaW4nKTtcbiAgICAgICAgc3BpbkRhdGEgPSAkc3Bpbi5kYXRhKCdhbXAtYW1wU3BpbicpO1xuICAgICAgICBpZiAoc3BpbkRhdGEgJiYgIXNwaW5EYXRhLl9sb2FkaW5nKSB7XG4gICAgICAgICAgICAkc3Bpbi5hbXBTcGluKCdwbGF5UmVwZWF0JywgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvL2xhenkgbG9hZGluZyB3ZWJnbCBhc3NldHNcbiAgICAgICAgJHdlYmdsID0gc2VsZi4kY3VycmVudFNsaWRlLmZpbmQoJy5hbXAtd2ViZ2wnKTtcbiAgICAgICAgaWYgKCR3ZWJnbC5sZW5ndGggJiYgISR3ZWJnbC5odG1sKCkpIHtcbiAgICAgICAgICAgICR3ZWJnbC5odG1sKCR3ZWJnbC5hdHRyKCdkYXRhLWFtcC13ZWJnbCcpKTtcbiAgICAgICAgfSBlbHNlIGlmIChoYXNPbGRTbGlkZSkge1xuICAgICAgICAgICAgLy9yZW1vdmUgYW55IGxvYWRlZCB3ZWJnbCBpZnJhbWUgd2hlbiBub3QgdmlzaWJsZSBiZWNhdXNlIGl0IGlzIHRvbyByZXNvdXJjZSBodW5ncnlcbiAgICAgICAgICAgICR3ZWJnbCA9IHNlbGYuJG9sZFNsaWRlLmZpbmQoJy5hbXAtd2ViZ2wnKTtcbiAgICAgICAgICAgIGlmICgkd2ViZ2wubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgJHdlYmdsLmh0bWwoJycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9tYW51YWxseSBhZGRpbmcgcGF1c2Ugb24gaGlkZSBmdW5jdGlvbmFsaXR5XG4gICAgICAgIGlmIChoYXNPbGRTbGlkZSkge1xuICAgICAgICAgICAgJHZpZGVvID0gc2VsZi4kb2xkU2xpZGUuZmluZCgnLmFtcC12aWRlbycpO1xuICAgICAgICAgICAgaWYgKCR2aWRlby5sZW5ndGggJiYgJHZpZGVvLmRhdGEoJ2FtcEFtcFZpZGVvJykpIHtcbiAgICAgICAgICAgICAgICAkdmlkZW8uYW1wVmlkZW8oJ3BhdXNlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTeW5jaHJvbml6ZSB0aGUgc2VsZWN0ZWQgc2xpZGUgaW4gdGhlIG5hdiAtIGNoYW5nZSBtYXkgaGF2ZSBvcmlnaW5hdGVkIGZyb20gbWFpbiBjYXJvdXNlbFxuICAgICAgICB2YXIgc2xpZGVJbmRleCA9IHNlbGYuJGN1cnJlbnRTbGlkZS5pbmRleCgpO1xuICAgICAgICB2YXIgJG5hdiA9IHNlbGYudWkuJG5hdjtcbiAgICAgICAgdmFyICRzZWxlY3RlZE5hdlNsaWRlID0gJG5hdi5maW5kKCcuYW1wLXNsaWRlLmFtcC1zZWxlY3RlZCcpO1xuICAgICAgICBpZiAoJHNlbGVjdGVkTmF2U2xpZGUuaW5kZXgoKSAhPT0gc2xpZGVJbmRleCkge1xuICAgICAgICAgICAgLy8gb25seSBjaGFuZ2UgbmF2IGlmIHRoZSBzZWxlY3RlZCBzbGlkZSBpcyBkaWZmZXJlbnQgdG8gYXZvaWQgbG9vcGluZ1xuICAgICAgICAgICAgLy92YXIgdGh1bWJTbGlkZVRvU2VsZWN0ID0gc2VsZi51aS4kbmF2LmZpbmQoJy5hbXAtc2xpZGUnKVtzbGlkZUluZGV4XTtcbiAgICAgICAgICAgIC8vc2VsZi51aS5jb250cm9sbGVycy5uYXZDb250cm9sbGVyLnNlbGVjdCh0aHVtYlNsaWRlVG9TZWxlY3QpO1xuICAgICAgICAgICAgc2VsZi51aS5jb250cm9sbGVycy5uYXZDb250cm9sbGVyLnNlbGVjdChzbGlkZUluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZWxmLnVpLmNvbnRyb2xsZXJzLnpvb21Db250cm9sbGVyKSB7XG4gICAgICAgICAgICBzZWxmLnVpLmNvbnRyb2xsZXJzLnpvb21Db250cm9sbGVyLnJlc2V0KHNlbGYuJG9sZFNsaWRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYudWkuY29udHJvbGxlcnMucXVpY2tMaW5rc0NvbnRyb2xsZXIucmVzZXQoc2VsZi4kb2xkU2xpZGUpO1xuICAgICAgICAvLyByZXNldCBhbnkgVUkgSGludHMgZm9yIHRoaXMgc2xpZGVcblxuICAgICAgICBzZWxmLnVpLmNvbnRyb2xsZXJzLnVpSGludENvbnRyb2xsZXIudXBkYXRlKCk7XG5cbiAgICAgICAgaWYgKHNlbGYucGFyZW50Vmlld2VyKSB7XG4gICAgICAgICAgICBpZiAoc2VsZi5wYXJlbnRWaWV3ZXIudWkuY3VycmVudFNsaWRlKCkuaW5kZXgoKSAhPT0gc2xpZGVJbmRleCkge1xuICAgICAgICAgICAgICAgIHNlbGYucGFyZW50Vmlld2VyLnVpLmNvbnRyb2xsZXJzLm5hdkNvbnRyb2xsZXIuc2VsZWN0KHNsaWRlSW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzZWxmLmZ1bGxzY3JlZW4pIHtcbiAgICAgICAgICAgIGlmIChzZWxmLmZ1bGxzY3JlZW4udWkuY3VycmVudFNsaWRlKCkuaW5kZXgoKSAhPT0gc2xpZGVJbmRleCkge1xuICAgICAgICAgICAgICAgIHNlbGYuZnVsbHNjcmVlbi51aS5jb250cm9sbGVycy5uYXZDb250cm9sbGVyLnNlbGVjdChzbGlkZUluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzZWxmLnVpLmNvbnRyb2xsZXJzLnZpZGVvQ29udHJvbGxlci5fcmVzaXplQ3VycmVudFZpZGVvKCk7XG4gICAgfSxcbiAgICBwcmV2ZW50U3dpcGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy9wcmV2ZW50IHN3aXBlIG9uIGFyZWEgd2hpY2ggcmVzcG9uc2libGUgdG8gdXNlICdiYWNrJyBnZXN0dXJlc1xuXG4gICAgICAgIGlmICgkKCcuYW1wLW1haW4tY29udGFpbmVyJykuY2hpbGRyZW4oJy5hbXAtY2Fyb3VzZWwnKS5jaGlsZHJlbignZGl2JykubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgIChmdW5jdGlvbiBwcmV2ZW50U3dpcGVEdWJsaWNhdGUoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlbCA9ICQoJy5hbXAtbWFpbi1jb250YWluZXInKS5jaGlsZHJlbignLmFtcC1jYXJvdXNlbCcpO1xuICAgICAgICAgICAgICAgIHZhciBvdmVybGF5RWwgPSAkKCc8ZGl2IGlkPVwib3ZlcmxheVN3aXBlXCIvPicpO1xuICAgICAgICAgICAgICAgIHNlbC5hcHBlbmQob3ZlcmxheUVsKTtcblxuICAgICAgICAgICAgICAgICQoJyNvdmVybGF5U3dpcGUnKS5vbigndG91Y2hzdGFydCBtb3VzZWRvd24nLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBQcmV2ZW50IGNhcm91c2VsIHN3aXBlXG4gICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH0pKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGRpc2FibGVUb3VjaFNjcm9sbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAkKGRvY3VtZW50KS5vbigndG91Y2htb3ZlLmRpc2FibGVUb3VjaFNjcm9sbCcsIGZ1bmN0aW9uIChldnQpIHtcbiAgICAgICAgICAgIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGVuYWJsZVRvdWNoU2Nyb2xsOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICQoZG9jdW1lbnQpLm9mZigndG91Y2htb3ZlLmRpc2FibGVUb3VjaFNjcm9sbCcpO1xuICAgIH0sXG4gICAgZGlzYWJsZUNzc1Njcm9sbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAkKCdib2R5LCBodG1sJykuYWRkQ2xhc3MoJ2FtcC1vdmVyZmxvdy1oaWRkZW4nKTtcbiAgICB9LFxuICAgIGVuYWJsZUNzc1Njcm9sbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAkKCdib2R5LCBodG1sJykucmVtb3ZlQ2xhc3MoJ2FtcC1vdmVyZmxvdy1oaWRkZW4nKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VWaWV3ZXI7XG4iLCJcInVzZSBzdHJpY3RcIjtcbi8qanNoaW50IGJyb3dzZXJpZnk6IHRydWUgKi9cbnZhciAkID0gcmVxdWlyZSgnLi9qcXVlcnknKTtcbnZhciBCb3hDb250cm9sbGVyID0gZnVuY3Rpb24gKCRtYWluLCAkYm94TGluaywgcXVpY2tMaW5rc0NvbnRyb2xsZXIpIHtcbiAgICB0aGlzLnVpID0ge1xuICAgICAgICAkbWFpbjogJG1haW4sXG4gICAgICAgICRib3hMaW5rOiAkYm94TGlua1xuICAgIH07XG5cbiAgICB0aGlzLl9iaW5kRXZlbnRzKCk7XG4gICAgdGhpcy5xdWlja0xpbmtzQ29udHJvbGxlciA9IHF1aWNrTGlua3NDb250cm9sbGVyO1xufTtcblxuQm94Q29udHJvbGxlci5wcm90b3R5cGUgPSB7XG4gICAgX2JpbmRFdmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHNlbGYudWkuJG1haW4uZmluZCgnLmFtcC1ib3gnKS5jbGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xuICAgICAgICAgICAgdmFyIHNlbGVjdGVkSW5kZXggPSAkdGhpcy5maW5kKCcuYW1wLXNlbGVjdGVkJykuaW5kZXgoKTtcbiAgICAgICAgICAgIHZhciB0b2dnbGVkSW5kZXggPSAhc2VsZWN0ZWRJbmRleDtcbiAgICAgICAgICAgIGlmICgkdGhpcy5kYXRhKCdhbXAtYW1wU3RhY2snKSkge1xuICAgICAgICAgICAgICAgIHNlbGYucXVpY2tMaW5rc0NvbnRyb2xsZXIucXVpY2tsaW5rTW9kZWwuJGJveExpbmsub3BlbiA9IHRvZ2dsZWRJbmRleDtcbiAgICAgICAgICAgICAgICAkdGhpcy5hbXBTdGFjaygnZ29UbycsIHRvZ2dsZWRJbmRleCArIDEpO1xuICAgICAgICAgICAgICAgIHNlbGYudWkuJGJveExpbmsuZmluZCgnLmFtcC1pY29uLWJveC1vcGVuJykudG9nZ2xlKCk7XG4gICAgICAgICAgICAgICAgc2VsZi51aS4kYm94TGluay5maW5kKCcuYW1wLWljb24tYm94LWNsb3NlJykudG9nZ2xlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9iaW5kRXZlbnRzKCk7XG4gICAgfVxuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJveENvbnRyb2xsZXI7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbnZhciBjYXBhYmlsaXRpZXMgPSB7XG4gICAgY29tbW9uTW9iaWxlRGV2aWNlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIHRoaXMgaXMgbm90IGNvbmNsdXNpdmUsIGJ1dCBzZXJ2ZXMgcmF0aGVyIHRvIHBpY2sgdXAgbW9zdCBlbXVsYXRvcidzIHVzZXJBZ2VudCBzdHJpbmdzLlxuICAgICAgICAvLyBUbyBiZSB1c2VkIGluIGNvbmp1bmN0aW9uIHdpdGggdG91Y2ggZGV0ZWN0aW9uICh2aWEgT1IpXG4gICAgICAgIHZhciBjb21tb25EZXZpY2VSZWdFeCA9IC9hbmRyb2lkfHdlYm9zfGlwaG9uZXxpcGFkfGlwb2R8YmxhY2tiZXJyeXxpZW1vYmlsZXxvcGVyYSBtaW5pL2k7XG5cbiAgICAgICAgcmV0dXJuICEhY29tbW9uRGV2aWNlUmVnRXgudGVzdChuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkpO1xuICAgIH0sXG5cbiAgICB0b3VjaDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ29udG91Y2hzdGFydCcgaW4gd2luZG93O1xuICAgIH0sXG5cbiAgICBjYW5XZWJHTDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuICEhKHdpbmRvdy5XZWJHTFJlbmRlcmluZ0NvbnRleHQgJiYgKGNhbnZhcy5nZXRDb250ZXh0KCd3ZWJnbCcpIHx8XG4gICAgICAgICAgICAgICAgY2FudmFzLmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcpKSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLy9UT0RPOiBHZXQgcmlkIG9mIEFTQVAgOihcbiAgICBnZXRJc0lFOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpc0lFID0gZmFsc2U7XG4gICAgICAgIGlmIChuYXZpZ2F0b3IudXNlckFnZW50LmluZGV4T2YoJ01TSUUnKSAhPT0gLTEgfHwgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZignVHJpZGVudC8nKSA+IDApIHtcbiAgICAgICAgICAgIGlzSUUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpc0lFO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY2FwYWJpbGl0aWVzO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmpzaGludCBicm93c2VyaWZ5OiB0cnVlICovXG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdXRpbHMvbG9nJyk7XG52YXIgJCA9IHJlcXVpcmUoJy4uL2NvbW1vbi9qcXVlcnknKTtcbnZhciBhbXAgPSByZXF1aXJlKCcuLi91dGlscy9uYW1lc3BhY2UnKTtcblxudmFyIGRlZmF1bHRFcnJvclNldCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gW3tzcmM6dGhpcy5kaVNlcnZpY2UuZXJySW1nVVJMfV07XG59O1xuXG52YXIgRGlTZXJ2aWNlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICBpZiAodGhpcy5fdmFsaWRPcHRpb25zKG9wdGlvbnMpKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBvcHRpb25zKTtcblxuICAgICAgICB2YXIgcGF0aCA9IHRoaXMub3B0aW9ucy5wYXRoO1xuXG4gICAgICAgIGlmIChwYXRoLnN1YnN0cmluZyhwYXRoLmxlbmd0aCAtIDEpICE9PSAnLycpIHtcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucy5wYXRoID0gdGhpcy5vcHRpb25zLnBhdGggKyAnLyc7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGluaXRPcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICdjbGllbnRfaWQnOiB0aGlzLm9wdGlvbnMuYWNjb3VudCxcbiAgICAgICAgICAgICAgICAnY2FjaGVfd2luZG93JzoxLFxuICAgICAgICAgICAgICAgICdkaV9iYXNlcGF0aCc6IHRoaXMub3B0aW9ucy5wYXRoXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5jYWNoZUJ1c3QpIHtcbiAgICAgICAgICAgICAgICBpbml0T3B0aW9uc1snY2FjaGVfd2luZG93J10gPSB0aGlzLm9wdGlvbnMuY2FjaGVCdXN0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhbXAuaW5pdChpbml0T3B0aW9ucyk7XG4gICAgICAgICAgICB0aGlzLmVyckltZ1VSTCA9IGFtcC5nZXRBc3NldFVSTCh7dHlwZTonaScsIG5hbWU6dGhpcy5vcHRpb25zLmVyckltZ05hbWV9KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nLndhcm4oJ2ZhaWxlZCB0byBpbml0aWFsaXplIEFtcGxpZW5jZSBESSBBUEknLCBlKTtcbiAgICAgICAgfVxuXG4gICAgfVxufTtcblxuRGlTZXJ2aWNlLnByb3RvdHlwZSA9IHtcbiAgICBfdmFsaWRPcHRpb25zOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBpZiAoIW9wdGlvbnMuYWNjb3VudCkge1xuICAgICAgICAgICAgbG9nLndhcm4oJ1tEaVNlcnZpY2VdIGBhY2NvdW50YCByZXF1aXJlZCB0byBpbml0aWFsaXplIEFQSScpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnBhdGgpIHtcbiAgICAgICAgICAgIGxvZy53YXJuKCdbRGlTZXJ2aWNlXSBgcGF0aGAgcmVxdWlyZWQgdG8gaW5pdGlhbGl6ZSBBUEknKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0aW9ucy5wYXRoKSB7XG4gICAgICAgICAgICBsb2cud2FybignW0RpU2VydmljZV0gYGNvbnRlbnRQYXRoYCByZXF1aXJlZCB0byBpbml0aWFsaXplIEFQSScpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGdldE1lZGlhU2V0OiBmdW5jdGlvbiAoc2V0TmFtZSwgc3VjY2VzcywgZXJyb3IpIHtcbiAgICAgICAgYW1wLmdldCh7XG4gICAgICAgICAgICBuYW1lOiBzZXROYW1lLFxuICAgICAgICAgICAgdHlwZTogJ3MnXG4gICAgICAgIH0sIHN1Y2Nlc3MsIGVycm9yID8gZXJyb3IgOiBkZWZhdWx0RXJyb3JTZXQsIHRoaXMub3B0aW9ucy52aWRlb1NvcnRPcmRlcik7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaVNlcnZpY2U7XG5cbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIGxvZyA9IHJlcXVpcmUoJy4uL3V0aWxzL2xvZycpO1xuXG52YXIgSGFuZGxlYmFycyA9IHdpbmRvdy5IYW5kbGViYXJzO1xuSGFuZGxlYmFycy5yZWdpc3RlckhlbHBlcigncmVuZGVyUGFydGlhbCcsIGZ1bmN0aW9uIChwYXJ0aWFsTmFtZSwgb3B0aW9ucykge1xuICAgIGlmICghcGFydGlhbE5hbWUpIHtcbiAgICAgICAgbG9nLmVycm9yKCdObyBwYXJ0aWFsIG5hbWUgZ2l2ZW4uJyk7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgdmFyIHBhcnRpYWwgPSBIYW5kbGViYXJzLnBhcnRpYWxzW3BhcnRpYWxOYW1lXTtcbiAgICBpZiAoIXBhcnRpYWwpIHtcbiAgICAgICAgbG9nLmVycm9yKCdDb3VsZG50IGZpbmQgdGhlIGNvbXBpbGVkIHBhcnRpYWw6ICcgKyBwYXJ0aWFsTmFtZSk7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBIYW5kbGViYXJzLlNhZmVTdHJpbmcocGFydGlhbChvcHRpb25zLmhhc2gpKTtcbn0pO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyKCdjb21wYXJlJywgZnVuY3Rpb24gKGx2YWx1ZSwgb3BlcmF0b3IsIHJ2YWx1ZSwgb3B0aW9ucykge1xuXG4gICAgdmFyIG9wZXJhdG9ycztcbiAgICB2YXIgcmVzdWx0O1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSGFuZGxlcmJhcnMgSGVscGVyIFwiY29tcGFyZVwiIG5lZWRzIDIgcGFyYW1ldGVycycpO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb3B0aW9ucyA9IHJ2YWx1ZTtcbiAgICAgICAgcnZhbHVlID0gb3BlcmF0b3I7XG4gICAgICAgIG9wZXJhdG9yID0gJz09PSc7XG4gICAgfVxuXG4gICAgb3BlcmF0b3JzID0ge1xuICAgICAgICAnPT09JzogZnVuY3Rpb24gKGwsIHIpIHsgcmV0dXJuIGwgPT09IHI7IH0sXG4gICAgICAgICchPT0nOiBmdW5jdGlvbiAobCwgcikgeyByZXR1cm4gbCAhPT0gcjsgfSxcbiAgICAgICAgJzwnOiBmdW5jdGlvbiAobCwgcikgeyByZXR1cm4gbCA8IHI7IH0sXG4gICAgICAgICc+JzogZnVuY3Rpb24gKGwsIHIpIHsgcmV0dXJuIGwgPiByOyB9LFxuICAgICAgICAnPD0nOiBmdW5jdGlvbiAobCwgcikgeyByZXR1cm4gbCA8PSByOyB9LFxuICAgICAgICAnPj0nOiBmdW5jdGlvbiAobCwgcikgeyByZXR1cm4gbCA+PSByOyB9LFxuICAgICAgICAndHlwZW9mJzogZnVuY3Rpb24gKGwsIHIpIHsgcmV0dXJuIHR5cGVvZiBsID09PSByOyB9XG4gICAgfTtcblxuICAgIGlmICghb3BlcmF0b3JzW29wZXJhdG9yXSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0hhbmRsZXJiYXJzIEhlbHBlciBcImNvbXBhcmVcIiBkb2VzblxcJ3Qga25vdyB0aGUgb3BlcmF0b3IgJyArIG9wZXJhdG9yKTtcbiAgICB9XG5cbiAgICByZXN1bHQgPSBvcGVyYXRvcnNbb3BlcmF0b3JdKGx2YWx1ZSwgcnZhbHVlKTtcblxuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuZm4odGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuaW52ZXJzZSh0aGlzKTtcbiAgICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhhbmRsZWJhcnM7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciAkID0gd2luZG93LiQ7XG5cbm1vZHVsZS5leHBvcnRzID0gJDtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIGFtcCA9IHdpbmRvdy5hbXA7XG5cbm1vZHVsZS5leHBvcnRzID0gYW1wO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmpzaGludCBicm93c2VyaWZ5OiB0cnVlICovXG52YXIgJCA9IHJlcXVpcmUoJy4vanF1ZXJ5Jyk7XG5cbnZhciBOYXZDb250cm9sbGVyID0gZnVuY3Rpb24gKCRuYXYsICRtYWluLCAkbmV4dCwgJHByZXYsIG1haW5TZWxlY3QpIHtcbiAgICB0aGlzLnVpID0ge1xuICAgICAgICAkbmF2OiAkbmF2LFxuICAgICAgICAkbWFpbjogJG1haW4sXG4gICAgICAgICRuZXh0OiAkbmV4dCxcbiAgICAgICAgJHByZXY6ICRwcmV2LFxuICAgICAgICAvL21haW5TZWxlY3Qgd2lsbCBjYWxsIGVpdGhlciBzdGFjayBzZWxlY3Qgb3IgY2Fyb3VzZWwgc2VsZWN0IGRlcGVuZGluZyBvbiB2aWV3ZXJcbiAgICAgICAgbWFpblNlbGVjdDogbWFpblNlbGVjdFxuICAgIH07XG5cbiAgICB0aGlzLnVwZGF0ZU5hdlVJKCk7XG4gICAgdGhpcy5fYmluZEV2ZW50cygpO1xufTtcblxuTmF2Q29udHJvbGxlci5wcm90b3R5cGUgPSB7XG4gICAgX2JpbmRFdmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHNlbGYudWkuJG5hdi5vbignY2xpY2snLCAnLmFtcC1zbGlkZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0KCQodGhpcykuaW5kZXgoKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlbGYudWkuJHByZXYuY2xpY2soJC5wcm94eShzZWxmLnByZXYsIHNlbGYpKTtcbiAgICAgICAgc2VsZi51aS4kbmV4dC5jbGljaygkLnByb3h5KHNlbGYubmV4dCwgc2VsZikpO1xuICAgIH0sXG4gICAgX3Bvc2l0aW9uVmlzaWJsZVRodW1iczogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgLypcbiAgICAgICAgICogSWYgdGh1bWJzIG51bWJlciBpcyBsZXNzIHRoZW4gbWluaW11bSAobm93IGl0IGlzIDQpLFxuICAgICAgICAgKiB0aGVuIGFzc2lnbiB3aWR0aCB0byAnLmFtcC1uYXZpZ2F0aW9uLWNvbnRhaW5lcicsIHNvIGl0IGNvdWxkIGJlIGNlbnRlcmVkXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRzLiR0aHVtYnMgLSBBbGwgdGh1bWJzIHRhZ3NcbiAgICAgICAgICoqL1xuICAgICAgICB2YXIgJHRodW1icyA9IG9wdHMuJHRodW1icztcbiAgICAgICAgdmFyIHRodW1ic0xlbmd0aCA9ICR0aHVtYnMubGVuZ3RoO1xuICAgICAgICB2YXIgJHRodW1ic0NvbnRhaW5lciA9IHRoaXMudWkuJG5hdi5maW5kKCcuYW1wLW5hdmlnYXRpb24tY29udGFpbmVyJyk7XG4gICAgICAgIGlmICgkdGh1bWJzLmZpbHRlcignLmFtcC1wYXJ0aWFsbHktdmlzaWJsZScpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICR0aHVtYnNDb250YWluZXIuY3NzKHt3aWR0aDogJyd9KTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjYWxjdWxhdGVkV2lkdGggPSAoJHRodW1icy5zbGljZSgwLCAxKS5vdXRlcldpZHRoKHRydWUpICogdGh1bWJzTGVuZ3RoKSArXG4gICAgICAgICAgICAodGhpcy51aS4kbmV4dC5vdXRlcldpZHRoKHRydWUpICsgdGhpcy51aS4kcHJldi5vdXRlcldpZHRoKHRydWUpKTtcbiAgICAgICAgJHRodW1ic0NvbnRhaW5lci5jc3Moe1xuICAgICAgICAgICAgd2lkdGg6IGNhbGN1bGF0ZWRXaWR0aCArICdweCdcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBfcmVzaXplTmF2VGh1bWJzT3ZlcmZsb3c6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHZhciAkdGh1bWJzID0gc2VsZi51aS4kbmF2LmZpbmQoJy5hbXAtc2xpZGUnKTtcbiAgICAgICAgc2VsZi5yZXNpemVOYXZ0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgdmFyIHJlc2l6ZUNhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHNlbGYucmVzaXplTmF2dGltZW91dCkge1xuICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRpbWVvdXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgJHRodW1icy5hZGRDbGFzcygnYW1wLW92ZXJmbG93LWhpZGRlbicpO1xuXG4gICAgICAgICAgICBzZWxmLnJlc2l6ZU5hdnRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAkdGh1bWJzID0gc2VsZi51aS4kbmF2LmZpbmQoJy5hbXAtc2xpZGUnKTtcbiAgICAgICAgICAgICAgICAkdGh1bWJzLnJlbW92ZUNsYXNzKCdhbXAtb3ZlcmZsb3ctaGlkZGVuJyk7XG4gICAgICAgICAgICB9LCAyNTApO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gcmVzaXplQ2FsbGJhY2s7XG4gICAgfSxcbiAgICB1cGRhdGVOYXZVSTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJHRodW1icyA9IHRoaXMudmlzaWJsZVRodW1icygpO1xuXG4gICAgICAgIGlmICh0aGlzLnZpc2libGVUaHVtYnMoKS5sZW5ndGggPT09IHRoaXMubnVtYmVyT2ZUaHVtYnMoKSkge1xuICAgICAgICAgICAgdGhpcy51aS4kbmV4dC5jc3MoJ3Zpc2liaWxpdHknLCAnaGlkZGVuJyk7XG4gICAgICAgICAgICB0aGlzLnVpLiRwcmV2LmNzcygndmlzaWJpbGl0eScsICdoaWRkZW4nKTtcbiAgICAgICAgICAgIHRoaXMuX3Bvc2l0aW9uVmlzaWJsZVRodW1icyh7XG4gICAgICAgICAgICAgICAgJHRodW1iczogJHRodW1ic1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmNhbk5leHQoKSkge1xuICAgICAgICAgICAgdGhpcy51aS4kbmV4dC5jc3MoJ3Zpc2liaWxpdHknLCAnaGlkZGVuJyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy52aXNpYmxlVGh1bWJzKCkubGVuZ3RoICE9PSB0aGlzLm51bWJlck9mVGh1bWJzKCkpIHtcbiAgICAgICAgICAgIHRoaXMudWkuJG5leHQuY3NzKCd2aXNpYmlsaXR5JywgJ3Zpc2libGUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5jYW5QcmV2KCkpIHtcbiAgICAgICAgICAgIHRoaXMudWkuJHByZXYuY3NzKCd2aXNpYmlsaXR5JywgJ2hpZGRlbicpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMudmlzaWJsZVRodW1icygpLmxlbmd0aCAhPT0gdGhpcy5udW1iZXJPZlRodW1icygpKSB7XG4gICAgICAgICAgICB0aGlzLnVpLiRwcmV2LmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wb3NpdGlvblZpc2libGVUaHVtYnMoe1xuICAgICAgICAgICAgJHRodW1iczogJHRodW1ic1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGNhbk5leHQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudEluZGV4KCkgPCB0aGlzLm51bWJlck9mVGh1bWJzKCkgLSAxO1xuICAgIH0sXG4gICAgY2FuUHJldjogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50SW5kZXgoKSA+IDA7XG4gICAgfSxcbiAgICBjdXJyZW50SW5kZXg6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudWkuJG5hdi5maW5kKCcuYW1wLXNsaWRlLmFtcC1zZWxlY3RlZCcpLmluZGV4KCk7XG4gICAgfSxcbiAgICB2aXNpYmxlVGh1bWJzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnVpLiRuYXYuZmluZCgnLmFtcC1zbGlkZS5hbXAtdmlzaWJsZScpO1xuICAgIH0sXG4gICAgdG90YWxUaHVtYnNBcnI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGFyciA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IHRoaXMubnVtYmVyT2ZUaHVtYnMoKSArIDE7IGkrKykge1xuICAgICAgICAgICAgYXJyLnB1c2goaSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9LFxuICAgIGdldFZpc2libGVBcnI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHJvb3ROYXZFbCA9IHRoaXMudWkuJG5hdi5maW5kKCcuYW1wLWFuaW0tY29udGFpbmVyJyk7XG4gICAgICAgIHZhciBhc3NldHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChyb290TmF2RWxbMF0uY2hpbGRyZW4pO1xuICAgICAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgICAgIGFzc2V0cy5mb3JFYWNoKGZ1bmN0aW9uIChlbCwgaW5kZXgpIHtcbiAgICAgICAgICAgIGlmICgkKGVsKS5oYXNDbGFzcygnYW1wLXZpc2libGUnKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGluZGV4ICsgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgY3VycmVudFRodW1iQXJyOiBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICAgICAgdmFyIHRvdGFsID0gdGhpcy50b3RhbFRodW1ic0FycigpO1xuICAgICAgICB2YXIgdmlzaWJsZUFzc2V0cyA9IHRoaXMuZ2V0VmlzaWJsZUFycigpO1xuXG4gICAgICAgIHZhciBhbnN3ZXIgPSB7fTtcblxuICAgICAgICB2YXIgY2VudHJhbEVsID0gTWF0aC5mbG9vcih2aXNpYmxlQXNzZXRzLmxlbmd0aCAvIDIpO1xuICAgICAgICB2YXIgZGlyZWN0aW9uID0gdmlzaWJsZUFzc2V0c1tjZW50cmFsRWxdIC0gaW5kZXg7XG5cbiAgICAgICAgaWYgKGRpcmVjdGlvbiA8IDAgJiYgaW5kZXggIT09IHRvdGFsW3RvdGFsLmxlbmd0aCAtIDFdKSB7XG4gICAgICAgICAgICBhbnN3ZXIubmV4dCA9IE1hdGguYWJzKGRpcmVjdGlvbik7XG4gICAgICAgIH0gZWxzZSBpZiAoZGlyZWN0aW9uID4gMCAmJiBpbmRleCAhPT0gdG90YWxbMF0pIHtcbiAgICAgICAgICAgIGFuc3dlci5wcmV2ID0gTWF0aC5hYnMoZGlyZWN0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFuc3dlci5uZXh0ID0gMDtcbiAgICAgICAgICAgIGFuc3dlci5wcmV2ID0gMDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYW5zd2VyO1xuICAgIH0sXG4gICAgbnVtYmVyT2ZUaHVtYnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudWkuJG5hdi5maW5kKCcuYW1wLXNsaWRlJykubGVuZ3RoO1xuICAgIH0sXG4gICAgbmV4dDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY3VyckluZGV4ID0gdGhpcy5jdXJyZW50SW5kZXgoKSArIDE7XG5cbiAgICAgICAgaWYgKGN1cnJJbmRleCA8IHRoaXMubnVtYmVyT2ZUaHVtYnMoKSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRUaHVtYkFycihjdXJySW5kZXggKyAxKS5uZXh0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy51aS4kbmF2LmFtcENhcm91c2VsKCdzZWxlY3QnLCArK2N1cnJJbmRleCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudWkuJG5hdi5hbXBDYXJvdXNlbCgnbmV4dCcpO1xuICAgICAgICAgICAgICAgIHRoaXMudWkuJG5hdi5hbXBDYXJvdXNlbCgnc2VsZWN0JywgKytjdXJySW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51aS5tYWluU2VsZWN0KGN1cnJJbmRleCk7XG4gICAgICAgIHRoaXMudXBkYXRlTmF2VUkoKTtcbiAgICB9LFxuICAgIHByZXY6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGN1cnJJbmRleCA9IHRoaXMuY3VycmVudEluZGV4KCk7XG5cbiAgICAgICAgaWYgKGN1cnJJbmRleCA+IDApIHtcbiAgICAgICAgICAgIC8vIHNlbGVjdCBzdGFydHMgYXQgMSBzbyB0aGlzIHdpbGwgc2VsZWN0IHByZXZpb3VzXG4gICAgICAgICAgICB0aGlzLnVpLiRuYXYuYW1wQ2Fyb3VzZWwoJ3NlbGVjdCcsIGN1cnJJbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jdXJyZW50VGh1bWJBcnIoY3VyckluZGV4KS5wcmV2KSB7XG4gICAgICAgICAgICB0aGlzLnVpLiRuYXYuYW1wQ2Fyb3VzZWwoJ3ByZXYnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudWkubWFpblNlbGVjdChjdXJySW5kZXgpO1xuICAgICAgICB0aGlzLnVwZGF0ZU5hdlVJKCk7XG4gICAgfSxcbiAgICBzZWxlY3Q6IGZ1bmN0aW9uIChlbEluZGV4KSB7XG4gICAgICAgIHZhciBpbmRleCA9IGVsSW5kZXggKyAxO1xuICAgICAgICB2YXIgY2VudHJhbCA9IE1hdGguZmxvb3IodGhpcy52aXNpYmxlVGh1bWJzKCkubGVuZ3RoIC8gMik7XG4gICAgICAgIHZhciBhcnIgPSB0aGlzLmdldFZpc2libGVBcnIoKTtcbiAgICAgICAgdmFyIGRpZmYgPSBpbmRleCAtIGFyclthcnIubGVuZ3RoIC0gMV07XG5cbiAgICAgICAgLy9jb25zdHJ1Y3Rpb24gdG8gZml4IElFOSB1bm5hdHVyYWwgdHJhbnNpdGlvbiBhbmltYXRpb25cbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEluZGV4KCkgKyAxIC0gaW5kZXggPCAwICYmIGluZGV4ID4gYXJyW2Fyci5sZW5ndGggLSAxXSkge1xuICAgICAgICAgICAgaWYgKGRpZmYgPD0gY2VudHJhbCkge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGNvdW50ID0gZGlmZjsgY291bnQgPiAwOyBjb3VudC0tKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudWkuJG5hdi5hbXBDYXJvdXNlbCgnbmV4dCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51aS4kbmF2LmFtcENhcm91c2VsKCdzZWxlY3QnLCBpbmRleCAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51aS4kbmF2LmFtcENhcm91c2VsKCdzZWxlY3QnLCBpbmRleCk7XG4gICAgICAgIHZhciBjdXJySW5kZXggPSB0aGlzLmN1cnJlbnRJbmRleCgpO1xuICAgICAgICB2YXIgYW5zd2VyID0gdGhpcy5jdXJyZW50VGh1bWJBcnIoY3VyckluZGV4ICsgMSk7XG5cbiAgICAgICAgaWYgKGFuc3dlci5uZXh0KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gYW5zd2VyLm5leHQ7IGkgPiAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVpLiRuYXYuYW1wQ2Fyb3VzZWwoJ25leHQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChhbnN3ZXIucHJldikge1xuICAgICAgICAgICAgZm9yICh2YXIgaiA9IGFuc3dlci5wcmV2OyBqID4gMDsgai0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51aS4kbmF2LmFtcENhcm91c2VsKCdwcmV2Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnVpLm1haW5TZWxlY3QoaW5kZXgpO1xuICAgICAgICB0aGlzLnVwZGF0ZU5hdlVJKCk7XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnVwZGF0ZU5hdlVJKCk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBOYXZDb250cm9sbGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgYW1wID0gcmVxdWlyZSgnLi9uYW1lc3BhY2UnKTtcbi8qanNoaW50IGJyb3dzZXJpZnk6IHRydWUgKi9cbnZhciBxdWlja0xpbmtNYXAgPSB7XG4gICAgc3BpbnNldDogJ2FtcC1zcGluc2V0JyxcbiAgICB2aWRlbzogJ2FtcC12aWRlby1ob2xkZXInLFxuICAgIHJlY2xpbmVyOiAnYW1wLXJlY2xpbmVyJyxcbiAgICBib3g6ICdhbXAtYm94J1xufTtcblxudmFyIFF1aWNrTGlua3NDb250cm9sbGVyID0gZnVuY3Rpb24gKG5hdkNvbnRyb2xsZXIsIHpvb21Db250cm9sbGVyLCB2aWRlb0NvbnRyb2xsZXIsICRtYWluLFxuICAgICAgICAkcXVpY2tsaW5rcywgY3VycmVudFNsaWRlLCBnZXRNYWluQ2hpbGRyZW4sIG9wZW5GdWxsc2NyZWVuKSB7XG4gICAgdGhpcy5xdWlja2xpbmtNb2RlbCA9IHt9O1xuICAgIHRoaXMudWkgPSB7XG4gICAgICAgICRtYWluOiAkbWFpbixcbiAgICAgICAgJHF1aWNrbGlua3M6ICRxdWlja2xpbmtzLFxuICAgICAgICBjdXJyZW50U2xpZGU6IGN1cnJlbnRTbGlkZSxcbiAgICAgICAgZ2V0TWFpbkNoaWxkcmVuOiBnZXRNYWluQ2hpbGRyZW5cbiAgICB9O1xuXG4gICAgaWYgKHRoaXMudWkuJHF1aWNrbGlua3MuJGZ1bGxzY3JlZW5MaW5rICYmIHRoaXMudWkuJHF1aWNrbGlua3MuJGZ1bGxzY3JlZW5MaW5rLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnVpLiRxdWlja2xpbmtzLiRmdWxsc2NyZWVuTGluay5jc3MoJ2Rpc3BsYXknLCAnYmxvY2snKTtcbiAgICAgICAgdGhpcy51aS4kcXVpY2tsaW5rcy4kZnVsbHNjcmVlbkxpbmsuY2xpY2sob3BlbkZ1bGxzY3JlZW4pO1xuICAgIH1cbiAgICB0aGlzLm5hdkNvbnRyb2xsZXIgPSBuYXZDb250cm9sbGVyO1xuICAgIHRoaXMuem9vbUNvbnRyb2xsZXIgPSB6b29tQ29udHJvbGxlcjtcbiAgICB0aGlzLnZpZGVvQ29udHJvbGxlciA9IHZpZGVvQ29udHJvbGxlcjtcblxuICAgIHRoaXMuaW5pdCgpO1xufTtcblxuUXVpY2tMaW5rc0NvbnRyb2xsZXIucHJvdG90eXBlID0ge1xuICAgIF9zcGluc2V0SXNTcGlubmluZzogZmFsc2UsXG4gICAgX3NwaW5zZXRTcGlubmluZ0V2ZW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgc2VsZi5fc3Bpbm5pbmdUaW1lb3V0ID0gbnVsbDtcbiAgICAgICAgYW1wLnN0YXRzLmJpbmQoW1xuICAgICAgICAgICAgeyd0eXBlJzogJ3NwaW4nLCAnZXZlbnQnOiAnY2hhbmdlJywgJ2NiJzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9zcGluc2V0SXNTcGlubmluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLl9zcGlubmluZ1RpbWVvdXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dChzZWxmLl9zcGlubmluZ1RpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX3NwaW5uaW5nVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fc3BpbnNldElzU3Bpbm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfSwgMTAwKTtcblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSxcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGZvciAodmFyIHAgaW4gcXVpY2tMaW5rTWFwKSB7XG4gICAgICAgICAgICB2YXIgbW9kZWwgPSB7bmFtZTogcCwgY2xhc3M6IHF1aWNrTGlua01hcFtwXSwgb3BlbjogZmFsc2V9O1xuICAgICAgICAgICAgaWYgKHAgPT09ICdyZWNsaW5lcicgfHwgcCA9PT0gJ3NwaW5zZXQnKSB7XG4gICAgICAgICAgICAgICAgbW9kZWwuYWN0aW9uID0gJ3NwaW4nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtb2RlbC5hY3Rpb24gPSBwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5xdWlja2xpbmtNb2RlbFsnJCcgKyBwICsgJ0xpbmsnXSA9IG1vZGVsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3MuJGJveExpbmsuZmluZCgnLmFtcC1pY29uLWJveC1jbG9zZScpLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3MuJGJveExpbmsuZmluZCgnLmFtcC1pY29uLWJveC1vcGVuJykuY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICAgICAgIHRoaXMuX2JpbmRFdmVudHMoKTtcbiAgICB9LFxuICAgIF9iaW5kRXZlbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBmb3IgKHZhciBwIGluIHRoaXMudWkuJHF1aWNrbGlua3MpIHtcblxuICAgICAgICAgICAgdmFyIG1vZGVsID0gdGhpcy5xdWlja2xpbmtNb2RlbFtwXTtcbiAgICAgICAgICAgIGlmICghbW9kZWwpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy51aS4kcXVpY2tsaW5rc1twXS51bmJpbmQoJ2NsaWNrJyk7XG4gICAgICAgICAgICB2YXIgaW5kZXggPSBzZWxmLnVpLiRtYWluLmZpbmQoJy4nICsgbW9kZWwuY2xhc3MpLmZpcnN0KCkucGFyZW50KCdsaScpLmluZGV4KCk7XG4gICAgICAgICAgICB0aGlzLnVpLiRxdWlja2xpbmtzW3BdLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3NbcF0uY3NzKCdkaXNwbGF5JywgJ2Jsb2NrJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3NbcF0uY2xpY2sodGhpcy5hY3Rpb24uYmluZCh0aGlzLCBpbmRleCwgbW9kZWwpKTtcblxuICAgICAgICAgICAgdGhpcy5fc3BpbnNldFNwaW5uaW5nRXZlbnQoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgYWN0aW9uOiBmdW5jdGlvbiAoaW5kZXgsIG1vZGVsKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpc1ttb2RlbC5hY3Rpb24gKyAnQWN0aW9uJ10gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRoaXNbbW9kZWwuYWN0aW9uICsgJ0FjdGlvbiddKGluZGV4LCBtb2RlbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm5hdkNvbnRyb2xsZXIuc2VsZWN0LmNhbGwodGhpcy5uYXZDb250cm9sbGVyLCBpbmRleCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHZpZGVvQWN0aW9uOiBmdW5jdGlvbiAoaW5kZXgsIG1vZGVsKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGN1cnJlbnRTbGlkZSA9IHRoaXMudWkuY3VycmVudFNsaWRlKCk7XG4gICAgICAgIHRoaXMubmF2Q29udHJvbGxlci5zZWxlY3QuY2FsbCh0aGlzLm5hdkNvbnRyb2xsZXIsIGluZGV4KTtcbiAgICAgICAgdmFyICR2aWRlb0hvbGRlciA9IGN1cnJlbnRTbGlkZS5maW5kKCcuJyArIG1vZGVsLmNsYXNzKTtcbiAgICAgICAgaWYgKCR2aWRlb0hvbGRlci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMubmF2Q29udHJvbGxlci5zZWxlY3QuY2FsbCh0aGlzLm5hdkNvbnRyb2xsZXIsIGluZGV4KTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNlbGYudmlkZW9Db250cm9sbGVyLnBsYXkoKTtcbiAgICAgICAgICAgIH0sIDMwMCk7XG5cbiAgICAgICAgfVxuICAgIH0sXG4gICAgYm94QWN0aW9uOiBmdW5jdGlvbiAoaW5kZXgsIG1vZGVsKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dCk7XG4gICAgICAgIHZhciBjdXJyZW50U2xpZGUgPSB0aGlzLnVpLmN1cnJlbnRTbGlkZSgpO1xuICAgICAgICBpZiAoY3VycmVudFNsaWRlLmZpbmQoJy4nICsgbW9kZWwuY2xhc3MpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5uYXZDb250cm9sbGVyLnNlbGVjdC5jYWxsKHRoaXMubmF2Q29udHJvbGxlciwgaW5kZXgpO1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5ib3hUb2dnbGUoaW5kZXgsIG1vZGVsKTtcbiAgICAgICAgICAgIH0sIDMwMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJveFRvZ2dsZShjdXJyZW50U2xpZGUuaW5kZXgoKSwgbW9kZWwpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBib3hUb2dnbGU6IGZ1bmN0aW9uIChpbmRleCwgbW9kZWwpIHtcbiAgICAgICAgbW9kZWwub3BlbiA9ICFtb2RlbC5vcGVuO1xuICAgICAgICBpZiAobW9kZWwub3Blbikge1xuICAgICAgICAgICAgdGhpcy51aS5nZXRNYWluQ2hpbGRyZW4oKS5lcShpbmRleCkuZmluZCgnLicgKyBtb2RlbC5jbGFzcykuYW1wU3RhY2soJ2dvVG8nLCAyKTtcbiAgICAgICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3MuJGJveExpbmsuZmluZCgnLmFtcC1pY29uLWJveC1vcGVuJykuY3NzKCdkaXNwbGF5JywgJ25vbmUnKTtcbiAgICAgICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3MuJGJveExpbmsuZmluZCgnLmFtcC1pY29uLWJveC1jbG9zZScpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudWkuZ2V0TWFpbkNoaWxkcmVuKCkuZXEoaW5kZXgpLmZpbmQoJy4nICsgbW9kZWwuY2xhc3MpLmFtcFN0YWNrKCdnb1RvJywgMSk7XG4gICAgICAgICAgICB0aGlzLnVpLiRxdWlja2xpbmtzLiRib3hMaW5rLmZpbmQoJy5hbXAtaWNvbi1ib3gtb3BlbicpLmNzcygnZGlzcGxheScsICcnKTtcbiAgICAgICAgICAgIHRoaXMudWkuJHF1aWNrbGlua3MuJGJveExpbmsuZmluZCgnLmFtcC1pY29uLWJveC1jbG9zZScpLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNwaW5BY3Rpb246IGZ1bmN0aW9uIChpbmRleCwgbW9kZWwpIHtcbiAgICAgICAgdmFyICRzcGluO1xuICAgICAgICB2YXIgY3VycmVudFNsaWRlID0gdGhpcy51aS5jdXJyZW50U2xpZGUoKTtcbiAgICAgICAgaWYgKGN1cnJlbnRTbGlkZS5maW5kKCcuJyArIG1vZGVsLmNsYXNzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMubmF2Q29udHJvbGxlci5zZWxlY3QuY2FsbCh0aGlzLm5hdkNvbnRyb2xsZXIsIGluZGV4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcGluc2V0SXNTcGlubmluZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRzcGluID0gY3VycmVudFNsaWRlLmZpbmQoJy4nICsgbW9kZWwuY2xhc3MpO1xuICAgICAgICAgICAgJHNwaW4uYW1wU3BpbigncGxheVJlcGVhdCcsIDEpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKCRsYXN0U2xpZGUpIHtcbiAgICAgICAgaWYgKCRsYXN0U2xpZGUgJiYgJGxhc3RTbGlkZS5maW5kKCcuJyArIHF1aWNrTGlua01hcC5ib3gpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHZhciBpbmRleCA9ICRsYXN0U2xpZGUuaW5kZXgoKTtcbiAgICAgICAgICAgIHRoaXMucXVpY2tsaW5rTW9kZWwuJGJveExpbmsub3BlbiA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmJveFRvZ2dsZShpbmRleCwgdGhpcy5xdWlja2xpbmtNb2RlbC4kYm94TGluayk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1aWNrTGlua3NDb250cm9sbGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgbG9nID0gcmVxdWlyZSgnLi4vdXRpbHMvbG9nJyk7XG52YXIgdGVtcGxhdGVzID0gcmVxdWlyZSgnLi4vdGVtcGxhdGVzL3RlbXBsYXRlcy5jb21waWxlZCcpO1xuXG52YXIgcm91bmRlbHMgPSB7XG4gICAgcGFyc2VQb3NpdGlvbjogZnVuY3Rpb24ocG9zaXRpb25UZXh0KSB7XG4gICAgICAgIC8vIHBpdHkgd2UgY2FuJ3QgYmFzZSB0aGlzIG9uIG9yZGluYWwuXG4gICAgICAgIC8vIHN0YXJ0IHN3aXRjaCBhdCBwb3MgOSBhZnRlciAncG9zaXRpb24nXG4gICAgICAgIC8vIGllLiB3ZSBleHBlY3QgcG9zaXRpb25zIGJ5IHNwZWMgdG8gYmVcbiAgICAgICAgLy8gcG9zaXRpb25PbmUsIHBvc2l0aW9uVHdvLCAuLi5cbiAgICAgICAgc3dpdGNoIChwb3NpdGlvblRleHQuc3Vic3RyaW5nKDkpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICAgIGNhc2UgJ29uZSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICBjYXNlICd0d28nOlxuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgY2FzZSAndGhyZWUnOlxuICAgICAgICAgICAgICAgIHJldHVybiAyO1xuICAgICAgICAgICAgY2FzZSAnZm91cic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDM7XG4gICAgICAgICAgICBjYXNlICdmaXZlJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gNDtcbiAgICAgICAgICAgIGNhc2UgJ3NpeCc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIDU7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oJHRhcmdldCwgY29uZmlnKSB7XG4gICAgICAgIHZhciBwYXJzZWRSb3VuZGVscyA9IFtdO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb25maWcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIC8vIGV4cGVjdCBhIHJvdW5kZWwgdG8gaGF2ZSBhIHBvc2l0aW9uLCBjbGFzcyBhbmQgZGVzY3JpcHRpb25cbiAgICAgICAgICAgIGlmIChjb25maWdbaV0ubGVuZ3RoICE9PSAzKSB7XG4gICAgICAgICAgICAgICAgbG9nLndhcm4oJ2V4cGVjdGVkIHJvdW5kZWwgdG8gaGF2ZSBhIHBvc2l0aW9uLCBjbGFzcyBhbmQgZGVzY3JpcHRpb24uICBSZWNlaXZlZCcsXG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGNvbmZpZ1tpXSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwYXJzZWRSb3VuZGVscy5wdXNoKHtcbiAgICAgICAgICAgICAgICBpbmRleDogcm91bmRlbHMucGFyc2VQb3NpdGlvbihjb25maWdbaV1bMF0pLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBjb25maWdbaV1bMF0sXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lOiBjb25maWdbaV1bMV0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGNvbmZpZ1tpXVsyXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJzZWRSb3VuZGVscy5zb3J0KGZ1bmN0aW9uIGNvbXBhcmVJbmRleChhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pbmRleCAtIGIuaW5kZXg7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciByb3VuZGVsc1RlbXBsYXRlID0gdGVtcGxhdGVzWyd0ZW1wbGF0ZS1yb3VuZGVscyddO1xuICAgICAgICB2YXIgcmVuZGVyZWREb20gPSByb3VuZGVsc1RlbXBsYXRlKHtcbiAgICAgICAgICAgIHJvdW5kZWxzOiBwYXJzZWRSb3VuZGVsc1xuICAgICAgICB9KTtcblxuICAgICAgICAkdGFyZ2V0XG4gICAgICAgICAgICAuZW1wdHkoKVxuICAgICAgICAgICAgLmFwcGVuZChyZW5kZXJlZERvbSlcbiAgICAgICAgICAgIC5hZGRDbGFzcygnYW1wLXJvdW5kZWxzLScgKyBwYXJzZWRSb3VuZGVscy5sZW5ndGgpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcm91bmRlbHM7XG4iLCJcInVzZSBzdHJpY3RcIjtcbi8qanNoaW50IGJyb3dzZXJpZnk6IHRydWUgKi9cbnZhciAkID0gcmVxdWlyZSgnLi9qcXVlcnknKTtcblxudmFyIFVpSGludENvbnRyb2xsZXIgPSBmdW5jdGlvbiAoY29uZmlnT2JqZWN0KSB7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWdPYmplY3QgfHwge307XG59O1xuXG5VaUhpbnRDb250cm9sbGVyLnByb3RvdHlwZSA9IHtcbiAgICBfb3ZlcmxheVRpbWVvdXRzOiB7XG4gICAgICAgIC8vc3RvcmUgaGlkZSB0aW1lb3V0IHdpdGggaW5pdGlhbCBmYWxzZVxuXG4gICAgfSxcbiAgICBoaWRlTW9iaWxlT3ZlcmxheVRpbWVvdXQ6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyICRvdmVybGF5ID0gb3B0cy4kb3ZlcmxheTtcblxuICAgICAgICBpZiAoc2VsZi5fb3ZlcmxheVRpbWVvdXRzW3NlbGYuX2Jhc2VWaWV3ZXIudmlld2VyVHlwZV0pIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChzZWxmLl9vdmVybGF5VGltZW91dHNbc2VsZi5fYmFzZVZpZXdlci52aWV3ZXJUeXBlXSk7XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLnNob3dNb2JpbGVPdmVybGF5KCRvdmVybGF5KTtcblxuICAgICAgICBzZWxmLl9vdmVybGF5VGltZW91dHNbc2VsZi5fYmFzZVZpZXdlci52aWV3ZXJUeXBlXSA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5oaWRlTW9iaWxlT3ZlcmxheSgkb3ZlcmxheSk7XG4gICAgICAgIH0sIHNlbGYuY29uZmlnLnVpSGludFRpbWVycy5kaXNwbGF5VGltZXIpO1xuICAgIH0sXG4gICAgX2NyZWF0ZVVpOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIHNldCB1aVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy51aSA9IHtcbiAgICAgICAgICAgICR2aWV3ZXI6IHNlbGYuX2Jhc2VWaWV3ZXIudWkuJGVsLmZpbmQoJy5hbXAtdmlld2VyJyksXG4gICAgICAgICAgICAkbWFpbjogc2VsZi5fYmFzZVZpZXdlci51aS4kbWFpbixcbiAgICAgICAgICAgIHVpSGludHM6IHtcbiAgICAgICAgICAgICAgICAkY2xpY2tUcmFwczogc2VsZi5fYmFzZVZpZXdlci51aS4kZWwuZmluZCgnLmFtcC1jb3Zlci1ib3guYW1wLWRvdWJsZS10YXAtcHJvbXB0JyksXG4gICAgICAgICAgICAgICAgJGV4aXRIaW50czogc2VsZi5fYmFzZVZpZXdlci51aS4kZWwuZmluZCgnLmFtcC1jb3Zlci1ib3guYW1wLWV4aXQtcHJvbXB0JylcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjdXJyZW50U2xpZGU6IHNlbGYuX2Jhc2VWaWV3ZXIudWkuY3VycmVudFNsaWRlXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBzaG93TW9iaWxlT3ZlcmxheTogZnVuY3Rpb24gKCRvdmVybGF5LCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICRvdmVybGF5XG4gICAgICAgICAgICAgICAgLmNzcygnZGlzcGxheScsICdibG9jaycpXG4gICAgICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdoaWRkZW4nKTtcbiAgICAgICAgJG92ZXJsYXkuYW5pbWF0ZSh7XG4gICAgICAgICAgICBvcGFjaXR5OiAxXG4gICAgICAgIH0sIHNlbGYuY29uZmlnLnVpSGludFRpbWVycy50cmFuc2l0aW9uVGltZXIsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoc2VsZik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgaGlkZU1vYmlsZU92ZXJsYXk6IGZ1bmN0aW9uICgkb3ZlcmxheSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAkb3ZlcmxheS5hbmltYXRlKHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDBcbiAgICAgICAgfSwgc2VsZi5jb25maWcudWlIaW50VGltZXJzLnRyYW5zaXRpb25UaW1lciwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJG92ZXJsYXlcbiAgICAgICAgICAgICAgICAgICAgLmNzcygnZGlzcGxheScsICdub25lJylcbiAgICAgICAgICAgICAgICAgICAgLmFkZENsYXNzKCdoaWRkZW4nKTtcblxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChzZWxmKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBfZG91YmxlVGFwQmVoYXZpb3I6IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIHRzID0gb3B0cy5lLnRpbWVTdGFtcDtcbiAgICAgICAgdmFyIG9sZFRpbWUgPSBvcHRzLiR0YWcuZGF0YSgnYW1wVG91Y2hUaW1lc3RhbXAnKTtcbiAgICAgICAgaWYgKG9sZFRpbWUpIHtcbiAgICAgICAgICAgIGlmICh0cyAtIG9sZFRpbWUgPCAyNTApIHtcbiAgICAgICAgICAgICAgICBvcHRzLmUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBvcHRzLmNhbGxiYWNrLmNhbGwoc2VsZiwgb3B0cy4kdGFnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBvcHRzLiR0YWcuZGF0YSgnYW1wVG91Y2hUaW1lc3RhbXAnLCB0cyk7XG4gICAgfSxcbiAgICBfZXZlbnRIZWxwZXJzOiB7XG4gICAgICAgIHNob3dTcGluTW9kZUNsaWNrVHJhcDogZnVuY3Rpb24gKCR0YXJnZXQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIGlmIChzZWxmLnVpLiR2aWV3ZXIuaGFzQ2xhc3MoJ2FtcC11aS10b3VjaCcpKSB7XG4gICAgICAgICAgICAgICAgdmFyICRjbGlja1RyYXAgPSAkdGFyZ2V0LnBhcmVudCgpLmZpbmQoJy5hbXAtY292ZXItYm94LmFtcC1kb3VibGUtdGFwLXByb21wdCcpO1xuICAgICAgICAgICAgICAgIHNlbGYuc2hvd01vYmlsZU92ZXJsYXkoJGNsaWNrVHJhcCk7XG4gICAgICAgICAgICAgICAgc2VsZi5oaWRlTW9iaWxlT3ZlcmxheVRpbWVvdXQoe1xuICAgICAgICAgICAgICAgICAgICAkb3ZlcmxheTogJGNsaWNrVHJhcC5maW5kKCcuYW1wLW1lc3NhZ2UnKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBzaG93RXhpdFNwaW5Nb2RlSGludDogZnVuY3Rpb24gKCR0YXJnZXQpIHtcbiAgICAgICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgICAgIHZhciAkZXhpdEhpbnQgPSAkdGFyZ2V0LnBhcmVudCgpLmZpbmQoJy5hbXAtZXhpdC1wcm9tcHQnKTtcbiAgICAgICAgICAgIHNlbGYuc2hvd01vYmlsZU92ZXJsYXkoJGV4aXRIaW50KTtcbiAgICAgICAgICAgIHNlbGYuaGlkZU1vYmlsZU92ZXJsYXlUaW1lb3V0KHtcbiAgICAgICAgICAgICAgICAkb3ZlcmxheTogJGV4aXRIaW50XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgX2JpbmRFdmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgJHVpSGludHMgPSBzZWxmLnVpLiRtYWluLmZpbmQoJy5hbXAtdWktaGludCcpO1xuXG4gICAgICAgIC8vIHByb3ZpZGUgdG91Y2ggZnJpZW5kbHkgZG91YmxlIHRhcCB0byBleGl0IHNwaW4gbW9kZVxuICAgICAgICAkdWlIaW50cy5vbigndG91Y2hzdGFydCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xuICAgICAgICAgICAgc2VsZi5fZG91YmxlVGFwQmVoYXZpb3Ioe1xuICAgICAgICAgICAgICAgIGU6IGUsXG4gICAgICAgICAgICAgICAgJHRhZzogJHRoaXMsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uICgkdGFnKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2V2ZW50SGVscGVycy5zaG93U3Bpbk1vZGVDbGlja1RyYXAuY2FsbChzZWxmLCAkdGFnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2VsZi51aS51aUhpbnRzLiRleGl0SGludHMub24oJ3RvdWNoc3RhcnQnLCBmdW5jdGlvbiAoZSkge1xuXG4gICAgICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xuICAgICAgICAgICAgc2VsZi5oaWRlTW9iaWxlT3ZlcmxheSgkdGhpcywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNlbGYuX2RvdWJsZVRhcEJlaGF2aW9yKHtcbiAgICAgICAgICAgICAgICAgICAgZTogZSxcbiAgICAgICAgICAgICAgICAgICAgJHRhZzogJHRoaXMsXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoJHRhZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fZXZlbnRIZWxwZXJzLnNob3dTcGluTW9kZUNsaWNrVHJhcC5jYWxsKHNlbGYsICR0YWcpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gYWNjZXNzIHByaXZhdGUgbWV0aG9kIG9uIHNwaW4gd2lkZ2V0IHRvIHN0YXJ0IHRoZSBkcmFnXG4gICAgICAgICAgICAvLyBiZWhpbmQgdGhlIHByb21wdCdzIGNsaWNrIHRyYXAgbGF5ZXJcbiAgICAgICAgICAgICR0aGlzLnBhcmVudCgpLmZpbmQoJ3VsJykuZGF0YSgpWydhbXBBbXBTcGluJ10uX3N0YXJ0RHJhZyhlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcHJvdmlkZSB0b3VjaCBmcmllbmRseSBkb3VibGUgdGFwIHRvIGVudGVyIHNwaW4gbW9kZVxuICAgICAgICBzZWxmLnVpLnVpSGludHMuJGNsaWNrVHJhcHMub24oJ3RvdWNoc3RhcnQnLCBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcbiAgICAgICAgICAgIHNlbGYuX2RvdWJsZVRhcEJlaGF2aW9yKHtcbiAgICAgICAgICAgICAgICBlOiBlLFxuICAgICAgICAgICAgICAgICR0YWc6ICR0aGlzLFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoJHRhZykge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLmhpZGVNb2JpbGVPdmVybGF5KCR0YWcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX2V2ZW50SGVscGVycy5zaG93RXhpdFNwaW5Nb2RlSGludC5jYWxsKHNlbGYsICR0YWcpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBhbGxvdyB1c2VyIHRvIGVudGVyIHNwaW4gbW9kZSB1c2luZyBkb3VibGUgY2xpY2sgaWYgdGhleSBhcmUgb25cbiAgICAgICAgLy8gYSBtaXhlZCBwb2ludGVyIGlucHV0IGRldmljZVxuICAgICAgICBzZWxmLnVpLnVpSGludHMuJGNsaWNrVHJhcHMub24oJ2RibGNsaWNrJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcbiAgICAgICAgICAgIHNlbGYuaGlkZU1vYmlsZU92ZXJsYXkoJHRoaXMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9ldmVudEhlbHBlcnMuc2hvd0V4aXRTcGluTW9kZUhpbnQuY2FsbChzZWxmLCAkdGhpcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICRjdXJyZW50U2xpZGUgPSB0aGlzLnVpLmN1cnJlbnRTbGlkZSgpO1xuICAgICAgICB2YXIgaXNIaW50U2xpZGUgPSAkY3VycmVudFNsaWRlLmZpbmQoJy5hbXAtdWktaGludCcpLmxlbmd0aDtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmIChpc0hpbnRTbGlkZSAmJiB0aGlzLnVpLiR2aWV3ZXIuaGFzQ2xhc3MoJ2FtcC11aS10b3VjaCcpKSB7XG4gICAgICAgICAgICB2YXIgJHNob3dPdmVybGF5ID0gJGN1cnJlbnRTbGlkZS5maW5kKCcuYW1wLWNvdmVyLWJveC5hbXAtZG91YmxlLXRhcC1wcm9tcHQnKTtcbiAgICAgICAgICAgIHZhciAkaGlkZU92ZXJsYXkgPSAkY3VycmVudFNsaWRlLmZpbmQoJy5hbXAtZXhpdC1wcm9tcHQnKTtcbiAgICAgICAgICAgIC8vIFNob3cgJ2RvdWJsZSB0YXAnIGluaXQgb3ZlcmxheVxuICAgICAgICAgICAgc2VsZi5zaG93TW9iaWxlT3ZlcmxheSgkc2hvd092ZXJsYXkpO1xuXG4gICAgICAgICAgICAvL2hpZGUgJ2RvdWJsZSB0YXAnIGhpZGVyIG92ZXJsYXlcbiAgICAgICAgICAgIHNlbGYuaGlkZU1vYmlsZU92ZXJsYXkoJGhpZGVPdmVybGF5KTtcblxuICAgICAgICAgICAgLy9oaWRlICdkb3VibGUgdGFwIGluaXQnIG92ZXJsYXkgYWZ0ZXIgc3BlY2lmaWVkIHRpbWVvdXRcbiAgICAgICAgICAgIHNlbGYuaGlkZU1vYmlsZU92ZXJsYXlUaW1lb3V0KHtcbiAgICAgICAgICAgICAgICAkb3ZlcmxheTogJHNob3dPdmVybGF5LmZpbmQoJy5hbXAtbWVzc2FnZScpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgaW5pdDogZnVuY3Rpb24gKGJhc2VWaWV3ZXIpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAvL2NhY2hlIGJhc2VWaWV3ZXIgb2JqZWN0XG4gICAgICAgIHNlbGYuX2Jhc2VWaWV3ZXIgPSBiYXNlVmlld2VyO1xuICAgICAgICAvL2luaXRBbGxcbiAgICAgICAgdGhpcy5fY3JlYXRlVWkoKTtcbiAgICAgICAgdGhpcy51cGRhdGUoKTtcbiAgICAgICAgdGhpcy5fYmluZEV2ZW50cygpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVWlIaW50Q29udHJvbGxlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xuLypqc2hpbnQgYnJvd3NlcmlmeTogdHJ1ZSAqL1xudmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeScpO1xudmFyIGFtcCA9IHJlcXVpcmUoJy4uL2NvbW1vbi9uYW1lc3BhY2UnKTtcblxudmFyIFZpZGVvQ29udHJvbGxlciA9IGZ1bmN0aW9uICgkbWFpbiwgY3VycmVudFNsaWRlKSB7XG4gICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgdGhpcy51aSA9IHtcbiAgICAgICAgJG1haW46ICRtYWluLFxuICAgICAgICAkY3VycmVudFBpUFNsaWRlOiBudWxsLFxuICAgICAgICBjdXJyZW50U2xpZGU6IGN1cnJlbnRTbGlkZVxuICAgIH07XG5cbiAgICB0aGlzLl9iaW5kRXZlbnRzKCk7XG59O1xuXG5WaWRlb0NvbnRyb2xsZXIucHJvdG90eXBlID0ge1xuICAgIF9iaW5kRXZlbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgLy9oYWQgdG8gc2V0IHRpbWVvdXQgaGVyZSBiZWNhdXNlIGl0IGRvZXNuJ3QgY2FsY3VsYXRlIDk4IG9mIG1haW4gY29udGFpbmVyIHByb3Blcmx5LFxuICAgICAgICAvLyBhcyBjYXJvdXNlbCB3YXMgbm90IGZ1bGx5IGxvYWRlZFxuICAgICAgICBzZXRUaW1lb3V0KHNlbGYuX3Jlc2l6ZUFsbFZpZGVvLmJpbmQoc2VsZiksIDEwMCk7XG4gICAgICAgIGFtcC5zdGF0cy5iaW5kKHtcbiAgICAgICAgICAgICd0eXBlJzogJ3ZpZGVvJywgJ2V2ZW50JzogJ2Z1bGxTY3JlZW5DaGFuZ2UnLCAnY2InOiBzZWxmLl9yZXNpemVWaWRlby5iaW5kKHNlbGYpXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vaW9zOSBQaVAgcGF1c2UgdmlkZW8gaWYgbm90IGN1cnJlbnQgdmlkZW9cbiAgICAgICAgdmFyICRhbGxWaWRlbyA9IHNlbGYudWkuJG1haW4uZmluZCgnLmFtcC12aWRlbyB2aWRlbycpO1xuICAgICAgICBpZiAoJGFsbFZpZGVvICYmICRhbGxWaWRlby5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmICgkYWxsVmlkZW9bMF0ud2Via2l0U3VwcG9ydHNQcmVzZW50YXRpb25Nb2RlICYmXG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiAkYWxsVmlkZW9bMF0ud2Via2l0U2V0UHJlc2VudGF0aW9uTW9kZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgICRhbGxWaWRlby5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgJCh0aGlzKS5iaW5kKCd3ZWJraXRwcmVzZW50YXRpb25tb2RlY2hhbmdlZCcsIChmdW5jdGlvbiAoJHZpZGVvKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICgkdmlkZW9bMF0ud2Via2l0UHJlc2VudGF0aW9uTW9kZSA9PT0gJ3BpY3R1cmUtaW4tcGljdHVyZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi51aS4kY3VycmVudFBpUFNsaWRlID0gc2VsZi51aS5jdXJyZW50U2xpZGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCR2aWRlb1swXS53ZWJraXRQcmVzZW50YXRpb25Nb2RlID09PSAnaW5saW5lJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi51aS4kY3VycmVudFBpUFNsaWRlLmluZGV4KCkgIT09IHNlbGYudWkuY3VycmVudFNsaWRlKCkuaW5kZXgoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyICR2aWRXaWRnZXQgPSBzZWxmLnVpLiRjdXJyZW50UGlQU2xpZGUuZmluZCgnLmFtcC12aWRlbycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCR2aWRXaWRnZXQuZGF0YSgnYW1wQW1wVmlkZW8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICR2aWRXaWRnZXQuYW1wVmlkZW8oJ3BhdXNlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KSgkKHRoaXMpKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHBsYXk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICRjdXJyZW50VmlkZW9TbGlkZSA9IHRoaXMudWkuY3VycmVudFNsaWRlKCkuZmluZCgnLmFtcC12aWRlbycpO1xuICAgICAgICB2YXIgVklERU9fUEFVU0VEID0gMjtcbiAgICAgICAgdmFyIFZJREVPX1NUT1BQRUQgPSAwO1xuXG4gICAgICAgIGlmICgkY3VycmVudFZpZGVvU2xpZGUubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgY3VycmVudFN0YXRlID0gJGN1cnJlbnRWaWRlb1NsaWRlLmFtcFZpZGVvKCdzdGF0ZScpO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRTdGF0ZSA9PT0gVklERU9fUEFVU0VEIHx8IGN1cnJlbnRTdGF0ZSA9PT0gVklERU9fU1RPUFBFRCkge1xuICAgICAgICAgICAgICAgICRjdXJyZW50VmlkZW9TbGlkZS5hbXBWaWRlbygncGxheScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkY3VycmVudFZpZGVvU2xpZGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hbXBWaWRlbygncGF1c2UnKTtcblxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAkY3VycmVudFZpZGVvU2xpZGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYW1wVmlkZW8oJ3NlZWsnLCAwKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hbXBWaWRlbygncGxheScpO1xuICAgICAgICAgICAgICAgIH0sIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBwYXVzZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGN1cnJlbnRTbGlkZSA9IHRoaXMudWkuY3VycmVudFNsaWRlKCk7XG4gICAgICAgIHZhciAkY3VycmVudFZpZGVvU2xpZGUgPSAkY3VycmVudFNsaWRlLmZpbmQoJy5hbXAtdmlkZW8nKTtcblxuICAgICAgICBpZiAoJGN1cnJlbnRWaWRlb1NsaWRlLmxlbmd0aCkge1xuICAgICAgICAgICAgJGN1cnJlbnRWaWRlb1NsaWRlLmFtcFZpZGVvKCdwYXVzZScpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwYXVzZUFsbFZpZGVvOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICQoJ2JvZHknKS5maW5kKCcuYW1wLXZpZXdlciAuYW1wLXZpZGVvJykuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgJHZpZGVvID0gJCh0aGlzKTtcbiAgICAgICAgICAgIGlmICgkdmlkZW8uZGF0YSgnYW1wLWFtcFZpZGVvJykgJiYgJHZpZGVvLmZpbmQoJy52anMtcGxheWluZycpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAkdmlkZW8uYW1wVmlkZW8oJ3BhdXNlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgX2RlYm91bmNlZFJlc2l6ZVZpZGVvOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50aW1lcik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50aW1lciA9IHNldFRpbWVvdXQodGhpcy5fcmVzaXplQ3VycmVudFZpZGVvLmJpbmQodGhpcywgYXJndW1lbnRzKSwgMjApO1xuICAgIH0sXG4gICAgX3Jlc2l6ZUFsbFZpZGVvOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXZpZGVvLWhvbGRlcicpLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyICR2aWRlb0hvbGRlciA9ICQodGhpcyk7XG4gICAgICAgICAgICB2YXIgJGFtcFZpZGVvID0gJHZpZGVvSG9sZGVyLmZpbmQoJy5hbXAtdmlkZW8nKTtcbiAgICAgICAgICAgICRhbXBWaWRlb1xuICAgICAgICAgICAgICAgICAgICAuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnYW1wLWhpZGRlbicpO1xuICAgICAgICAgICAgc2VsZi5fcmVzaXplVmlkZW8oJHZpZGVvSG9sZGVyKTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICRhbXBWaWRlby5jc3Moe1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmlsaXR5OiAndmlzaWJsZSdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sIDIwMCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgX3Jlc2l6ZUN1cnJlbnRWaWRlbzogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGN1cnJlbnRTbGlkZSA9IHRoaXMudWkuY3VycmVudFNsaWRlKCk7XG4gICAgICAgIHZhciAkdmlkZW9Ib2xkZXIgPSAkY3VycmVudFNsaWRlLmZpbmQoJy5hbXAtdmlkZW8taG9sZGVyJyk7XG4gICAgICAgIHRoaXMuX3Jlc2l6ZVZpZGVvKCR2aWRlb0hvbGRlcik7XG4gICAgfSxcbiAgICBfcmVzaXplVmlkZW86IGZ1bmN0aW9uICgkdmlkZW9Ib2xkZXIpIHtcbiAgICAgICAgdmFyICR2aWRlb0VsO1xuICAgICAgICB2YXIgY29udGFpbmVyU2l6ZSA9IHt9O1xuICAgICAgICB2YXIgb3JpZ2luYWxNZWRpYVNpemUgPSB7fTtcbiAgICAgICAgdmFyIGFzcGVjdEZpdCA9IHt9O1xuXG4gICAgICAgIGlmICghJHZpZGVvSG9sZGVyLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgJHZpZGVvRWwgPSAkdmlkZW9Ib2xkZXIuZmluZCgnLnZpZGVvLWpzJyk7XG5cbiAgICAgICAgb3JpZ2luYWxNZWRpYVNpemUud2lkdGggPSAkdmlkZW9Ib2xkZXIuYXR0cignZGF0YS1hbXAtd2lkdGgnKTtcbiAgICAgICAgb3JpZ2luYWxNZWRpYVNpemUuaGVpZ2h0ID0gJHZpZGVvSG9sZGVyLmF0dHIoJ2RhdGEtYW1wLWhlaWdodCcpO1xuICAgICAgICBjb250YWluZXJTaXplLndpZHRoID0gdGhpcy51aS4kbWFpbi53aWR0aCgpO1xuICAgICAgICBjb250YWluZXJTaXplLmhlaWdodCA9IHRoaXMudWkuJG1haW4uaGVpZ2h0KCk7XG5cbiAgICAgICAgb3JpZ2luYWxNZWRpYVNpemUuYXNwZWN0UmF0aW8gPSBvcmlnaW5hbE1lZGlhU2l6ZS53aWR0aCAvIG9yaWdpbmFsTWVkaWFTaXplLmhlaWdodDtcbiAgICAgICAgY29udGFpbmVyU2l6ZS5hc3BlY3RSYXRpbyA9IGNvbnRhaW5lclNpemUud2lkdGggLyBjb250YWluZXJTaXplLmhlaWdodDtcblxuICAgICAgICBpZiAoY29udGFpbmVyU2l6ZS5hc3BlY3RSYXRpbyA+PSBvcmlnaW5hbE1lZGlhU2l6ZS5hc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgYXNwZWN0Rml0LmhlaWdodCA9IGNvbnRhaW5lclNpemUuaGVpZ2h0O1xuICAgICAgICAgICAgYXNwZWN0Rml0LndpZHRoID0gb3JpZ2luYWxNZWRpYVNpemUuYXNwZWN0UmF0aW8gKiBjb250YWluZXJTaXplLmhlaWdodDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFzcGVjdEZpdC5oZWlnaHQgPSAob3JpZ2luYWxNZWRpYVNpemUuaGVpZ2h0IC8gb3JpZ2luYWxNZWRpYVNpemUud2lkdGgpICogY29udGFpbmVyU2l6ZS53aWR0aDtcbiAgICAgICAgICAgIGFzcGVjdEZpdC53aWR0aCA9IGNvbnRhaW5lclNpemUud2lkdGg7XG4gICAgICAgIH1cblxuICAgICAgICAkdmlkZW9Ib2xkZXJcbiAgICAgICAgICAgICAgICAuZmluZCgnLmFtcC12aWRlbyAudmlkZW8tanMsIHZpZGVvJylcbiAgICAgICAgICAgICAgICAuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgJ2hlaWdodCc6IGFzcGVjdEZpdC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICd3aWR0aCc6IGFzcGVjdEZpdC53aWR0aFxuICAgICAgICAgICAgICAgIH0pO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmlkZW9Db250cm9sbGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmpzaGludCBicm93c2VyaWZ5OiB0cnVlICovXG52YXIgYW1wID0gcmVxdWlyZSgnLi4vY29tbW9uL25hbWVzcGFjZScpO1xudmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeScpO1xuXG52YXIgWm9vbUNvbnRyb2xsZXIgPSBmdW5jdGlvbiAoJHpvb21JbiwgJHpvb21PdXQsIGN1cnJlbnRTbGlkZSkge1xuICAgIHRoaXMudWkgPSB7XG4gICAgICAgICR6b29tSW46ICR6b29tSW4sXG4gICAgICAgICR6b29tT3V0OiAkem9vbU91dCxcbiAgICAgICAgY3VycmVudFNsaWRlOiBjdXJyZW50U2xpZGVcbiAgICB9O1xuXG4gICAgdGhpcy5fYmluZEV2ZW50cygpO1xufTtcblxuWm9vbUNvbnRyb2xsZXIucHJvdG90eXBlID0ge1xuICAgICRjYWNoZWRDdXJyZW50U2xpZGU6IG51bGwsXG4gICAgX2JpbmRFdmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHNlbGYudWkuJHpvb21Jbi5jbGljayhzZWxmLnpvb21Jbi5iaW5kKHNlbGYpKTtcbiAgICAgICAgc2VsZi51aS4kem9vbU91dC5jbGljayhzZWxmLnpvb21PdXQuYmluZChzZWxmKSk7XG5cbiAgICAgICAgYW1wLnN0YXRzLmJpbmQoe1xuICAgICAgICAgICAgJ3R5cGUnOiAnem9vbScsICdldmVudCc6ICd6b29tZWRJbicsICdjYic6IGZ1bmN0aW9uIChhLCBiLCBjLCB6b29tSW5mbykge1xuICAgICAgICAgICAgICAgIHNlbGYuX2ludmFsaWRhdGVab29tQnV0dG9ucyh6b29tSW5mbyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGFtcC5zdGF0cy5iaW5kKHtcbiAgICAgICAgICAgICd0eXBlJzogJ3pvb20nLCAnZXZlbnQnOiAnem9vbWVkT3V0JywgJ2NiJzogZnVuY3Rpb24gKGEsIGIsIGMsIHpvb21JbmZvKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5faW52YWxpZGF0ZVpvb21CdXR0b25zKHpvb21JbmZvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBfc2xpZGVUb2dnbGVab29tZWRDbGFzczogZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgY2xhc3NOYW1lID0gb3B0cy5jbGFzcyB8fCAnYW1wLXpvb21lZC1pbic7XG4gICAgICAgIHNlbGYuJGNhY2hlZEN1cnJlbnRTbGlkZVtvcHRzLmFjdGlvbiArICdDbGFzcyddKGNsYXNzTmFtZSk7XG4gICAgfSxcbiAgICBfaW52YWxpZGF0ZVpvb21CdXR0b25zOiBmdW5jdGlvbiAoem9vbUluZm8pIHtcbiAgICAgICAgdmFyICR6b29tID0gdGhpcy5jdXJyZW50Wm9vbSgpO1xuICAgICAgICBpZiAoISR6b29tLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy51aS4kem9vbUluLmNzcygndmlzaWJpbGl0eScsICdoaWRkZW4nKTtcbiAgICAgICAgICAgIHRoaXMudWkuJHpvb21PdXQuY3NzKCd2aXNpYmlsaXR5JywgJ2hpZGRlbicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy51aS4kem9vbUluLmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG4gICAgICAgICAgICB0aGlzLnVpLiR6b29tT3V0LmNzcygndmlzaWJpbGl0eScsICd2aXNpYmxlJyk7XG4gICAgICAgICAgICBpZiAoIXpvb21JbmZvKSB7XG4gICAgICAgICAgICAgICAgem9vbUluZm8gPSAkem9vbS5hbXBab29tSW5saW5lKCdzdGF0ZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHpvb21JbmZvLnNjYWxlID09PSB6b29tSW5mby5zY2FsZU1heCkge1xuICAgICAgICAgICAgdGhpcy51aS4kem9vbUluLmFkZENsYXNzKCdkaXNhYmxlZCcpO1xuICAgICAgICAgICAgdGhpcy51aS4kem9vbU91dC5yZW1vdmVDbGFzcygnZGlzYWJsZWQnKTtcblxuICAgICAgICAgICAgdGhpcy5fc2xpZGVUb2dnbGVab29tZWRDbGFzcyh7XG4gICAgICAgICAgICAgICAgYWN0aW9uOiAnYWRkJ1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudWkuJHpvb21Jbi5yZW1vdmVDbGFzcygnZGlzYWJsZWQnKTtcbiAgICAgICAgICAgIHRoaXMudWkuJHpvb21PdXQucmVtb3ZlQ2xhc3MoJ2Rpc2FibGVkJyk7XG5cbiAgICAgICAgICAgIHRoaXMuX3NsaWRlVG9nZ2xlWm9vbWVkQ2xhc3Moe1xuICAgICAgICAgICAgICAgIGFjdGlvbjogJ2FkZCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHpvb21JbmZvLnNjYWxlID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLnVpLiR6b29tSW4ucmVtb3ZlQ2xhc3MoJ2Rpc2FibGVkJyk7XG4gICAgICAgICAgICB0aGlzLnVpLiR6b29tT3V0LmFkZENsYXNzKCdkaXNhYmxlZCcpO1xuXG4gICAgICAgICAgICB0aGlzLl9zbGlkZVRvZ2dsZVpvb21lZENsYXNzKHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiAncmVtb3ZlJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjdXJyZW50Wm9vbTogZnVuY3Rpb24gKHNsaWRlKSB7XG4gICAgICAgIHZhciAkc2xpZGUgPSBzbGlkZSB8fCB0aGlzLnVpLmN1cnJlbnRTbGlkZSgpO1xuICAgICAgICB0aGlzLiRjYWNoZWRDdXJyZW50U2xpZGUgPSAkc2xpZGU7XG4gICAgICAgIHZhciAkem9vbTtcblxuICAgICAgICBpZiAoJHNsaWRlLmZpbmQoJy5hbXAtc3BpbnNldCcpLmxlbmd0aCkge1xuICAgICAgICAgICAgJHpvb20gPSAkc2xpZGUuZmluZCgnLmFtcC1zZWxlY3RlZCAuYW1wLXpvb21hYmxlJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkem9vbSA9ICRzbGlkZS5maW5kKCcuYW1wLXpvb21hYmxlJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICR6b29tO1xuICAgIH0sXG4gICAgem9vbUF1dG86IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICR6b29tID0gdGhpcy5jdXJyZW50Wm9vbSgpO1xuXG4gICAgICAgIGlmICgkem9vbS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciB6b29tU3RhdGUgPSAkem9vbS5hbXBab29tSW5saW5lKCdzdGF0ZScpO1xuICAgICAgICAgICAgaWYgKHpvb21TdGF0ZS5zY2FsZSA+PSB6b29tU3RhdGUuc2NhbGVNYXgpIHtcbiAgICAgICAgICAgICAgICAkem9vbS5hbXBab29tSW5saW5lKCd6b29tT3V0RnVsbCcpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkem9vbS5hbXBab29tSW5saW5lKCd6b29tSW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uIChvbGRTbGlkZSkge1xuICAgICAgICBpZiAob2xkU2xpZGUgJiYgb2xkU2xpZGUubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgJHpvb20gPSB0aGlzLmN1cnJlbnRab29tKG9sZFNsaWRlKTtcbiAgICAgICAgICAgICR6b29tLmFtcFpvb21JbmxpbmUoJ3pvb21PdXRGdWxsJyk7XG5cbiAgICAgICAgICAgIGlmIChvbGRTbGlkZS5maW5kKCcuYW1wLXNwaW5zZXQnKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2YXIgJGFsbFpvb21zID0gb2xkU2xpZGUuZmluZCgnLmFtcC16b29tYWJsZScpO1xuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9ICRhbGxab29tcy5pbmRleCgkem9vbSk7XG4gICAgICAgICAgICAgICAgdmFyIGluZGV4UHJldiA9IChpbmRleCA+IDApID8gKGluZGV4IC0gMSkgOiAoJGFsbFpvb21zLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgIHZhciBpbmRleE5leHQgPSAoaW5kZXggPCAkYWxsWm9vbXMubGVuZ3RoIC0gMSkgPyAoaW5kZXggKyAxKSA6ICgwKTtcbiAgICAgICAgICAgICAgICAkKCRhbGxab29tc1tpbmRleFByZXZdKS5hbXBab29tSW5saW5lKCd6b29tT3V0RnVsbCcpO1xuICAgICAgICAgICAgICAgICQoJGFsbFpvb21zW2luZGV4TmV4dF0pLmFtcFpvb21JbmxpbmUoJ3pvb21PdXRGdWxsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pbnZhbGlkYXRlWm9vbUJ1dHRvbnMoKTtcbiAgICB9LFxuICAgIHpvb21PdXRGdWxsOiBmdW5jdGlvbiAoaWdub3JlSW5ab29tQ2hlY2spIHtcbiAgICAgICAgdmFyICRjdXJyZW50Wm9vbSA9IHRoaXMuY3VycmVudFpvb20oKTtcblxuICAgICAgICBpZiAoJGN1cnJlbnRab29tLmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyICR6b29tQ29udGFpbmVyID0gJGN1cnJlbnRab29tLnBhcmVudCgpLmNoaWxkcmVuKCcuYW1wLXpvb21lZC1jb250YWluZXInKTtcbiAgICAgICAgICAgIHZhciBpblpvb20gPSAkem9vbUNvbnRhaW5lci5sZW5ndGggJiYgJHpvb21Db250YWluZXIuY3NzKCdkaXNwbGF5JykgIT09ICdub25lJztcblxuICAgICAgICAgICAgaWYgKGluWm9vbSB8fCBpZ25vcmVJblpvb21DaGVjaykge1xuICAgICAgICAgICAgICAgICR6b29tQ29udGFpbmVyLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgICAgICAgICAgICAgJGN1cnJlbnRab29tLmFtcFpvb21JbmxpbmUoJ3pvb21PdXRGdWxsJyk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW52YWxpZGF0ZVpvb21CdXR0b25zKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHpvb21JbjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJHpvb20gPSB0aGlzLmN1cnJlbnRab29tKCk7XG4gICAgICAgICR6b29tLmFtcFpvb21JbmxpbmUoJ3pvb21JbicpO1xuICAgIH0sXG4gICAgem9vbU91dDogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJHpvb20gPSB0aGlzLmN1cnJlbnRab29tKCk7XG4gICAgICAgICR6b29tLmFtcFpvb21JbmxpbmUoJ3pvb21PdXQnKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFpvb21Db250cm9sbGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgQmFzZVZpZXdlciA9IHJlcXVpcmUoJy4uL2NvbW1vbi9iYXNlVmlld2VyJyk7XG52YXIgRnVsbHNjcmVlblZpZXdlciA9IHJlcXVpcmUoJy4uL2Z1bGxzY3JlZW4tdmlld2VyL2luZGV4Jyk7XG52YXIgJCA9IHJlcXVpcmUoJy4uL2NvbW1vbi9qcXVlcnknKTtcbnZhciByb3VuZGVscyA9IHJlcXVpcmUoJy4uL2NvbW1vbi9yb3VuZGVscycpO1xudmFyIGNhcGFiaWxpdHlEZXRlY3Rpb24gPSByZXF1aXJlKCcuLi9jb21tb24vY2FwYWJpbGl0aWVzJyk7XG5cbnZhciBEZXNrdG9wVmlld2VyID0gZnVuY3Rpb24gRGVza3RvcFZpZXdlcihjb25maWcpIHtcbiAgICB0aGlzLnZpZXdlclR5cGUgPSAnZGVza3RvcCc7XG4gICAgY29uZmlnLnBhcmVudFZpZXdlciA9IHRoaXM7XG4gICAgdGhpcy5yb3VuZGVscyA9IGNvbmZpZy5yb3VuZGVscztcbiAgICB0aGlzLmNvbmZpZyA9IGNvbmZpZztcblxuICAgIGlmICgkKHdpbmRvdykud2lkdGgoKSA+PSAxMzY2KSB7XG4gICAgICAgIHRoaXMudGVtcGxhdGVzID0gY29uZmlnLnRlbXBsYXRlcy53aWRlRGVza3RvcDtcbiAgICB9XG5cbiAgICByZXR1cm4gQmFzZVZpZXdlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuRGVza3RvcFZpZXdlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEJhc2VWaWV3ZXIucHJvdG90eXBlKTtcblxuRGVza3RvcFZpZXdlci5wcm90b3R5cGUuX2dldFRodW1ic0NvbnRhaW5lckhlaWdodCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoJCh3aW5kb3cpLndpZHRoKCkgPCAxMzY2KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRodW1ic0NvbnRhaW5lckhlaWdodC5zbWFsbDtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudGh1bWJzQ29udGFpbmVySGVpZ2h0LmJpZztcbn07XG5cbkRlc2t0b3BWaWV3ZXIucHJvdG90eXBlLl9yZXNpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCF0aGlzLl9yZXNpemVOYXZUaHVtYnNGdW5jdGlvbikge1xuICAgICAgICB0aGlzLl9yZXNpemVOYXZUaHVtYnNGdW5jdGlvbiA9IHRoaXMudWkuY29udHJvbGxlcnMubmF2Q29udHJvbGxlci5fcmVzaXplTmF2VGh1bWJzT3ZlcmZsb3coKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXNpemVOYXZUaHVtYnNGdW5jdGlvbigpO1xuICAgIHRoaXMudWkuJG5hdi5hbXBDYXJvdXNlbCgncmVkcmF3Jyk7XG4gICAgdGhpcy51aS4kbmF2LmNzcyh7XG4gICAgICAgIGhlaWdodDogc2VsZi5fZ2V0VGh1bWJzQ29udGFpbmVySGVpZ2h0KClcbiAgICB9KTtcbn07XG5cbkRlc2t0b3BWaWV3ZXIucHJvdG90eXBlLl9pbml0Vmlld2VyQ29tcG9uZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIG1haW5DYXJvdXNlbE9wdGlvbnMgPSB7XG4gICAgICAgICdwcmVsb2FkTmV4dCc6IGZhbHNlLFxuICAgICAgICAnd2lkdGgnOiA2MDAsXG4gICAgICAgICdoZWlnaHQnOiAzMTgsXG4gICAgICAgICdvbkFjdGl2YXRlJzogeydnb1RvJzogZmFsc2UsICdzZWxlY3QnOiBmYWxzZX0sXG4gICAgICAgICdsb29wJzogZmFsc2UsXG4gICAgICAgICdhbmltYXRlJzogdHJ1ZSxcbiAgICAgICAgJ2dlc3R1cmUnOiB7J2VuYWJsZWQnOiB0cnVlLCAnZmluZ2Vycyc6IDF9XG4gICAgfTtcblxuICAgIC8vVE9ETzogR2V0IHJpZCBvZiBBU0FQIDooXG4gICAgaWYgKGNhcGFiaWxpdHlEZXRlY3Rpb24uZ2V0SXNJRSgpKSB7XG4gICAgICAgIG1haW5DYXJvdXNlbE9wdGlvbnMubm8zRCA9IHRydWU7XG4gICAgfVxuXG4gICAgdGhpcy51aS4kbWFpbi5hbXBDYXJvdXNlbChtYWluQ2Fyb3VzZWxPcHRpb25zKTtcblxuICAgIHRoaXMudGh1bWJzQ29udGFpbmVySGVpZ2h0ID0ge1xuICAgICAgICBzbWFsbDogNDYsXG4gICAgICAgIGJpZzogNTNcbiAgICB9O1xuXG4gICAgdGhpcy51aS4kbmF2LmFtcENhcm91c2VsKHtcbiAgICAgICAgJ29uQWN0aXZhdGUnOiB7J3NlbGVjdCc6IGZhbHNlLCAnZ29Ubyc6IGZhbHNlfSxcbiAgICAgICAgJ3ByZWxvYWROZXh0JzogZmFsc2UsXG4gICAgICAgICdkaXInOiAnaG9yeicsXG4gICAgICAgICdyZXNwb25zaXZlJzogZmFsc2UsXG4gICAgICAgICdsb29wJzogZmFsc2UsXG4gICAgICAgICdoZWlnaHQnOiBzZWxmLl9nZXRUaHVtYnNDb250YWluZXJIZWlnaHQoKSxcbiAgICAgICAgJ2Vhc2luZyc6ICdlYXNlLWluLW91dCcsXG4gICAgICAgICdhbmltRHVyYXRpb24nOiA2MDBcbiAgICB9KTtcbiAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZS5hbXAuZGVza3RvcC5yZXNpemUnLCB0aGlzLl9yZXNpemVCYXNlLmJpbmQodGhpcykpO1xufTtcblxuRGVza3RvcFZpZXdlci5wcm90b3R5cGUuX2Rlc3Ryb3lWaWV3ZXJDb21wb25lbnRzID0gZnVuY3Rpb24gKCkge1xuICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZS5hbXAuZGVza3RvcC5yZXNpemUnKTtcbn07XG5cbkRlc2t0b3BWaWV3ZXIucHJvdG90eXBlLl9jYWNoZVZpZXdlckRvbSA9IGZ1bmN0aW9uICgkcmVuZGVyZWREb20pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgJC5leHRlbmQodHJ1ZSwgc2VsZi51aSwge1xuICAgICAgICAkcm91bmRlbHM6ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLXJvdW5kZWxzJyksXG4gICAgICAgIHF1aWNrTGlua3M6IHtcbiAgICAgICAgICAgICRmdWxsc2NyZWVuTGluazogJHJlbmRlcmVkRG9tLmZpbmQoJy5hbXAtcXVpY2tsaW5rLWZ1bGxzY3JlZW4nKVxuICAgICAgICB9LFxuICAgICAgICBvcGVuRnVsbHNjcmVlblZpZXdlcjogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgICAgICBpZiAoIXNlbGYuZnVsbHNjcmVlbiB8fCBzZWxmLmZ1bGxzY3JlZW4uc2V0RGF0YS5pdGVtcy5sZW5ndGggIT09IHNlbGYuc2V0RGF0YS5pdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmZ1bGxzY3JlZW4gPSBudWxsO1xuICAgICAgICAgICAgICAgIHZhciBjdXJyZW50U2xpZGVJbmRleCA9IHNlbGYudWkuY3VycmVudFNsaWRlKCkuaW5kZXgoKTsgICAgICAgICAgICAgICAgICAgICAvLy8vLy8gIFJlbWVtYmVyIGN1cnJlbnQgc2xpZGVcbiAgICAgICAgICAgICAgICBzZWxmLmZ1bGxzY3JlZW4gPSBuZXcgRnVsbHNjcmVlblZpZXdlcihzZWxmLmNvbmZpZyk7ICAgICAgICAgICAgICAgICAgICAgICAgLy8vLy8vICBTZXRzIGN1cnJlbnQgc2xpZGUgdG8gMCBpbiBkZXNrdG9wIHZpZXdlclxuICAgICAgICAgICAgICAgIHNlbGYuZnVsbHNjcmVlbi51aS5jb250cm9sbGVycy5uYXZDb250cm9sbGVyLnNlbGVjdChjdXJyZW50U2xpZGVJbmRleCk7ICAgICAvLy8vLy8gIFJlc3RvcmUgY3VycmVudCBzbGlkZVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5mdWxsc2NyZWVuLiRjdXJyZW50U2xpZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4T2ZCYXNlVmlldyA9IHNlbGYuZnVsbHNjcmVlbi4kY3VycmVudFNsaWRlLmluZGV4KCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbmRleE9mRnVsbFZpZXcgPSBzZWxmLiRjdXJyZW50U2xpZGUuaW5kZXgoKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXhPZkJhc2VWaWV3ICE9PSBpbmRleE9mRnVsbFZpZXcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZnVsbHNjcmVlbi5fdXBkYXRlVmlld2VyKHNlbGYuc2V0RGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzZWxmLnNldERhdGEubmFtZSAhPT0gc2VsZi5mdWxsc2NyZWVuLnNldERhdGEubmFtZSkge1xuICAgICAgICAgICAgICAgIHNlbGYuZnVsbHNjcmVlbi5fdXBkYXRlVmlld2VyKHNlbGYuc2V0RGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZWxmLnVpLmNvbnRyb2xsZXJzLnZpZGVvQ29udHJvbGxlci5wYXVzZSgpO1xuICAgICAgICAgICAgc2VsZi5mdWxsc2NyZWVuLm9wZW4oKTtcbiAgICAgICAgICAgIHNlbGYuZnVsbHNjcmVlbi51aS5jb250cm9sbGVycy56b29tQ29udHJvbGxlci5yZXNldChzZWxmLmZ1bGxzY3JlZW4udWkuY3VycmVudFNsaWRlKCkpO1xuICAgICAgICB9LFxuICAgICAgICBjbG9zZUZ1bGxzY3JlZW5WaWV3ZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZnVsbHNjcmVlbi5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcm91bmRlbHMucmVuZGVyKHNlbGYudWkuJHJvdW5kZWxzLCBzZWxmLnJvdW5kZWxzKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGVza3RvcFZpZXdlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyICQgPSByZXF1aXJlKCcuLi9jb21tb24vanF1ZXJ5Jyk7XG52YXIgYW1wID0gcmVxdWlyZSgnLi4vY29tbW9uL25hbWVzcGFjZScpO1xudmFyIFpvb21Db250cm9sbGVyID0gcmVxdWlyZSgnLi4vY29tbW9uL3pvb21Db250cm9sbGVyJyk7XG52YXIgQmFzZVZpZXdlciA9IHJlcXVpcmUoJy4uL2NvbW1vbi9iYXNlVmlld2VyJyk7XG5cbnZhciBGdWxsc2NyZWVuVmlld2VyID0gZnVuY3Rpb24gRnVsbHNjcmVlblZpZXdlcihjb25maWcpIHtcbiAgICB0aGlzLnZpZXdlclR5cGUgPSAnZnVsbHNjcmVlbic7XG4gICAgdGhpcy5wYXJlbnRWaWV3ZXIgPSBjb25maWcucGFyZW50Vmlld2VyO1xuICAgIC8vY2hhbmdpbmcgZnVsbHNjcmVlbiB3cmFwcGVyIHNvIGNsaWVudCBkb2Vzbid0IG5lZWQgdG8gYWRkIGEgZGl2IGZpcnN0XG4gICAgdGhpcy51aSA9IHtcbiAgICAgICAgJGVsOiAkKCcuYW1wLWZ1bGxzY3JlZW4td3JhcHBlcicpXG4gICAgfTtcblxuICAgIGlmICghdGhpcy51aS4kZWwubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMudWkuJGVsID0gJCgnPGRpdiBjbGFzcz1cImFtcC1mdWxsc2NyZWVuLXdyYXBwZXJcIiBzdHlsZT1cImRpc3BsYXk6bm9uZVwiPjwvZGl2PicpO1xuICAgICAgICAkKCdib2R5JykuYXBwZW5kKHRoaXMudWkuJGVsKTtcbiAgICB9XG5cbiAgICB0aGlzLnRlbXBsYXRlcyA9IGNvbmZpZy50ZW1wbGF0ZXMuZnVsbFNjcmVlbjtcbiAgICByZXR1cm4gQmFzZVZpZXdlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxuRnVsbHNjcmVlblZpZXdlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEJhc2VWaWV3ZXIucHJvdG90eXBlKTtcblxuRnVsbHNjcmVlblZpZXdlci5wcm90b3R5cGUuX2JpbmRWaWV3ZXJFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy51aS5jb250cm9scy4kY2xvc2Uub24oJ2NsaWNrJywgdGhpcy5jbG9zZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnpvb21Db250cm9sbGVyID0gbmV3IFpvb21Db250cm9sbGVyKFxuICAgICAgICB0aGlzLnVpLmNvbnRyb2xzLiR6b29tSW4sXG4gICAgICAgIHRoaXMudWkuY29udHJvbHMuJHpvb21PdXQsXG4gICAgICAgIHRoaXMudWkuY3VycmVudFNsaWRlXG4gICAgKTtcbiAgICBhbXAuc3RhdHMuYmluZChbXG4gICAgICAgIHsndHlwZSc6ICdzdGFjaycsICdldmVudCc6ICdjaGFuZ2UnLCAnY2InOiB0aGlzLl9vbk1haW5TbGlkZUNoYW5nZS5iaW5kKHRoaXMpfVxuICAgIF0pO1xufTtcblxuRnVsbHNjcmVlblZpZXdlci5wcm90b3R5cGUuX2JlZm9yZVZpZXdlckNyZWF0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5kaXNhYmxlVG91Y2hTY3JvbGwoKTtcbiAgICB0aGlzLmRpc2FibGVDc3NTY3JvbGwoKTtcbn07XG5cbkZ1bGxzY3JlZW5WaWV3ZXIucHJvdG90eXBlLl9pbml0Vmlld2VyQ29tcG9uZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnVpLiRtYWluLmFtcFN0YWNrKHtcbiAgICAgICAgJ2xvb3AnOiBmYWxzZSxcbiAgICAgICAgJ2dlc3R1cmUnOiB7J2VuYWJsZWQnOiB0cnVlLCAnZmluZ2Vycyc6IDF9XG4gICAgfSk7XG5cbiAgICB0aGlzLnVpLiRtYWluLmFtcFN0YWNrKCd2aXNpYmxlJywgdHJ1ZSk7XG5cbiAgICB0aGlzLnVpLiRuYXYuYW1wQ2Fyb3VzZWwoe1xuICAgICAgICAnb25BY3RpdmF0ZSc6IHsnc2VsZWN0JzogZmFsc2UsICdnb1RvJzogZmFsc2V9LFxuICAgICAgICAncHJlbG9hZE5leHQnOiBmYWxzZSxcbiAgICAgICAgJ2Rpcic6ICdob3J6JyxcbiAgICAgICAgJ2xvb3AnOiBmYWxzZSxcbiAgICAgICAgJ2hlaWdodCc6IDU1LFxuICAgICAgICAnd2lkdGgnOiA0NTAsXG4gICAgICAgICdyZXNwb25zaXZlJzogZmFsc2UsXG4gICAgICAgICdlYXNpbmcnOiAnZWFzZS1pbi1vdXQnLFxuICAgICAgICAnYW5pbUR1cmF0aW9uJzogNjAwXG4gICAgfSk7XG5cbiAgICB0aGlzLnVpLiRtYWluLmZpbmQoJy5hbXAtem9vbWFibGUnKS5hbXBab29tSW5saW5lKHtcbiAgICAgICAgJ3NjYWxlU3RlcHMnOiB0cnVlLFxuICAgICAgICAnZXZlbnRzJzogeyd6b29tSW4nOiAnbm9uZScsICd6b29tT3V0JzogJ25vbmUnLCAnbW92ZSc6ICdub25lJ30sXG4gICAgICAgICdwYW4nOiB0cnVlLFxuICAgICAgICAncGluY2gnOiB0cnVlLFxuICAgICAgICAndHJhbnNmb3Jtcyc6IHRoaXMudGVtcGxhdGVzLmltYWdlWm9vbVxuICAgIH0pO1xuXG59O1xuXG5GdWxsc2NyZWVuVmlld2VyLnByb3RvdHlwZS5fZGVzdHJveVZpZXdlckNvbXBvbmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXpvb21hYmxlJykuYW1wWm9vbUlubGluZSgnZGVzdHJveScpO1xuICAgIHRoaXMuJGN1cnJlbnRTbGlkZSA9IHZvaWQgMDtcbn07XG5cbkZ1bGxzY3JlZW5WaWV3ZXIucHJvdG90eXBlLl9jYWNoZVZpZXdlckRvbSA9IGZ1bmN0aW9uICgkcmVuZGVyZWREb20pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgJC5leHRlbmQodHJ1ZSwgdGhpcy51aSwge1xuICAgICAgICBjb250cm9sczoge1xuICAgICAgICAgICAgJGNsb3NlOiAkcmVuZGVyZWREb20uZmluZCgnLmFtcC1jbG9zZScpLFxuICAgICAgICAgICAgJHpvb21JbjogJHJlbmRlcmVkRG9tLmZpbmQoJy5hbXAtem9vbS1pbicpLFxuICAgICAgICAgICAgJHpvb21PdXQ6ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLXpvb20tb3V0JylcbiAgICAgICAgfSxcbiAgICAgICAgZ2V0TWFpbkNoaWxkcmVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gc2VsZi51aS4kbWFpbi5jaGlsZHJlbigpO1xuICAgICAgICB9LFxuICAgICAgICBtYWluU2VsZWN0OiBmdW5jdGlvbiAoc2xpZGVJbmRleCkge1xuICAgICAgICAgICAgc2VsZi51aS4kbWFpbi5hbXBTdGFjaygnZ29UbycsIHNsaWRlSW5kZXgpO1xuICAgICAgICB9LFxuICAgICAgICBjdXJyZW50U2xpZGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLnVpLiRtYWluLmNoaWxkcmVuKCcuYW1wLWxheWVyLmFtcC1zZWxlY3RlZCcpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG5GdWxsc2NyZWVuVmlld2VyLnByb3RvdHlwZS5fcmVzaXplID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudWkuY29udHJvbGxlcnMuem9vbUNvbnRyb2xsZXIuem9vbU91dEZ1bGwodHJ1ZSk7XG4gICAgdGhpcy5fbWFpbnRhaW5Bc3BlY3RSYXRpbygpO1xufTtcblxuRnVsbHNjcmVlblZpZXdlci5wcm90b3R5cGUuX21haW50YWluQXNwZWN0UmF0aW8gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGN3ID0gdGhpcy51aS4kbWFpbi53aWR0aCgpO1xuICAgIHZhciBjaCA9IHRoaXMudWkuJG1haW4uaGVpZ2h0KCk7XG4gICAgdmFyIG9hcyA9IDYwMCAvIDMxODtcbiAgICB2YXIgY2FzID0gY3cgLyBjaDtcbiAgICBpZiAoY2FzID49IG9hcykge1xuICAgICAgICB0aGlzLnVpLiRtYWluLmZpbmQoJ1tkYXRhLWFtcC1zcmNdJykuY3NzKHsnaGVpZ2h0JzogJzEwMCUnLCAnd2lkdGgnOiAnYXV0byd9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnVpLiRtYWluLmZpbmQoJ1tkYXRhLWFtcC1zcmNdJykuY3NzKHsnd2lkdGgnOiAnMTAwJScsICdoZWlnaHQnOiAnYXV0byd9KTtcbiAgICB9XG59O1xuXG5GdWxsc2NyZWVuVmlld2VyLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZGlzYWJsZVRvdWNoU2Nyb2xsKCk7XG4gICAgdGhpcy5kaXNhYmxlQ3NzU2Nyb2xsKCk7XG4gICAgdGhpcy51aS4kZWwuY3NzKHtkaXNwbGF5OiAnYmxvY2snfSk7XG4gICAgdGhpcy5fbWFpbnRhaW5Bc3BlY3RSYXRpbygpO1xuICAgIHRoaXMudWkuY29udHJvbGxlcnMudmlkZW9Db250cm9sbGVyLl9yZXNpemVDdXJyZW50VmlkZW8oKTtcbiAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZS5hbXAuZnVsbHNjcmVlbi5yZXNpemUnLCB0aGlzLl9yZXNpemVCYXNlLmJpbmQodGhpcykpO1xufTtcblxuRnVsbHNjcmVlblZpZXdlci5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5lbmFibGVUb3VjaFNjcm9sbCgpO1xuICAgIHRoaXMuZW5hYmxlQ3NzU2Nyb2xsKCk7XG4gICAgdGhpcy51aS5jb250cm9sbGVycy52aWRlb0NvbnRyb2xsZXIucGF1c2UoKTtcbiAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnpvb21Db250cm9sbGVyLnJlc2V0KHRoaXMudWkuY3VycmVudFNsaWRlKCkpO1xuICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZS5hbXAuZnVsbHNjcmVlbi5yZXNpemUnKTtcbiAgICB0aGlzLnVpLiRlbC5jc3Moe2Rpc3BsYXk6ICdub25lJ30pO1xuICAgIHRoaXMudWkuY29udHJvbGxlcnMudmlkZW9Db250cm9sbGVyLl9yZXNpemVDdXJyZW50VmlkZW8oKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRnVsbHNjcmVlblZpZXdlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIHRlbXBsYXRlcyA9IHJlcXVpcmUoJy4uL3RlbXBsYXRlcy90ZW1wbGF0ZXMuY29tcGlsZWQnKTtcbnZhciAkID0gcmVxdWlyZSgnLi4vY29tbW9uL2pxdWVyeScpO1xuXG52YXIgSW50ZWdyYXRpb25WaWV3ZXIgPSBmdW5jdGlvbiBJbnRlZ3JhdGlvblZpZXdlcihjb25maWcpIHtcbiAgICB2YXIgdGVtcGxhdGUgPSB0ZW1wbGF0ZXNbJ3RlbXBsYXRlLWludGVncmF0aW9uJ107XG5cbiAgICB2YXIgaW50ZWdyYXRpb25LZXlzID0gWydtb2JpbGUnLCAncXVpY2tWaWV3JywgJ3Byb2R1Y3ROYW1lJywgJ3JhbmdlTmFtZScsICdsb2NhbGUnLCAnc2V0TmFtZSddO1xuXG4gICAgdmFyIHZpZXdNb2RlbCA9IHtcbiAgICAgICAgaW50ZWdyYXRpb25Qb2ludHM6IFtdLFxuICAgICAgICB2aWV3ZXJPcHRpb25zOiBbXVxuICAgIH07XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gaW50ZWdyYXRpb25LZXlzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZpZXdNb2RlbC5pbnRlZ3JhdGlvblBvaW50cy5wdXNoKHtcbiAgICAgICAgICAgIGtleTogaW50ZWdyYXRpb25LZXlzW2ldLFxuICAgICAgICAgICAgdmFsdWU6IGludGVncmF0aW9uS2V5c1tpXSAmJiBjb25maWdbaW50ZWdyYXRpb25LZXlzW2ldXS50b1N0cmluZygpXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHZpZXdNb2RlbC52aWV3ZXJPcHRpb25zLnB1c2goe1xuICAgICAgICBrZXk6ICdwcm9kdWN0JyxcbiAgICAgICAgdmFsdWU6IGNvbmZpZy5wcm9kdWN0XG4gICAgfSk7XG5cbiAgICB2aWV3TW9kZWwudmlld2VyT3B0aW9ucy5wdXNoKHtcbiAgICAgICAga2V5OiAncm91bmRlbHMnLFxuICAgICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoY29uZmlnLnJvdW5kZWxzLCBudWxsLCAyKVxuICAgIH0pO1xuXG4gICAgdmlld01vZGVsLnZpZXdlck9wdGlvbnMucHVzaCh7XG4gICAgICAgIGtleTogJ3RlbXBsYXRlcycsXG4gICAgICAgIHZhbHVlOiBKU09OLnN0cmluZ2lmeShjb25maWcudGVtcGxhdGVzLCBudWxsLCAyKVxuICAgIH0pO1xuXG4gICAgdmlld01vZGVsLnZpZXdlck9wdGlvbnMucHVzaCh7XG4gICAgICAgIGtleTogJ3NlcnZlcicsXG4gICAgICAgIHZhbHVlOiBjb25maWcuc2VydmVyXG4gICAgfSk7XG5cbiAgICB2aWV3TW9kZWwudmlld2VyT3B0aW9ucy5wdXNoKHtcbiAgICAgICAga2V5OiAnYWNjb3VudCcsXG4gICAgICAgIHZhbHVlOiBjb25maWcuYWNjb3VudFxuICAgIH0pO1xuXG4gICAgdmlld01vZGVsLnZpZXdlck9wdGlvbnMucHVzaCh7XG4gICAgICAgIGtleTogJ3ZpZGVvU29ydE9yZGVyJyxcbiAgICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KGNvbmZpZy52aWRlb1NvcnRPcmRlcilcbiAgICB9KTtcblxuICAgICQoY29uZmlnLnRhcmdldCkuaHRtbCh0ZW1wbGF0ZSh2aWV3TW9kZWwpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZWdyYXRpb25WaWV3ZXI7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciB0ZW1wbGF0ZXMgPSByZXF1aXJlKCcuLi90ZW1wbGF0ZXMvdGVtcGxhdGVzLmNvbXBpbGVkJyk7XG52YXIgJCA9IHJlcXVpcmUoJy4uL2NvbW1vbi9qcXVlcnknKTtcbnZhciBCYXNlVmlld2VyID0gcmVxdWlyZSgnLi4vY29tbW9uL2Jhc2VWaWV3ZXInKTtcbnZhciBab29tQ29udHJvbGxlciA9IHJlcXVpcmUoJy4uL2NvbW1vbi96b29tQ29udHJvbGxlcicpO1xuXG52YXIgTW9iaWxlVmlld2VyID0gZnVuY3Rpb24gTW9iaWxlVmlld2VyKGNvbmZpZykge1xuICAgIHRoaXMudmlld2VyVHlwZSA9ICdtb2JpbGUnO1xuICAgIHRoaXMudGVtcGxhdGVzID0gY29uZmlnLnRlbXBsYXRlcy5tb2JpbGVWaWV3O1xuICAgIHRoaXMudGVtcGxhdGVOYXZJdGVtID0gdGVtcGxhdGVzWydfdGVtcGxhdGUtbmF2LWl0ZW0tYWx0J107XG4gICAgcmV0dXJuIEJhc2VWaWV3ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbk1vYmlsZVZpZXdlci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEJhc2VWaWV3ZXIucHJvdG90eXBlKTtcblxuTW9iaWxlVmlld2VyLnByb3RvdHlwZS5fcmVzaXplID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudWkuY29udHJvbGxlcnMuem9vbUNvbnRyb2xsZXIuem9vbU91dEZ1bGwodHJ1ZSk7XG59O1xuXG5Nb2JpbGVWaWV3ZXIucHJvdG90eXBlLl9iaW5kVmlld2VyRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHNlbGYudWkuY29udHJvbGxlcnMuem9vbUNvbnRyb2xsZXIgPSBuZXcgWm9vbUNvbnRyb2xsZXIoXG4gICAgICAgIHNlbGYudWkuY29udHJvbHMuJHpvb21JbixcbiAgICAgICAgc2VsZi51aS5jb250cm9scy4kem9vbU91dCxcbiAgICAgICAgc2VsZi51aS5jdXJyZW50U2xpZGVcbiAgICApO1xufTtcblxuTW9iaWxlVmlld2VyLnByb3RvdHlwZS5faW5pdFZpZXdlckNvbXBvbmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy51aS4kbWFpbi5hbXBDYXJvdXNlbCh7XG4gICAgICAgICd3aWR0aCc6IDYwMCxcbiAgICAgICAgJ2hlaWdodCc6IDMxOCxcbiAgICAgICAgJ29uQWN0aXZhdGUnOiB7J2dvVG8nOiBmYWxzZSwgJ3NlbGVjdCc6IGZhbHNlfSxcbiAgICAgICAgJ2xvb3AnOiBmYWxzZSxcbiAgICAgICAgJ2FuaW1hdGUnOiB0cnVlLFxuICAgICAgICAnZ2VzdHVyZSc6IHsnZW5hYmxlZCc6IHRydWUsICdmaW5nZXJzJzogMX1cbiAgICB9KTtcblxuICAgIHRoaXMudWkuJG5hdi5hbXBDYXJvdXNlbCh7XG4gICAgICAgICdvbkFjdGl2YXRlJzogeydzZWxlY3QnOiBmYWxzZSwgJ2dvVG8nOiBmYWxzZX0sXG4gICAgICAgICdwcmVsb2FkTmV4dCc6IGZhbHNlLFxuICAgICAgICAnZGlyJzogJ2hvcnonLFxuICAgICAgICAnbG9vcCc6IGZhbHNlLFxuICAgICAgICAnaGVpZ2h0JzogMTYsXG4gICAgICAgICdyZXNwb25zaXZlJzogZmFsc2UsXG4gICAgICAgICd3aWR0aCc6IDEwNFxuICAgIH0pO1xuXG4gICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXpvb21hYmxlJykuYW1wWm9vbUlubGluZSh7XG4gICAgICAgICdzY2FsZVN0ZXBzJzogdHJ1ZSxcbiAgICAgICAgJ2V2ZW50cyc6IHsnem9vbUluJzogJ25vbmUnLCAnem9vbU91dCc6ICdub25lJywgJ21vdmUnOiAnbm9uZSd9LFxuICAgICAgICAncGFuJzogdHJ1ZSxcbiAgICAgICAgJ3BpbmNoJzogdHJ1ZSxcbiAgICAgICAgJ3RyYW5zZm9ybXMnOiB0aGlzLnRlbXBsYXRlcy5pbWFnZVpvb21cbiAgICB9KTtcblxuICAgICQod2luZG93KS5vbigncmVzaXplLmFtcC5tb2JpbGUucmVzaXplJywgdGhpcy5fcmVzaXplQmFzZS5iaW5kKHRoaXMpKTtcbn07XG5cbk1vYmlsZVZpZXdlci5wcm90b3R5cGUuX2Rlc3Ryb3lWaWV3ZXJDb21wb25lbnRzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudWkuJG1haW4uZmluZCgnLmFtcC16b29tYWJsZScpLmFtcFpvb21JbmxpbmUoJ2Rlc3Ryb3knKTtcbiAgICB0aGlzLiRjdXJyZW50U2xpZGUgPSB2b2lkIDA7XG5cbiAgICAkKHdpbmRvdykub2ZmKCdyZXNpemUuYW1wLm1vYmlsZS5yZXNpemUnKTtcbn07XG5cbk1vYmlsZVZpZXdlci5wcm90b3R5cGUuX2NhY2hlVmlld2VyRG9tID0gZnVuY3Rpb24gKCRyZW5kZXJlZERvbSkge1xuICAgICQuZXh0ZW5kKHRydWUsIHRoaXMudWksIHtcbiAgICAgICAgY29udHJvbHM6IHtcbiAgICAgICAgICAgICR6b29tSW46ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLXpvb20taW4nKSxcbiAgICAgICAgICAgICR6b29tT3V0OiAkcmVuZGVyZWREb20uZmluZCgnLmFtcC16b29tLW91dCcpXG4gICAgICAgIH1cbiAgICB9KTtcblxufTtcbm1vZHVsZS5leHBvcnRzID0gTW9iaWxlVmlld2VyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgJCA9IHJlcXVpcmUoJy4uL2NvbW1vbi9qcXVlcnknKTtcbnZhciBCYXNlVmlld2VyID0gcmVxdWlyZSgnLi4vY29tbW9uL2Jhc2VWaWV3ZXInKTtcbnZhciBab29tQ29udHJvbGxlciA9IHJlcXVpcmUoJy4uL2NvbW1vbi96b29tQ29udHJvbGxlcicpO1xudmFyIGNhcGFiaWxpdHlEZXRlY3Rpb24gPSByZXF1aXJlKCcuLi9jb21tb24vY2FwYWJpbGl0aWVzJyk7XG5cbnZhciBRdWlja1ZpZXdlciA9IGZ1bmN0aW9uIFF1aWNrVmlld2VyKGNvbmZpZykge1xuICAgIHRoaXMudmlld2VyVHlwZSA9ICdxdWlja3ZpZXcnO1xuICAgIHRoaXMudGVtcGxhdGVzID0gY29uZmlnLnRlbXBsYXRlcy5xdWlja1ZpZXc7XG4gICAgcmV0dXJuIEJhc2VWaWV3ZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cblF1aWNrVmlld2VyLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQmFzZVZpZXdlci5wcm90b3R5cGUpO1xuXG5RdWlja1ZpZXdlci5wcm90b3R5cGUuX3Jlc2l6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLnVpLmNvbnRyb2xsZXJzLnpvb21Db250cm9sbGVyLnpvb21PdXRGdWxsKHRydWUpO1xuICAgIGlmICghdGhpcy5fcmVzaXplTmF2VGh1bWJzRnVuY3Rpb24pIHtcbiAgICAgICAgdGhpcy5fcmVzaXplTmF2VGh1bWJzRnVuY3Rpb24gPSB0aGlzLnVpLmNvbnRyb2xsZXJzLm5hdkNvbnRyb2xsZXIuX3Jlc2l6ZU5hdlRodW1ic092ZXJmbG93KCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVzaXplTmF2VGh1bWJzRnVuY3Rpb24oKTtcbn07XG5cblF1aWNrVmlld2VyLnByb3RvdHlwZS5fYmluZFZpZXdlckV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB0aGlzLnVpLmNvbnRyb2xzLiRjbG9zZS5vbignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYudWkuY29udHJvbGxlcnMudmlkZW9Db250cm9sbGVyLnBhdXNlKCk7XG4gICAgICAgIHNlbGYuX2Rlc3Ryb3lDb21wb25lbnRzKCk7XG4gICAgICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZS5hbXAucXVpY2t2aWV3LnJlc2l6ZScpO1xuICAgIH0pO1xuXG4gICAgdGhpcy51aS5jb250cm9sbGVycy56b29tQ29udHJvbGxlciA9IG5ldyBab29tQ29udHJvbGxlcihcbiAgICAgICAgICAgIHRoaXMudWkuY29udHJvbHMuJHpvb21JbixcbiAgICAgICAgICAgIHRoaXMudWkuY29udHJvbHMuJHpvb21PdXQsXG4gICAgICAgICAgICB0aGlzLnVpLmN1cnJlbnRTbGlkZVxuICAgICAgICAgICAgKTtcbn07XG5cblF1aWNrVmlld2VyLnByb3RvdHlwZS5fYmVmb3JlVmlld2VyQ3JlYXRlZCA9IGZ1bmN0aW9uICgpIHtcblxufTtcblxuUXVpY2tWaWV3ZXIucHJvdG90eXBlLl9pbml0Vmlld2VyQ29tcG9uZW50cyA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBtYWluQ2Fyb3VzZWxPcHRpb25zID0ge1xuICAgICAgICAncHJlbG9hZE5leHQnOiBmYWxzZSxcbiAgICAgICAgJ29uQWN0aXZhdGUnOiB7J2dvVG8nOiBmYWxzZSwgJ3NlbGVjdCc6IGZhbHNlfSxcbiAgICAgICAgJ2xvb3AnOiBmYWxzZSxcbiAgICAgICAgJ2FuaW1hdGUnOiB0cnVlLFxuICAgICAgICAnZ2VzdHVyZSc6IHsnZW5hYmxlZCc6IHRydWUsICdmaW5nZXJzJzogMX1cbiAgICB9O1xuXG4gICAgLy9UT0RPOiBHZXQgcmlkIG9mIEFTQVAgOihcbiAgICBpZiAoY2FwYWJpbGl0eURldGVjdGlvbi5nZXRJc0lFKCkpIHtcbiAgICAgICAgbWFpbkNhcm91c2VsT3B0aW9ucy5ubzNEID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLnVpLiRtYWluLmFtcENhcm91c2VsKG1haW5DYXJvdXNlbE9wdGlvbnMpO1xuXG4gICAgdGhpcy51aS4kbmF2LmFtcENhcm91c2VsKHtcbiAgICAgICAgJ29uQWN0aXZhdGUnOiB7J3NlbGVjdCc6IGZhbHNlLCAnZ29Ubyc6IGZhbHNlfSxcbiAgICAgICAgJ3ByZWxvYWROZXh0JzogZmFsc2UsXG4gICAgICAgICdkaXInOiAnaG9yeicsXG4gICAgICAgICdsb29wJzogZmFsc2UsXG4gICAgICAgICdoZWlnaHQnOiA0NixcbiAgICAgICAgJ3dpZHRoJzogMzgwLFxuICAgICAgICAnZWFzaW5nJzogJ2Vhc2UtaW4tb3V0JyxcbiAgICAgICAgJ2FuaW1EdXJhdGlvbic6IDYwMFxuICAgIH0pO1xuXG4gICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXpvb21hYmxlJykuYW1wWm9vbUlubGluZSh7XG4gICAgICAgICdzY2FsZVN0ZXBzJzogdHJ1ZSxcbiAgICAgICAgJ2V2ZW50cyc6IHsnem9vbUluJzogJ25vbmUnLCAnem9vbU91dCc6ICdub25lJywgJ21vdmUnOiAnbm9uZSd9LFxuICAgICAgICAncGFuJzogdHJ1ZSxcbiAgICAgICAgJ3BpbmNoJzogdHJ1ZSxcbiAgICAgICAgJ3RyYW5zZm9ybXMnOiB0aGlzLnRlbXBsYXRlcy5pbWFnZVpvb21cbiAgICB9KTtcblxuICAgICQod2luZG93KS5vbigncmVzaXplLmFtcC5xdWlja3ZpZXcucmVzaXplJywgdGhpcy5fcmVzaXplQmFzZS5iaW5kKHRoaXMpKTtcbn07XG5cblF1aWNrVmlld2VyLnByb3RvdHlwZS5fZGVzdHJveVZpZXdlckNvbXBvbmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy51aS4kbWFpbi5maW5kKCcuYW1wLXpvb21hYmxlJykuYW1wWm9vbUlubGluZSgnZGVzdHJveScpO1xuICAgIHRoaXMuJGN1cnJlbnRTbGlkZSA9IHZvaWQgMDtcbn07XG5cblF1aWNrVmlld2VyLnByb3RvdHlwZS5fY2FjaGVWaWV3ZXJEb20gPSBmdW5jdGlvbiAoJHJlbmRlcmVkRG9tKSB7XG4gICAgJC5leHRlbmQodHJ1ZSwgdGhpcy51aSwge1xuICAgICAgICBjb250cm9sczoge1xuICAgICAgICAgICAgJGNsb3NlOiAkcmVuZGVyZWREb20uZmluZCgnLmFtcC1jbG9zZScpLFxuICAgICAgICAgICAgJHpvb21JbjogJHJlbmRlcmVkRG9tLmZpbmQoJy5hbXAtem9vbS1pbicpLFxuICAgICAgICAgICAgJHpvb21PdXQ6ICRyZW5kZXJlZERvbS5maW5kKCcuYW1wLXpvb20tb3V0JylcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWlja1ZpZXdlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xudGhpc1tcImFtcFwiXSA9IHRoaXNbXCJhbXBcIl0gfHwge307XG50aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdID0gdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXSB8fCB7fTtcbnRoaXNbXCJhbXBcIl1bXCJ0ZW1wbGF0ZXNcIl1bXCJkZnNcIl0gPSB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdIHx8IHt9O1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVyUGFydGlhbChcIl90ZW1wbGF0ZS1tYWluLWl0ZW1cIiwgdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcIl90ZW1wbGF0ZS1tYWluLWl0ZW1cIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcIjFcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIiAgICAgICA8dWwgY2xhc3M9XFxcImFtcC1yZWNsaW5lciBhbXAtdWktaGludFxcXCI+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcuY2FsbChkZXB0aDAsY29udGFpbmVyLmxhbWJkYSgoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW0gOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLnNldCA6IHN0YWNrMSkpICE9IG51bGwgPyBzdGFjazEuaXRlbXMgOiBzdGFjazEpLCBkZXB0aDApLHtcIm5hbWVcIjpcIml0ZW0uc2V0Lml0ZW1zXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDIsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5ub29wLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgPC91bD5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1jb3Zlci1ib3ggYW1wLWV4aXQtcHJvbXB0IGhpZGRlblxcXCI+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW1lc3NhZ2VcXFwiPlxcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwiYW1wLW1lc3NhZ2UtdGFnbGluZVxcXCI+RG91YmxlIHRhcCB0byBleGl0PC9zcGFuPlxcbiAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgPC9kaXY+XFxuICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtY292ZXItYm94IGFtcC1kb3VibGUtdGFwLXByb21wdFxcXCI+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW1lc3NhZ2VcXFwiPlxcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwiYW1wLW1lc3NhZ2UtdGFnbGluZVxcXCI+RG91YmxlIHRhcCBmb3IgUmVjbGluZXIgc3Bpbjwvc3Bhbj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW1lc3NhZ2UtaWNvbiBhbXAtaWNvbi1yZWNsaW5lclxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy1yZWNsaW5lclwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtcmVjbGluZXJcIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgIDwvZGl2PlxcblwiO1xufSxcIjJcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICA8bGk+XFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtaW1hZ2UtY29udGFpbmVyXFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwiYW1wLWNlbnRlcmVyXFxcIj48L3NwYW4+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRlbXBsYXRlcyA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc2NyZWVuV2lkdGggOiBzdGFjazEpLHtcIm5hbWVcIjpcImlmXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDMsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5wcm9ncmFtKDUsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgICAgIDwvbGk+XFxuXCI7XG59LFwiM1wiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMSwgaGVscGVyLCBhbGlhczE9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgZGF0YS1hbXAtZGltZW5zaW9ucz0nW3tcXFwid1xcXCIgOiB7XFxcImRvbU5hbWVcXFwiIDogXFxcIndpbmRvd1xcXCIsIFxcXCJkb21Qcm9wXFxcIiA6IFxcXCJ3aWR0aFxcXCJ9fV0nIGRhdGEtYW1wLXNyYz1cXFwiXCJcbiAgICArIGFsaWFzMSgoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnNyYyB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuc3JjIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGhlbHBlcnMuaGVscGVyTWlzc2luZyksKHR5cGVvZiBoZWxwZXIgPT09IFwiZnVuY3Rpb25cIiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJzcmNcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiP1wiXG4gICAgKyBhbGlhczEoY29udGFpbmVyLmxhbWJkYSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC50ZW1wbGF0ZXMgOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLmltYWdlTWFpbiA6IHN0YWNrMSksIGRlcHRoMCkpXG4gICAgKyBcIlxcXCIgY2xhc3M9XFxcImFtcC1tYWluLWltZ1xcXCI+XFxuXCI7XG59LFwiNVwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazEsIGhlbHBlciwgYWxpYXMxPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIGRhdGEtYW1wLXNyYz1cXFwiXCJcbiAgICArIGFsaWFzMSgoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnNyYyB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuc3JjIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGhlbHBlcnMuaGVscGVyTWlzc2luZyksKHR5cGVvZiBoZWxwZXIgPT09IFwiZnVuY3Rpb25cIiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJzcmNcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiP1wiXG4gICAgKyBhbGlhczEoY29udGFpbmVyLmxhbWJkYSgoKHN0YWNrMSA9IChkZXB0aHNbMV0gIT0gbnVsbCA/IGRlcHRoc1sxXS50ZW1wbGF0ZXMgOiBkZXB0aHNbMV0pKSAhPSBudWxsID8gc3RhY2sxLmltYWdlTWFpbiA6IHN0YWNrMSksIGRlcHRoMCkpXG4gICAgKyBcIlxcXCIgY2xhc3M9XFxcImFtcC1tYWluLWltZ1xcXCI+XFxuXCI7XG59LFwiN1wiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazE7XG5cbiAgcmV0dXJuICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW0gOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLmJveCA6IHN0YWNrMSkse1wibmFtZVwiOlwiaWZcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oOCwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLnByb2dyYW0oMTQsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpO1xufSxcIjhcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgIDx1bCBjbGFzcz1cXFwiYW1wLWJveFxcXCI+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVycy5ibG9ja0hlbHBlck1pc3NpbmcuY2FsbChkZXB0aDAsY29udGFpbmVyLmxhbWJkYSgoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW0gOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLnNldCA6IHN0YWNrMSkpICE9IG51bGwgPyBzdGFjazEuaXRlbXMgOiBzdGFjazEpLCBkZXB0aDApLHtcIm5hbWVcIjpcIml0ZW0uc2V0Lml0ZW1zXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDksIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5ub29wLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgICAgICAgICA8L3VsPlxcblwiO1xufSxcIjlcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgIDxsaT5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLWltYWdlLWNvbnRhaW5lclxcXCI+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwiYW1wLWNlbnRlcmVyXFxcIj48L3NwYW4+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRlbXBsYXRlcyA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc2NyZWVuV2lkdGggOiBzdGFjazEpLHtcIm5hbWVcIjpcImlmXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDEwLCBkYXRhLCAwLCBibG9ja1BhcmFtcywgZGVwdGhzKSxcImludmVyc2VcIjpjb250YWluZXIucHJvZ3JhbSgxMiwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbGk+XFxuXCI7XG59LFwiMTBcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxLCBoZWxwZXIsIGFsaWFzMT1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIGRhdGEtYW1wLWRpbWVuc2lvbnM9J1t7XFxcIndcXFwiIDoge1xcXCJkb21OYW1lXFxcIiA6IFxcXCJ3aW5kb3dcXFwiLCBcXFwiZG9tUHJvcFxcXCIgOiBcXFwid2lkdGhcXFwifX1dJyBkYXRhLWFtcC1zcmM9XFxcIlwiXG4gICAgKyBhbGlhczEoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5zcmMgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnNyYyA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBoZWxwZXJzLmhlbHBlck1pc3NpbmcpLCh0eXBlb2YgaGVscGVyID09PSBcImZ1bmN0aW9uXCIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwic3JjXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIj9cIlxuICAgICsgYWxpYXMxKGNvbnRhaW5lci5sYW1iZGEoKChzdGFjazEgPSAoZGVwdGhzWzFdICE9IG51bGwgPyBkZXB0aHNbMV0udGVtcGxhdGVzIDogZGVwdGhzWzFdKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZU1haW4gOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIGNsYXNzPVxcXCJhbXAtbWFpbi1pbWdcXFwiPlxcblwiO1xufSxcIjEyXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgdmFyIHN0YWNrMSwgaGVscGVyLCBhbGlhczE9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGltZyBkYXRhLWFtcC1zcmM9XFxcIlwiXG4gICAgKyBhbGlhczEoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5zcmMgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnNyYyA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBoZWxwZXJzLmhlbHBlck1pc3NpbmcpLCh0eXBlb2YgaGVscGVyID09PSBcImZ1bmN0aW9uXCIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwic3JjXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIj9cIlxuICAgICsgYWxpYXMxKGNvbnRhaW5lci5sYW1iZGEoKChzdGFjazEgPSAoZGVwdGhzWzFdICE9IG51bGwgPyBkZXB0aHNbMV0udGVtcGxhdGVzIDogZGVwdGhzWzFdKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZU1haW4gOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIGNsYXNzPVxcXCJhbXAtbWFpbi1pbWdcXFwiPlxcblwiO1xufSxcIjE0XCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgdmFyIHN0YWNrMTtcblxuICByZXR1cm4gKChzdGFjazEgPSBoZWxwZXJzW1wiaWZcIl0uY2FsbChkZXB0aDAsKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc2V0IDogc3RhY2sxKSx7XCJuYW1lXCI6XCJpZlwiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgxNSwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLnByb2dyYW0oMjEsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpO1xufSxcIjE1XCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgdmFyIHN0YWNrMTtcblxuICByZXR1cm4gXCIgICAgICAgICAgICAgICAgICAgIDx1bCBjbGFzcz1cXFwiYW1wLXNwaW5zZXQgYW1wLXVpLWhpbnRcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuYmxvY2tIZWxwZXJNaXNzaW5nLmNhbGwoZGVwdGgwLGNvbnRhaW5lci5sYW1iZGEoKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zZXQgOiBzdGFjazEpKSAhPSBudWxsID8gc3RhY2sxLml0ZW1zIDogc3RhY2sxKSwgZGVwdGgwKSx7XCJuYW1lXCI6XCJpdGVtLnNldC5pdGVtc1wiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgxNiwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgICAgICA8L3VsPlxcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLWNvdmVyLWJveCBhbXAtZXhpdC1wcm9tcHQgaGlkZGVuXFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbWVzc2FnZVxcXCI+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVxcXCJhbXAtbWVzc2FnZS10YWdsaW5lXFxcIj5Eb3VibGUgdGFwIHRvIGV4aXQ8L3NwYW4+XFxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1jb3Zlci1ib3ggYW1wLWRvdWJsZS10YXAtcHJvbXB0XFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbWVzc2FnZVxcXCI+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVxcXCJhbXAtbWVzc2FnZS10YWdsaW5lXFxcIj5Eb3VibGUgdGFwIGZvciAzNjAmZGVnOyBzcGluPC9zcGFuPlxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbWVzc2FnZS1pY29uIGFtcC1pY29uLTM2MFxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy0zNjBcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLTM2MFwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XFxuXCI7XG59LFwiMTZcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bGk+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtaW1hZ2UtY29udGFpbmVyXFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwiYW1wLWNlbnRlcmVyXFxcIj48L3NwYW4+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRlbXBsYXRlcyA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc2NyZWVuV2lkdGggOiBzdGFjazEpLHtcIm5hbWVcIjpcImlmXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDE3LCBkYXRhLCAwLCBibG9ja1BhcmFtcywgZGVwdGhzKSxcImludmVyc2VcIjpjb250YWluZXIucHJvZ3JhbSgxOSwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9saT5cXG5cIjtcbn0sXCIxN1wiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazEsIGhlbHBlciwgYWxpYXMxPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIGRhdGEtYW1wLWRpbWVuc2lvbnM9J1t7XFxcIndcXFwiIDoge1xcXCJkb21OYW1lXFxcIiA6IFxcXCJ3aW5kb3dcXFwiLCBcXFwiZG9tUHJvcFxcXCIgOiBcXFwid2lkdGhcXFwifX1dJyBkYXRhLWFtcC1zcmM9XFxcIlwiXG4gICAgKyBhbGlhczEoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5zcmMgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnNyYyA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBoZWxwZXJzLmhlbHBlck1pc3NpbmcpLCh0eXBlb2YgaGVscGVyID09PSBcImZ1bmN0aW9uXCIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwic3JjXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIj9cIlxuICAgICsgYWxpYXMxKGNvbnRhaW5lci5sYW1iZGEoKChzdGFjazEgPSAoZGVwdGhzWzFdICE9IG51bGwgPyBkZXB0aHNbMV0udGVtcGxhdGVzIDogZGVwdGhzWzFdKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZU1haW4gOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIGNsYXNzPVxcXCJhbXAtem9vbWFibGUgYW1wLW1haW4taW1nXFxcIj5cXG5cIjtcbn0sXCIxOVwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazEsIGhlbHBlciwgYWxpYXMxPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIGRhdGEtYW1wLXNyYz1cXFwiXCJcbiAgICArIGFsaWFzMSgoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnNyYyB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuc3JjIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGhlbHBlcnMuaGVscGVyTWlzc2luZyksKHR5cGVvZiBoZWxwZXIgPT09IFwiZnVuY3Rpb25cIiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJzcmNcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiP1wiXG4gICAgKyBhbGlhczEoY29udGFpbmVyLmxhbWJkYSgoKHN0YWNrMSA9IChkZXB0aHNbMV0gIT0gbnVsbCA/IGRlcHRoc1sxXS50ZW1wbGF0ZXMgOiBkZXB0aHNbMV0pKSAhPSBudWxsID8gc3RhY2sxLmltYWdlTWFpbiA6IHN0YWNrMSksIGRlcHRoMCkpXG4gICAgKyBcIlxcXCIgY2xhc3M9XFxcImFtcC16b29tYWJsZSBhbXAtbWFpbi1pbWdcXFwiPlxcblwiO1xufSxcIjIxXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiAoKHN0YWNrMSA9IGhlbHBlcnNbXCJpZlwiXS5jYWxsKGRlcHRoMCwoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5tZWRpYSA6IHN0YWNrMSkse1wibmFtZVwiOlwiaWZcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMjIsIGRhdGEsIDApLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5wcm9ncmFtKDI1LCBkYXRhLCAwKSxcImRhdGFcIjpkYXRhfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKTtcbn0sXCIyMlwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMSwgYWxpYXMxPWNvbnRhaW5lci5sYW1iZGEsIGFsaWFzMj1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCIgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtdmlkZW8taG9sZGVyXFxcIiBkYXRhLWFtcC13aWR0aD1cXFwiXCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEudmlkV2lkdGggOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIGRhdGEtYW1wLWhlaWdodD1cXFwiXCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEudmlkSGVpZ2h0IDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiXFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXZpZGVvIGFtcC1oaWRkZW5cXFwiPlxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHZpZGVvIHBvc3Rlcj1cXFwiXCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc3JjIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiP1wiXG4gICAgKyBhbGlhczIoYWxpYXMxKCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRlbXBsYXRlcyA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuaW1hZ2VNYWluIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiJnc9XCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEudmlkV2lkdGggOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCImaD1cIlxuICAgICsgYWxpYXMyKGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS52aWRIZWlnaHQgOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIHByZWxvYWQ9XFxcIm5vbmVcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuYmxvY2tIZWxwZXJNaXNzaW5nLmNhbGwoZGVwdGgwLGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5tZWRpYSA6IHN0YWNrMSksIGRlcHRoMCkse1wibmFtZVwiOlwiaXRlbS5tZWRpYVwiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgyMywgZGF0YSwgMCksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3ZpZGVvPlxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cXG5cIjtcbn0sXCIyM1wiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIGhlbHBlciwgYWxpYXMxPWhlbHBlcnMuaGVscGVyTWlzc2luZywgYWxpYXMyPVwiZnVuY3Rpb25cIiwgYWxpYXMzPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c291cmNlIGRhdGEtcXVhbGl0eS1sYWJlbD1cXFwiXCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnByb2ZpbGVMYWJlbCB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAucHJvZmlsZUxhYmVsIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJwcm9maWxlTGFiZWxcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiXFxcIiBkYXRhLWJpdHJhdGU9XFxcIlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5iaXRyYXRlIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5iaXRyYXRlIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJiaXRyYXRlXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIlxcXCIgZGF0YS1yZXM9XFxcIlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5wcm9maWxlTGFiZWwgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnByb2ZpbGVMYWJlbCA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwicHJvZmlsZUxhYmVsXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIlxcXCIgc3JjPVxcXCJcIlxuICAgICsgYWxpYXMzKCgoaGVscGVyID0gKGhlbHBlciA9IGhlbHBlcnMuc3JjIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5zcmMgOiBkZXB0aDApKSAhPSBudWxsID8gaGVscGVyIDogYWxpYXMxKSwodHlwZW9mIGhlbHBlciA9PT0gYWxpYXMyID8gaGVscGVyLmNhbGwoZGVwdGgwLHtcIm5hbWVcIjpcInNyY1wiLFwiaGFzaFwiOnt9LFwiZGF0YVwiOmRhdGF9KSA6IGhlbHBlcikpKVxuICAgICsgXCJcXFwiIHR5cGU9XFxcIlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5odG1sQ29kZWMgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLmh0bWxDb2RlYyA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwiaHRtbENvZGVjXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIlxcXCI+XFxuXCI7XG59LFwiMjVcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazE7XG5cbiAgcmV0dXJuICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW0gOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLmNvbnRlbnQgOiBzdGFjazEpLHtcIm5hbWVcIjpcImlmXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDI2LCBkYXRhLCAwKSxcImludmVyc2VcIjpjb250YWluZXIucHJvZ3JhbSgyOCwgZGF0YSwgMCksXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIik7XG59LFwiMjZcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazE7XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC13ZWJnbCAgYW1wLXVpLWhpbnRcXFwiIGRhdGEtYW1wLXdlYmdsPVxcXCJcIlxuICAgICsgY29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb24oY29udGFpbmVyLmxhbWJkYSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS52YWx1ZSA6IHN0YWNrMSksIGRlcHRoMCkpXG4gICAgKyBcIlxcXCI+PC9kaXY+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1jb3Zlci1ib3ggYW1wLWRvdWJsZS10YXAtcHJvbXB0XFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1tZXNzYWdlXFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwiYW1wLW1lc3NhZ2UtdGFnbGluZVxcXCI+RG91YmxlIHRhcCB0byBhY3RpdmF0ZSAzRDwvc3Bhbj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbWVzc2FnZS1pY29uIGFtcC1pY29uLXdlYmdsXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLXdlYmdsXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy13ZWJnbFwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxcblwiO1xufSxcIjI4XCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtaW1hZ2UtY29udGFpbmVyXFxcIj5cXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVxcXCJhbXAtY2VudGVyZXJcXFwiPjwvc3Bhbj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBoZWxwZXJzW1wiaWZcIl0uY2FsbChkZXB0aDAsKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudGVtcGxhdGVzIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zY3JlZW5XaWR0aCA6IHN0YWNrMSkse1wibmFtZVwiOlwiaWZcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMjksIGRhdGEsIDApLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5wcm9ncmFtKDMxLCBkYXRhLCAwKSxcImRhdGFcIjpkYXRhfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCJcXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XFxuXCI7XG59LFwiMjlcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazEsIGFsaWFzMT1jb250YWluZXIubGFtYmRhLCBhbGlhczI9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGltZyBkYXRhLWFtcC1kaW1lbnNpb25zPSdbe1xcXCJ3XFxcIiA6IHtcXFwiZG9tTmFtZVxcXCIgOiBcXFwid2luZG93XFxcIiwgXFxcImRvbVByb3BcXFwiIDogXFxcIndpZHRoXFxcIn19XScgZGF0YS1hbXAtc3JjPVxcXCJcIlxuICAgICsgYWxpYXMyKGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zcmMgOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCI/XCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudGVtcGxhdGVzIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZU1haW4gOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIGNsYXNzPVxcXCJhbXAtem9vbWFibGUgYW1wLW1haW4taW1nXFxcIj5cXG5cIjtcbn0sXCIzMVwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMSwgYWxpYXMxPWNvbnRhaW5lci5sYW1iZGEsIGFsaWFzMj1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aW1nIGRhdGEtYW1wLXNyYz1cXFwiXCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc3JjIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiP1wiXG4gICAgKyBhbGlhczIoYWxpYXMxKCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRlbXBsYXRlcyA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuaW1hZ2VNYWluIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiXFxcIiBjbGFzcz1cXFwiYW1wLXpvb21hYmxlIGFtcC1tYWluLWltZ1xcXCI+XFxuXCI7XG59LFwiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazE7XG5cbiAgcmV0dXJuIFwiPGxpPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnNbXCJpZlwiXS5jYWxsKGRlcHRoMCwoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5yZWNsaW5lciA6IHN0YWNrMSkse1wibmFtZVwiOlwiaWZcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMSwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLnByb2dyYW0oNywgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiPC9saT5cXG5cIjtcbn0sXCJ1c2VQYXJ0aWFsXCI6dHJ1ZSxcInVzZURhdGFcIjp0cnVlLFwidXNlRGVwdGhzXCI6dHJ1ZX0pKTtcblxuSGFuZGxlYmFycy5yZWdpc3RlclBhcnRpYWwoXCJfdGVtcGxhdGUtbmF2LWl0ZW0tYWx0XCIsIHRoaXNbXCJhbXBcIl1bXCJ0ZW1wbGF0ZXNcIl1bXCJkZnNcIl1bXCJfdGVtcGxhdGUtbmF2LWl0ZW0tYWx0XCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICByZXR1cm4gXCI8ZGl2IGNsYXNzPVxcXCJhbXAtbmF2LWxpbmstY29udGFpbmVyXFxcIj5cXG4gICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdi1saW5rXFxcIj48L2Rpdj5cXG48L2Rpdj5cIjtcbn0sXCJ1c2VEYXRhXCI6dHJ1ZX0pKTtcblxuSGFuZGxlYmFycy5yZWdpc3RlclBhcnRpYWwoXCJfdGVtcGxhdGUtbmF2LWl0ZW1cIiwgdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcIl90ZW1wbGF0ZS1uYXYtaXRlbVwiXSA9IEhhbmRsZWJhcnMudGVtcGxhdGUoe1wiMVwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMSwgYWxpYXMxPWNvbnRhaW5lci5sYW1iZGEsIGFsaWFzMj1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCIgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtaWNvbiBhbXAtaWNvbi1yZWNsaW5lclxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy1yZWNsaW5lclwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtcmVjbGluZXJcIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgICAgICA8aW1nIHNyYz1cXFwiXCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc3JjIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiLzE/XCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudGVtcGxhdGVzIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZVRodW1iIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiXFxcIiBjbGFzcz1cXFwiYW1wLW1haW4taW1nXFxcIj5cXG5cIjtcbn0sXCIzXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiAoKHN0YWNrMSA9IGhlbHBlcnNbXCJpZlwiXS5jYWxsKGRlcHRoMCwoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5ib3ggOiBzdGFjazEpLHtcIm5hbWVcIjpcImlmXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDQsIGRhdGEsIDApLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5wcm9ncmFtKDYsIGRhdGEsIDApLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpO1xufSxcIjRcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazEsIGFsaWFzMT1jb250YWluZXIubGFtYmRhLCBhbGlhczI9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1pY29uIGFtcC1pY29uLWJveC1vcGVuXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLWJveC1vcGVuXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy1ib3gtb3BlblwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgICAgICA8aW1nIHNyYz1cXFwiXCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuc3JjIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiLzE/XCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudGVtcGxhdGVzIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZVRodW1iIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiXFxcIiBjbGFzcz1cXFwiYW1wLW1haW4taW1nXFxcIj5cXG5cIjtcbn0sXCI2XCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiAoKHN0YWNrMSA9IGhlbHBlcnNbXCJpZlwiXS5jYWxsKGRlcHRoMCwoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zZXQgOiBzdGFjazEpLHtcIm5hbWVcIjpcImlmXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDcsIGRhdGEsIDApLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5wcm9ncmFtKDksIGRhdGEsIDApLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpO1xufSxcIjdcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazEsIGFsaWFzMT1jb250YWluZXIubGFtYmRhLCBhbGlhczI9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtaWNvbiBhbXAtaWNvbi0zNjBcXFwiPlwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtMzYwXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy0zNjBcIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPVxcXCJcIlxuICAgICsgYWxpYXMyKGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zcmMgOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCIvMT9cIlxuICAgICsgYWxpYXMyKGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC50ZW1wbGF0ZXMgOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLmltYWdlVGh1bWIgOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCJcXFwiIGNsYXNzPVxcXCJhbXAtbWFpbi1pbWdcXFwiPlxcblwiO1xufSxcIjlcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazE7XG5cbiAgcmV0dXJuICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW0gOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLm1lZGlhIDogc3RhY2sxKSx7XCJuYW1lXCI6XCJpZlwiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgxMCwgZGF0YSwgMCksXCJpbnZlcnNlXCI6Y29udGFpbmVyLnByb2dyYW0oMTIsIGRhdGEsIDApLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpO1xufSxcIjEwXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxLCBhbGlhczE9Y29udGFpbmVyLmxhbWJkYSwgYWxpYXMyPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1pY29uIGFtcC1pY29uLXZpZGVvXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLXZpZGVvXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy12aWRlb1wiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPVxcXCJcIlxuICAgICsgYWxpYXMyKGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zcmMgOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCI/XCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudGVtcGxhdGVzIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZVRodW1iIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiXFxcIiBjbGFzcz1cXFwiYW1wLW1haW4taW1nXFxcIj5cXG5cIjtcbn0sXCIxMlwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMTtcblxuICByZXR1cm4gKChzdGFjazEgPSBoZWxwZXJzW1wiaWZcIl0uY2FsbChkZXB0aDAsKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbSA6IGRlcHRoMCkpICE9IG51bGwgPyBzdGFjazEuY29udGVudCA6IHN0YWNrMSkse1wibmFtZVwiOlwiaWZcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMTMsIGRhdGEsIDApLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5wcm9ncmFtKDE1LCBkYXRhLCAwKSxcImRhdGFcIjpkYXRhfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKTtcbn0sXCIxM1wiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMTtcblxuICByZXR1cm4gXCIgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLWljb24gYW1wLWljb24td2ViZ2xcXFwiPlwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtd2ViZ2xcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLXdlYmdsXCIsXCJkYXRhXCI6ZGF0YSxcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiPC9kaXY+XFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1tYWluLWltZ1xcXCI+PC9kaXY+XFxuXCI7XG59LFwiMTVcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazEsIGFsaWFzMT1jb250YWluZXIubGFtYmRhLCBhbGlhczI9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3JjPVxcXCJcIlxuICAgICsgYWxpYXMyKGFsaWFzMSgoKHN0YWNrMSA9IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5zcmMgOiBzdGFjazEpLCBkZXB0aDApKVxuICAgICsgXCI/XCJcbiAgICArIGFsaWFzMihhbGlhczEoKChzdGFjazEgPSAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudGVtcGxhdGVzIDogZGVwdGgwKSkgIT0gbnVsbCA/IHN0YWNrMS5pbWFnZVRodW1iIDogc3RhY2sxKSwgZGVwdGgwKSlcbiAgICArIFwiXFxcIiBjbGFzcz1cXFwiYW1wLW1haW4taW1nXFxcIj5cXG5cIjtcbn0sXCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIjxsaT5cXG4gICAgPGRpdiBjbGFzcz1cXFwiYW1wLXRodW1iLWltYWdlLWNvbnRhaW5lciBhbXAtbW96LWludmlzaWJsZVxcXCI+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVyc1tcImlmXCJdLmNhbGwoZGVwdGgwLCgoc3RhY2sxID0gKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW0gOiBkZXB0aDApKSAhPSBudWxsID8gc3RhY2sxLnJlY2xpbmVyIDogc3RhY2sxKSx7XCJuYW1lXCI6XCJpZlwiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgxLCBkYXRhLCAwKSxcImludmVyc2VcIjpjb250YWluZXIucHJvZ3JhbSgzLCBkYXRhLCAwKSxcImRhdGFcIjpkYXRhfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgPC9kaXY+XFxuPC9saT5cIjtcbn0sXCJ1c2VQYXJ0aWFsXCI6dHJ1ZSxcInVzZURhdGFcIjp0cnVlfSkpO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVyUGFydGlhbChcIl90ZW1wbGF0ZS1xdWlja2xpbmtzXCIsIHRoaXNbXCJhbXBcIl1bXCJ0ZW1wbGF0ZXNcIl1bXCJkZnNcIl1bXCJfdGVtcGxhdGUtcXVpY2tsaW5rc1wiXSA9IEhhbmRsZWJhcnMudGVtcGxhdGUoe1wiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgdmFyIHN0YWNrMTtcblxuICByZXR1cm4gXCI8ZGl2IGNsYXNzPVxcXCJhbXAtcXVpY2tsaW5rcy1jb250YWluZXJcXFwiPlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtcXVpY2tsaW5rcy13cmFwcGVyXFxcIj5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1xdWlja2xpbmsgYW1wLXF1aWNrbGluay1mdWxsc2NyZWVuXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLXpvb20taW5cIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLXpvb20taW5cIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1xdWlja2xpbmsgYW1wLXF1aWNrbGluay12aWRlb1xcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy12aWRlb1wiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtdmlkZW9cIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1xdWlja2xpbmsgYW1wLXF1aWNrbGluay1yZWNsaW5lclxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy1yZWNsaW5lclwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtcmVjbGluZXJcIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1xdWlja2xpbmsgYW1wLXF1aWNrbGluay1ib3hcXFwiPlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1pY29uLWJveC1vcGVuXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLWJveC1vcGVuXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy1ib3gtb3BlblwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1pY29uLWJveC1jbG9zZVxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy1ib3gtY2xvc2VcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLWJveC1jbG9zZVwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgPC9kaXY+XFxuICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtcXVpY2tsaW5rIGFtcC1xdWlja2xpbmstc3BpbnNldFxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy0zNjBcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLTM2MFwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICA8L2Rpdj5cXG48L2Rpdj5cIjtcbn0sXCJ1c2VQYXJ0aWFsXCI6dHJ1ZSxcInVzZURhdGFcIjp0cnVlfSkpO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVyUGFydGlhbChcImljb25zLTM2MFwiLCB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1wiaWNvbnMtMzYwXCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICByZXR1cm4gXCI8c3ZnIGNsYXNzPVxcXCJhbXAtc3ZnLWljb25cXFwiIHZpZXdCb3g9XFxcIjAgMCAyMDAgMjAwXFxcIiB4bWxucz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiIHhtbG5zOnN2Zz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiPlxcbiAgICA8Zz5cXG4gICAgICAgIFxcbiAgICAgICAgPGc+XFxuICAgICAgICAgICAgPHBhdGggZD1cXFwibTEyNC41LDEyNi41YzI4LjI5OTk4OCwtMi44OTk5OTQgNDguNSwtMTAuMjk5OTg4IDQ4LjUsLTE5YzAsLTUuMzk5OTk0IC03Ljc5OTk4OCwtMTAuMzk5OTk0IC0yMC42MDAwMDYsLTE0bDAsLTRjMTguNjAwMDA2LDQuODk5OTk0IDMwLjM5OTk5NCwxMi4yMDAwMTIgMzAuMzk5OTk0LDIwLjM5OTk5NGMwLDExLjg5OTk5NCAtMjQuNSwyMS44MDAwMTggLTU4LjM5OTk5NCwyNS4zMDAwMThsMC4xMDAwMDYsLTguNzAwMDEyelxcXCIgZmlsbD1cXFwiIzZCNkI2QlxcXCIvPlxcbiAgICAgICAgPC9nPlxcbiAgICAgICAgPHBhdGggZD1cXFwibTEwMS41LDEzNi41Yy0wLjg5OTk5NCwwIC0xLjg5OTk5NCwwIC0yLjc5OTk4OCwwYy00Ni41MDAwMTUsMCAtODQuMjAwMDEyLC0xMS44OTk5OTQgLTg0LjIwMDAxMiwtMjYuNjAwMDA2YzAsLTguNzk5OTg4IDEzLjYwMDAwNiwtMTYuNjAwMDA2IDM0LjUsLTIxLjVsMCw0Yy0xNS4xOTk5OTcsMy43MDAwMTIgLTI0LjgwMDAwMyw5LjEwMDAwNiAtMjQuODAwMDAzLDE1LjEwMDAwNmMwLDExLjIwMDAxMiAzMy4zMDAwMDMsMjAuMjk5OTg4IDc0LjQwMDAwOSwyMC4yOTk5ODhjMSwwIDIsMCAzLDBsMCwtOC43OTk5ODhsMTIuNzAwMDEyLDEzLjIwMDAxMmwtMTIuODAwMDE4LDEzLjI5OTk4OGwwLC05elxcXCIgZmlsbD1cXFwiIzZCNkI2QlxcXCIvPlxcbiAgICAgICAgPHRleHQgeD1cXFwiLTE5NFxcXCIgeT1cXFwiLTMyNlxcXCIgZm9udC1zaXplPVxcXCI1NS44MjUxXFxcIiBmb250LWZhbWlseT1cXFwiJ0hlbHZldGljYU5ldWUtQm9sZCdcXFwiIGZpbGw9XFxcIiM2QjZCNkJcXFwiIHRyYW5zZm9ybT1cXFwibWF0cml4KDEsMCwwLDEsMjQ0LjY2ODYsNDM0LjQ3MTYpIFxcXCI+MzY8L3RleHQ+XFxuICAgICAgICA8dGV4dCB4PVxcXCItMTk0XFxcIiB5PVxcXCItMzI2XFxcIiBmb250LXNpemU9XFxcIjU1LjgyNTFcXFwiIGZvbnQtZmFtaWx5PVxcXCInSGVsdmV0aWNhTmV1ZS1Cb2xkJ1xcXCIgZmlsbD1cXFwiIzZCNkI2QlxcXCIgdHJhbnNmb3JtPVxcXCJtYXRyaXgoMSwwLDAsMSwzMDYuNzc5OSw0MzQuNDcxNikgXFxcIj4wPC90ZXh0PlxcbiAgICAgICAgPHRleHQgeD1cXFwiLTE5NFxcXCIgeT1cXFwiLTMyNlxcXCIgZm9udC1zaXplPVxcXCI1NS44MjUxXFxcIiBmb250LWZhbWlseT1cXFwiJ0hlbHZldGljYU5ldWUtQm9sZCdcXFwiIGZpbGw9XFxcIiM2QjZCNkJcXFwiIHRyYW5zZm9ybT1cXFwibWF0cml4KDEsMCwwLDEsMzM2LjM1MTcsNDM0LjQ3MTYpIFxcXCI+JiMxNzY7PC90ZXh0PlxcbiAgICA8L2c+XFxuPC9zdmc+XFxuXFxuXCI7XG59LFwidXNlRGF0YVwiOnRydWV9KSk7XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJQYXJ0aWFsKFwiaWNvbnMtYm94LWNsb3NlXCIsIHRoaXNbXCJhbXBcIl1bXCJ0ZW1wbGF0ZXNcIl1bXCJkZnNcIl1bXCJpY29ucy1ib3gtY2xvc2VcIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHJldHVybiBcIjxzdmcgY2xhc3M9XFxcImFtcC1zdmctaWNvblxcXCIgdmlld0JveD1cXFwiMCAwIDIwMCAyMDBcXFwiIHhtbG5zPVxcXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1xcXCI+XFxuICAgIDxnPlxcbiAgICAgICAgXFxuICAgICAgICA8Zz5cXG4gICAgICAgICAgICA8cGF0aCBzdHJva2U9XFxcIiM0QzRDNENcXFwiIGQ9XFxcIm0xNDYuNDY5NTU5LDExMC41ODc1OTNsMCwyMC43Njk3MDdsLTQ2LjcxNDMxLDIwLjgzOTYxNWMwLDAgLTEwLjY5OTU2Miw4LjQ2MTcxNiAtMjYuOTkzNjI5LDBsLTQ4Ljk1MjE3NSwtMjEuMzk5MDc4bDAsLTIzLjA3NzQ0NmMwLDAgLTAuNTU5NDQ0LC0zLjAwNzA1NyA1LjM4NDc0NywtMy40MjY2NTFjMCwwIC01LjQ1NDY3MiwtNi4wODQwNjEgLTUuNDU0NjcyLC0xMi4yMzgwMzdsMCwtMTAuOTc5Mjc5YzAsMCAwLjU1OTQ1NiwtNy40ODI2ODEgMTAuNDg5NzQ4LC05LjM3MDgzNGw0NS4yNDU3NywtMTMuNDI2ODY4YzAsMCA0LjY4NTQzMiwtMS42MDg0NDggMTIuMzc3OTE0LDBsNDUuOTQ1MDg0LDEyLjQ0NzgyNmMwLDAgOC40NjE3LDAuNTU5NDQxIDguNjcxNTI0LDYuMDE0MTIybDAsMTIuOTM3MzU1YzAsMCAxLjUzODUxMywxMi4yMzgwNTIgLTUuNTk0NTI4LDEzLjAwNzI5NGMwLDAgNS41OTQ1MjgsLTMuMTQ2OTI3IDUuNTk0NTI4LDcuOTAyMjc1elxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2UtbGluZWpvaW49XFxcInJvdW5kXFxcIiBzdHJva2UtbGluZWNhcD1cXFwicm91bmRcXFwiIHN0cm9rZS13aWR0aD1cXFwiN1xcXCIgZmlsbD1cXFwibm9uZVxcXCIvPlxcbiAgICAgICAgICAgIDxwYXRoIHN0cm9rZT1cXFwiIzRDNEM0Q1xcXCIgZD1cXFwibTE0NC4xNjE4MzUsMTAxLjA3Njg4MWwtNDguMTEyOTkxLDIxLjgxODY4Yy0zLjcwNjM2LDEuNjc4MzY4IC02Ljk5MzE1NiwyLjM3NzY2MyAtOS42NTA1NTEsMi41MTc1MjVjLTQuNDc1NjI0LDAuMjc5NzQ3IC03LjIwMjk1LC0wLjgzOTE1NyAtNy4yMDI5NSwtMC44MzkxNTdzLTQ2Ljk5NDA4NywtMTguNjAxODM3IC01Mi4wOTkxMDQsLTE5LjE2MTI3XFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS1saW5lam9pbj1cXFwicm91bmRcXFwiIHN0cm9rZS1saW5lY2FwPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI3XFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgICAgICAgPGxpbmUgc3Ryb2tlPVxcXCIjNEM0QzRDXFxcIiB5Mj1cXFwiMTAyLjY4NTMxM1xcXCIgeDI9XFxcIjg1LjYyOTAzN1xcXCIgeTE9XFxcIjE1NS45MDMzMDVcXFwiIHgxPVxcXCI4Ni4zMjgzNTRcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLWxpbmVqb2luPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLWxpbmVjYXA9XFxcInJvdW5kXFxcIiBzdHJva2Utd2lkdGg9XFxcIjdcXFwiIGZpbGw9XFxcIm5vbmVcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBzdHJva2U9XFxcIiM0QzRDNENcXFwiIGQ9XFxcIm0xNDMuMzkyNjI0LDc1LjY5MTY5NmwtNDguMTEzMDIyLDIxLjgxODY4N2MtMy43MDYzODMsMS42NzgzNDUgLTYuOTkzMTc5LDIuMzc3NjcgLTkuNjUwNTU4LDIuNTE3NTI1Yy00LjQ3NTYyNCwwLjI3OTc0NyAtNy4yMDI5NjUsLTAuODM5MTggLTcuMjAyOTY1LC0wLjgzOTE4cy00Ni45OTQwNzgsLTE4LjYwMTgwNyAtNTIuMDk5MDkxLC0xOS4xNjEyNjNcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLWxpbmVqb2luPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLWxpbmVjYXA9XFxcInJvdW5kXFxcIiBzdHJva2Utd2lkdGg9XFxcIjdcXFwiIGZpbGw9XFxcIm5vbmVcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBkPVxcXCJtMTY5LjgyNjczNiwxMDUuOTcyMDkybC03LjY5MjQ5LC0xMS44ODgzNzRsNC4xOTU5MDgsLTAuNjk5MzE4YzAsMCAzLjg0NjI2OCwtMjQuMTI2NDE5IC0yNi4zNjQyMTIsLTQ4LjA0MzAzN2MwLDAgMzMuNDI3MzM4LDE2Ljg1MzUxMiAzMi4zNzgzNTcsNDcuMDY0MDAzbDQuNDA1NzAxLC0wLjYyOTM3OWwtNi45MjMyNjQsMTQuMTk2MTA2elxcXCIgZmlsbD1cXFwiIzRDNEM0Q1xcXCIvPlxcbiAgICAgICAgPC9nPlxcbiAgICA8L2c+XFxuPC9zdmc+XCI7XG59LFwidXNlRGF0YVwiOnRydWV9KSk7XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJQYXJ0aWFsKFwiaWNvbnMtYm94LW9wZW5cIiwgdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcImljb25zLWJveC1vcGVuXCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICByZXR1cm4gXCI8c3ZnIGNsYXNzPVxcXCJhbXAtc3ZnLWljb25cXFwiIHZpZXdCb3g9XFxcIjAgMCAyMDAgMjAwXFxcIiB4bWxucz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiIHhtbG5zOnN2Zz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiPlxcbiA8Zz5cXG4gICAgIFxcbiAgICAgPGc+XFxuICAgICAgPHBhdGggZD1cXFwibTUwLjY5OTk5NywxMTIuNWwzNS4wOTk5OTEsLTEwLjEwMDAwNmMwLDAgOC42MDAwMDYsLTQgMjIuMTAwMDA2LDBsMzUuNjAwMDA2LDEwLjEwMDAwNmMwLDAgNi42MDAwMDYsMi42MDAwMDYgNi4xMDAwMDYsMTIuNjAwMDA2bDAsMTguNWwtNDEuNjAwMDA2LDE4LjYwMDAwNmMwLDAgLTkuNjAwMDA2LDcuNjAwMDA2IC0yNC4xMDAwMDYsMGwtNDMuNjk5OTk3LC0xOS4xMDAwMDZsMCwtMjAuNjAwMDA2YzAsMCAwLjYwMDAwNiwtMy41IDQsLTYuNTk5OTc2YzEuNSwtMS4zMDAwMTggMy42OTk5OTcsLTIuNjAwMDM3IDYuNSwtMy40MDAwMjR6XFxcIiBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS1saW5lam9pbj1cXFwicm91bmRcXFwiIHN0cm9rZS1saW5lY2FwPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI3XFxcIiBzdHJva2U9XFxcIiM2QjZCNkJcXFwiIGZpbGw9XFxcIm5vbmVcXFwiLz5cXG4gICAgICA8cGF0aCBkPVxcXCJtMTQ3Ljg5OTk5NCwxMTYuNjAwMDA2bC00Mi44OTk5OTQsMTkuNWMtMy4yOTk5ODgsMS41IC02LjIwMDAxMiwyLjEwMDAwNiAtOC42MDAwMDYsMi4yMDAwMTJjLTQsMC4xOTk5ODIgLTYuMzk5OTk0LC0wLjcwMDAxMiAtNi4zOTk5OTQsLTAuNzAwMDEycy00MiwtMTYuNjAwMDA2IC00Ni42MDAwMDYsLTE3LjEwMDAwNlxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2UtbGluZWpvaW49XFxcInJvdW5kXFxcIiBzdHJva2UtbGluZWNhcD1cXFwicm91bmRcXFwiIHN0cm9rZS13aWR0aD1cXFwiN1xcXCIgc3Ryb2tlPVxcXCIjNkI2QjZCXFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgPHBvbHlsaW5lIHBvaW50cz1cXFwiOTYuMjk5OTg3NzkyOTY4NzUsMTAyLjEwMDAwNjEwMzUxNTYyIDk2LjI5OTk4Nzc5Mjk2ODc1LDExNC4yMDAwMTIyMDcwMzEyNSAxMjguNjAwMDA2MTAzNTE1NjIsMTIzLjc5OTk4Nzc5Mjk2ODc1IFxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2UtbGluZWpvaW49XFxcInJvdW5kXFxcIiBzdHJva2UtbGluZWNhcD1cXFwicm91bmRcXFwiIHN0cm9rZS13aWR0aD1cXFwiN1xcXCIgc3Ryb2tlPVxcXCIjNkI2QjZCXFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgPGxpbmUgeTI9XFxcIjEyNi4xXFxcIiB4Mj1cXFwiNTkuOFxcXCIgeTE9XFxcIjExMy42XFxcIiB4MT1cXFwiOTYuOVxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2UtbGluZWpvaW49XFxcInJvdW5kXFxcIiBzdHJva2UtbGluZWNhcD1cXFwicm91bmRcXFwiIHN0cm9rZS13aWR0aD1cXFwiN1xcXCIgc3Ryb2tlPVxcXCIjNkI2QjZCXFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgPHBhdGggZD1cXFwibTkyLjg5OTk5NCw5MC4yOTk5ODhjMCwwIC00LjcwMDAxMiwwLjcwMDAxMiAtMTIuMjk5OTg4LDQuMjAwMDEybC00MS4yMDAwMTIsMjAuNWwtOC44MDAwMDMsLTIwLjI5OTk4OGMwLDAgLTIuMTk5OTk3LC00LjIwMDAxMiA2LC04LjVsNDUuMDk5OTkxLC0xOS40MDAwMjRsNTIuMTAwMDA2LC0xN2wxMC4xMDAwMDYsMjIuMTAwMDA2bC01MC4zOTk5OTQsMTguMzk5OTk0bC0xMS41LC0yMi4xOTk5ODJcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLWxpbmVqb2luPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLWxpbmVjYXA9XFxcInJvdW5kXFxcIiBzdHJva2Utd2lkdGg9XFxcIjdcXFwiIHN0cm9rZT1cXFwiIzZCNkI2QlxcXCIgZmlsbD1cXFwibm9uZVxcXCIvPlxcbiAgICAgIDxsaW5lIHkyPVxcXCIxMzkuOFxcXCIgeDI9XFxcIjk1LjdcXFwiIHkxPVxcXCIxNjUuNlxcXCIgeDE9XFxcIjk2LjNcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLWxpbmVqb2luPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLWxpbmVjYXA9XFxcInJvdW5kXFxcIiBzdHJva2Utd2lkdGg9XFxcIjdcXFwiIHN0cm9rZT1cXFwiIzZCNkI2QlxcXCIgZmlsbD1cXFwibm9uZVxcXCIvPlxcbiAgICAgIDxwYXRoIGQ9XFxcIm0xMjMuMzk5OTk0LDMwLjIwMDAxMmw2LjIwMDAxMiwxMWwyLjE5OTk4MiwtM2MwLDAgMjAuNzAwMDEyLDcuMTAwMDA2IDI3LDQwLjc5OTk4OGMwLDAgMC42MDAwMDYsLTMzLjM5OTk5NCAtMjMuNjk5OTgyLC00NS4wOTk5NzZsMi4zOTk5OTQsLTMuMjAwMDEybC0xNC4xMDAwMDYsLTAuNXpcXFwiIGZpbGw9XFxcIiM2QjZCNkJcXFwiLz5cXG4gICAgIDwvZz5cXG4gPC9nPlxcbjwvc3ZnPlwiO1xufSxcInVzZURhdGFcIjp0cnVlfSkpO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVyUGFydGlhbChcImljb25zLWNhcmV0LWxlZnRcIiwgdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcImljb25zLWNhcmV0LWxlZnRcIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHJldHVybiBcIjxzdmcgdmlld0JveD1cXFwiMCAwIDY0IDkzXFxcIiB4bWxucz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiIHhtbG5zOnN2Zz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiPlxcbiAgPGc+XFxuICAgPHBhdGggaWQ9XFxcInN2Z18xXFxcIiBkPVxcXCJtMTQuNjUwMDIsNDYuMDUyODZsMzUsLTM1YzAsMCA0LjI5OTk5LC01IDAsLTkuODAwMDJjMCwwIC00Ljc5OTk5LC0zLjUgLTkuNzk5OTksMS4yMDAwMWwtMzcuNjAwMDEsMzcuNjAwMDFjMCwwIC02LjYwMDAxLDUuMTk5OTggMCwxMi4xMDAwMWwzOS43OTk5OSwzOC4yOTk5OWMwLDAgNS44MDAwMiw1LjMgMTAuNSwxYzAsMCA1LjIwMDAxLC00Ljc5OTk5IC0yLjI5OTk5LC0xMi4ybC0zNS42MDAwMSwtMzMuMTk5OThsMC4wMDAwMSwtMC4wMDAwMWwwLC0wLjAwMDAxelxcXCIgZmlsbD1cXFwiIzVDMkM5MVxcXCIvPlxcbiAgPC9nPlxcbiA8L3N2Zz5cIjtcbn0sXCJ1c2VEYXRhXCI6dHJ1ZX0pKTtcblxuSGFuZGxlYmFycy5yZWdpc3RlclBhcnRpYWwoXCJpY29ucy1jYXJldC1yaWdodFwiLCB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1wiaWNvbnMtY2FyZXQtcmlnaHRcIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHJldHVybiBcIjxzdmcgdmlld0JveD1cXFwiMCAwIDY0IDkzXFxcIiB4bWxucz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiIHhtbG5zOnN2Zz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiPlxcbiAgPGc+XFxuICAgPHBhdGggaWQ9XFxcInN2Z18xXFxcIiBkPVxcXCJtNDcuNjU1MzYsNDYuMDUyODZsLTM1LC0zNWMwLDAgLTQuMjk5OTksLTUgMCwtOS44MDAwMmMwLDAgNC43OTk5OSwtMy41IDkuNzk5OTksMS4yMDAwMWwzNy42MDAwMSwzNy42MDAwMWMwLDAgNi42MDAwMSw1LjE5OTk4IDAsMTIuMTAwMDFsLTM5Ljc5OTk5LDM4LjI5OTk5YzAsMCAtNS44MDAwMiw1LjI5OTk5IC0xMC41LDFjMCwwIC01LjIwMDAxLC00Ljc5OTk5IDIuMjk5OTksLTEyLjIwMDAxbDM1LjYwMDAxLC0zMy4xOTk5OHpcXFwiIGZpbGw9XFxcIiM1QzJDOTFcXFwiLz5cXG4gIDwvZz5cXG4gPC9zdmc+XCI7XG59LFwidXNlRGF0YVwiOnRydWV9KSk7XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJQYXJ0aWFsKFwiaWNvbnMtY2xvc2VcIiwgdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcImljb25zLWNsb3NlXCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICByZXR1cm4gXCI8c3ZnIGNsYXNzPVxcXCJhbXAtc3ZnLWljb25cXFwiIHZpZXdCb3g9XFxcIjAgMCAyMDAgMjAwXFxcIiB4bWxucz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiIHhtbG5zOnN2Zz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiPlxcbiAgICA8Zz5cXG4gICAgICAgIFxcbiAgICAgICAgPGc+XFxuICAgICAgICAgICAgPHBhdGggZmlsbD1cXFwiIzZENkQ2Q1xcXCIgZD1cXFwibTE0Ny4wNjIwODgsNjUuMjg2NTk4bC03OS40NTUyNjEsNzkuNDU1MjU0Yy0xLjU3MDI1MSwxLjU3MDI1MSAtMy4zNDE1NDUsMi4zMTE1MjMgLTMuOTg1MzI5LDEuNjY3NzRsLTkuNzg1NTI2LC05Ljc4NTUyMmMtMC42NDM3ODcsLTAuNjQzNzg0IDAuMDk3NDgxLC0yLjQxNTA4NSAxLjY2NzczNiwtMy45ODUzMzZsNzkuNDU1MjQ2LC03OS40NTUyNTRjMS41NzAyODIsLTEuNTcwMjg2IDMuMzQxNDYxLC0yLjMxMTQzMiAzLjk4NTI0NSwtMS42Njc2NDhsOS43ODU1MzgsOS43ODU1MjZjMC42NDM3ODQsMC42NDM3ODQgLTAuMDk3MzgyLDIuNDE0OTY3IC0xLjY2NzY0OCwzLjk4NTI0MXpcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBmaWxsPVxcXCIjNkQ2RDZDXFxcIiBkPVxcXCJtMTM0Ljk1ODkzOSwxNDQuNzQxODk4bC03OS40NTUxOTYsLTc5LjQ1NTE5M2MtMS41NzAyNCwtMS41NzAyMzYgLTIuMzExNTE2LC0zLjM0MTU0NSAtMS42Njc3MzIsLTMuOTg1MzI5bDkuNzg1NTI2LC05Ljc4NTUyNmMwLjY0Mzc4NCwtMC42NDM3ODQgMi40MTUwOTIsMC4wOTc0OTIgMy45ODUzMjksMS42Njc3MzJsNzkuNDU1MTkzLDc5LjQ1NTE5NmMxLjU3MDMxMywxLjU3MDMxMyAyLjMxMTQ0NywzLjM0MTQ3NiAxLjY2NzY2NCwzLjk4NTI2bC05Ljc4NTUyMiw5Ljc4NTUyMmMtMC42NDM3ODQsMC42NDM3ODQgLTIuNDE0OTQ4LC0wLjA5NzM1MSAtMy45ODUyNiwtMS42Njc2NjR6XFxcIi8+XFxuICAgICAgICA8L2c+XFxuICAgIDwvZz5cXG48L3N2Zz5cIjtcbn0sXCJ1c2VEYXRhXCI6dHJ1ZX0pKTtcblxuSGFuZGxlYmFycy5yZWdpc3RlclBhcnRpYWwoXCJpY29ucy1yZWNsaW5lclwiLCB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1wiaWNvbnMtcmVjbGluZXJcIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHJldHVybiBcIjxzdmcgY2xhc3M9XFxcImFtcC1zdmctaWNvblxcXCIgdmlld0JveD1cXFwiMCAwIDIwMCAyMDBcXFwiIHhtbG5zPVxcXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1xcXCIgeG1sbnM6c3ZnPVxcXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1xcXCI+XFxuICAgIDxnPlxcbiAgICAgICAgXFxuICAgICAgICA8Zz5cXG4gICAgICAgICAgICA8cGF0aFxcbiAgICAgICAgICAgICAgICAgIGQ9XFxcIm0xNDIuMzAwMDE4LDE0My4zOTk5NjNsMCwtMzQuMjk5OTg4bDI0LC0zNS43OTk5ODhjMCwwIDExLjIwMDAxMiwtMTguMjAwMDEyIC03LjEwMDAwNiwtMjEuNzAwMDEybC0zOC44OTk5OTQsLTYuMTAwMDA2YzAsMCAtMTEuODk5OTk0LDAuODk5OTk0IC04LjM5OTk5NCwxOC44OTk5OTRjMCwwIC0xMS42MDAwMDYsNSAtMjYuMzk5OTk0LDI5LjQwMDAyNGwwLjYwMDAwNiwtMTIuNDAwMDI0YzAsMCAtMC4yMDAwMTIsLTUuMDk5OTc2IC04LjEwMDAwNiwtMi4xOTk5ODJsLTM0LjgwMDAwMywxMy4yOTk5ODhjMCwwIC03LjIwMDAxMiwxLjIwMDAxMiAtNy40MDAwMDksMTUuMTAwMDA2YzAsMCAwLjE5OTk5NywxMy4zOTk5OTQgMC4xOTk5OTcsMTMuMzk5OTk0Yy0wLjA5OTk5MSwwLjEwMDAwNiAtOSw3LjIwMDAxMiAtOC43OTk5ODgsMTUuMTAwMDA2bDMwLjE5OTk5NywxNi41YzAsMCA3LjYwMDAwNiw0LjIwMDAxMiAxOS4zOTk5OTQsLTkuMjAwMDEybDguODAwMDE4LDMuMzAwMDE4bDAsNi4yOTk5ODhsMTcuNzk5OTg4LDcuMjAwMDEybDM4Ljg5OTk5NCwtMTYuODAwMDE4elxcXCJcXG4gICAgICAgICAgICAgICAgICBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS1saW5lam9pbj1cXFwicm91bmRcXFwiIHN0cm9rZS13aWR0aD1cXFwiNlxcXCIgc3Ryb2tlPVxcXCIjNkI2QjZCXFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgICAgICAgPHBhdGggZD1cXFwibTE2Mi44MDAwMTgsNTIuNTk5OTc2YzAsMCAtMTUsLTIuMTAwMDA2IC0xMi43OTk5ODgsMTkuODk5OTk0bC0zOC4yMDAwMTIsLTguMTAwMDA2XFxcIlxcbiAgICAgICAgICAgICAgICAgIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLWxpbmVqb2luPVxcXCJyb3VuZFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI2XFxcIiBzdHJva2U9XFxcIiM2QjZCNkJcXFwiIGZpbGw9XFxcIm5vbmVcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBkPVxcXCJtMTUwLDcyLjQ5OTk2OWMwLDAgLTYuNzAwMDEyLDUgLTE2LDIxLjVcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI2XFxcIlxcbiAgICAgICAgICAgICAgICAgIHN0cm9rZT1cXFwiIzZCNkI2QlxcXCIgZmlsbD1cXFwibm9uZVxcXCIvPlxcbiAgICAgICAgICAgIDxwYXRoXFxuICAgICAgICAgICAgICAgICAgZD1cXFwibTE0Mi4zMDAwMTgsMTA5LjA5OTk3NmMwLC0xMi4yMDAwMTIgLTguMzk5OTk0LC0xNS4xMDAwMDYgLTguMzk5OTk0LC0xNS4xMDAwMDZjLTYsLTQgLTE0LC0wLjg5OTk5NCAtMTQsLTAuODk5OTk0bC0xNC4yOTk5ODgsNi42MDAwMDZsLTIwLjQwMDAyNCwtNmwtMzUuNDk5OTg1LDE2LjE5OTk4MmMwLDAgLTcuNDAwMDA5LDMuMzAwMDE4IC0xNC4xMDAwMDYsMTFcXFwiXFxuICAgICAgICAgICAgICAgICAgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBzdHJva2Utd2lkdGg9XFxcIjZcXFwiIHN0cm9rZT1cXFwiIzZCNkI2QlxcXCIgZmlsbD1cXFwibm9uZVxcXCIvPlxcbiAgICAgICAgICAgIDxwYXRoXFxuICAgICAgICAgICAgICAgICAgZD1cXFwibTc2LjUsMTQzLjM5OTk2M2M5Ljc5OTk4OCwtMTIuMjk5OTg4IDguNzk5OTg4LC0xOC43OTk5ODggOC43OTk5ODgsLTE4Ljc5OTk4OGwtMzUuNDk5OTg1LC0xNC42MDAwMDZsMCwtOC44OTk5OTRjMCwwIDEuMTk5OTk3LC0xMC43MDAwMTIgLTguMTAwMDA2LC04LjIwMDAxMlxcXCJcXG4gICAgICAgICAgICAgICAgICBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNlxcXCIgc3Ryb2tlPVxcXCIjNkI2QjZCXFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgICAgICAgPHBhdGggZD1cXFwibTg1LjQwMDAyNCwxMjQuNDk5OTY5YzAsMCAtMTYuMjk5OTg4LC0wLjMwMDAxOCAtMjcuMTk5OTgyLDI4LjM5OTk5NFxcXCJcXG4gICAgICAgICAgICAgICAgICBzdHJva2UtbWl0ZXJsaW1pdD1cXFwiMTBcXFwiIHN0cm9rZS13aWR0aD1cXFwiNlxcXCIgc3Ryb2tlPVxcXCIjNkI2QjZCXFxcIiBmaWxsPVxcXCJub25lXFxcIi8+XFxuICAgICAgICAgICAgPHBhdGhcXG4gICAgICAgICAgICAgICAgICBkPVxcXCJtODUuNDAwMDI0LDE0Ni41OTk5NzZsMC4xMDAwMDYsLTI1LjcwMDAxMmMwLDAgLTAuNSwtMTMuMzk5OTk0IDUuNzk5OTg4LC0xNC42OTk5ODJjMCwwIDEwLjgwMDAxOCwtMi44MDAwMTggMTEuODk5OTk0LDcuNjk5OTgybDAsNDQuNzAwMDEyXFxcIlxcbiAgICAgICAgICAgICAgICAgIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgc3Ryb2tlLXdpZHRoPVxcXCI2XFxcIiBzdHJva2U9XFxcIiM2QjZCNkJcXFwiIGZpbGw9XFxcIm5vbmVcXFwiLz5cXG4gICAgICAgICAgICA8bGluZSB5Mj1cXFwiMTA2LjE5OTk3NlxcXCIgeDI9XFxcIjkxLjIwMDAxMlxcXCIgeTE9XFxcIjk5LjY5OTk3NlxcXCIgeDE9XFxcIjEwNS44MDAwMTJcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCJcXG4gICAgICAgICAgICAgICAgICBzdHJva2Utd2lkdGg9XFxcIjZcXFwiIHN0cm9rZT1cXFwiIzZCNkI2QlxcXCIgZmlsbD1cXFwibm9uZVxcXCIvPlxcbiAgICAgICAgICAgIDxwYXRoXFxuICAgICAgICAgICAgICAgICAgZD1cXFwibTkwLjQwMDAyNCw2Ni4wOTk5NzZjMCwwIDguMTAwMDA2LC0yNS42MDAwMDYgMzQuMjk5OTg4LC0zMS42MDAwMDZsMCwyLjEwMDAwNmw4LjYwMDAwNiwtNC43MDAwMTJsLTguNjAwMDA2LC00LjA5OTk3NmwwLDIuMjk5OTg4YzAsMC4xMDAwMDYgLTMwLjUsMi44OTk5OTQgLTM0LjI5OTk4OCwzNnpcXFwiXFxuICAgICAgICAgICAgICAgICAgZmlsbD1cXFwiIzZCNkI2QlxcXCIvPlxcbiAgICAgICAgICAgIDxwYXRoXFxuICAgICAgICAgICAgICAgICAgZD1cXFwibTU4LjM5OTk5NCwxNjcuNjk5OTgybC0wLjUsMi4yMDAwMTJsLTcuNTk5OTc2LC01LjgwMDAxOGw5LjM5OTk5NCwtMi43OTk5ODhsLTAuMzk5OTk0LDJjMCwwIDEzLjY5OTk4MiwwLjUgMjAuNjk5OTgyLC0xMy4yMDAwMTJjLTAuMDk5OTc2LDAuMTAwMDA2IC0wLjI5OTk4OCwxNy41IC0yMS42MDAwMDYsMTcuNjAwMDA2elxcXCJcXG4gICAgICAgICAgICAgICAgICBmaWxsPVxcXCIjNkI2QjZCXFxcIi8+XFxuICAgICAgICA8L2c+XFxuICAgIDwvZz5cXG48L3N2Zz5cXG5cIjtcbn0sXCJ1c2VEYXRhXCI6dHJ1ZX0pKTtcblxuSGFuZGxlYmFycy5yZWdpc3RlclBhcnRpYWwoXCJpY29ucy12aWRlb1wiLCB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1wiaWNvbnMtdmlkZW9cIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHJldHVybiBcIjxzdmcgY2xhc3M9XFxcImFtcC1zdmctaWNvblxcXCIgdmlld0JveD1cXFwiMCAwIDIwMCAyMDBcXFwiIHhtbG5zPVxcXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1xcXCIgeG1sbnM6c3ZnPVxcXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1xcXCI+XFxuICAgIDxnPlxcbiAgICAgICAgPGc+XFxuICAgICAgICAgICAgPHBhdGhcXG4gICAgICAgICAgICAgICAgZD1cXFwibTY1LjI5OTk4OCw2OC4yMDAwMTJjMCwtNyA1LC05Ljg5OTk5NCAxMS4xMDAwMDYsLTYuMzk5OTk0bDYyLjI5OTk4OCwzNmM2LjEwMDAwNiwzLjYwMDAwNiA2LjEwMDAwNiw5LjI5OTk4OCAwLDEyLjY5OTk4MmwtNjIuMjk5OTg4LDM2Yy02LjEwMDAwNiwzLjYwMDAwNiAtMTEuMTAwMDA2LDAuNjAwMDA2IC0xMS4xMDAwMDYsLTYuMzk5OTk0bDAsLTcxLjg5OTk5NHpcXFwiXFxuICAgICAgICAgICAgICAgIGZpbGw9XFxcIiM2RDZENkNcXFwiLz5cXG4gICAgICAgIDwvZz5cXG4gICAgPC9nPlxcbjwvc3ZnPlxcblwiO1xufSxcInVzZURhdGFcIjp0cnVlfSkpO1xuXG5IYW5kbGViYXJzLnJlZ2lzdGVyUGFydGlhbChcImljb25zLXdlYmdsXCIsIHRoaXNbXCJhbXBcIl1bXCJ0ZW1wbGF0ZXNcIl1bXCJkZnNcIl1bXCJpY29ucy13ZWJnbFwiXSA9IEhhbmRsZWJhcnMudGVtcGxhdGUoe1wiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgcmV0dXJuIFwiPHN2ZyBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uXFxcIiB2aWV3Ym94PVxcXCIwIDAgMjAwIDIwMFxcXCIgeG1sbnM9XFxcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXFxcIiB4bWxuczpzdmc9XFxcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXFxcIj5cXG5cXG4gPGc+XFxuICAgICBcXG4gICAgIDxnPlxcbiAgICAgIDx0ZXh0IHg9XFxcIi0yNDAuNTQ1NTY3XFxcIiB5PVxcXCItMzI3XFxcIiBmb250LXNpemU9XFxcIjUzLjg5MTlcXFwiIGZvbnQtZmFtaWx5PVxcXCInSGVsdmV0aWNhTmV1ZS1Cb2xkJ1xcXCIgZmlsbD1cXFwiIzZCNkI2QlxcXCIgdHJhbnNmb3JtPVxcXCJtYXRyaXgoMC44MDY1LDAsMCwxLDI2Mi41MTUxLDQ3Mi41MTgyKSBcXFwiPjNEPC90ZXh0PlxcbiAgICAgIDxwYXRoIGQ9XFxcIm0xMzkuNzk5OTg4LDEzMC4zOTk5OTRsMCwxMC44OTk5OTRjMCwwIDM4LjM5OTk5NCwtMy44OTk5OTQgMzkuMjAwMDEyLC0xNS44OTk5OTRjMCwwIDMuNSwtMTEuNzAwMDEyIC00My44MDAwMTgsLTIwLjcwMDAxMmMwLDAgLTY4LjI5OTk4OCwtOS41IC0xMDguODk5OTk0LDEwLjEwMDAwNmMwLDAgLTM0LjE5OTk5NywxOS4xMDAwMDYgMzcuODk5OTk0LDM0LjIwMDAxMmMwLDAgLTU4LjI5OTk4OCwtNC4yMDAwMTIgLTUzLjc5OTk4OCwtMjcuMjk5OTg4YzAsMCA3LjE5OTk5NywtMTcuODAwMDE4IDc1LC0yMS44MDAwMThjMCwwIDY3LjM5OTk5NCwtMi4zOTk5OTQgOTMuNjAwMDA2LDE1LjEwMDAwNmMwLDAgMjAuMzk5OTk0LDkuNzAwMDEyIC00LjkwMDAyNCwyMi43OTk5ODhjMCwwIC04LjUsMy45MDAwMjQgLTM0LjE5OTk4Miw4LjVsMCwxMC4zMDAwMThsLTEzLjMwMDAxOCwtMTIuODAwMDE4bDEzLjIwMDAxMiwtMTMuMzk5OTk0elxcXCIgZmlsbD1cXFwiIzZCNkI2QlxcXCIvPlxcbiAgICAgIDxnPlxcbiAgICAgICA8cGF0aCBkPVxcXCJtNzguMjk5OTg4LDEwNS43MDAwMTJjMC43MDAwMTIsLTExLjUgMS43MDAwMTIsLTE5IDEuNzAwMDEyLC0xOWM5LC00Ny4yOTk5ODggMjAuNjk5OTgyLC00My43OTk5ODggMjAuNjk5OTgyLC00My43OTk5ODhjMTEuODk5OTk0LDAuNzk5OTg4IDE1Ljg5OTk5NCwzOS4xOTk5ODIgMTUuODk5OTk0LDM5LjE5OTk4MmwtMTEsMGwxMy41LDEzbDEyLjgwMDAxOCwtMTMuMjk5OTg4bC0xMC4zMDAwMTgsMGMtNC41LC0yNS43MDAwMTIgLTguNSwtMzQuMjAwMDEyIC04LjUsLTM0LjIwMDAxMmMtMTMsLTI1LjE5OTk4MiAtMjIuNzk5OTg4LC00Ljg5OTk5NCAtMjIuNzk5OTg4LC00Ljg5OTk5NGMtOS43MDAwMTIsMTQuNSAtMTMuMjk5OTg4LDQxLjYwMDAwNiAtMTQuNSw2Mi44OTk5OTRsMi41LDAuMTAwMDA2bDAsMGwwLDB6XFxcIiBmaWxsPVxcXCIjODI4MjgyXFxcIi8+XFxuICAgICAgPC9nPlxcbiAgICAgPC9nPlxcbiA8L2c+XFxuPC9zdmc+XCI7XG59LFwidXNlRGF0YVwiOnRydWV9KSk7XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJQYXJ0aWFsKFwiaWNvbnMtem9vbS1pblwiLCB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1wiaWNvbnMtem9vbS1pblwiXSA9IEhhbmRsZWJhcnMudGVtcGxhdGUoe1wiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gICAgcmV0dXJuIFwiPHN2ZyBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uXFxcIiB2aWV3Qm94PVxcXCIwIDAgMjAwIDIwMFxcXCIgeG1sbnM9XFxcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXFxcIiB4bWxuczpzdmc9XFxcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXFxcIj5cXG4gICAgPGc+XFxuICAgICAgICBcXG4gICAgICAgIDxnPlxcbiAgICAgICAgICAgIDxjaXJjbGUgZmlsbD1cXFwibm9uZVxcXCIgc3Ryb2tlPVxcXCIjNkQ2RDZDXFxcIiBzdHJva2Utd2lkdGg9XFxcIjlcXFwiIHN0cm9rZS1taXRlcmxpbWl0PVxcXCIxMFxcXCIgY3g9XFxcIjg3LjUyNTAwMVxcXCIgY3k9XFxcIjg1LjM2MjMzMlxcXCIgcj1cXFwiNTAuNDYyNjg3XFxcIi8+XFxuICAgICAgICAgICAgPHBhdGggZmlsbD1cXFwiIzZENkQ2Q1xcXCIgZD1cXFwibTE3My4xMzEzNjMsMTU3LjI3MTY2N2wtMTQuNTk4MTYsMTQuNTk4MTZjLTMuMDYzNzY2LDMuMDYzNzY2IC03LjkyOTgyNSwzLjA2Mzc2NiAtMTAuODEzNDMxLDBsLTM2LjQwNTE5LC0zNi40MDUyNDNjLTMuMDYzODIsLTMuMDYzODEyIC0zLjA2MzgyLC03LjkyOTg0IDAsLTEwLjgxMzQzOGwxNC41OTgwOTksLTE0LjU5ODE2YzMuMDYzODM1LC0zLjA2Mzc2NiA3LjkyOTg5MywtMy4wNjM3NjYgMTAuODEzNDM4LDBsMzYuNDA1MjQzLDM2LjQwNTI1MWMyLjg4MzU0NSwzLjA2Mzc5NyAyLjg4MzU0NSw3Ljc0OTY2NCAwLDEwLjgxMzQzMXpcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBmaWxsPVxcXCIjNkQ2RDZDXFxcIiBkPVxcXCJtMTEwLjk1NDEyNCw5NC45MTQxNzdsLTQ1LjU5NjYyNiwwYy0wLjkwMTEyMywwIC0xLjYyMjA0NywtMC43MjA4NzEgLTEuNjIyMDQ3LC0xLjYyMTk5NGwwLC0xMy42OTcwMjljMCwtMC45MDExMjMgMC43MjA5MjQsLTEuNjIyMDAyIDEuNjIyMDQ3LC0xLjYyMjAwMmw0NS41OTY2MjYsMGMwLjkwMTExNSwwIDEuNjIxOTk0LDAuNzIwODc5IDEuNjIxOTk0LDEuNjIyMDAybDAsMTMuNjk3MDI5YzAsMC45MDExMjMgLTAuNzIwODc5LDEuNjIxOTk0IC0xLjYyMTk5NCwxLjYyMTk5NHpcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBmaWxsPVxcXCIjNkQ2RDZDXFxcIiBkPVxcXCJtNzkuNzc1MzYsMTA5LjMzMjA5MmwwLC00NS41OTY2M2MwLC0wLjkwMTExOSAwLjcyMDg3OSwtMS42MjIwNDQgMS42MjE5OTQsLTEuNjIyMDQ0bDEzLjY5NzAzNywwYzAuOTAxMTE1LDAgMS42MjE5OTQsMC43MjA5MjQgMS42MjE5OTQsMS42MjIwNDRsMCw0NS41OTY2M2MwLDAuOTAxMTE1IC0wLjcyMDg3OSwxLjYyMTk5NCAtMS42MjE5OTQsMS42MjE5OTRsLTEzLjY5NzAzNywwYy0wLjkwMTExNSwtMC4xODAxODMgLTEuNjIxOTk0LC0wLjcyMDg3OSAtMS42MjE5OTQsLTEuNjIxOTk0elxcXCIvPlxcbiAgICAgICAgPC9nPlxcbiAgICA8L2c+XFxuPC9zdmc+XCI7XG59LFwidXNlRGF0YVwiOnRydWV9KSk7XG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJQYXJ0aWFsKFwiaWNvbnMtem9vbS1vdXRcIiwgdGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcImljb25zLXpvb20tb3V0XCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICByZXR1cm4gXCI8c3ZnIGNsYXNzPVxcXCJhbXAtc3ZnLWljb25cXFwiIHZpZXdCb3g9XFxcIjAgMCAyMDAgMjAwXFxcIiB4bWxucz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiIHhtbG5zOnN2Zz1cXFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcXFwiPlxcbiAgICA8Zz5cXG4gICAgICAgIFxcbiAgICAgICAgPGc+XFxuICAgICAgICAgICAgPGNpcmNsZSBmaWxsPVxcXCJub25lXFxcIiBzdHJva2U9XFxcIiM2RDZENkNcXFwiIHN0cm9rZS13aWR0aD1cXFwiOVxcXCIgc3Ryb2tlLW1pdGVybGltaXQ9XFxcIjEwXFxcIiBjeD1cXFwiODcuNTI1MDAxXFxcIiBjeT1cXFwiODUuMzYyMzMyXFxcIiByPVxcXCI1MC40NjI2ODdcXFwiLz5cXG4gICAgICAgICAgICA8cGF0aCBmaWxsPVxcXCIjNkQ2RDZDXFxcIiBkPVxcXCJtMTczLjEzMTM2MywxNTcuMjcxNjY3bC0xNC41OTgxNiwxNC41OTgxNmMtMy4wNjM3NjYsMy4wNjM3NjYgLTcuOTI5ODI1LDMuMDYzNzY2IC0xMC44MTM0MzEsMGwtMzYuNDA1MTksLTM2LjQwNTI0M2MtMy4wNjM4MiwtMy4wNjM4MTIgLTMuMDYzODIsLTcuOTI5ODQgMCwtMTAuODEzNDM4bDE0LjU5ODA5OSwtMTQuNTk4MTZjMy4wNjM4MzUsLTMuMDYzNzY2IDcuOTI5ODkzLC0zLjA2Mzc2NiAxMC44MTM0MzgsMGwzNi40MDUyNDMsMzYuNDA1MjUxYzIuODgzNTQ1LDMuMDYzNzk3IDIuODgzNTQ1LDcuNzQ5NjY0IDAsMTAuODEzNDMxelxcXCIvPlxcbiAgICAgICAgICAgIDxwYXRoIGZpbGw9XFxcIiM2RDZENkNcXFwiIGQ9XFxcIm0xMTAuOTU0MTI0LDk0LjkxNDE3N2wtNDUuNTk2NjI2LDBjLTAuOTAxMTIzLDAgLTEuNjIyMDQ3LC0wLjcyMDg3MSAtMS42MjIwNDcsLTEuNjIxOTk0bDAsLTEzLjY5NzAyOWMwLC0wLjkwMTEyMyAwLjcyMDkyNCwtMS42MjIwMDIgMS42MjIwNDcsLTEuNjIyMDAybDQ1LjU5NjYyNiwwYzAuOTAxMTE1LDAgMS42MjE5OTQsMC43MjA4NzkgMS42MjE5OTQsMS42MjIwMDJsMCwxMy42OTcwMjljMCwwLjkwMTEyMyAtMC43MjA4NzksMS42MjE5OTQgLTEuNjIxOTk0LDEuNjIxOTk0elxcXCIvPlxcbiAgICAgICAgPC9nPlxcbiAgICA8L2c+XFxuPC9zdmc+XCI7XG59LFwidXNlRGF0YVwiOnRydWV9KSk7XG5cbnRoaXNbXCJhbXBcIl1bXCJ0ZW1wbGF0ZXNcIl1bXCJkZnNcIl1bXCJ0ZW1wbGF0ZS1kZXNrdG9wXCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCIxXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgcmV0dXJuIFwiICAgICAgICAgICAgICAgIFwiXG4gICAgKyBjb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbigoaGVscGVycy5yZW5kZXJQYXJ0aWFsIHx8IChkZXB0aDAgJiYgZGVwdGgwLnJlbmRlclBhcnRpYWwpIHx8IGhlbHBlcnMuaGVscGVyTWlzc2luZykuY2FsbChkZXB0aDAsXCJfdGVtcGxhdGUtbWFpbi1pdGVtXCIse1wibmFtZVwiOlwicmVuZGVyUGFydGlhbFwiLFwiaGFzaFwiOntcInByb2R1Y3ROYW1lXCI6KGRlcHRoc1sxXSAhPSBudWxsID8gZGVwdGhzWzFdLnByb2R1Y3ROYW1lIDogZGVwdGhzWzFdKSxcInRlbXBsYXRlc1wiOihkZXB0aHNbMV0gIT0gbnVsbCA/IGRlcHRoc1sxXS50ZW1wbGF0ZXMgOiBkZXB0aHNbMV0pLFwiaXRlbVwiOmRlcHRoMH0sXCJkYXRhXCI6ZGF0YX0pKVxuICAgICsgXCJcXG5cIjtcbn0sXCIzXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgXCJcbiAgICArIGNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uKChoZWxwZXJzLnJlbmRlclBhcnRpYWwgfHwgKGRlcHRoMCAmJiBkZXB0aDAucmVuZGVyUGFydGlhbCkgfHwgaGVscGVycy5oZWxwZXJNaXNzaW5nKS5jYWxsKGRlcHRoMCxcIl90ZW1wbGF0ZS1uYXYtaXRlbVwiLHtcIm5hbWVcIjpcInJlbmRlclBhcnRpYWxcIixcImhhc2hcIjp7XCJ0ZW1wbGF0ZXNcIjooZGVwdGhzWzFdICE9IG51bGwgPyBkZXB0aHNbMV0udGVtcGxhdGVzIDogZGVwdGhzWzFdKSxcIml0ZW1cIjpkZXB0aDB9LFwiZGF0YVwiOmRhdGF9KSlcbiAgICArIFwiXFxuXCI7XG59LFwiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazEsIGhlbHBlciwgYWxpYXMxPWhlbHBlcnMuaGVscGVyTWlzc2luZywgYWxpYXMyPVwiZnVuY3Rpb25cIiwgYWxpYXMzPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIjxzZWN0aW9uIGNsYXNzPVxcXCJhbXAtdmlld2VyIGFtcC1kZXNrdG9wLXZpZXdlciBcIlxuICAgICsgYWxpYXMzKCgoaGVscGVyID0gKGhlbHBlciA9IGhlbHBlcnMudG91Y2ggfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRvdWNoIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJ0b3VjaFwiLFwiaGFzaFwiOnt9LFwiZGF0YVwiOmRhdGF9KSA6IGhlbHBlcikpKVxuICAgICsgXCJcXFwiPlxcbiAgICA8aGVhZGVyIGNsYXNzPVxcXCJhbXAtaGVhZGVyXFxcIj5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1oZWFkZXItd3JhcHBlclxcXCI+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLWhlYWRlci1wcm9kdWN0LXRpdGxlXFxcIj5cXG4gICAgICAgICAgICAgICAgPGgzPlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5yYW5nZU5hbWUgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnJhbmdlTmFtZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwicmFuZ2VOYW1lXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIjogXCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnByb2R1Y3ROYW1lIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5wcm9kdWN0TmFtZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwicHJvZHVjdE5hbWVcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiPC9oMz5cXG4gICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtcm91bmRlbHNcXFwiPjwvZGl2PlxcbiAgICAgICAgPC9kaXY+XFxuICAgIDwvaGVhZGVyPlxcblxcbiAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbWFpbi1jb250YWluZXJcXFwiPlxcbiAgICAgICAgPHVsIGNsYXNzPVxcXCJhbXAtdmlld2VyLW1haW5cXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuZWFjaC5jYWxsKGRlcHRoMCwoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbXMgOiBkZXB0aDApLHtcIm5hbWVcIjpcImVhY2hcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMSwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICA8L3VsPlxcbiAgICA8L2Rpdj5cXG4gICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdi1jb250YWluZXJcXFwiPlxcbiAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdmlnYXRpb24td3JhcHBlclxcXCI+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXByZXYgYW1wLW5hdi1wcmV2IGFtcC1uYXYtYnV0dG9uIGFtcC1tb3otaW52aXNpYmxlXFxcIj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uLXdyYXBwZXJcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtY2FyZXQtbGVmdFwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtY2FyZXQtbGVmdFwiLFwiZGF0YVwiOmRhdGEsXCJpbmRlbnRcIjpcIiAgICAgICAgICAgICAgICBcIixcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1uYXYtdGh1bWJzXFxcIj5cXG4gICAgICAgICAgICAgICAgPHVsIGNsYXNzPVxcXCJhbXAtbmF2aWdhdGlvbi1tYWluXFxcIj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW1zIDogZGVwdGgwKSx7XCJuYW1lXCI6XCJlYWNoXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDMsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5ub29wLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgICAgICAgICA8L3VsPlxcbiAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1uZXh0IGFtcC1uYXYtbmV4dCBhbXAtbmF2LWJ1dHRvbiBhbXAtbW96LWludmlzaWJsZVxcXCI+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1zdmctaWNvbi13cmFwcGVyXFxcIj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLWNhcmV0LXJpZ2h0XCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy1jYXJldC1yaWdodFwiLFwiZGF0YVwiOmRhdGEsXCJpbmRlbnRcIjpcIiAgICAgICAgICAgICAgICBcIixcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDwvZGl2PlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiX3RlbXBsYXRlLXF1aWNrbGlua3NcIl0sZGVwdGgwLHtcIm5hbWVcIjpcIl90ZW1wbGF0ZS1xdWlja2xpbmtzXCIsXCJkYXRhXCI6ZGF0YSxcImluZGVudFwiOlwiICAgICAgICAgICAgXCIsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgPC9kaXY+XFxuICAgIDwvZGl2Plxcblxcbjwvc2VjdGlvbj5cXG5cIjtcbn0sXCJ1c2VQYXJ0aWFsXCI6dHJ1ZSxcInVzZURhdGFcIjp0cnVlLFwidXNlRGVwdGhzXCI6dHJ1ZX0pO1xuXG50aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1widGVtcGxhdGUtZnVsbHNjcmVlblwiXSA9IEhhbmRsZWJhcnMudGVtcGxhdGUoe1wiMVwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHJldHVybiBcIiAgICAgICAgICAgICAgIFwiXG4gICAgKyBjb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbigoaGVscGVycy5yZW5kZXJQYXJ0aWFsIHx8IChkZXB0aDAgJiYgZGVwdGgwLnJlbmRlclBhcnRpYWwpIHx8IGhlbHBlcnMuaGVscGVyTWlzc2luZykuY2FsbChkZXB0aDAsXCJfdGVtcGxhdGUtbWFpbi1pdGVtXCIse1wibmFtZVwiOlwicmVuZGVyUGFydGlhbFwiLFwiaGFzaFwiOntcInByb2R1Y3ROYW1lXCI6KGRlcHRoc1sxXSAhPSBudWxsID8gZGVwdGhzWzFdLnByb2R1Y3ROYW1lIDogZGVwdGhzWzFdKSxcInRlbXBsYXRlc1wiOihkZXB0aHNbMV0gIT0gbnVsbCA/IGRlcHRoc1sxXS50ZW1wbGF0ZXMgOiBkZXB0aHNbMV0pLFwiaXRlbVwiOmRlcHRoMH0sXCJkYXRhXCI6ZGF0YX0pKVxuICAgICsgXCJcXG5cIjtcbn0sXCIzXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgcmV0dXJuIFwiICAgICAgICAgICAgICAgICAgICAgICAgXCJcbiAgICArIGNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uKChoZWxwZXJzLnJlbmRlclBhcnRpYWwgfHwgKGRlcHRoMCAmJiBkZXB0aDAucmVuZGVyUGFydGlhbCkgfHwgaGVscGVycy5oZWxwZXJNaXNzaW5nKS5jYWxsKGRlcHRoMCxcIl90ZW1wbGF0ZS1uYXYtaXRlbVwiLHtcIm5hbWVcIjpcInJlbmRlclBhcnRpYWxcIixcImhhc2hcIjp7XCJ0ZW1wbGF0ZXNcIjooZGVwdGhzWzFdICE9IG51bGwgPyBkZXB0aHNbMV0udGVtcGxhdGVzIDogZGVwdGhzWzFdKSxcIml0ZW1cIjpkZXB0aDB9LFwiZGF0YVwiOmRhdGF9KSlcbiAgICArIFwiXFxuXCI7XG59LFwiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazEsIGhlbHBlciwgYWxpYXMxPWhlbHBlcnMuaGVscGVyTWlzc2luZywgYWxpYXMyPVwiZnVuY3Rpb25cIiwgYWxpYXMzPWNvbnRhaW5lci5lc2NhcGVFeHByZXNzaW9uO1xuXG4gIHJldHVybiBcIjxzZWN0aW9uIGNsYXNzPVxcXCJhbXAtdmlld2VyIGFtcC1mdWxsc2NyZWVuLXZpZXdlciBcIlxuICAgICsgYWxpYXMzKCgoaGVscGVyID0gKGhlbHBlciA9IGhlbHBlcnMudG91Y2ggfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRvdWNoIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJ0b3VjaFwiLFwiaGFzaFwiOnt9LFwiZGF0YVwiOmRhdGF9KSA6IGhlbHBlcikpKVxuICAgICsgXCJcXFwiPlxcbiAgICA8aGVhZGVyPlxcbiAgICA8aDM+XCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnJhbmdlTmFtZSB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAucmFuZ2VOYW1lIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJyYW5nZU5hbWVcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiOiBcIlxuICAgICsgYWxpYXMzKCgoaGVscGVyID0gKGhlbHBlciA9IGhlbHBlcnMucHJvZHVjdE5hbWUgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnByb2R1Y3ROYW1lIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJwcm9kdWN0TmFtZVwiLFwiaGFzaFwiOnt9LFwiZGF0YVwiOmRhdGF9KSA6IGhlbHBlcikpKVxuICAgICsgXCI8L2gzPlxcbiAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXRvcGxpbmtzLWNvbnRhaW5lclxcXCI+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXRvcGxpbmtzLXdyYXBwZXJcXFwiPlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtdG9wbGlua3MgYW1wLWNsb3NlXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLWNsb3NlXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy1jbG9zZVwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtdG9wbGlua3MgYW1wLXpvb20tb3V0XFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLXpvb20tb3V0XCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy16b29tLW91dFwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtdG9wbGlua3MgYW1wLXpvb20taW5cXFwiPlwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtem9vbS1pblwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtem9vbS1pblwiLFwiZGF0YVwiOmRhdGEsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIjwvZGl2PlxcbiAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgPC9kaXY+XFxuICAgIDwvaGVhZGVyPlxcbiAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbWFpbi1jb250YWluZXJcXFwiPlxcbiAgICAgICAgPHVsIGNsYXNzPVxcXCJhbXAtdmlld2VyLW1haW5cXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuZWFjaC5jYWxsKGRlcHRoMCwoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbXMgOiBkZXB0aDApLHtcIm5hbWVcIjpcImVhY2hcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMSwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICA8L3VsPlxcbiAgICA8L2Rpdj5cXG5cXG4gICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdi1jb250YWluZXJcXFwiPlxcbiAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdmlnYXRpb24td3JhcHBlclxcXCI+XFxuICAgICAgICAgICAgXFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXByZXYgYW1wLW5hdi1wcmV2IGFtcC1uYXYtYnV0dG9uXFxcIj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uLXdyYXBwZXJcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtY2FyZXQtbGVmdFwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtY2FyZXQtbGVmdFwiLFwiZGF0YVwiOmRhdGEsXCJpbmRlbnRcIjpcIiAgICAgICAgICAgICAgICBcIixcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1uYXYtdGh1bWJzXFxcIj5cXG4gICAgICAgICAgICAgICAgPHVsIGNsYXNzPVxcXCJhbXAtbmF2aWdhdGlvbi1tYWluXFxcIj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW1zIDogZGVwdGgwKSx7XCJuYW1lXCI6XCJlYWNoXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDMsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5ub29wLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgICAgICAgICA8L3VsPlxcbiAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1uZXh0IGFtcC1uYXYtbmV4dCBhbXAtbmF2LWJ1dHRvblxcXCI+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1zdmctaWNvbi13cmFwcGVyXFxcIj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLWNhcmV0LXJpZ2h0XCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy1jYXJldC1yaWdodFwiLFwiZGF0YVwiOmRhdGEsXCJpbmRlbnRcIjpcIiAgICAgICAgICAgICAgICBcIixcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgIDwvZGl2PlxcblxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiX3RlbXBsYXRlLXF1aWNrbGlua3NcIl0sZGVwdGgwLHtcIm5hbWVcIjpcIl90ZW1wbGF0ZS1xdWlja2xpbmtzXCIsXCJkYXRhXCI6ZGF0YSxcImluZGVudFwiOlwiICAgICAgICAgICAgXCIsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgPC9kaXY+XFxuICAgIDwvZGl2Plxcbjwvc2VjdGlvbj5cXG5cIjtcbn0sXCJ1c2VQYXJ0aWFsXCI6dHJ1ZSxcInVzZURhdGFcIjp0cnVlLFwidXNlRGVwdGhzXCI6dHJ1ZX0pO1xuXG50aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1widGVtcGxhdGUtaW50ZWdyYXRpb25cIl0gPSBIYW5kbGViYXJzLnRlbXBsYXRlKHtcIjFcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBoZWxwZXIsIGFsaWFzMT1oZWxwZXJzLmhlbHBlck1pc3NpbmcsIGFsaWFzMj1cImZ1bmN0aW9uXCIsIGFsaWFzMz1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCIgICAgPGxpIGNsYXNzPVxcXCJrZXktdmFsdWUtcGFpclxcXCI+XFxuICAgICAgICA8c3BhbiBjbGFzcz1cXFwia2V5XFxcIj5cIlxuICAgICsgYWxpYXMzKCgoaGVscGVyID0gKGhlbHBlciA9IGhlbHBlcnMua2V5IHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5rZXkgOiBkZXB0aDApKSAhPSBudWxsID8gaGVscGVyIDogYWxpYXMxKSwodHlwZW9mIGhlbHBlciA9PT0gYWxpYXMyID8gaGVscGVyLmNhbGwoZGVwdGgwLHtcIm5hbWVcIjpcImtleVwiLFwiaGFzaFwiOnt9LFwiZGF0YVwiOmRhdGF9KSA6IGhlbHBlcikpKVxuICAgICsgXCI8L3NwYW4+XFxuICAgICAgICA8c3BhbiBjbGFzcz1cXFwidmFsdWVcXFwiPjxwcmU+XCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnZhbHVlIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC52YWx1ZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwidmFsdWVcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiPC9wcmU+PC9zcGFuPlxcbiAgICA8L2xpPlxcblwiO1xufSxcIjNcIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBoZWxwZXIsIGFsaWFzMT1oZWxwZXJzLmhlbHBlck1pc3NpbmcsIGFsaWFzMj1cImZ1bmN0aW9uXCIsIGFsaWFzMz1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCIgICAgICAgIDxsaSBjbGFzcz1cXFwia2V5LXZhbHVlLXBhaXJcXFwiPlxcbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVxcXCJrZXlcXFwiPlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5rZXkgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLmtleSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwia2V5XCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIjwvc3Bhbj5cXG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cXFwidmFsdWVcXFwiPjxwcmU+XCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnZhbHVlIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC52YWx1ZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwidmFsdWVcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiPC9wcmU+PC9zcGFuPlxcbiAgICAgICAgPC9saT5cXG5cIjtcbn0sXCJjb21waWxlclwiOls3LFwiPj0gNC4wLjBcIl0sXCJtYWluXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiBcIjxoMT5BbXBsaWVuY2UgREZTIFZpZXdlcjwvaDE+XFxuXFxuPGgyPkludGVncmF0aW9uIERlYnVnIFZpZXc8L2gyPlxcbjx1bCBjbGFzcz1cXFwia2V5LXZhbHVlLXBhaXItbGlzdFxcXCI+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVycy5lYWNoLmNhbGwoZGVwdGgwLChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pbnRlZ3JhdGlvblBvaW50cyA6IGRlcHRoMCkse1wibmFtZVwiOlwiZWFjaFwiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgxLCBkYXRhLCAwKSxcImludmVyc2VcIjpjb250YWluZXIubm9vcCxcImRhdGFcIjpkYXRhfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L3VsPlxcblxcbjxoMj5WaWV3ZXIgT3B0aW9uczwvaDI+XFxuPHVsIGNsYXNzPVxcXCJrZXktdmFsdWUtcGFpci1saXN0XFxcIj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnZpZXdlck9wdGlvbnMgOiBkZXB0aDApLHtcIm5hbWVcIjpcImVhY2hcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMywgZGF0YSwgMCksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiPC91bD5cXG5cXG5cIjtcbn0sXCJ1c2VEYXRhXCI6dHJ1ZX0pO1xuXG50aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdW1widGVtcGxhdGUtbW9iaWxlXCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCIxXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEsYmxvY2tQYXJhbXMsZGVwdGhzKSB7XG4gICAgcmV0dXJuIFwiICAgICAgICAgICAgICAgIFwiXG4gICAgKyBjb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbigoaGVscGVycy5yZW5kZXJQYXJ0aWFsIHx8IChkZXB0aDAgJiYgZGVwdGgwLnJlbmRlclBhcnRpYWwpIHx8IGhlbHBlcnMuaGVscGVyTWlzc2luZykuY2FsbChkZXB0aDAsXCJfdGVtcGxhdGUtbWFpbi1pdGVtXCIse1wibmFtZVwiOlwicmVuZGVyUGFydGlhbFwiLFwiaGFzaFwiOntcInByb2R1Y3ROYW1lXCI6KGRlcHRoc1sxXSAhPSBudWxsID8gZGVwdGhzWzFdLnByb2R1Y3ROYW1lIDogZGVwdGhzWzFdKSxcInRlbXBsYXRlc1wiOihkZXB0aHNbMV0gIT0gbnVsbCA/IGRlcHRoc1sxXS50ZW1wbGF0ZXMgOiBkZXB0aHNbMV0pLFwiaXRlbVwiOmRlcHRoMH0sXCJkYXRhXCI6ZGF0YX0pKVxuICAgICsgXCJcXG5cIjtcbn0sXCIzXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgc3RhY2sxO1xuXG4gIHJldHVybiAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiX3RlbXBsYXRlLW5hdi1pdGVtLWFsdFwiXSxkZXB0aDAse1wibmFtZVwiOlwiX3RlbXBsYXRlLW5hdi1pdGVtLWFsdFwiLFwiZGF0YVwiOmRhdGEsXCJpbmRlbnRcIjpcIiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIixcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIik7XG59LFwiY29tcGlsZXJcIjpbNyxcIj49IDQuMC4wXCJdLFwibWFpblwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHZhciBzdGFjazEsIGhlbHBlcjtcblxuICByZXR1cm4gXCI8c2VjdGlvbiBjbGFzcz1cXFwiYW1wLXZpZXdlciBhbXAtbW9iaWxlLXZpZXdlciBcIlxuICAgICsgY29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb24oKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy50b3VjaCB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAudG91Y2ggOiBkZXB0aDApKSAhPSBudWxsID8gaGVscGVyIDogaGVscGVycy5oZWxwZXJNaXNzaW5nKSwodHlwZW9mIGhlbHBlciA9PT0gXCJmdW5jdGlvblwiID8gaGVscGVyLmNhbGwoZGVwdGgwLHtcIm5hbWVcIjpcInRvdWNoXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIlxcXCI+XFxuICAgIDxoZWFkZXI+XFxuICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtdG9wbGlua3MtY29udGFpbmVyXFxcIj5cXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtdG9wbGlua3Mtd3JhcHBlclxcXCI+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC10b3BsaW5rcyBhbXAtem9vbS1vdXRcXFwiPlwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtem9vbS1vdXRcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLXpvb20tb3V0XCIsXCJkYXRhXCI6ZGF0YSxcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiPC9kaXY+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC10b3BsaW5rcyBhbXAtem9vbS1pblxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy16b29tLWluXCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy16b29tLWluXCIsXCJkYXRhXCI6ZGF0YSxcImhlbHBlcnNcIjpoZWxwZXJzLFwicGFydGlhbHNcIjpwYXJ0aWFscyxcImRlY29yYXRvcnNcIjpjb250YWluZXIuZGVjb3JhdG9yc30pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiPC9kaXY+XFxuICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICA8L2Rpdj5cXG4gICAgPC9oZWFkZXI+XFxuICAgIDxkaXYgY2xhc3M9XFxcImFtcC1tYWluLWNvbnRhaW5lclxcXCIgPlxcbiAgICAgICAgPHVsIGNsYXNzPVxcXCJhbXAtdmlld2VyLW1haW5cXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuZWFjaC5jYWxsKGRlcHRoMCwoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbXMgOiBkZXB0aDApLHtcIm5hbWVcIjpcImVhY2hcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMSwgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICA8L3VsPlxcbiAgICA8L2Rpdj5cXG5cXG4gICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdi1jb250YWluZXJcXFwiPlxcbiAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdmlnYXRpb24td3JhcHBlclxcXCI+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdmlnYXRpb24tY29udGFpbmVyXFxcIj5cXG4gICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1wcmV2IGFtcC1uYXYtcHJldiBhbXAtbmF2LWJ1dHRvblxcXCI+XFxuICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uLXdyYXBwZXJcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtY2FyZXQtbGVmdFwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtY2FyZXQtbGVmdFwiLFwiZGF0YVwiOmRhdGEsXCJpbmRlbnRcIjpcIiAgICAgICAgICAgICAgICAgICAgIFwiLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdi1saW5rc1xcXCI+XFxuICAgICAgICAgICAgICAgICAgICAgPHVsIGNsYXNzPVxcXCJhbXAtbmF2aWdhdGlvbi1tYWluXFxcIj5cXG5cIlxuICAgICsgKChzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLml0ZW1zIDogZGVwdGgwKSx7XCJuYW1lXCI6XCJlYWNoXCIsXCJoYXNoXCI6e30sXCJmblwiOmNvbnRhaW5lci5wcm9ncmFtKDMsIGRhdGEsIDAsIGJsb2NrUGFyYW1zLCBkZXB0aHMpLFwiaW52ZXJzZVwiOmNvbnRhaW5lci5ub29wLFwiZGF0YVwiOmRhdGF9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgICAgICAgICAgICAgIDwvdWw+XFxuICAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC1uZXh0IGFtcC1uYXYtbmV4dCBhbXAtbmF2LWJ1dHRvblxcXCI+XFxuICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uLXdyYXBwZXJcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtY2FyZXQtcmlnaHRcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLWNhcmV0LXJpZ2h0XCIsXCJkYXRhXCI6ZGF0YSxcImluZGVudFwiOlwiICAgICAgICAgICAgICAgICAgICAgXCIsXCJoZWxwZXJzXCI6aGVscGVycyxcInBhcnRpYWxzXCI6cGFydGlhbHMsXCJkZWNvcmF0b3JzXCI6Y29udGFpbmVyLmRlY29yYXRvcnN9KSkgIT0gbnVsbCA/IHN0YWNrMSA6IFwiXCIpXG4gICAgKyBcIiAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxcbiAgICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgPC9kaXY+XFxuXCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJfdGVtcGxhdGUtcXVpY2tsaW5rc1wiXSxkZXB0aDAse1wibmFtZVwiOlwiX3RlbXBsYXRlLXF1aWNrbGlua3NcIixcImRhdGFcIjpkYXRhLFwiaW5kZW50XCI6XCIgICAgICAgICAgIFwiLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgICAgIDwvZGl2PlxcbiAgICA8L2Rpdj5cXG5cXG48L3NlY3Rpb24+XFxuXCI7XG59LFwidXNlUGFydGlhbFwiOnRydWUsXCJ1c2VEYXRhXCI6dHJ1ZSxcInVzZURlcHRoc1wiOnRydWV9KTtcblxudGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcInRlbXBsYXRlLXF1aWNrdmlld1wiXSA9IEhhbmRsZWJhcnMudGVtcGxhdGUoe1wiMVwiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHJldHVybiBcIiAgICAgICAgICAgICAgICBcIlxuICAgICsgY29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb24oKGhlbHBlcnMucmVuZGVyUGFydGlhbCB8fCAoZGVwdGgwICYmIGRlcHRoMC5yZW5kZXJQYXJ0aWFsKSB8fCBoZWxwZXJzLmhlbHBlck1pc3NpbmcpLmNhbGwoZGVwdGgwLFwiX3RlbXBsYXRlLW1haW4taXRlbVwiLHtcIm5hbWVcIjpcInJlbmRlclBhcnRpYWxcIixcImhhc2hcIjp7XCJwcm9kdWN0TmFtZVwiOihkZXB0aHNbMV0gIT0gbnVsbCA/IGRlcHRoc1sxXS5wcm9kdWN0TmFtZSA6IGRlcHRoc1sxXSksXCJ0ZW1wbGF0ZXNcIjooZGVwdGhzWzFdICE9IG51bGwgPyBkZXB0aHNbMV0udGVtcGxhdGVzIDogZGVwdGhzWzFdKSxcIml0ZW1cIjpkZXB0aDB9LFwiZGF0YVwiOmRhdGF9KSlcbiAgICArIFwiXFxuXCI7XG59LFwiM1wiOmZ1bmN0aW9uKGNvbnRhaW5lcixkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhLGJsb2NrUGFyYW1zLGRlcHRocykge1xuICAgIHJldHVybiBcIiAgICAgICAgICAgICAgICAgICAgICAgIFwiXG4gICAgKyBjb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbigoaGVscGVycy5yZW5kZXJQYXJ0aWFsIHx8IChkZXB0aDAgJiYgZGVwdGgwLnJlbmRlclBhcnRpYWwpIHx8IGhlbHBlcnMuaGVscGVyTWlzc2luZykuY2FsbChkZXB0aDAsXCJfdGVtcGxhdGUtbmF2LWl0ZW1cIix7XCJuYW1lXCI6XCJyZW5kZXJQYXJ0aWFsXCIsXCJoYXNoXCI6e1widGVtcGxhdGVzXCI6KGRlcHRoc1sxXSAhPSBudWxsID8gZGVwdGhzWzFdLnRlbXBsYXRlcyA6IGRlcHRoc1sxXSksXCJpdGVtXCI6ZGVwdGgwfSxcImRhdGFcIjpkYXRhfSkpXG4gICAgKyBcIlxcblwiO1xufSxcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSxibG9ja1BhcmFtcyxkZXB0aHMpIHtcbiAgICB2YXIgc3RhY2sxLCBoZWxwZXIsIGFsaWFzMT1oZWxwZXJzLmhlbHBlck1pc3NpbmcsIGFsaWFzMj1cImZ1bmN0aW9uXCIsIGFsaWFzMz1jb250YWluZXIuZXNjYXBlRXhwcmVzc2lvbjtcblxuICByZXR1cm4gXCI8c2VjdGlvbiBjbGFzcz1cXFwiYW1wLXZpZXdlciBhbXAtcXVpY2t2aWV3LXZpZXdlciBcIlxuICAgICsgYWxpYXMzKCgoaGVscGVyID0gKGhlbHBlciA9IGhlbHBlcnMudG91Y2ggfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnRvdWNoIDogZGVwdGgwKSkgIT0gbnVsbCA/IGhlbHBlciA6IGFsaWFzMSksKHR5cGVvZiBoZWxwZXIgPT09IGFsaWFzMiA/IGhlbHBlci5jYWxsKGRlcHRoMCx7XCJuYW1lXCI6XCJ0b3VjaFwiLFwiaGFzaFwiOnt9LFwiZGF0YVwiOmRhdGF9KSA6IGhlbHBlcikpKVxuICAgICsgXCJcXFwiPlxcbiAgICA8aGVhZGVyPlxcbiAgICAgICAgPGgzPlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5yYW5nZU5hbWUgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLnJhbmdlTmFtZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwicmFuZ2VOYW1lXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIjogXCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnByb2R1Y3ROYW1lIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5wcm9kdWN0TmFtZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwicHJvZHVjdE5hbWVcIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiPC9oMz5cXG4gICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC10b3BsaW5rcy1jb250YWluZXJcXFwiPlxcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XFxcImFtcC10b3BsaW5rcy13cmFwcGVyXFxcIj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXRvcGxpbmtzIGFtcC1jbG9zZSBjbG9zZVxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy1jbG9zZVwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtY2xvc2VcIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXRvcGxpbmtzIGFtcC16b29tLW91dFxcXCI+XCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy16b29tLW91dFwiXSxkZXB0aDAse1wibmFtZVwiOlwiaWNvbnMtem9vbS1vdXRcIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXRvcGxpbmtzIGFtcC16b29tLWluXFxcIj5cIlxuICAgICsgKChzdGFjazEgPSBjb250YWluZXIuaW52b2tlUGFydGlhbChwYXJ0aWFsc1tcImljb25zLXpvb20taW5cIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLXpvb20taW5cIixcImRhdGFcIjpkYXRhLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCI8L2Rpdj5cXG4gICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgIDwvZGl2PlxcbiAgICA8L2hlYWRlcj5cXG4gICAgPGRpdiBjbGFzcz1cXFwiYW1wLW1haW4tY29udGFpbmVyXFxcIiA+XFxuICAgICAgICA8dWwgY2xhc3M9XFxcImFtcC12aWV3ZXItbWFpblxcXCI+XFxuXCJcbiAgICArICgoc3RhY2sxID0gaGVscGVycy5lYWNoLmNhbGwoZGVwdGgwLChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5pdGVtcyA6IGRlcHRoMCkse1wibmFtZVwiOlwiZWFjaFwiLFwiaGFzaFwiOnt9LFwiZm5cIjpjb250YWluZXIucHJvZ3JhbSgxLCBkYXRhLCAwLCBibG9ja1BhcmFtcywgZGVwdGhzKSxcImludmVyc2VcIjpjb250YWluZXIubm9vcCxcImRhdGFcIjpkYXRhfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgICAgIDwvdWw+XFxuICAgIDwvZGl2PlxcblxcbiAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbmF2LWNvbnRhaW5lclxcXCI+XFxuICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtbmF2aWdhdGlvbi13cmFwcGVyXFxcIj5cXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtcHJldiBhbXAtbmF2LXByZXYgYW1wLW5hdi1idXR0b25cXFwiPlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVxcXCJhbXAtc3ZnLWljb24td3JhcHBlclxcXCI+XFxuXCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJpY29ucy1jYXJldC1sZWZ0XCJdLGRlcHRoMCx7XCJuYW1lXCI6XCJpY29ucy1jYXJldC1sZWZ0XCIsXCJkYXRhXCI6ZGF0YSxcImluZGVudFwiOlwiICAgICAgICAgICAgICAgIFwiLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5hdi10aHVtYnNcXFwiPlxcbiAgICAgICAgICAgICAgICA8dWwgY2xhc3M9XFxcImFtcC1uYXZpZ2F0aW9uLW1haW5cXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuZWFjaC5jYWxsKGRlcHRoMCwoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuaXRlbXMgOiBkZXB0aDApLHtcIm5hbWVcIjpcImVhY2hcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMywgZGF0YSwgMCwgYmxvY2tQYXJhbXMsIGRlcHRocyksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiICAgICAgICAgICAgICAgIDwvdWw+XFxuICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLW5leHQgYW1wLW5hdi1uZXh0IGFtcC1uYXYtYnV0dG9uXFxcIj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cXFwiYW1wLXN2Zy1pY29uLXdyYXBwZXJcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGNvbnRhaW5lci5pbnZva2VQYXJ0aWFsKHBhcnRpYWxzW1wiaWNvbnMtY2FyZXQtcmlnaHRcIl0sZGVwdGgwLHtcIm5hbWVcIjpcImljb25zLWNhcmV0LXJpZ2h0XCIsXCJkYXRhXCI6ZGF0YSxcImluZGVudFwiOlwiICAgICAgICAgICAgICAgIFwiLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgPC9kaXY+XFxuXCJcbiAgICArICgoc3RhY2sxID0gY29udGFpbmVyLmludm9rZVBhcnRpYWwocGFydGlhbHNbXCJfdGVtcGxhdGUtcXVpY2tsaW5rc1wiXSxkZXB0aDAse1wibmFtZVwiOlwiX3RlbXBsYXRlLXF1aWNrbGlua3NcIixcImRhdGFcIjpkYXRhLFwiaW5kZW50XCI6XCIgICAgICAgICAgIFwiLFwiaGVscGVyc1wiOmhlbHBlcnMsXCJwYXJ0aWFsc1wiOnBhcnRpYWxzLFwiZGVjb3JhdG9yc1wiOmNvbnRhaW5lci5kZWNvcmF0b3JzfSkpICE9IG51bGwgPyBzdGFjazEgOiBcIlwiKVxuICAgICsgXCIgICAgICAgIDwvZGl2PlxcbiAgICA8L2Rpdj5cXG5cXG48L3NlY3Rpb24+XFxuXCI7XG59LFwidXNlUGFydGlhbFwiOnRydWUsXCJ1c2VEYXRhXCI6dHJ1ZSxcInVzZURlcHRoc1wiOnRydWV9KTtcblxudGhpc1tcImFtcFwiXVtcInRlbXBsYXRlc1wiXVtcImRmc1wiXVtcInRlbXBsYXRlLXJvdW5kZWxzXCJdID0gSGFuZGxlYmFycy50ZW1wbGF0ZSh7XCIxXCI6ZnVuY3Rpb24oY29udGFpbmVyLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgICB2YXIgaGVscGVyLCBhbGlhczE9aGVscGVycy5oZWxwZXJNaXNzaW5nLCBhbGlhczI9XCJmdW5jdGlvblwiLCBhbGlhczM9Y29udGFpbmVyLmVzY2FwZUV4cHJlc3Npb247XG5cbiAgcmV0dXJuIFwiXHQ8ZGl2IGNsYXNzPVxcXCJhbXAtZGZzLXJvdW5kZWwgXCJcbiAgICArIGFsaWFzMygoKGhlbHBlciA9IChoZWxwZXIgPSBoZWxwZXJzLnBvc2l0aW9uIHx8IChkZXB0aDAgIT0gbnVsbCA/IGRlcHRoMC5wb3NpdGlvbiA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwicG9zaXRpb25cIixcImhhc2hcIjp7fSxcImRhdGFcIjpkYXRhfSkgOiBoZWxwZXIpKSlcbiAgICArIFwiIFwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5jbGFzc05hbWUgfHwgKGRlcHRoMCAhPSBudWxsID8gZGVwdGgwLmNsYXNzTmFtZSA6IGRlcHRoMCkpICE9IG51bGwgPyBoZWxwZXIgOiBhbGlhczEpLCh0eXBlb2YgaGVscGVyID09PSBhbGlhczIgPyBoZWxwZXIuY2FsbChkZXB0aDAse1wibmFtZVwiOlwiY2xhc3NOYW1lXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIlxcXCI+XFxuXHRcdDxzcGFuPlwiXG4gICAgKyBhbGlhczMoKChoZWxwZXIgPSAoaGVscGVyID0gaGVscGVycy5kZXNjcmlwdGlvbiB8fCAoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAuZGVzY3JpcHRpb24gOiBkZXB0aDApKSAhPSBudWxsID8gaGVscGVyIDogYWxpYXMxKSwodHlwZW9mIGhlbHBlciA9PT0gYWxpYXMyID8gaGVscGVyLmNhbGwoZGVwdGgwLHtcIm5hbWVcIjpcImRlc2NyaXB0aW9uXCIsXCJoYXNoXCI6e30sXCJkYXRhXCI6ZGF0YX0pIDogaGVscGVyKSkpXG4gICAgKyBcIjwvc3Bhbj5cXG5cdDwvZGl2PlxcblwiO1xufSxcImNvbXBpbGVyXCI6WzcsXCI+PSA0LjAuMFwiXSxcIm1haW5cIjpmdW5jdGlvbihjb250YWluZXIsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICAgIHZhciBzdGFjazE7XG5cbiAgcmV0dXJuIFwiPGRpdiBjbGFzcz1cXFwicm91bmRlbHNcXFwiPlxcblwiXG4gICAgKyAoKHN0YWNrMSA9IGhlbHBlcnMuZWFjaC5jYWxsKGRlcHRoMCwoZGVwdGgwICE9IG51bGwgPyBkZXB0aDAucm91bmRlbHMgOiBkZXB0aDApLHtcIm5hbWVcIjpcImVhY2hcIixcImhhc2hcIjp7fSxcImZuXCI6Y29udGFpbmVyLnByb2dyYW0oMSwgZGF0YSwgMCksXCJpbnZlcnNlXCI6Y29udGFpbmVyLm5vb3AsXCJkYXRhXCI6ZGF0YX0pKSAhPSBudWxsID8gc3RhY2sxIDogXCJcIilcbiAgICArIFwiPC9kaXY+XFxuXFxuXCI7XG59LFwidXNlRGF0YVwiOnRydWV9KTtcblxubW9kdWxlLmV4cG9ydHMgPSB0aGlzW1wiYW1wXCJdW1widGVtcGxhdGVzXCJdW1wiZGZzXCJdOyIsIlwidXNlIHN0cmljdFwiO1xuLyogZ2xvYmFsIGNvbnNvbGUgKi9cbi8qIGpzaGludCAtVzA5NyAqL1xuXG4vLyBzZXQgdXAgc2FmZSBjb25zb2xlXG52YXIgbG9nRm5zID0gWydsb2cnLCAnZXJyb3InLCAnd2FybicsICdpbmZvJ107XG5cbnZhciBsb2cgPSB7XG4gICAgaGlzdG9yeTogW11cbn07XG5cbnZhciBmYWxsYmFjayA9IGZ1bmN0aW9uICgpIHtcbiAgICBsb2cuaGlzdG9yeS5wdXNoKGFyZ3VtZW50cyk7XG59O1xuXG52YXIgaWVMZWdhY3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgRnVuY3Rpb24ucHJvdG90eXBlLmNhbGwuY2FsbChjb25zb2xlLmxvZywgY29uc29sZSwgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSk7XG59O1xuXG52YXIgc3BlY2lhbGl6ZWRGbjtcbnZhciBkZWZhdWx0Rm47XG5cbmZvciAodmFyIGkgPSAwOyBpIDwgbG9nRm5zLmxlbmd0aDsgaSsrKSB7XG5cbiAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBjb25zb2xlLmxvZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgLy8gaWU4ICsgaWU5XG4gICAgICAgIGxvZ1tsb2dGbnNbaV1dID0gaWVMZWdhY3k7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNvbnNvbGUubG9nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHNwZWNpYWxpemVkRm4gPSB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZVtsb2dGbnNbaV1dICYmIHdpbmRvdy5jb25zb2xlW2xvZ0Zuc1tpXV0uYmluZCh3aW5kb3cuY29uc29sZSk7XG4gICAgICAgIGRlZmF1bHRGbiA9IHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyAmJiB3aW5kb3cuY29uc29sZS5sb2cuYmluZCh3aW5kb3cuY29uc29sZSk7XG5cbiAgICAgICAgbG9nW2xvZ0Zuc1tpXV0gPSBzcGVjaWFsaXplZEZuIHx8IGRlZmF1bHRGbiB8fCBmYWxsYmFjaztcbiAgICB9IGVsc2Uge1xuICAgICAgICBsb2dbbG9nRm5zW2ldXSA9IGZhbGxiYWNrO1xuICAgIH1cbn1cblxuLy8gcHV0IHRoaXMgb24gZ2xvYmFsIHNjb3BlIHRvIGFsbG93IGludGVycm9nYXRpb24gb2YgaGlzdG9yeSBmb3IgZmFsbGJhY2tcbndpbmRvdy5hbXBMb2cgPSBsb2c7XG5cbm1vZHVsZS5leHBvcnRzID0gbG9nO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKiBqc2hpbnQgLVcwOTcgKi9cbi8vIHByb3ZpZGVzIHRoZSBuYW1lc3BhY2UgdG8gdXNlIGZvciB0aGlzIGFwcFxuXG52YXIgbmFtZXNwYWNlID0gd2luZG93LmFtcCA9IHdpbmRvdy5hbXAgfHwge307XG5cbm1vZHVsZS5leHBvcnRzID0gbmFtZXNwYWNlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgYW1wID0gcmVxdWlyZSgnLi91dGlscy9uYW1lc3BhY2UnKTtcbnZhciAkID0gcmVxdWlyZSgnLi9jb21tb24vanF1ZXJ5Jyk7XG52YXIgUXVpY2tWaWV3ZXIgPSByZXF1aXJlKCcuL3F1aWNrLXZpZXdlcicpO1xudmFyIERlc2t0b3BWaWV3ZXIgPSByZXF1aXJlKCcuL2Rlc2t0b3Atdmlld2VyJyk7XG52YXIgTW9iaWxlVmlld2VyID0gcmVxdWlyZSgnLi9tb2JpbGUtdmlld2VyJyk7XG52YXIgSW50ZWdyYXRpb25WaWV3ZXIgPSByZXF1aXJlKCcuL2ludGVncmF0aW9uLXZpZXdlci9pbmRleCcpO1xuXG5hbXAuY3JlYXRlVmlld2VyID0gZnVuY3Rpb24gdmlld2VyRmFjdG9yeShjb25maWcpIHtcbiAgICB2YXIgZGVmYXVsdENvbmZpZyA9IHtcbiAgICAgICAgc2VydmVyOiAnLy9pMS5hZGlzLndzJyxcbiAgICAgICAgZXJySW1nTmFtZTogJ2ltZzQwNCcsXG4gICAgICAgIGFjY291bnQ6ICdkZnMnLFxuICAgICAgICBtb2JpbGU6IGZhbHNlLFxuICAgICAgICBxdWlja1ZpZXc6IGZhbHNlLFxuICAgICAgICBkZWJ1ZzogZmFsc2UsXG4gICAgICAgIHJhbmdlTmFtZTogJycsXG4gICAgICAgIHByb2R1Y3ROYW1lOiAnJyxcbiAgICAgICAgcHJlbG9hZFZpZGVvczogJ25vbmUnLCAvLyBvciAnYXV0bycgd2lsbCBwcmVsb2FkIGF0IHBhZ2UgbG9hZFxuICAgICAgICB0ZW1wbGF0ZXM6IHtcbiAgICAgICAgICAgIGltYWdlTWFpbjogJyRwZHAtbWFpbiQnLFxuICAgICAgICAgICAgaW1hZ2VUaHVtYjogJyRwZHAtdGh1bWIkJyxcbiAgICAgICAgICAgIHdpZGVEZXNrdG9wOiB7XG4gICAgICAgICAgICAgICAgaW1hZ2VNYWluOiAnJHBkcC1tYWluLXdpZGUkJyxcbiAgICAgICAgICAgICAgICBpbWFnZVRodW1iOiAnJHBkcC10aHVtYi13aWRlJCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmdWxsU2NyZWVuOiB7XG4gICAgICAgICAgICAgICAgc2NyZWVuV2lkdGggOiB0cnVlLFxuICAgICAgICAgICAgICAgIGltYWdlTWFpbjogJyRwZHAtZnVsbHNjcmVlbiQnLFxuICAgICAgICAgICAgICAgIGltYWdlVGh1bWI6ICckcGRwLXRodW1iJCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBxdWlja1ZpZXc6IHtcbiAgICAgICAgICAgICAgICBpbWFnZU1haW46ICckcGRwLXF1aWNrdmlldyQnLFxuICAgICAgICAgICAgICAgIGltYWdlVGh1bWI6ICckcGRwLXRodW1iJCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtb2JpbGVWaWV3OiB7XG4gICAgICAgICAgICAgICAgaW1hZ2VNYWluOiAnJHBkcC1tb2JpbGUkJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByb3VuZGVsczogW10sXG4gICAgICAgIC8vIGRlZmF1bHRzIGZvciB1aSBoaWRlIGFuZCBmYWRlT3V0IHRpbWVyc1xuICAgICAgICB1aUhpbnRUaW1lcnM6IHtcbiAgICAgICAgICAgIGRpc3BsYXlUaW1lciA6IDMwMDAsXG4gICAgICAgICAgICB0cmFuc2l0aW9uVGltZXIgOiA0MDBcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgbWVyZ2VkQ29uZmlnID0gJC5leHRlbmQodHJ1ZSwge30sIGRlZmF1bHRDb25maWcsIGNvbmZpZyk7XG5cbiAgICBpZiAoY29uZmlnLm1vYmlsZSkge1xuICAgICAgICAvLyBjcmVhdGUgbW9iaWxlIHZpZXdlclxuICAgICAgICByZXR1cm4gbmV3IE1vYmlsZVZpZXdlcihtZXJnZWRDb25maWcpO1xuICAgIH0gZWxzZSBpZiAoY29uZmlnLnF1aWNrVmlldykge1xuICAgICAgICByZXR1cm4gbmV3IFF1aWNrVmlld2VyKG1lcmdlZENvbmZpZyk7XG4gICAgfSBlbHNlIGlmIChjb25maWcuZGVidWcpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBJbnRlZ3JhdGlvblZpZXdlcihtZXJnZWRDb25maWcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXcgRGVza3RvcFZpZXdlcihtZXJnZWRDb25maWcpO1xuICAgIH1cbn07XG4iXX0=
