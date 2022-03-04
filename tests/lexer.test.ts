import { test } from "uvu";
import * as assert from "uvu/assert";
import { Span } from "../src/span";
import { Token, kinds } from "../src/syntax";
import { Lexer, LexerError, errorKinds } from "../src/lexer";

interface TestCase {
  name: string;
  input: string;
  output: (
    makeSpan: (index: number, length: number) => Span
  ) => (Token | LexerError)[];
  expectsError?: boolean;
}

const testCases: TestCase[] = [
  {
    name: "handles empty input",
    input: "",
    output: s => [new Token(kinds.end, s(0, 0))]
  },
  {
    name: "fails for an unrecognised character",
    input: "§",
    output: s => [new LexerError(errorKinds.unknownChar("§"), s(0, 1))],
    expectsError: true
  },
  {
    name: "ignores whitespace",
    input: " \t\n\r",
    output: s => [new Token(kinds.end, s(4, 0))]
  },
  {
    name: "ignores comments",
    input: "# foobar \n# foo",
    output: s => [new Token(kinds.end, s(15, 0))]
  },
  {
    name: "handles symbols",
    input: ":|&!?*+()",
    output: s => [
      new Token(kinds.colon, s(0, 1)),
      new Token(kinds.pipe, s(1, 1)),
      new Token(kinds.and, s(2, 1)),
      new Token(kinds.not, s(3, 1)),
      new Token(kinds.question, s(4, 1)),
      new Token(kinds.star, s(5, 1)),
      new Token(kinds.plus, s(6, 1)),
      new Token(kinds.open, s(7, 1)),
      new Token(kinds.close, s(8, 1)),
      new Token(kinds.end, s(9, 0))
    ]
  },
  {
    name: "handles specials",
    input: "<any> <end>",
    output: s => [
      new Token(kinds.specialAny, s(0, 5)),
      new Token(kinds.specialEnd, s(6, 5)),
      new Token(kinds.end, s(11, 0))
    ]
  },
  {
    name: "fails for unknown specials",
    input: "<hello>",
    output: s => [
      new LexerError(errorKinds.unknownSpecial("<hello>"), s(0, 7))
    ],
    expectsError: true
  },
  {
    name: "fails for unclosed specials",
    input: "<aaaaaaaaaaaaaaaaa",
    output: s => [new LexerError(errorKinds.unclosedSpecial, s(0, 18))],
    expectsError: true
  },
  {
    name: "handles single-quoted strings",
    input: `'' 'abc' '\\' '\n'`,
    output: s => [
      new Token(kinds.string(``), s(0, 2)),
      new Token(kinds.string(`abc`), s(3, 5)),
      new Token(kinds.string(`\\`), s(9, 3)),
      new Token(kinds.string(`\n`), s(13, 3)),
      new Token(kinds.end, s(16, 0))
    ]
  },
  {
    name: "fails for unclosed single-quoted strings",
    input: "'foobar",
    output: s => [new LexerError(errorKinds.unclosedString, s(0, 7))],
    expectsError: true
  },
  {
    name: "handles double-quoted strings",
    input: String.raw`"" "bread" "\n\r\t\"\\\!"`,
    output: s => [
      new Token(kinds.string(``), s(0, 2)),
      new Token(kinds.string(`bread`), s(3, 7)),
      new Token(kinds.string(`\n\r\t\"\\!`), s(11, 14)),
      new Token(kinds.end, s(25, 0))
    ]
  },
  {
    name: "fails for unclosed double-quoted strings",
    input: `"sup`,
    output: s => [new LexerError(errorKinds.unclosedString, s(0, 4))],
    expectsError: true
  },

  {
    name: "fails for unclosed double-quoted strings after escape",
    input: `"woops\\`,
    output: s => [new LexerError(errorKinds.unclosedString, s(0, 7))],
    expectsError: true
  },
  {
    name: "handles unicode escapes in double-quoted strings",
    input: String.raw`"\u{A}\u{41}\u{28B}\u{5763}\u{1042d}\u{10AeCf}"`,
    output: s => [
      new Token(
        kinds.string(`\u{A}\u{41}\u{28B}\u{5763}\u{1042d}\u{10AeCf}`),
        s(0, 47)
      ),
      new Token(kinds.end, s(47, 0))
    ]
  },
  {
    name: "fails for missing open brace in unicode escapes",
    input: `"\\u41}"`,
    output: s => [new LexerError(errorKinds.badUnicodeEscape, s(1, 3))],
    expectsError: true
  },
  {
    name: "fails for missing close brace in unicode escapes",
    input: `"\\u{41 `,
    output: s => [new LexerError(errorKinds.badUnicodeEscape, s(1, 6))],
    expectsError: true
  },
  {
    name: "fails for non-hex characters in unicode escapes",
    input: `"\\u{-}"`,
    output: s => [new LexerError(errorKinds.badUnicodeEscape, s(1, 4))],
    expectsError: true
  },
  {
    name: "fails for invalid code points in unicode escapes",
    input: `"\\u{FFFFFF}"`,
    output: s => [new LexerError(errorKinds.badUnicodeEscape, s(1, 10))],
    expectsError: true
  },
  {
    name: "handles character ranges",
    input: String.raw`[] [abcd] [A-Z0-9] [-] [h-] [-w] [\t-\n] [\[\--\-\]]`,
    output: s => [
      new Token(kinds.charClass([]), s(0, 2)),
      new Token(kinds.charClass(["a", "b", "c", "d"]), s(3, 6)),
      new Token(
        kinds.charClass([
          { from: "A", to: "Z" },
          { from: "0", to: "9" }
        ]),
        s(10, 8)
      ),
      new Token(kinds.charClass(["-"]), s(19, 3)),
      new Token(kinds.charClass(["h", "-"]), s(23, 4)),
      new Token(kinds.charClass(["-", "w"]), s(28, 4)),
      new Token(kinds.charClass([{ from: "\t", to: "\n" }]), s(33, 7)),
      new Token(kinds.charClass(["[", { from: "-", to: "-" }, "]"]), s(41, 11)),
      new Token(kinds.end, s(52, 0))
    ]
  },
  {
    name: "fails for unclosed character range",
    input: String.raw`[abcd`,
    output: s => [new LexerError(errorKinds.unclosedCharacterRange, s(0, 5))],
    expectsError: true
  },
  {
    name: "fails for unclosed character range after dash",
    input: String.raw`[0-`,
    output: s => [new LexerError(errorKinds.unclosedCharacterRange, s(0, 3))],
    expectsError: true
  },
  {
    name: "handles names",
    input: `a hey000 YXZ__123_456_789'AfterPrime''`,
    output: s => [
      new Token(kinds.name("a"), s(0, 1)),
      new Token(kinds.name("hey000"), s(2, 6)),
      new Token(kinds.name("YXZ__123_456_789'"), s(9, 17)),
      new Token(kinds.name("AfterPrime''"), s(26, 12)),
      new Token(kinds.end, s(38, 0))
    ]
  }
];

for (const testCase of testCases) {
  test(`Lexer ${testCase.name}`, () => {
    const lexer = new Lexer(testCase.input);

    const actual = [];
    while (true) {
      try {
        const token = lexer.next();
        actual.push(token);
        if (token.isEnd) break;
      } catch (e) {
        if (testCase.expectsError && e instanceof LexerError) {
          actual.push(e);
          break;
        } else {
          throw e;
        }
      }
    }

    const expected = testCase.output(
      (index, length) => new Span(testCase.input, index, length)
    );

    assert.equal(actual, expected);
  });
}

test.run();
