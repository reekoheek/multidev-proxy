multidev-proxy
==============

Multi development proxy to use inside intranet network, support for Composer, NPM, and Github dist.

# Install

Installation using npm

```bash
npm install -g multidev-proxy
```

# Use

Run on terminal and the proxy will saves cache to $USER_HOME/.multidev-proxy/cache directory.

```bash
multidev-proxy
```

The proxy will run at port 8765 ( http://0.0.0.0:8765 ).

## Use with Composer

Add to composer.json file of project

```json
{   
    "repositories": [
        {
            "type": "composer",
            "url": "http://localhost:8765/local"
        },
        {
            "type": "composer",
            "url": "http://localhost:8765"
        },
        {
            "packagist": false
        }
    ]
}
```

Or add the config to the $USER_HOME/.composer/config.json to use it globally across projects.

## Use with Github

The proxy will be used to download Github dist files. Keep relax and take an ice tea.

## Use with NPM

To use proxy from specific project

```bash
npm --registry http://localhost:8765/registry.npmjs.org install [something]
```

Or, to use proxy globally, you can alter default configuration

```bash
npm config set registry http://localhost:8765/registry.npmjs.org/
```

Enjoy!

