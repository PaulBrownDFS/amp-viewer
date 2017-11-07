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
