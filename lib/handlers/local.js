var fs = require('fs');

var Local = function(route) {
    this.cacheDir = route.cacheDir + '/' + route.name;
};

Local.prototype.handle = function(req, res) {
    var cachePath = this.cacheDir + req.routeUrl;

    if (req.routeUrl === '/download/') {
        this.doDownload(req, res);
        return;
    }

    fs.exists(cachePath, function(exists) {
        if (!exists) {
            if (cachePath.indexOf('/packages.json') !== -1) {
                var packageJson = {
                    "packages":[],
                    "notify":"\/local\/downloads\/%package%",
                    "notify-batch":"\/local\/downloads\/",
                    "providers-url":"\/local\/p\/%package%$%hash%.json",
                    "search":"\/local\/search.json?q=%query%",
                    "providers": {}
                };
                res.end(JSON.stringify(packageJson));
            } else {
                res.writeHead(404);
                res.end();
            }
        } else {
            var readable = fs.createReadStream(cachePath);
            readable.pipe(res);
        }
    });
};

Local.prototype.doDownload = function(req, res) {
    var chunks = [];
    req.on('data', function(chunk) {
        chunks.push(chunk);
    });

    req.on('end', function() {
        var buffer = Buffer.concat(chunks);
        console.log(JSON.parse(buffer));
    });
};

module.exports = Local;
