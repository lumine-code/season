var CSON, fs, parser, path, readFile, temp;

path = require('path');

fs = require('fs');

temp = require('./helpers/temp');

CSON = require('../src/cson');

parser = require('cson-parser');

readFile = function(filePath, callback) {
  var done;
  done = jasmine.createSpy('readFile callback');
  expect(CSON.readFile(filePath, done)).toBeUndefined();
  waitsFor(function() {
    return done.calls.count() === 1;
  });
  return runs(function() {
    return callback(...done.calls.argsFor(0));
  });
};

describe("CSON", function() {
  beforeEach(function() {
    CSON.setCacheDir(null);
    return CSON.resetCacheStats();
  });
  describe(".stringify(object)", function() {
    describe("when the object is undefined", function() {
      return it("returns undefined", function() {
        return expect(CSON.stringify(void 0)).toBe(void 0);
      });
    });
    describe("when the object is a function", function() {
      return it("returns undefined", function() {
        return expect(CSON.stringify(function() {
          return 'function';
        })).toBe(void 0);
      });
    });
    describe("when the object contains a function", function() {
      return it("it gets filtered away, when not providing a visitor function", function() {
        return expect(CSON.stringify({
          a: function() {
            return 'function';
          }
        })).toBe('{}');
      });
    });
    describe("when formatting an undefined key", function() {
      return it("does not include the key in the formatted CSON", function() {
        return expect(CSON.stringify({
          b: 1,
          c: void 0
        })).toBe('b: 1');
      });
    });
    describe("when formatting a string", function() {
      it("returns formatted CSON", function() {
        return expect(CSON.stringify({
          a: 'b'
        })).toBe("a: 'b'");
      });
      it("doesn't escape single quotes", function() {
        return expect(CSON.stringify({
          a: "'b'"
        })).toBe(`a: "'b'"`);
      });
      it("escapes double quotes", function() {
        return expect(CSON.stringify({
          a: '"b"'
        })).toBe("a: '\"b\"'");
      });
      it("turns strings with newlines into triple-apostrophe strings", function() {
        return expect(CSON.stringify("a\nb")).toBe(`'''
  a
  b
'''`);
      });
      return it("escapes triple-apostrophes in triple-apostrophe strings", function() {
        return expect(CSON.stringify("a\n'''")).toBe(`'''
  a
  \\\'''
'''`);
      });
    });
    describe("when formatting a boolean", function() {
      return it("returns formatted CSON", function() {
        expect(CSON.stringify(true)).toBe('true');
        expect(CSON.stringify(false)).toBe('false');
        expect(CSON.stringify({
          a: true
        })).toBe('a: true');
        return expect(CSON.stringify({
          a: false
        })).toBe('a: false');
      });
    });
    describe("when formatting a number", function() {
      return it("returns formatted CSON", function() {
        expect(CSON.stringify(54321.012345)).toBe('54321.012345');
        expect(CSON.stringify({
          a: 14
        })).toBe('a: 14');
        return expect(CSON.stringify({
          a: 1.23
        })).toBe('a: 1.23');
      });
    });
    describe("when formatting null", function() {
      return it("returns formatted CSON", function() {
        expect(CSON.stringify(null)).toBe('null');
        return expect(CSON.stringify({
          a: null
        })).toBe('a: null');
      });
    });
    describe("when formatting an array", function() {
      describe("when the array is empty", function() {
        return it("puts the array on a single line", function() {
          return expect(CSON.stringify([])).toBe("[]");
        });
      });
      it("returns formatted CSON", function() {
        expect(CSON.stringify({
          a: ['b']
        })).toBe(`a: [
  'b'
]`);
        return expect(CSON.stringify({
          a: ['b', 4]
        })).toBe(`a: [
  'b'
  4
]`);
      });
      describe("when the array has an undefined value", function() {
        return it("formats the undefined value as null", function() {
          return expect(CSON.stringify(['a', void 0, 'b'])).toBe(`[
  'a'
  null
  'b'
]`);
        });
      });
      return describe("when the array contains an object", function() {
        return it("wraps the object in {}", function() {
          return expect(CSON.stringify([
            {
              a: 'b',
              a1: 'b1'
            },
            {
              c: 'd'
            }
          ])).toBe(`[
  {
    a: 'b'
    a1: 'b1'
  }
  {
    c: 'd'
  }
]`);
        });
      });
    });
    return describe("when formatting an object", function() {
      describe("when the object is empty", function() {
        return it("returns {}", function() {
          return expect(CSON.stringify({})).toBe("{}");
        });
      });
      it("returns formatted CSON", function() {
        expect(CSON.stringify({
          a: {
            b: 'c'
          }
        })).toBe(`a:
  b: 'c'`);
        expect(CSON.stringify({
          a: {}
        })).toBe('a: {}');
        return expect(CSON.stringify({
          a: []
        })).toBe('a: []');
      });
      return it("escapes object keys", function() {
        return expect(CSON.stringify({
          '\\t': 3
        })).toBe("'\\\\t': 3");
      });
    });
  });
  describe("when converting back to an object", function() {
    return it("produces the original object", function() {
      var CSONParser, cson, evaledObject, object;
      object = {
        a: true,
        b: 20,
        c: {
          d: ['a', 'b']
        },
        e: {
          f: true
        }
      };
      cson = CSON.stringify(object);
      CSONParser = require('cson-parser');
      evaledObject = CSONParser.parse(cson);
      return expect(evaledObject).toEqual(object);
    });
  });
  describe('.parse', function() {
    return it('returns the javascript value', function() {
      return expect(CSON.parse('a: "b"')).toEqual({
        a: 'b'
      });
    });
  });
  describe(".isObjectPath(objectPath)", function() {
    return it("returns true if the path has an object extension", function() {
      expect(CSON.isObjectPath('/test2.json')).toBe(true);
      expect(CSON.isObjectPath('/a/b.cson')).toBe(true);
      expect(CSON.isObjectPath()).toBe(false);
      expect(CSON.isObjectPath(null)).toBe(false);
      expect(CSON.isObjectPath('')).toBe(false);
      return expect(CSON.isObjectPath('a/b/c.txt')).toBe(false);
    });
  });
  describe(".resolve(objectPath)", function() {
    return it("returns the path to the object file", function() {
      var file1, file2, file3, folder1, objectDir;
      objectDir = temp.mkdirSync('season-object-dir-');
      file1 = path.join(objectDir, 'file1.json');
      file2 = path.join(objectDir, 'file2.cson');
      file3 = path.join(objectDir, 'file3.json');
      folder1 = path.join(objectDir, 'folder1.json');
      fs.mkdirSync(folder1);
      fs.writeFileSync(file1, '{}');
      fs.writeFileSync(file2, '{}');
      fs.writeFileSync(file3, '{}');
      expect(CSON.resolve(file1)).toBe(file1);
      expect(CSON.resolve(file2)).toBe(file2);
      expect(CSON.resolve(file3)).toBe(file3);
      expect(CSON.resolve(path.join(objectDir, 'file4'))).toBe(null);
      expect(CSON.resolve(folder1)).toBe(null);
      expect(CSON.resolve()).toBe(null);
      expect(CSON.resolve(null)).toBe(null);
      return expect(CSON.resolve('')).toBe(null);
    });
  });
  describe(".writeFile(objectPath, object, callback)", function() {
    var object;
    object = {
      a: 1,
      b: 2
    };
    describe("when called with a .json path", function() {
      return it("writes the object and calls back", function() {
        var callback, jsonPath;
        jsonPath = path.join(temp.mkdirSync('season-object-dir-'), 'file1.json');
        callback = jasmine.createSpy('callback');
        CSON.writeFile(jsonPath, object, callback);
        waitsFor(function() {
          return callback.calls.count() === 1;
        });
        return runs(function() {
          return expect(CSON.readFileSync(jsonPath)).toEqual(object);
        });
      });
    });
    return describe("when called with a .cson path", function() {
      var csonPath;
      csonPath = path.join(temp.mkdirSync('season-object-dir-'), 'file1.cson');
      return it("writes the object and calls back", function() {
        var callback;
        callback = jasmine.createSpy('callback');
        CSON.writeFile(csonPath, object, callback);
        waitsFor(function() {
          return callback.calls.count() === 1;
        });
        return runs(function() {
          return expect(CSON.readFileSync(csonPath)).toEqual(object);
        });
      });
    });
  });
  describe("caching", function() {
    describe("synchronous reads", function() {
      return it("caches the contents of the compiled CSON files", function() {
        var CSONParser, cacheDir, samplePath;
        samplePath = path.join(__dirname, 'fixtures', 'sample.cson');
        cacheDir = temp.mkdirSync('cache-dir');
        CSON.setCacheDir(cacheDir);
        CSON.resetCacheStats();
        CSONParser = require('cson-parser');
        spyOn(CSONParser, 'parse').and.callThrough();
        expect(CSON.getCacheHits()).toBe(0);
        expect(CSON.getCacheMisses()).toBe(0);
        expect(CSON.readFileSync(samplePath)).toEqual({
          a: 1,
          b: {
            c: true
          }
        });
        expect(CSONParser.parse.calls.count()).toBe(1);
        expect(CSON.getCacheHits()).toBe(0);
        expect(CSON.getCacheMisses()).toBe(1);
        CSONParser.parse.calls.reset();
        expect(CSON.readFileSync(samplePath)).toEqual({
          a: 1,
          b: {
            c: true
          }
        });
        expect(CSONParser.parse.calls.count()).toBe(0);
        expect(CSON.getCacheHits()).toBe(1);
        return expect(CSON.getCacheMisses()).toBe(1);
      });
    });
    return describe("asynchronous reads", function() {
      return it("caches the contents of the compiled CSON files", function() {
        var CSONParser, cacheDir, sample, samplePath;
        samplePath = path.join(__dirname, 'fixtures', 'sample.cson');
        cacheDir = temp.mkdirSync('cache-dir');
        CSON.setCacheDir(cacheDir);
        CSON.resetCacheStats();
        CSONParser = require('cson-parser');
        spyOn(CSONParser, 'parse').and.callThrough();
        expect(CSON.getCacheHits()).toBe(0);
        expect(CSON.getCacheMisses()).toBe(0);
        sample = null;
        CSON.readFile(samplePath, function(error, object) {
          return sample = object;
        });
        waitsFor(function() {
          return sample != null;
        });
        runs(function() {
          expect(sample).toEqual({
            a: 1,
            b: {
              c: true
            }
          });
          expect(CSONParser.parse.calls.count()).toBe(1);
          expect(CSON.getCacheHits()).toBe(0);
          expect(CSON.getCacheMisses()).toBe(1);
          CSONParser.parse.calls.reset();
          sample = null;
          return CSON.readFile(samplePath, function(error, object) {
            return sample = object;
          });
        });
        waitsFor(function() {
          return sample != null;
        });
        return runs(function() {
          expect(CSONParser.parse.calls.count()).toBe(0);
          expect(CSON.getCacheHits()).toBe(1);
          return expect(CSON.getCacheMisses()).toBe(1);
        });
      });
    });
  });
  describe("readFileSync", function() {
    it("returns null for files that are all whitespace", function() {
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty.cson'))).toBeNull();
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty.json'))).toBeNull();
      expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty-line.cson'))).toBeNull();
      return expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'empty-line.json'))).toBeNull();
    });
    it("throws errors for invalid .cson files", function() {
      var error, errorPath, parseError;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.cson');
      parseError = null;
      try {
        CSON.readFileSync(errorPath);
      } catch (error1) {
        error = error1;
        parseError = error;
      }
      expect(parseError.path).toBe(errorPath);
      expect(parseError.filename).toBe(errorPath);
      expect(parseError.location.first_line).toBe(0);
      return expect(parseError.location.first_column).toBe(3);
    });
    it("throws errors for invalid .json files", function() {
      var error, errorPath, parseError;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.json');
      parseError = null;
      try {
        CSON.readFileSync(errorPath);
      } catch (error1) {
        error = error1;
        parseError = error;
      }
      expect(parseError.path).toBe(errorPath);
      return expect(parseError.filename).toBe(errorPath);
    });
    it("does not increment the cache stats when .json files are read", function() {
      expect(CSON.getCacheHits()).toBe(0);
      expect(CSON.getCacheMisses()).toBe(0);
      CSON.readFileSync(path.join(__dirname, 'fixtures', 'sample.json'));
      expect(CSON.getCacheHits()).toBe(0);
      return expect(CSON.getCacheMisses()).toBe(0);
    });
    return describe("when the allowDuplicateKeys option is set to false", function() {
      return it("throws errors if objects contain duplicate keys", function() {
        expect(function() {
          return CSON.readFileSync(path.join(__dirname, 'fixtures', 'duplicate-keys.cson'), {
            allowDuplicateKeys: false
          });
        }).toThrowError("Duplicate key 'foo'");
        expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'sample.cson'), {
          allowDuplicateKeys: false
        })).toEqual({
          a: 1,
          b: {
            c: true
          }
        });
        return expect(CSON.readFileSync(path.join(__dirname, 'fixtures', 'duplicate-keys.cson'))).toEqual({
          foo: 3,
          bar: 2
        });
      });
    });
  });
  describe("readFile", function() {
    it("calls back with null for files that are all whitespace", function() {
      var callback;
      callback = function(error, content) {
        expect(error).toBeNull();
        return expect(content).toBeNull();
      };
      readFile(path.join(__dirname, 'fixtures', 'empty.cson'), callback);
      readFile(path.join(__dirname, 'fixtures', 'empty.json'), callback);
      readFile(path.join(__dirname, 'fixtures', 'empty-line.cson'), callback);
      return readFile(path.join(__dirname, 'fixtures', 'empty-line.json'), callback);
    });
    it("calls back with an error for files that do no exist", function() {
      var callback;
      callback = function(error, content) {
        expect(error).not.toBeNull();
        return expect(content).toBeUndefined();
      };
      readFile(path.join(__dirname, 'fixtures', 'this-file-does-not-exist.cson'), callback);
      return readFile(path.join(__dirname, 'fixtures', 'this-file-does-not-exist.json'), callback);
    });
    it("calls back with null for files that are all comments", function() {
      var callback;
      callback = function(error, content) {
        expect(error).toBeNull();
        return expect(content).toBeNull();
      };
      readFile(path.join(__dirname, 'fixtures', 'single-comment.cson'), callback);
      return readFile(path.join(__dirname, 'fixtures', 'multi-comment.cson'), callback);
    });
    it("calls back with an error for invalid files", function() {
      var callback, done;
      done = false;
      callback = function(error, content) {
        done = true;
        expect(error).not.toBeNull();
        expect(error.path).toEqual(path.join(__dirname, 'fixtures', 'invalid.cson'));
        expect(error.message).toContain(path.join(__dirname, 'fixtures', 'invalid.cson'));
        return expect(content).toBeUndefined();
      };
      readFile(path.join(__dirname, 'fixtures', 'invalid.cson'), callback);
      return waitsFor(function() {
        return done;
      });
    });
    it("calls back with location information for .cson files with syntax errors", function() {
      var callback, done, errorPath;
      done = false;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.cson');
      callback = function(parseError, content) {
        done = true;
        expect(parseError.path).toBe(errorPath);
        expect(parseError.filename).toBe(errorPath);
        expect(parseError.location.first_line).toBe(0);
        return expect(parseError.location.first_column).toBe(3);
      };
      readFile(errorPath, callback);
      return waitsFor(function() {
        return done;
      });
    });
    it("calls back with path information for .json files with syntax errors", function() {
      var callback, done, errorPath;
      done = false;
      errorPath = path.join(__dirname, 'fixtures', 'syntax-error.json');
      callback = function(parseError, content) {
        done = true;
        expect(parseError.path).toBe(errorPath);
        return expect(parseError.filename).toBe(errorPath);
      };
      readFile(errorPath, callback);
      return waitsFor(function() {
        return done;
      });
    });
    describe("when the allowDuplicateKeys option is set to false", function() {
      return it("calls back with an error if objects contain duplicate keys", function() {
        var done, fixturePath;
        fixturePath = path.join(__dirname, 'fixtures', 'duplicate-keys.cson');
        done = false;
        runs(function() {
          return CSON.readFile(fixturePath, {
            allowDuplicateKeys: false
          }, function(err, content) {
            expect(err.message).toContain("Duplicate key 'foo'");
            expect(content).toBeUndefined();
            return done = true;
          });
        });
        waitsFor(function() {
          return done;
        });
        runs(function() {
          done = false;
          return CSON.readFile(fixturePath, function(err, content) {
            expect(content).toEqual({
              foo: 3,
              bar: 2
            });
            return done = true;
          });
        });
        return waitsFor(function() {
          return done;
        });
      });
    });
    return describe("when an error is thrown by the callback", function() {
      var uncaughtListeners;
      uncaughtListeners = null;
      beforeEach(function() {
        uncaughtListeners = process.listeners('uncaughtException');
        return process.removeAllListeners('uncaughtException');
      });
      afterEach(function() {
        var i, len, listener, results;
        results = [];
        for (i = 0, len = uncaughtListeners.length; i < len; i++) {
          listener = uncaughtListeners[i];
          results.push(process.on('uncaughtException', listener));
        }
        return results;
      });
      return it("only calls the callback once when it throws an error", function() {
        var callback, called, uncaughtHandler;
        called = 0;
        callback = function() {
          called++;
          throw new Error('called');
        };
        uncaughtHandler = jasmine.createSpy('uncaughtHandler');
        process.once('uncaughtException', uncaughtHandler);
        CSON.readFile(path.join(__dirname, 'fixtures', 'sample.cson'), callback);
        waitsFor(function() {
          return called > 0;
        });
        return runs(function() {
          expect(called).toBe(1);
          return expect(uncaughtHandler.calls.count()).toBe(1);
        });
      });
    });
  });
  return describe("when options are provided for the underlying fs call", function() {
    it("passes options to the readFileSync call", function() {
      spyOn(fs, 'readFileSync').and.returnValue("{}");
      spyOn(parser, 'parse').and.callThrough();
      CSON.readFileSync("/foo/blarg.cson", {
        encoding: 'cuneiform',
        allowDuplicateKeys: false
      });
      expect(fs.readFileSync).toHaveBeenCalledWith("/foo/blarg.cson", {
        encoding: 'cuneiform'
      });
      expect(parser.parse.calls.argsFor(0)[0]).toEqual("{}");
      return expect(typeof parser.parse.calls.argsFor(0)[1]).toEqual("function");
    });
    it("passes options to the readFile call", function() {
      var callback, called, cb;
      called = 0;
      callback = function() {
        return called++;
      };
      spyOn(parser, 'parse').and.callThrough();
      spyOn(fs, 'readFile').and.callFake(function(filePath, fsOptions, callback) {
        expect(filePath).toEqual("/bar/blarg.cson");
        expect(fsOptions).toEqual({
          encoding: 'cuneiform'
        });
        return callback(null, "{}");
      });
      cb = jasmine.createSpy('callback');
      CSON.readFile("/bar/blarg.cson", {
        encoding: 'cuneiform',
        allowDuplicateKeys: false
      }, cb);
      expect(fs.readFile).toHaveBeenCalled();
      expect(parser.parse.calls.argsFor(0)[0]).toEqual("{}");
      expect(typeof parser.parse.calls.argsFor(0)[1]).toEqual("function");
      return expect(cb).toHaveBeenCalledWith(null, {});
    });
    it("passes options to the writeFileSync call", function() {
      var filePath;
      filePath = path.join(temp.mkdirSync('season-options-'), 'stuff.cson');
      spyOn(fs, 'writeFileSync').and.callFake(function(writtenPath, payload, fileOptions) {
        expect(writtenPath).toEqual(filePath);
        return expect(fileOptions).toEqual({
          mode: 0o755
        });
      });
      CSON.writeFileSync(filePath, {
        data: 'yep'
      }, {
        mode: 0o755
      });
      expect(fs.writeFileSync).toHaveBeenCalled();
      return expect(fs.writeFileSync.calls.argsFor(0)[2]).toEqual({
        mode: 0o755
      });
    });
    return it("passes options to the writeFile call", function() {
      var cb, filePath;
      filePath = path.join(temp.mkdirSync('season-options-'), 'stuff.cson');
      spyOn(fs, 'writeFile').and.callFake(function(writtenPath, payload, fileOptions, callback) {
        expect(writtenPath).toEqual(filePath);
        expect(fileOptions).toEqual({
          flag: 'x'
        });
        return callback(null);
      });
      cb = jasmine.createSpy('callback');
      CSON.writeFile(filePath, {}, {
        flag: 'x'
      }, cb);
      waitsFor(function() {
        return fs.writeFile.calls.count() === 1;
      });
      return runs(function() {
        expect(fs.writeFile).toHaveBeenCalled();
        return expect(cb).toHaveBeenCalledWith(null);
      });
    });
  });
});
