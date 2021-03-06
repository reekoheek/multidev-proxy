var fs = require('fs');

var Local = function(route) {
    this.name = route.name || 'local';
    this.cacheDir = route.cacheDir + '/' + route.name;
};

Local.prototype.handle = function(req, res) {
    var cachePath = this.cacheDir + req.routeUrl,
        that = this;

    if (req.routeUrl === '/download/') {
        this.doDownload(req, res);
        return;
    }

    fs.exists(cachePath, function(exists) {
        if (!exists) {
            if (cachePath.indexOf('/packages.json') !== -1) {
                var packageJson = {
                    "packages":[],
                    "notify":"\/" + that.name + "\/downloads\/%package%",
                    "notify-batch":"\/" + that.name + "\/downloads\/",
                    "providers-url":"\/" + that.name + "\/p\/%package%$%hash%.json",
                    "search":"\/" + that.name + "\/search.json?q=%query%",
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
