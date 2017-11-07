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

