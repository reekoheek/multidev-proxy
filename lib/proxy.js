var http = require('http'),
    https = require('https'),
    url = require('url'),
    _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    Q = require('q'),
    sha256 = require('sha256'),
    mkdirp = require('mkdirp');

var HOME_DIR = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

var ComposerProxy = function(options) {
    "use strict";

    var cacheDir = HOME_DIR + '/.multidev-proxy/cache';
    mkdirp.sync(cacheDir);

    this.routes = options.routes || {};
    _.forEach(this.routes, function(route) {
        if (typeof route.handler === 'string') {
            route.cacheDir = cacheDir;
            var Handler = require(route.handler);
            route.handler = new Handler(route);
        }
    });
};

ComposerProxy.prototype.listen = function() {
    "use strict";

    var that = this;
    var server = this.server = http.createServer(function(req, res) {
        console.log(req.method, req.url);

        for(var i in that.routes) {
            var route = that.routes[i],
                matches = req.url.match(route.matcher);

            if (matches) {
                req.route = route;
                req.routeUrl = matches[1];

                route.handler.handle(req, res);
                break;
            }
        }
    });

    server.listen.apply(server, arguments);
};

module.exports = ComposerProxy;
