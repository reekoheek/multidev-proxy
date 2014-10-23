var http = require('http'),
    https = require('https'),
    url = require('url'),
    _ = require('lodash'),
    mkdirp = require('mkdirp'),
    Q = require('q'),
    fs = require('fs'),
    path = require('path'),
    request = require('request');

var Github = function(route) {
    var parsed = url.parse(route.url);

    this.options = route;

    this.url = route.url;
    this.cacheDir = route.cacheDir + '/' + parsed.protocol.replace(':', '-') + parsed.hostname;
};

Github.prototype.handle = function(req, res) {
    this.doFetch(req, res);
};

Github.prototype.read = function(stream, dataType) {
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

Github.prototype.writeCache = function(cachePath, readableStream) {
    return Q.nfcall(mkdirp, path.dirname(cachePath)).then(function() {
        var deferred = Q.defer(),
            tmpPath = path.dirname(cachePath) + '/.' + path.basename(cachePath),
            writableStream = fs.createWriteStream(tmpPath);

        writableStream.on('finish', function() {
            fs.rename(tmpPath, cachePath, function(e) {
                if (e) {
                    deferred.reject(e);
                } else {
                    deferred.resolve();
                }
            });
        });

        writableStream.on('error', function() {
            fs.unlinkSync(tmpPath);
            deferred.reject();
        });

        readableStream.on('data', function(chunk) {
            writableStream.write(chunk);
        });

        readableStream.on('end', function() {
            writableStream.end();
        });

        return deferred.promise;
    });
};

Github.prototype.get = function(dataUrl, options) {
    var deferred = Q.defer(),
        that = this,
        parsedUrl = url.parse(dataUrl),
        cachePath = this.cacheDir + parsedUrl.pathname;

    options = _.defaults(options || {}, {dataType: 'stream'});

    fs.exists(cachePath, function(exists) {
        if (exists) {
            that.read(fs.createReadStream(cachePath), options.dataType).then(deferred.resolve, deferred.reject);
        } else {
            var opts = {
                url: dataUrl,
                headers: {
                    'User-Agent': 'reekoheek'
                }
            };

            that.writeCache(cachePath, request(opts)).then(function() {
                that.read(fs.createReadStream(cachePath), options.dataType).then(deferred.resolve, deferred.reject);
            });
        }
    });

    return deferred.promise;
};

Github.prototype.doFetch = function(req, res) {
    var cachePath = this.cacheDir + req.routeUrl,
        getUrl = this.url + req.routeUrl;

    this.get(getUrl).then(function(stream) {
        stream.pipe(res);
    });
};

module.exports = Github;
