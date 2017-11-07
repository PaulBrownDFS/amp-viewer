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
