'use strict';
var loaderUtils = require('loader-utils');
var favicons = require('favicons/es5');
var path = require('path');
var faviconPersitenceCache = require('./cache');

module.exports = function (content) {
  var self = this;
  self.cacheable && this.cacheable();
  if (!self.emitFile) throw new Error('emitFile is required from module system');
  if (!self.async) throw new Error('async is required');

  var callback = self.async();
  var query = loaderUtils.parseQuery(self.query);
  var pathPrefix = loaderUtils.interpolateName(self, query.outputFilePrefix, {
    context: query.context || this.options.context,
    content: content,
    regExp: query.regExp
  });
  var fileHash = loaderUtils.interpolateName(self, '[hash]', {
    context: query.context || this.options.context,
    content: content,
    regExp: query.regExp
  });
  var cacheFile = pathPrefix + '.cache';
  faviconPersitenceCache.loadIconsFromDiskCache(self, query, cacheFile, fileHash, function (err, cachedResult) {
    if (err) return callback(err);
    if (cachedResult) {
      return callback(null, 'module.exports = ' + JSON.stringify(cachedResult));
    }
    // Generate icons
    generateIcons(self, content, pathPrefix, query, function (err, iconResult) {
      if (err) return callback(err);
      faviconPersitenceCache.emitCacheInformationFile(self, query, cacheFile, fileHash, iconResult);
      callback(null, 'module.exports = ' + JSON.stringify(iconResult));
    });
  });
};

function getPublicPath (compilation) {
  var publicPath = compilation.outputOptions.publicPath || '';
  if (publicPath.length && publicPath.substr(-1) !== '/') {
    publicPath += '/';
  }
  return publicPath;
}

function generateIcons (loader, imageFileStream, pathPrefix, query, callback) {
  var publicPath = getPublicPath(loader._compilation);

  var allowedKeys = [
    'appName',
    'appDescription',
    'developerName',
    'developerURL',
    'background',
    'theme_color',
    'path',
    'display',
    'orientation',
    'start_url',
    'version',
    'online',
    'logging',
    'preferOnline',
    'icons',
  ];
  var faviconOpts = {};
  for (var i = 0; i < allowedKeys.length; i = i + 1) {
    faviconOpts[allowedKeys[i]] = query[allowedKeys[i]];
  }
  favicons(imageFileStream, faviconOpts, function (err, result) {
    if (err) return callback(err);
    var html = result.html.map(function (entry) {
      if (!path.extname(entry)) {
        return entry;
      }
      var pattern = entry.indexOf('href') !== -1 ? /(href=[""])/g : /(content=[""])/g;
      return entry.replace(pattern, '$1' + publicPath + pathPrefix);
    });
    var loaderResult = {
      outputFilePrefix: pathPrefix,
      html: html,
      files: []
    };
    result.images.forEach(function (image) {
      loaderResult.files.push(pathPrefix + image.name);
      loader.emitFile(pathPrefix + image.name, image.contents);
    });
    result.files.forEach(function (file) {
      loaderResult.files.push(pathPrefix + file.name);
      loader.emitFile(pathPrefix + file.name, file.contents);
    });
    callback(null, loaderResult);
  });
}

module.exports.raw = true;
