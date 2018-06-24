'use strict';

const path = require('path');

const app = {
  port: 3000,
  uploadDir: path.join(__dirname, '../data')
};

module.exports = app;
