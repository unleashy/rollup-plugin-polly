import { test } from "uvu";
import * as assert from "uvu/assert";
import { namedTypes as types, builders as b } from "ast-types";
import { testBundle } from "./util";

const compilerMock = (grammar: string): types.ASTNode => {
  return b.stringLiteral(`polly test: ${grammar}`);
};

test("ignores files without an import to createParser", async () => {
  const { module } = await testBundle("fixtures/no-action.js", {
    compilerMock
  });

  assert.equal(module.exports, { parser: "no action" });
});

test("works for basic imports", async () => {
  const { module } = await testBundle("fixtures/basic-import.js", {
    compilerMock
  });

  assert.equal(module.exports, { parser: "polly test: basic!" });
});

test("works for complex imports", async () => {
  const { module } = await testBundle("fixtures/complex-import.js", {
    compilerMock
  });

  assert.equal(module.exports, {
    parser: "polly test: complex!",
    fakeParser: "fake parser"
  });
});

test("handles two createParser calls in the same file", async () => {
  const { module } = await testBundle("fixtures/two-parsers.js", {
    compilerMock
  });

  assert.equal(module.exports, {
    parser1: "polly test: 1",
    parser2: "polly test: 2"
  });
});

test.run();
