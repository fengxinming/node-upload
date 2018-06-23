'use strict';

const EventEmitter = require('events');
const URL = require('url');
const fs = require('fs');
const Path = require('path');
const qs = require('querystring');

const toString = Object.prototype.toString;

const contentTypes = {
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  html: 'text/html; charset=utf-8',
  swf: 'application/x-shockwave-flash; charset=utf-8',
  png: 'image/png; charset=utf-8',
  gif: 'image/gif; charset=utf-8',
  svg: 'text/xml; charset=utf-8',
  ico: 'image/x-icon'
};

function isAsyncFunction(fn) {
  return toString.call(fn) === '[object AsyncFunction]';
}

function convert(asyncFn) {
  return isAsyncFunction(asyncFn) ? (req, res, next) => {
    asyncFn(req, res, err => err ? Promise.reject(err) : Promise.resolve()).then(next).catch(next);
  } : asyncFn;
};

function callNext(req, res, next) {
  return () => {
    return next ? next(req, res) : Promise.resolve();
  }
}

class Router extends EventEmitter {
  constructor() {
    super();
    this.middleware = [];
    ['get', 'post'].forEach((method) => {
      this[method] = function(path, fn) {
        if (typeof path === 'function') {
          fn = path;
          path = '/'
        }
        return this._use(path, method, fn);
      };
    });
    this.callback = this.callback.bind(this);
  }

  use(path, fn) {
    if (typeof path === 'function') {
      fn = path;
      path = '/'
    }
    return this._use(path, null, fn);
  }

  callback(req, res) {
    const urlObject = URL.parse(req.url);
    req.path = urlObject.path;
    req.search = urlObject.search;
    req.query = qs.parse(urlObject.query);
    const first = this.middleware[0];
    first && first(req, res).catch(() => {
      this.emit('error', err, req, res);
    });
  }

  resource(path = process.cwd() + '/public', suffixs = ['.js', '.css', '.swf', '.png', '.gif', '.html', '.ico']) {
    return (req, res, next) => {
      let suffix;
      if (suffixs.some(suf => req.path.endsWith(suffix = suf))) {
        res.statusCode = 200;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'max-age=315360000');
        res.setHeader('Content-Type', contentTypes[suffix.slice(1)]);
        const stream = fs.createReadStream(Path.join(path, req.path));
        stream.on('error', (err) => {
          res.writeHead(err.code === 'ENOENT' ? 404 : 500, {
            'Content-Length': 0
          });
          res.end();
        });
        stream.pipe(res);
      } else if (req.path === '/') {
        res.writeHead(200, {
          'Content-type': contentTypes.html
        });
        fs.createReadStream(Path.join(path, 'index.html')).pipe(res);
        // const buffer = fs.readFileSync(Path.join(path, 'index.html'));
        // res.writeHead(200, {
        //   'Content-type': 'text/html',
        //   'Content-Length': buffer.length
        // });
        // res.end(buffer.toString());
      } else {
        return next();
      }
    }
  }

  _use(path, method, fn) {
    const middleware = this.middleware;
    const len = middleware.length;
    middleware[len] = (req, res) => {
      const next = callNext(req, res, middleware[len + 1]);
      if (path === '/' || path === req.path) {
        if (!method || method === req.method.toLowerCase()) {
          return fn(req, res, next) || Promise.resolve();
        }
      }
      return next();
    };
    return this;
  }
}

module.exports = Router;
