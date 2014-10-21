var http = require('http'),
    https = require('https'),
    mkdirp = require('mkdirp'),
    Q = require('q'),
    fs = require('fs'),
    path = require('path');

var ComposerProxy = function(remoteUrl) {
    "use strict";

    this.remoteUrl = remoteUrl;
};

ComposerProxy.prototype.listen = function() {
    "use strict";

    var that = this;
    var server = http.createServer(function(req, res) {
        var url = that.remoteUrl + req.url,
            cachePath = './cache' + req.url;

        console.log(req.method, req.url);

        fs.exists(cachePath, function(exists) {
            if (exists) {
                var rstream = fs.createReadStream(cachePath);
                rstream.pipe(res);
            } else {
                https.get(url, function(rres) {
                    var chunks = [];

                    rres.on('data', function(chunk) {
                        chunks.push(chunk);
                    });

                    rres.on('end', function() {
                        var buffer = Buffer.concat(chunks);

                        Q.nfcall(mkdirp, path.dirname(cachePath)).then(function() {
                            var deferred = Q.defer(),
                                wstream = fs.createWriteStream(cachePath);

                            // if (rres.headers['content-type'] === 'application/json') {
                            //     buffer = JSON.stringify(JSON.parse(buffer.toString()), null, 4);
                            // }

                            wstream.on('finish', function () {
                                deferred.resolve(buffer);
                            });
                            wstream.write(buffer);
                            wstream.end();

                            return deferred.promise;
                        }).then(function(buffer) {
                            res.write(buffer);
                            res.end();
                        });

                    });
                });
            }
        });

    });

    server.listen.apply(server, arguments);
};


var proxy = new ComposerProxy('https://packagist.org');
proxy.listen(8765);