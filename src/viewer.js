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
