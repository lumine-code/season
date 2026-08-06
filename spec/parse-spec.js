const path = require("path");

const parse = require("../src/parse");

describe("CSON parse", function () {
  describe("string literals", function () {
    it("decodes double-quoted escape sequences", function () {
      expect(parse('a: "x\\ny"')).toEqual({ a: "x\ny" });
      expect(parse('a: "tab\\there"')).toEqual({ a: "tab\there" });
      expect(parse('a: "\\r\\b\\f\\v\\0"')).toEqual({ a: "\r\b\f\v\0" });
      expect(parse('a: "back\\\\slash"')).toEqual({ a: "back\\slash" });
      expect(parse('a: "quote\\"inside"')).toEqual({ a: 'quote"inside' });
    });

    it("decodes single-quoted strings", function () {
      expect(parse("a: 'plain'")).toEqual({ a: "plain" });
      expect(parse("a: 'it\\'s'")).toEqual({ a: "it's" });
    });

    it("decodes hexadecimal and Unicode escapes", function () {
      expect(parse('a: "\\x41"')).toEqual({ a: "A" });
      expect(parse('a: "\\u00e9"')).toEqual({ a: "\u00e9" });
      expect(parse('a: "\\u{1F600}"')).toEqual({ a: "\u{1F600}" });
    });

    it("treats unknown escapes as the escaped character", function () {
      expect(parse('a: "\\q"')).toEqual({ a: "q" });
      expect(parse('a: "\\ "')).toEqual({ a: " " });
    });

    it("decodes heredocs into multi-line strings", function () {
      expect(parse('a: """\n  multi\n  line\n"""')).toEqual({ a: "multi\nline" });
      expect(parse("a: '''\n  multi\n  line\n'''")).toEqual({ a: "multi\nline" });
    });

    it("decodes quoted keys", function () {
      expect(parse("'a b': 1")).toEqual({ "a b": 1 });
      expect(parse('"a\\nb": 1')).toEqual({ "a\nb": 1 });
    });

    it("rejects interpolation", function () {
      expect(function () {
        parse('a: "x#{1}"');
      }).toThrowError(SyntaxError);
    });
  });

  describe("regular expression literals", function () {
    it("decodes patterns and flags", function () {
      expect(parse("a: /ab+c/gi")).toEqual({ a: /ab+c/gi });
      expect(parse("a: /ab\\/c/")).toEqual({ a: /ab\/c/ });
    });

    it("decodes heregexes", function () {
      expect(parse("a: /// ab c ///i")).toEqual({ a: /abc/i });
    });
  });

  describe("other values", function () {
    it("parses numbers, booleans, null, and expressions", function () {
      expect(parse("a: 0x10")).toEqual({ a: 16 });
      expect(parse("a: 1 + 2")).toEqual({ a: 3 });
      expect(parse("a: true\nb: null")).toEqual({ a: true, b: null });
    });

    it("parses nested objects and arrays", function () {
      expect(parse('a:\n  b: [1, 2]\n  c:\n    d: "e"')).toEqual({
        a: { b: [1, 2], c: { d: "e" } },
      });
    });

    it("ignores standalone comments", function () {
      expect(parse("# leading\na: 1")).toEqual({ a: 1 });
      expect(parse("###\nblock\n###\na: 1")).toEqual({ a: 1 });
      expect(parse("a: 1\n# mid\nb: 2")).toEqual({ a: 1, b: 2 });
      expect(parse("a: [\n  1\n  # between items\n  2\n]")).toEqual({ a: [1, 2] });
      expect(function () {
        parse("# only a comment");
      }).toThrowError(SyntaxError);
    });
  });

  describe("module loading", function () {
    it("never loads the coffeescript package entry, its repl, or cson-parser", function () {
      parse('a: "b"');
      const packageMain = path.join("coffeescript", "lib", "coffeescript", "index.js");
      const repl = path.join("coffeescript", "lib", "coffeescript", "repl.js");
      const csonParser = path.join("node_modules", "cson-parser");
      const offenders = Object.keys(require.cache).filter(function (file) {
        return file.endsWith(packageMain) || file.endsWith(repl) || file.includes(csonParser);
      });
      expect(offenders).toEqual([]);
    });
  });
});
