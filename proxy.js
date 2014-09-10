var http = require('http'),
    https = require('https'),
    mkdirp = require('mkdirp'),
    Q = require('q'),
    fs = require('fs'),
    zlib = require('zlib'),
    qs = require('querystring');

var doServe = function() {
    var server = http.createServer(doHandle);

    server.listen(3000);

};

var doHandle = function(req, res) {

    var reqBody = '';

    req.on('data', function (data) {
        reqBody += data;

        // Too much POST data, kill the connection!
        if (reqBody.length > 1e6)
            req.connection.destroy();
    });

    req.on('end', function () {
        req.body = reqBody;

        doProcess(req, res);
    });
};


var doProcess = function(req, res) {
    var cacheName = req.url.substr(1).replace(/\//g, '--');

    var headers = {};
    for(var i in req.headers) {
        if (i === 'host') continue;
        headers[i] = req.headers[i];
    }

    req.normalizedHeaders = headers;
    req.cacheName = cacheName;

    fs.exists('./cache/body/' + cacheName, function(exists) {
        if (exists && req.method !== 'POST') {
            doHandleCache(req, res);
        } else {
            doHandleRemote(req, res);
        }
    });
};

var doHandleCache = function(req, res) {
    var cacheName = req.cacheName;

    console.log('HIT', req.method, req.url);

    Q.nfcall(fs.readFile, './cache/headers/' + cacheName, 'utf8').then(function(lines) {
        var cacheHeaders = JSON.parse(lines);
        var raw = fs.createReadStream('./cache/body/' + cacheName);

        res.writeHead(200, cacheHeaders);
        raw.pipe(res);
    });
};

var doHandleRemote = function(req, res) {
    var cacheName = req.cacheName;

    console.log('MISS', req.method, req.url);

    var options = {
        hostname: 'packagist.org',
        method: req.method,
        path: req.url,
        headers : req.normalizedHeaders
    };

    var cReq = https.request(options, function(resp) {

        var headers = {};

        for(var i in resp.headers) {
            if (i === 'accept-ranges' ||
                i === 'connection' ||
                i === 'content-length') continue;
            headers[i] = resp.headers[i];
        }

        var chunks = [];

        var promise;

        if (req.method === 'POST') {
            var d = Q.defer();
            d.resolve();
            promise = d.promise;
        } else {
            promise = Q.nfcall(fs.writeFile, './cache/headers/' + cacheName, JSON.stringify(headers));
        }

        promise.then(function() {
            // console.log('start');
            res.writeHead(resp.statusCode, headers);

            resp.on('data', function(chunk) {
                // console.log('chunking');
                chunks.push(chunk);
            });

            resp.on('end', function() {
                var buffer = Buffer.concat(chunks);

                if (req.method === 'POST') {
                    res.end(buffer);
                } else {
                    var wstream = fs.createWriteStream('./cache/body/' + cacheName);
                    wstream.on('finish', function () {
                        // console.log('written');
                        res.end(buffer);
                    });
                    wstream.write(buffer);
                    wstream.end();
                }
            });
        }).fail(function(e) {
            console.error(e.stack);
        });


    });


    cReq.on('error', function(e) {
        console.log('E', arguments);
    });

    if (req.method === 'POST') {
        cReq.write(req.body);
    }
    cReq.end();
};

Q.nfcall(mkdirp, './cache/headers').then(function() {
    return Q.nfcall(mkdirp, './cache/body');
}).then(doServe);

