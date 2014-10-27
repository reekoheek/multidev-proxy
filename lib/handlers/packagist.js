var http = require('http'),
    https = require('https'),
    url = require('url'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    Q = require('q'),
    fs = require('fs'),
    request = require('request'),
    path = require('path'),
    glob = require('glob');

var Packagist = function(route) {
    var parsed = url.parse(route.url);

    this.options = route;

    this.url = route.url;
    this.cacheDir = route.cacheDir + '/' + parsed.protocol.replace(':', '-') + parsed.hostname;
};

Packagist.prototype.handle = function(req, res) {
    switch (req.routeUrl) {
        case '/downloads/':
            this.doDownload(req, res);
            break;
        default:
            this.doFetch(req, res);
            break;
    }
};

Packagist.prototype.read = function(stream, dataType) {

    var deferred = Q.defer();

    try {
        dataType = dataType || 'stream';

        if (dataType === 'stream') {
            deferred.resolve(stream);
        } else {
            var chunks = [];
            stream.on('data', function(chunk) {
                chunks.push(chunk);
            });

            stream.on('end', function() {
                var buffer = Buffer.concat(chunks);

                switch (dataType) {
                    case 'buffer':
                        deferred.resolve(buffer);
                        break;
                    case 'json':
                        var data = null;
                        try {
                            data = JSON.parse(buffer.toString());
                        } catch(e) {
                            console.error('[json parse error]');
                            console.trace(e);
                        }
                        deferred.resolve(data);
                        break;
                    default:
                        deferred.resolve(buffer.toString());
                        break;
                }
            });
        }
    } catch(e) {
        deferred.reject(e);
    }

    return deferred.promise;
};

Packagist.prototype.writeCache = function(cachePath, readableStream) {
    return Q.nfcall(mkdirp, path.dirname(cachePath)).then(function() {
        var deferred = Q.defer(),
            tmpPath = path.dirname(cachePath) + '/.' + path.basename(cachePath),
            writableStream,
            chunks = [];

        _.forEach(glob.sync(cachePath.split('$')[0] + '$*'), function(p) {
            fs.unlinkSync(p);
        });

        writableStream = fs.createWriteStream(tmpPath);

        writableStream.on('finish', function() {
            try {
                var data = JSON.parse(Buffer.concat(chunks));

                fs.rename(tmpPath, cachePath, function(e) {
                    if (e) {
                        deferred.reject(e);
                    } else {
                        deferred.resolve();
                    }
                });
            } catch(e) {
                console.error('[json parse error]');
                console.trace(e);
                deferred.reject(e);
            }
        });

        writableStream.on('error', function() {
            fs.unlinkSync(tmpPath);
            deferred.reject();
        });

        readableStream.on('data', function(chunk) {
            chunks.push(chunk);
            writableStream.write(chunk);
        });

        readableStream.on('end', function() {
            writableStream.end();
        });

        return deferred.promise;
    });
};

Packagist.prototype.get = function(dataUrl, options) {
    var deferred = Q.defer(),
        that = this,
        parsedUrl = url.parse(dataUrl),
        cachePath = this.cacheDir + parsedUrl.pathname;

    options = _.defaults(options || {}, {dataType: 'stream'});

    var afterRead = function(data) {
        if (that.options.onRead && typeof that.options.onRead === 'function') {
            Q.all([that.options.onRead(cachePath)]).then(function() {
                deferred.resolve(data);
            });
        } else {
            deferred.resolve(data);
        }
    };

    fs.exists(cachePath, function(exists) {
        if (exists) {
            that.read(fs.createReadStream(cachePath), options.dataType).then(afterRead, deferred.reject);
        } else {
            that.writeCache(cachePath, request(dataUrl)).then(function() {
                that.read(fs.createReadStream(cachePath), options.dataType).then(afterRead, deferred.reject);
            }, deferred.reject);
        }
    });

    var h = (dataUrl.split(':')[0] === 'https') ? https : http;

    return deferred.promise;
};

Packagist.prototype.doDownload = function(req, res) {
    var chunks = [];
    req.on('data', function(chunk) {
        chunks.push(chunk);
    });

    req.on('end', function() {
        var buffer = Buffer.concat(chunks);
        console.log(JSON.parse(buffer));
    });
};

Packagist.prototype.doFetch = function(req, res) {
    var cachePath = this.cacheDir + req.routeUrl,
        getUrl = this.url + req.routeUrl;

    this.get(getUrl).then(function(stream) {
        // console.log(stream);
        stream.pipe(res);
    }, function(e) {
        res.writeHead(505, e.toString());
        res.end();
    });
};

module.exports = Packagist;