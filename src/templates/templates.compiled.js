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
    + ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.program(5, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "                    </div>\n                </li>\n";
},"3":function(container,depth0,helpers,partials,data) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                            <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"5":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                            <img data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"7":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.box : stack1),{"name":"if","hash":{},"fn":container.program(8, data, 0, blockParams, depths),"inverse":container.program(14, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "");
},"8":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "               <ul class=\"amp-box\">\n"
    + ((stack1 = helpers.blockHelperMissing.call(depth0,container.lambda(((stack1 = ((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1)) != null ? stack1.items : stack1), depth0),{"name":"item.set.items","hash":{},"fn":container.program(9, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n";
},"9":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return "                        <li>\n                            <div class=\"amp-image-container\">\n                                <span class=\"amp-centerer\"></span>\n"
    + ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(10, data, 0, blockParams, depths),"inverse":container.program(12, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "                            </div>\n                        </li>\n";
},"10":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                    <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"12":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                    <img data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-main-img\">\n";
},"14":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1),{"name":"if","hash":{},"fn":container.program(15, data, 0, blockParams, depths),"inverse":container.program(21, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "");
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
    + ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(17, data, 0, blockParams, depths),"inverse":container.program(19, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
    + "                                </div>\n                            </li>\n";
},"17":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                        <img data-amp-dimensions='[{\"w\" : {\"domName\" : \"window\", \"domProp\" : \"width\"}}]' data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-zoomable amp-main-img\">\n";
},"19":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=container.escapeExpression;

  return "                                        <img data-amp-src=\""
    + alias1(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(depth0 != null ? depth0 : (container.nullContext || {}),{"name":"src","hash":{},"data":data}) : helper)))
    + "?"
    + alias1(container.lambda(((stack1 = (depths[1] != null ? depths[1].templates : depths[1])) != null ? stack1.imageMain : stack1), depth0))
    + "\" class=\"amp-zoomable amp-main-img\">\n";
},"21":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.media : stack1),{"name":"if","hash":{},"fn":container.program(22, data, 0),"inverse":container.program(25, data, 0),"data":data})) != null ? stack1 : "");
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
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "                                        <source data-quality-label=\""
    + alias4(((helper = (helper = helpers.profileLabel || (depth0 != null ? depth0.profileLabel : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"profileLabel","hash":{},"data":data}) : helper)))
    + "\" data-bitrate=\""
    + alias4(((helper = (helper = helpers.bitrate || (depth0 != null ? depth0.bitrate : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"bitrate","hash":{},"data":data}) : helper)))
    + "\" data-res=\""
    + alias4(((helper = (helper = helpers.profileLabel || (depth0 != null ? depth0.profileLabel : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"profileLabel","hash":{},"data":data}) : helper)))
    + "\" src=\""
    + alias4(((helper = (helper = helpers.src || (depth0 != null ? depth0.src : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"src","hash":{},"data":data}) : helper)))
    + "\" type=\""
    + alias4(((helper = (helper = helpers.htmlCodec || (depth0 != null ? depth0.htmlCodec : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"htmlCodec","hash":{},"data":data}) : helper)))
    + "\">\n";
},"25":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.content : stack1),{"name":"if","hash":{},"fn":container.program(26, data, 0),"inverse":container.program(28, data, 0),"data":data})) != null ? stack1 : "");
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
    + ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.templates : depth0)) != null ? stack1.screenWidth : stack1),{"name":"if","hash":{},"fn":container.program(29, data, 0),"inverse":container.program(31, data, 0),"data":data})) != null ? stack1 : "")
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
    + ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.recliner : stack1),{"name":"if","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.program(7, data, 0, blockParams, depths),"data":data})) != null ? stack1 : "")
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

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.box : stack1),{"name":"if","hash":{},"fn":container.program(4, data, 0),"inverse":container.program(6, data, 0),"data":data})) != null ? stack1 : "");
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

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.set : stack1),{"name":"if","hash":{},"fn":container.program(7, data, 0),"inverse":container.program(9, data, 0),"data":data})) != null ? stack1 : "");
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

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.media : stack1),{"name":"if","hash":{},"fn":container.program(10, data, 0),"inverse":container.program(12, data, 0),"data":data})) != null ? stack1 : "");
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

  return ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.content : stack1),{"name":"if","hash":{},"fn":container.program(13, data, 0),"inverse":container.program(15, data, 0),"data":data})) != null ? stack1 : "");
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
    + ((stack1 = helpers["if"].call(depth0 != null ? depth0 : (container.nullContext || {}),((stack1 = (depth0 != null ? depth0.item : depth0)) != null ? stack1.recliner : stack1),{"name":"if","hash":{},"fn":container.program(1, data, 0),"inverse":container.program(3, data, 0),"data":data})) != null ? stack1 : "")
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
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                        "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-nav-item",{"name":"renderPartial","hash":{"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<section class=\"amp-viewer amp-desktop-viewer "
    + alias4(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header class=\"amp-header\">\n        <div class=\"amp-header-wrapper\">\n            <div class=\"amp-header-product-title\">\n                <h3>"
    + alias4(((helper = (helper = helpers.rangeName || (depth0 != null ? depth0.rangeName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"rangeName","hash":{},"data":data}) : helper)))
    + ": "
    + alias4(((helper = (helper = helpers.productName || (depth0 != null ? depth0.productName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"productName","hash":{},"data":data}) : helper)))
    + "</h3>\n            </div>\n            <div class=\"amp-roundels\"></div>\n        </div>\n    </header>\n\n    <div class=\"amp-main-container\">\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            <div class=\"amp-prev amp-nav-prev amp-nav-button amp-moz-invisible\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n            <div class=\"amp-nav-thumbs\">\n                <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n            </div>\n            <div class=\"amp-next amp-nav-next amp-nav-button amp-moz-invisible\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"            ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-fullscreen"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "               "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                        "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-nav-item",{"name":"renderPartial","hash":{"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<section class=\"amp-viewer amp-fullscreen-viewer "
    + alias4(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header>\n    <h3>"
    + alias4(((helper = (helper = helpers.rangeName || (depth0 != null ? depth0.rangeName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"rangeName","hash":{},"data":data}) : helper)))
    + ": "
    + alias4(((helper = (helper = helpers.productName || (depth0 != null ? depth0.productName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"productName","hash":{},"data":data}) : helper)))
    + "</h3>\n     <div class=\"amp-toplinks-container\">\n            <div class=\"amp-toplinks-wrapper\">\n                <div class=\"amp-toplinks amp-close\">"
    + ((stack1 = container.invokePartial(partials["icons-close"],depth0,{"name":"icons-close","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-out\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-out"],depth0,{"name":"icons-zoom-out","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-in\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n    </header>\n    <div class=\"amp-main-container\">\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            \n            <div class=\"amp-prev amp-nav-prev amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n            <div class=\"amp-nav-thumbs\">\n                <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n            </div>\n            <div class=\"amp-next amp-nav-next amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"            ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-integration"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "    <li class=\"key-value-pair\">\n        <span class=\"key\">"
    + alias4(((helper = (helper = helpers.key || (depth0 != null ? depth0.key : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"key","hash":{},"data":data}) : helper)))
    + "</span>\n        <span class=\"value\"><pre>"
    + alias4(((helper = (helper = helpers.value || (depth0 != null ? depth0.value : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"value","hash":{},"data":data}) : helper)))
    + "</pre></span>\n    </li>\n";
},"3":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "        <li class=\"key-value-pair\">\n            <span class=\"key\">"
    + alias4(((helper = (helper = helpers.key || (depth0 != null ? depth0.key : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"key","hash":{},"data":data}) : helper)))
    + "</span>\n            <span class=\"value\"><pre>"
    + alias4(((helper = (helper = helpers.value || (depth0 != null ? depth0.value : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"value","hash":{},"data":data}) : helper)))
    + "</pre></span>\n        </li>\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1, alias1=depth0 != null ? depth0 : (container.nullContext || {});

  return "<h1>Amplience DFS Viewer</h1>\n\n<h2>Integration Debug View</h2>\n<ul class=\"key-value-pair-list\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.integrationPoints : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</ul>\n\n<h2>Viewer Options</h2>\n<ul class=\"key-value-pair-list\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.viewerOptions : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</ul>\n\n";
},"useData":true});

this["amp"]["templates"]["dfs"]["template-mobile"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data) {
    var stack1;

  return ((stack1 = container.invokePartial(partials["_template-nav-item-alt"],depth0,{"name":"_template-nav-item-alt","data":data,"indent":"                            ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "");
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {});

  return "<section class=\"amp-viewer amp-mobile-viewer "
    + container.escapeExpression(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : helpers.helperMissing),(typeof helper === "function" ? helper.call(alias1,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header>\n        <div class=\"amp-toplinks-container\">\n            <div class=\"amp-toplinks-wrapper\">\n                <div class=\"amp-toplinks amp-zoom-out\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-out"],depth0,{"name":"icons-zoom-out","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-in\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n    </header>\n    <div class=\"amp-main-container\" >\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            <div class=\"amp-navigation-container\">\n                 <div class=\"amp-prev amp-nav-prev amp-nav-button\">\n                     <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                     ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                     </div>\n                 </div>\n                 <div class=\"amp-nav-links\">\n                     <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                     </ul>\n                 </div>\n                 <div class=\"amp-next amp-nav-next amp-nav-button\">\n                     <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                     ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                     </div>\n                 </div>\n            </div>\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"           ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-quickview"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-main-item",{"name":"renderPartial","hash":{"productName":(depths[1] != null ? depths[1].productName : depths[1]),"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"3":function(container,depth0,helpers,partials,data,blockParams,depths) {
    return "                        "
    + container.escapeExpression((helpers.renderPartial || (depth0 && depth0.renderPartial) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"_template-nav-item",{"name":"renderPartial","hash":{"templates":(depths[1] != null ? depths[1].templates : depths[1]),"item":depth0},"data":data}))
    + "\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data,blockParams,depths) {
    var stack1, helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "<section class=\"amp-viewer amp-quickview-viewer "
    + alias4(((helper = (helper = helpers.touch || (depth0 != null ? depth0.touch : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"touch","hash":{},"data":data}) : helper)))
    + "\">\n    <header>\n        <h3>"
    + alias4(((helper = (helper = helpers.rangeName || (depth0 != null ? depth0.rangeName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"rangeName","hash":{},"data":data}) : helper)))
    + ": "
    + alias4(((helper = (helper = helpers.productName || (depth0 != null ? depth0.productName : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"productName","hash":{},"data":data}) : helper)))
    + "</h3>\n        <div class=\"amp-toplinks-container\">\n            <div class=\"amp-toplinks-wrapper\">\n                <div class=\"amp-toplinks amp-close close\">"
    + ((stack1 = container.invokePartial(partials["icons-close"],depth0,{"name":"icons-close","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-out\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-out"],depth0,{"name":"icons-zoom-out","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n                <div class=\"amp-toplinks amp-zoom-in\">"
    + ((stack1 = container.invokePartial(partials["icons-zoom-in"],depth0,{"name":"icons-zoom-in","data":data,"helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "</div>\n            </div>\n        </div>\n    </header>\n    <div class=\"amp-main-container\" >\n        <ul class=\"amp-viewer-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "        </ul>\n    </div>\n\n    <div class=\"amp-nav-container\">\n        <div class=\"amp-navigation-wrapper\">\n            <div class=\"amp-prev amp-nav-prev amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-left"],depth0,{"name":"icons-caret-left","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n            <div class=\"amp-nav-thumbs\">\n                <ul class=\"amp-navigation-main\">\n"
    + ((stack1 = helpers.each.call(alias1,(depth0 != null ? depth0.items : depth0),{"name":"each","hash":{},"fn":container.program(3, data, 0, blockParams, depths),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "                </ul>\n            </div>\n            <div class=\"amp-next amp-nav-next amp-nav-button\">\n                <div class=\"amp-svg-icon-wrapper\">\n"
    + ((stack1 = container.invokePartial(partials["icons-caret-right"],depth0,{"name":"icons-caret-right","data":data,"indent":"                ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "                </div>\n            </div>\n"
    + ((stack1 = container.invokePartial(partials["_template-quicklinks"],depth0,{"name":"_template-quicklinks","data":data,"indent":"           ","helpers":helpers,"partials":partials,"decorators":container.decorators})) != null ? stack1 : "")
    + "        </div>\n    </div>\n\n</section>\n";
},"usePartial":true,"useData":true,"useDepths":true});

this["amp"]["templates"]["dfs"]["template-roundels"] = Handlebars.template({"1":function(container,depth0,helpers,partials,data) {
    var helper, alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3="function", alias4=container.escapeExpression;

  return "	<div class=\"amp-dfs-roundel "
    + alias4(((helper = (helper = helpers.position || (depth0 != null ? depth0.position : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"position","hash":{},"data":data}) : helper)))
    + " "
    + alias4(((helper = (helper = helpers.className || (depth0 != null ? depth0.className : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"className","hash":{},"data":data}) : helper)))
    + "\">\n		<span>"
    + alias4(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : alias2),(typeof helper === alias3 ? helper.call(alias1,{"name":"description","hash":{},"data":data}) : helper)))
    + "</span>\n	</div>\n";
},"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var stack1;

  return "<div class=\"roundels\">\n"
    + ((stack1 = helpers.each.call(depth0 != null ? depth0 : (container.nullContext || {}),(depth0 != null ? depth0.roundels : depth0),{"name":"each","hash":{},"fn":container.program(1, data, 0),"inverse":container.noop,"data":data})) != null ? stack1 : "")
    + "</div>\n\n";
},"useData":true});

module.exports = this["amp"]["templates"]["dfs"];