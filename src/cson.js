const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let CSON = null; // defer until used
let JSONC = null; // defer until used

let csonCache = null;

let stats = {
  hits: 0,
  misses: 0
};

const getCachePath = function(cson) {
  const digest = crypto.createHash('sha1').update(cson, 'utf8').digest('hex');
  return path.join(csonCache, `${digest}.json`);
};

const writeCacheFileSync = function(cachePath, object) {
  try {
    return writeFileSync(cachePath, JSON.stringify(object));
  } catch (error) {}
};

const writeCacheFile = (cachePath, object) => writeFile(cachePath, JSON.stringify(object), function() {});

const isFileSync = function(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
};

const writeFileSync = function(filePath, contents, options) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  return fs.writeFileSync(filePath, contents, options);
};

const writeFile = function(filePath, contents, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = undefined;
  }
  fs.mkdir(path.dirname(filePath), {recursive: true}, function(error) {
    if (error) {
      callback(error);
      return;
    }
    fs.writeFile(filePath, contents, options, callback);
  });
};

const parseObject = function(objectPath, contents, options) {
  if (path.extname(objectPath) === '.cson') {
    if (CSON == null) { CSON = require('cson-parser'); }
    try {
      const parsed = CSON.parse(contents, (options != null ? options.allowDuplicateKeys : undefined) === false ? detectDuplicateKeys : undefined);
      stats.misses++;
      return parsed;
    } catch (error) {
      if (isAllCommentsAndWhitespace(contents)) {
        return null;
      } else {
        throw error;
      }
    }
  } else {
    if (JSONC == null) { JSONC = require('jsonc-parser'); }

    const errors = [];
    const parsed = JSONC.parse(contents, errors, {
      allowEmptyContent: true,
      allowTrailingComma: true
    });

    if (errors.length > 0) {
      const parseError = errors[0];
      const prefix = contents.slice(0, parseError.offset);
      const lines = prefix.split('\n');
      const line = lines.length - 1;
      const column = lines[lines.length - 1].length;
      const error = new SyntaxError(
        `Syntax error on line ${line + 1}, column ${column + 1}: ${JSONC.printParseErrorCode(parseError.error)}`
      );
      error.location = {first_line: line, first_column: column};
      throw error;
    }

    if ((options != null ? options.allowDuplicateKeys : undefined) === false) {
      const keySets = [];
      let duplicateKey = null;
      JSONC.visit(contents, {
        onObjectBegin() {
          keySets.push(new Set());
        },
        onObjectProperty(key) {
          const keys = keySets[keySets.length - 1];
          if (keys.has(key)) {
            duplicateKey = key;
          } else {
            keys.add(key);
          }
        },
        onObjectEnd() {
          keySets.pop();
        }
      }, {allowTrailingComma: true});
      if (duplicateKey != null) { throw new Error(`Duplicate key '${duplicateKey}'`); }
    }

    return parsed === undefined ? null : parsed;
  }
};

const parseCacheContents = function(contents) {
  const parsed = JSON.parse(contents);
  stats.hits++;
  return parsed;
};

const parseContentsSync = function(objectPath, cachePath, contents, options) {
  let object;
  try {
    object = parseObject(objectPath, contents, options);
  } catch (parseError) {
    if (parseError.path == null) { parseError.path = objectPath; }
    if (parseError.filename == null) { parseError.filename = objectPath; }
    throw parseError;
  }

  if (cachePath) { writeCacheFileSync(cachePath, object); }
  return object;
};

const isAllCommentsAndWhitespace = function(contents) {
  const lines = contents.split('\n');
  while (lines.length > 0) {
    const line = lines[0].trim();
    if ((line.length === 0) || (line[0] === '#')) {
      lines.shift();
    } else {
      return false;
    }
  }
  return true;
};

const parseContents = function(objectPath, cachePath, contents, options, callback) {
  let object;
  try {
    object = parseObject(objectPath, contents, options);
  } catch (parseError) {
    parseError.path = objectPath;
    if (parseError.filename == null) { parseError.filename = objectPath; }
    parseError.message = `${objectPath}: ${parseError.message}`;
    if (typeof callback === 'function') {
      callback(parseError);
    }
    return;
  }

  if (cachePath) { writeCacheFile(cachePath, object); }
  if (typeof callback === 'function') {
    callback(null, object);
  }
};

module.exports = {
  setCacheDir(cacheDirectory) { return csonCache = cacheDirectory; },

  isObjectPath(objectPath) {
    if (!objectPath) { return false; }

    const extension = path.extname(objectPath);
    return (extension === '.cson') || (extension === '.json') || (extension === '.jsonc');
  },

  resolve(objectPath) {
    if (objectPath == null) { objectPath = ''; }
    if (!objectPath) { return null; }

    if (this.isObjectPath(objectPath) && isFileSync(objectPath)) { return objectPath; }

    const jsonPath = `${objectPath}.json`;
    if (isFileSync(jsonPath)) { return jsonPath; }

    const jsoncPath = `${objectPath}.jsonc`;
    if (isFileSync(jsoncPath)) { return jsoncPath; }

    const csonPath = `${objectPath}.cson`;
    if (isFileSync(csonPath)) { return csonPath; }

    return null;
  },

  readFileSync(objectPath, options) {
    let cachePath;
    if (options == null) { options = {}; }
    const parseOptions =
      {allowDuplicateKeys: options.allowDuplicateKeys};
    delete options.allowDuplicateKeys;

    const fsOptions = Object.assign({encoding: 'utf8'}, options);

    const contents = fs.readFileSync(objectPath, fsOptions);
    if (contents.trim().length === 0) { return null; }
    if (csonCache && (path.extname(objectPath) === '.cson')) {
      cachePath = getCachePath(contents);
      if (isFileSync(cachePath)) {
        try {
          return parseCacheContents(fs.readFileSync(cachePath, 'utf8'));
        } catch (error) {}
      }
    }

    return parseContentsSync(objectPath, cachePath, contents, parseOptions);
  },

  readFile(objectPath, options, callback) {
    if (arguments.length < 3) {
      callback = options;
      options = {};
    }

    const parseOptions =
      {allowDuplicateKeys: options.allowDuplicateKeys};
    delete options.allowDuplicateKeys;

    const fsOptions = Object.assign({encoding: 'utf8'}, options);

    fs.readFile(objectPath, fsOptions, (error, contents) => {
      if (error != null) { return (typeof callback === 'function' ? callback(error) : undefined); }
      if (contents.trim().length === 0) { return (typeof callback === 'function' ? callback(null, null) : undefined); }

      if (csonCache && (path.extname(objectPath) === '.cson')) {
        const cachePath = getCachePath(contents);
        fs.stat(cachePath, function(error, stat) {
          if (stat?.isFile()) {
            fs.readFile(cachePath, 'utf8', function(error, cached) {
              let parsed;
              try {
                parsed = parseCacheContents(cached);
              } catch(err) {
                try {
                  parseContents(objectPath, cachePath, contents, parseOptions, callback);
                } catch(err2) {}
                return;
              }
              return (typeof callback === 'function' ? callback(null, parsed) : undefined);
            });
          } else {
            return parseContents(objectPath, cachePath, contents, parseOptions, callback);
          }
        });
      } else {
        return parseContents(objectPath, null, contents, parseOptions, callback);
      }
    });
  },

  writeFile(objectPath, object, options, callback) {
    let contents;
    if (arguments.length < 4) {
      callback = options;
      options = {};
    }
    if (callback == null) { callback = function() {}; }

    try {
      contents = this.stringifyPath(objectPath, object);
    } catch (error) {
      callback(error);
      return;
    }

    return writeFile(objectPath, `${contents}\n`, options, callback);
  },

  writeFileSync(objectPath, object, options) {
    if (options == null) { options = undefined; }
    return writeFileSync(objectPath, `${this.stringifyPath(objectPath, object)}\n`, options);
  },

  stringifyPath(objectPath, object, visitor, space) {
    if (path.extname(objectPath) === '.cson') {
      return this.stringify(object, visitor, space);
    } else {
      return JSON.stringify(object, undefined, 2);
    }
  },

  stringify(object, visitor, space) {
    if (space == null) { space = 2; }
    if (CSON == null) { CSON = require('cson-parser'); }
    return CSON.stringify(object, visitor, space);
  },

  parse(str, reviver) {
    if (CSON == null) { CSON = require('cson-parser'); }
    return CSON.parse(str, reviver);
  },

  getCacheHits() { return stats.hits; },

  getCacheMisses() { return stats.misses; },

  resetCacheStats() {
    return stats = {
      hits: 0,
      misses: 0
    };
  }
};

const detectDuplicateKeys = function(key, value) {
  if (this.hasOwnProperty(key) && (this[key] !== value)) {
    throw new Error(`Duplicate key '${key}'`);
  } else {
    return value;
  }
};
