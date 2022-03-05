import { test } from "uvu";
import * as assert from "uvu/assert";
import { namedTypes as types } from "ast-types";
import * as recast from "recast";
import { PollyError, errorKinds } from "../src/error";
import { Span } from "../src/span";
import { compile } from "../src/compiler";

interface TestCase {
  name: string;
  grammar: string;
  input: string;
  output: (
    makeSpan: (start: number, length: number) => Span
  ) => boolean | PollyError;
  expectsError?: boolean;
}

const testCases: TestCase[] = [
  {
    name: "succeeds for <end> and an empty string",
    grammar: `A: <end>`,
    input: "",
    output: () => true
  },
  {
    name: "fails for <end> and a non-empty string",
    grammar: `A: <end>`,
    input: "a",
    output: () => false
  },
  {
    name: "succeeds for <any> and any single character",
    grammar: `A: <any>`,
    input: "x",
    output: () => true
  },
  {
    name: "fails for <any> and an empty string",
    grammar: `A: <any>`,
    input: "",
    output: () => false
  },
  {
    name: "succeeds for a string with a matching input",
    grammar: `A: "hey"`,
    input: "hey",
    output: () => true
  },
  {
    name: "fails for a string without a matching input",
    grammar: `A: "sup"`,
    input: "nope",
    output: () => false
  },
  {
    name: "succeeds for a char class with matching input",
    grammar: `A: [a-z]`,
    input: "g",
    output: () => true
  },
  {
    name: "fails for a char class without matching input",
    grammar: `A: [a-z]`,
    input: "Zg",
    output: () => false
  },
  {
    name: "succeeds for name references and matching input",
    grammar: `
      A: B
      C: "c"
      B: C
    `,
    input: "c",
    output: () => true
  },
  {
    name: "ensures all names are defined",
    grammar: `A: B`,
    input: "",
    output: s => new PollyError(errorKinds.unresolvedName("B"), s(3, 1)),
    expectsError: true
  },
  {
    name: "succeeds for a zero or one suffix and non matching input",
    grammar: `
      A: "a"?
    `,
    input: "x",
    output: () => true
  },
  {
    name: "succeeds for a zero or one suffix and matching input",
    grammar: `
      A: "x"?
    `,
    input: "x",
    output: () => true
  },
  {
    name: "succeeds for a zero or more suffix and non matching input",
    grammar: `
      A: "a"*
    `,
    input: "x",
    output: () => true
  },
  {
    name: "succeeds for a zero or more suffix and matching input",
    grammar: `
      A: "x"*
    `,
    input: "xxy",
    output: () => true
  },
  {
    name: "fails for a one or more suffix and non matching input",
    grammar: `
      A: "a"+
    `,
    input: "x",
    output: () => false
  },
  {
    name: "succeeds for a one or more suffix and matching input",
    grammar: `
      A: "y"+
    `,
    input: "yyx",
    output: () => true
  },
  {
    name: "succeeds for a sequence and matching input",
    grammar: `
      A: "a" <any> "c"
    `,
    input: "axc",
    output: () => true
  },
  {
    name: "fails for a sequence and non matching input",
    grammar: `
      A: "a" <any> "c"
    `,
    input: "axd",
    output: () => false
  },
  {
    name: "succeeds for a not and matching input",
    grammar: `
      A: !"b" <any> "b"
    `,
    input: "ab",
    output: () => true
  },
  {
    name: "fails for a not and non matching input",
    grammar: `
      A: !"b" <any> "b"
    `,
    input: "bb",
    output: () => false
  },
  {
    name: "succeeds for an and with matching input",
    grammar: `
      A: &"a" <any> "a"
    `,
    input: "aa",
    output: () => true
  },
  {
    name: "fails for an and with non matching input",
    grammar: `
      A: &"a" <any> "a"
    `,
    input: "ba",
    output: () => false
  },
  {
    name: "succeeds for a choice with matching input",
    grammar: `
      A: "a" | "b" | "c"
    `,
    input: "c",
    output: () => true
  },
  {
    name: "fails for a choice with non matching input",
    grammar: `
      A: "a" | "b" | "c"
    `,
    input: "dac",
    output: () => false
  },
  {
    name: "handles groups correctly",
    grammar: `
      A: ("a" | "b")+ "c"
    `,
    input: "abbaaabbbc",
    output: () => true
  },
  {
    name: "encodes rule names without conflicts",
    grammar: `
      str: "foo" str'
      str': "bar" strp
      strp: "baz" str1
      str1: "bux"
    `,
    input: "foobarbazbux",
    output: () => true
  }
];

for (const testCase of testCases) {
  test(`Compiler ${testCase.name}`, () => {
    const makeSpan = (start: number, length: number) =>
      new Span(testCase.grammar, start, length);

    let result;
    try {
      const js = compile(testCase.grammar);

      const inputParam = (js.params[0] as types.Identifier).name;
      const body = recast.prettyPrint(js.body).code;
      const fn = new Function(inputParam, body);

      result = fn(testCase.input);
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
