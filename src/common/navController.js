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
