import { test } from "uvu";
import * as assert from "uvu/assert";
import dedent from "ts-dedent";
import { PollyError, errorKinds } from "../src/error";
import { Grammar, Prefix, Suffix, ast } from "../src/syntax";
import { Span } from "../src/span";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";

interface TestCase {
  name: string;
  input: string;
  output: (
    makeSpan: (start: number, length: number) => Span
  ) => Grammar | PollyError;
  expectsError?: boolean;
}

const testCases: TestCase[] = [
  {
    name: "handles a single basic definition",
    input: "A: <any>",
    output: () => ast.grammar("A", { A: ast.any })
  },
  {
    name: "handles a few basic definitions",
    input: dedent`
      End: <end>
      Ref: A
      Str: 'hey'
      Class: [a-z]
    `,
    output: s =>
      ast.grammar("End", {
        End: ast.end,
        Ref: ast.name("A", s(16, 1)),
        Str: ast.string("hey"),
        Class: ast.charClass([{ from: "a", to: "z" }])
      })
  },
  {
    name: "handles suffixes",
    input: dedent`
      ZeroOrOne: 'abc'?
      ZeroOrMore: Foo*
      OneOrMore: <any>+
    `,
    output: s =>
      ast.grammar("ZeroOrOne", {
        ZeroOrOne: ast.suffix(ast.string("abc"), Suffix.zeroOrOne),
        ZeroOrMore: ast.suffix(ast.name("Foo", s(30, 3)), Suffix.zeroOrMore),
        OneOrMore: ast.suffix(ast.any, Suffix.oneOrMore)
      })
  },
  {
    name: "handles prefixes",
    input: dedent`
      And: &'bread'
      Not: !<end>
    `,
    output: () =>
      ast.grammar("And", {
        And: ast.prefix(Prefix.and, ast.string("bread")),
        Not: ast.prefix(Prefix.not, ast.end)
      })
  },
  {
    name: "handles sequences",
    input: dedent`
      A: B C
      D: <any> "abc" [asd]
    `,
    output: s =>
      ast.grammar("A", {
        A: ast.sequence(ast.name("B", s(3, 1)), ast.name("C", s(5, 1))),
        D: ast.sequence(
          ast.any,
          ast.string("abc"),
          ast.charClass(["a", "s", "d"])
        )
      })
  },
  {
    name: "handles choices",
    input: dedent`
      A: Foo
       | Bar
      B: 'hey' | 'there' | 'something' | 'goes here'
    `,
    output: s =>
      ast.grammar("A", {
        A: ast.choice(ast.name("Foo", s(3, 3)), ast.name("Bar", s(10, 3))),
        B: ast.choice(
          ast.string("hey"),
          ast.string("there"),
          ast.string("something"),
          ast.string("goes here")
        )
      })
  },
  {
    name: "uses the appropriate operator precedence",
    input: dedent`
      Def: &"foo"? !([] bar)+
         | (<end> | a (!<any>)*)
    `,
    output: s =>
      ast.grammar("Def", {
        Def: ast.choice(
          ast.sequence(
            ast.prefix(
              Prefix.and,
              ast.suffix(ast.string("foo"), Suffix.zeroOrOne)
            ),
            ast.prefix(
              Prefix.not,
              ast.suffix(
                ast.group(
                  ast.sequence(ast.charClass([]), ast.name("bar", s(18, 3)))
                ),
                Suffix.oneOrMore
              )
            )
          ),
          ast.group(
            ast.choice(
              ast.end,
              ast.sequence(
                ast.name("a", s(38, 1)),
                ast.suffix(
                  ast.group(ast.prefix(Prefix.not, ast.any)),
                  Suffix.zeroOrMore
                )
              )
            )
          )
        )
      })
  },
  {
    name: "fails for malformed primaries",
    input: `A: +`,
    output: s => new PollyError(errorKinds.badPrimary, s(3, 1)),
    expectsError: true
  },
  {
    name: "fails for unclosed groups",
    input: `Unclosed: (a b`,
    output: s => new PollyError(errorKinds.unclosedGroup, s(10, 1)),
    expectsError: true
  },
  {
    name: "fails for missing colon after def name",
    input: `Colonless a+ b`,
    output: s => new PollyError(errorKinds.colonlessDef, s(10, 1)),
    expectsError: true
  },
  {
    name: "fails for def without name",
    input: `: 'hello'`,
    output: s => new PollyError(errorKinds.namelessDef, s(0, 1)),
    expectsError: true
  },
  {
    name: "fails for no defs",
    input: `<any>`,
    output: s => new PollyError(errorKinds.namelessDef, s(0, 5)),
    expectsError: true
  }
];

for (const testCase of testCases) {
  test(`Parser ${testCase.name}`, () => {
    const parser = new Parser(new Lexer(testCase.input));
    const makeSpan = (start: number, length: number) =>
      new Span(testCase.input, start, length);

    let result;
    try {
      result = parser.parse();
    } catch (e) {
      if (testCase.expectsError && e instanceof PollyError) {
        result = e;
      } else {
        throw e;
      }
    }

    assert.equal(result, testCase.output(makeSpan));
  });
}

test.run();
