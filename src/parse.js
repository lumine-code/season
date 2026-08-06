/*
 * Copyright (c) 2014, Groupon, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of GROUPON nor the names of its contributors may be
 * used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
 * IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
 * TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 * PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

// Vendored from cson-parser@4.0.9 with two changes: string and regex
// literals are decoded in plain JavaScript instead of being evaluated with
// the vm module, which Electron deprecates in renderer processes, and the
// node transforms understand coffeescript 2 (upstream ran on a nested
// coffeescript 1). The compiler is loaded through its core module because
// the coffeescript package entry point also requires vm eagerly.
const { nodes } = require("coffeescript/lib/coffeescript/coffeescript");

function defaultReviver(key, value) {
  return value;
}

function getFunctionNameIE(fn) {
  return fn.toString().match(/^function\s*([^( ]+)/)[1];
}

function nodeTypeString(csNode) {
  const ref = csNode.constructor.name;
  return ref != null ? ref : getFunctionNameIE(csNode.constructor);
}

function syntaxErrorMessage(csNode, msg) {
  const ref = csNode.locationData;
  const lineIdx = ref.first_line;
  const columnIdx = ref.first_column;
  let line = "";
  let column = "";
  if (lineIdx != null) {
    line = lineIdx + 1;
  }
  if (columnIdx != null) {
    column = columnIdx + 1;
  }
  return `Syntax error on line ${line}, column ${column}: ${msg}`;
}

const stringEscapes = {
  0: "\0",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

// The literal is a valid JavaScript literal by the time it gets here: the
// coffeescript lexer normalizes heredocs and multi-line strings into
// single-line quoted form and rejects malformed escapes on its own.
function parseStringLiteral(literal) {
  const quote = literal.charAt(0);
  if (
    literal.length < 2 ||
    (quote !== "'" && quote !== '"') ||
    literal.charAt(literal.length - 1) !== quote
  ) {
    throw new SyntaxError(`Invalid string literal: ${literal}`);
  }
  const body = literal.slice(1, -1);
  let result = "";
  let i = 0;
  while (i < body.length) {
    const char = body.charAt(i);
    i += 1;
    if (char !== "\\") {
      result += char;
      continue;
    }
    const next = body.charAt(i);
    i += 1;
    if (next === "") {
      throw new SyntaxError(`Invalid string literal: ${literal}`);
    } else if (next === "x" || next === "u") {
      if (next === "u" && body.charAt(i) === "{") {
        const end = body.indexOf("}", i + 1);
        const hex = end === -1 ? "" : body.slice(i + 1, end);
        if (!/^[0-9a-fA-F]+$/.test(hex)) {
          throw new SyntaxError(`Invalid Unicode escape: ${literal}`);
        }
        i = end + 1;
        result += String.fromCodePoint(parseInt(hex, 16));
      } else {
        const width = next === "x" ? 2 : 4;
        const hex = body.slice(i, i + width);
        if (hex.length !== width || !/^[0-9a-fA-F]+$/.test(hex)) {
          throw new SyntaxError(`Invalid ${next} escape: ${literal}`);
        }
        i += width;
        result += String.fromCharCode(parseInt(hex, 16));
      }
    } else if (Object.prototype.hasOwnProperty.call(stringEscapes, next)) {
      result += stringEscapes[next];
    } else if (next === "\r") {
      // A backslash before a line terminator is a line continuation; \r\n
      // counts as one terminator.
      if (body.charAt(i) === "\n") {
        i += 1;
      }
    } else if (next !== "\n" && next !== "\u2028" && next !== "\u2029") {
      result += next;
    }
  }
  return result;
}

function parseRegExpLiteral(literal) {
  const lastSlash = literal.lastIndexOf("/");
  if (literal.charAt(0) !== "/" || lastSlash < 1) {
    throw new SyntaxError(`Invalid regular expression literal: ${literal}`);
  }
  return new RegExp(literal.slice(1, lastSlash), literal.slice(lastSlash + 1));
}

function transformKey(csNode) {
  const type = nodeTypeString(csNode);
  if (type !== "Value") {
    throw new SyntaxError(syntaxErrorMessage(csNode, `${type} used as key`));
  }
  const value = csNode.base.value;
  switch (value.charAt(0)) {
    case "'":
    case '"':
      return parseStringLiteral(value);
    default:
      return value;
  }
}

// coffeescript 2 represents a standalone comment as an empty
// PassthroughLiteral expression; coffeescript 1 dropped comments from the
// AST, so they must not count as values here either.
function withoutComments(expressions) {
  return (expressions || []).filter(function (expression) {
    return !(
      expression.constructor.name === "Value" &&
      expression.base != null &&
      expression.base.constructor.name === "PassthroughLiteral" &&
      expression.base.value === ""
    );
  });
}

const nodeTransforms = {
  // coffeescript 2 wraps the program in a Root node; upstream cson-parser
  // was written against coffeescript 1, where nodes() returned the Block.
  Root: function Root(node, transformNode) {
    return transformNode(node.body);
  },
  Block: function Block(node, transformNode) {
    const expressions = withoutComments(node.expressions);
    if (expressions.length !== 1) {
      throw new SyntaxError(syntaxErrorMessage(node, "One top level value expected"));
    }
    return transformNode(expressions[0]);
  },
  Value: function Value(node, transformNode) {
    return transformNode(node.base);
  },
  Bool: function Bool(node) {
    return node.val === "true";
  },
  BooleanLiteral: function BooleanLiteral(node) {
    return node.value === "true";
  },
  Null: function Null() {
    return null;
  },
  NullLiteral: function NullLiteral() {
    return null;
  },
  Literal: function Literal(node) {
    const value = node.value;
    try {
      switch (value.charAt(0)) {
        case "'":
        case '"':
          return parseStringLiteral(value);
        case "/":
          return parseRegExpLiteral(value);
        default:
          return JSON.parse(value);
      }
    } catch (error) {
      throw new SyntaxError(syntaxErrorMessage(node, error.message), { cause: error });
    }
  },
  NumberLiteral: function NumberLiteral(node) {
    return Number(node.value);
  },
  StringLiteral: function StringLiteral(node) {
    return parseStringLiteral(node.value);
  },
  RegexLiteral: function RegexLiteral(node) {
    return parseRegExpLiteral(node.value);
  },
  Arr: function Arr(node, transformNode) {
    return withoutComments(node.objects).map(transformNode);
  },
  Obj: function Obj(node, transformNode, reviver) {
    return node.properties.reduce((outObject, property) => {
      const variable = property.variable;
      let value = property.value;
      if (!variable) {
        return outObject;
      }
      const keyName = transformKey(variable);
      value = transformNode(value);
      outObject[keyName] = reviver.call(outObject, keyName, value);
      return outObject;
    }, {});
  },
  Op: function Op(node, transformNode) {
    if (node.second != null) {
      const left = transformNode(node.first);
      const right = transformNode(node.second);
      switch (node.operator) {
        case "-":
          return left - right;
        case "+":
          return left + right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "%":
          return left % right;
        case "&":
          return left & right;
        case "|":
          return left | right;
        case "^":
          return left ^ right;
        case "<<":
          return left << right;
        case ">>>":
          return left >>> right;
        case ">>":
          return left >> right;
        default:
          throw new SyntaxError(
            syntaxErrorMessage(node, `Unknown binary operator ${node.operator}`),
          );
      }
    } else {
      switch (node.operator) {
        case "-":
          return -transformNode(node.first);
        case "~":
          return ~transformNode(node.first);
        default:
          throw new SyntaxError(
            syntaxErrorMessage(node, `Unknown unary operator ${node.operator}`),
          );
      }
    }
  },
  Parens: function Parens(node, transformNode) {
    const expressions = withoutComments(node.body.expressions);
    if (expressions.length !== 1) {
      throw new SyntaxError(
        syntaxErrorMessage(node, "Parenthesis may only contain one expression"),
      );
    }
    return transformNode(expressions[0]);
  },
};

function parse(source, reviver) {
  if (reviver == null) {
    reviver = defaultReviver;
  }
  function transformNode(csNode) {
    const type = nodeTypeString(csNode);
    const transform = nodeTransforms[type];
    if (!transform) {
      throw new SyntaxError(syntaxErrorMessage(csNode, `Unexpected ${type}`));
    }
    return transform(csNode, transformNode, reviver);
  }
  if (typeof reviver !== "function") {
    throw new TypeError("reviver has to be a function");
  }
  const coffeeAst = nodes(source.toString("utf8"));
  const parsed = transformNode(coffeeAst);
  if (reviver === defaultReviver) {
    return parsed;
  }
  const contextObj = {};
  contextObj[""] = parsed;
  return reviver.call(contextObj, "", parsed);
}
module.exports = parse;
