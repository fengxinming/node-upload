'use strict';

const http = require('http');
const os = require('os');
const fs = require('fs');
const Path = require('path');
const conf = require('./conf/server');
const Router = require('./lib/router');
const formidable = require('./lib/formidable');

const router = new Router();
router.use(router.resource());
router.post('/upload', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const contentType = req.headers['content-type'];
  if (contentType.indexOf('multipart/form-data')) {
    res.statusCode = 405;
    res.end(JSON.stringify({
      message: '不允许上传'
    }), 'utf8');
    return;
  }
  const form = new formidable.IncomingForm();
  const files = [];
  const fields = [];

  const uploadDir = conf.uploadDir;
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  form.uploadDir = uploadDir;
  form
    .on('field', function(field, value) {
      fields.push([field, value]);
    })
    .on('file', function(field, file) {
      files.push([field, file]);
    })
    .on('end', function() {
      files.forEach((file) => {
        file = file[1];
        const pobj = Path.parse(file.path);
        fs.renameSync(file.path, Path.join(pobj.dir, file.name));
      });
      res.statusCode = 200;
      res.end(JSON.stringify({
        message: '上传成功'
      }), 'utf8');
    })
    .parse(req);
});

const server = http.createServer(router.callback);
server.listen(conf.port);
server.on('listening', () => {
  console.log(`The server is running at port ${conf.port}`);
});
