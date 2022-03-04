import { test } from "uvu";
import * as assert from "uvu/assert";
import { PollyError, errorKinds } from "../src/error";
import { Grammar, Prefix, Suffix, ast } from "../src/syntax";
import { Span } from "../src/span";
import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";

type TestCase =
  | {
      name: string;
      input: string;
      output: Grammar<string>;
    }
  | {
      name: string;
      input: string;
      error: (makeSpan: (start: number, length: number) => Span) => PollyError;
    };

const testCases: TestCase[] = [
  {
    name: "handles a single basic definition",
    input: "A: <any>",
    output: ast.grammar("A", { A: ast.any })
  },
  {
    name: "handles a few basic definitions",
    input: `
      End: <end>
      Ref: A
      Str: 'hey'
      Class: [a-z]
    `,
    output: ast.grammar("End", {
      End: ast.end,
      Ref: ast.name("A"),
      Str: ast.string("hey"),
      Class: ast.charClass([{ from: "a", to: "z" }])
    })
  },
  {
    name: "handles suffixes",
    input: `
      ZeroOrOne: 'abc'?
      ZeroOrMore: Foo*
      OneOrMore: <any>+
    `,
    output: ast.grammar("ZeroOrOne", {
      ZeroOrOne: ast.suffix(ast.string("abc"), Suffix.zeroOrOne),
      ZeroOrMore: ast.suffix(ast.name("Foo"), Suffix.zeroOrMore),
      OneOrMore: ast.suffix(ast.any, Suffix.oneOrMore)
    })
  },
  {
    name: "handles prefixes",
    input: `
      And: &'bread'
      Not: !<end>
    `,
    output: ast.grammar("And", {
      And: ast.prefix(Prefix.and, ast.string("bread")),
      Not: ast.prefix(Prefix.not, ast.end)
    })
  },
  {
    name: "handles sequences",
    input: `
      A: B C
      D: <any> "abc" [asd]
    `,
    output: ast.grammar("A", {
      A: ast.sequence(ast.name("B"), ast.name("C")),
      D: ast.sequence(
        ast.any,
        ast.string("abc"),
        ast.charClass(["a", "s", "d"])
      )
    })
  },
  {
    name: "handles choices",
    input: `
      A: Foo
       | Bar
      B: 'hey' | 'there' | 'something' | 'goes here'
    `,
    output: ast.grammar("A", {
      A: ast.choice(ast.name("Foo"), ast.name("Bar")),
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
    input: `
      Def: &"foo"? !([] bar)+
         | (<end> | a (!<any>)*)
    `,
    output: ast.grammar("Def", {
      Def: ast.choice(
        ast.sequence(
          ast.prefix(
            Prefix.and,
            ast.suffix(ast.string("foo"), Suffix.zeroOrOne)
          ),
          ast.prefix(
            Prefix.not,
            ast.suffix(
              ast.group(ast.sequence(ast.charClass([]), ast.name("bar"))),
              Suffix.oneOrMore
            )
          )
        ),
        ast.group(
          ast.choice(
            ast.end,
            ast.sequence(
              ast.name("a"),
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
    error: s => new PollyError(errorKinds.badPrimary, s(3, 1))
  },
  {
    name: "fails for unclosed groups",
    input: `Unclosed: (a b`,
    error: s => new PollyError(errorKinds.unclosedGroup, s(10, 1))
  },
  {
    name: "fails for missing colon after def name",
    input: `Colonless a+ b`,
    error: s => new PollyError(errorKinds.colonlessDef, s(10, 1))
  },
  {
    name: "fails for def without name",
    input: `: 'hello'`,
    error: s => new PollyError(errorKinds.namelessDef, s(0, 1))
  },
  {
    name: "fails for no defs",
    input: `<any>`,
    error: s => new PollyError(errorKinds.namelessDef, s(0, 5))
  }
];

for (const testCase of testCases) {
  test(`Parser ${testCase.name}`, () => {
    const parser = new Parser(new Lexer(testCase.input));

    if ("error" in testCase) {
      const makeSpan = (start: number, length: number) =>
        new Span(testCase.input, start, length);

      let result;
      try {
        result = parser.parse();
      } catch (e) {
        if (e instanceof PollyError) {
          result = e;
        } else {
          throw e;
        }
      }

      assert.equal(result, testCase.error(makeSpan));
    } else {
      const result = parser.parse();

      assert.equal(result, testCase.output);
    }
  });
}

test.run();
