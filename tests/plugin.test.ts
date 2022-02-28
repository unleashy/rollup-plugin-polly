import { test } from "uvu";
import * as assert from "uvu/assert";
import * as path from "path";
import * as types from "ast-types";

// Mock out the compiler - we don't want to run it
const compilerPath = path.join(__dirname, "../src/compiler.ts");
require.cache[compilerPath] = {
  exports: {
    compile: (grammar: string): types.ASTNode => {
      return types.builders.stringLiteral(`polly test: ${grammar}`);
    }
  }
} as never;

// Importing anything from polly must happen after the mock!
import { testBundle } from "./util";

// Unmock the compiler
test.after(() => {
  delete require.cache[compilerPath];
});

test("ignores files without an import to createParser", async () => {
  const { module } = await testBundle("fixtures/no-action.js");

  assert.equal(module.exports, { parser: "no action" });
});

test("works for basic imports", async () => {
  const { module } = await testBundle("fixtures/basic-import.js");

  assert.equal(module.exports, { parser: "polly test: basic!" });
});

test("works for complex imports", async () => {
  const { module } = await testBundle("fixtures/complex-import.js");

  assert.equal(module.exports, {
    parser: "polly test: complex!",
    fakeParser: "fake parser"
  });
});

test("handles two createParser calls in the same file", async () => {
  const { module } = await testBundle("fixtures/two-parsers.js");

  assert.equal(module.exports, {
    parser1: "polly test: 1",
    parser2: "polly test: 2"
  });
});

test.run();
