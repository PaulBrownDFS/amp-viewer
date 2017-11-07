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
