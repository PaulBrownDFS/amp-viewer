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
