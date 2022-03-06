import { test } from "uvu";
import * as assert from "uvu/assert";
import { namedTypes as types, builders as b } from "ast-types";
import { testBundle } from "./util";
import { errorKinds, PollyError } from "../src/error";
import { Span } from "../src/span";
import path from "path";

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

test("throws errors appropriately", async () => {
  const fixture = "fixtures/has-error.js";
  try {
    await testBundle(fixture, {
      compilerMock: (grammar: string) => {
        throw new PollyError(
          errorKinds.unknownChar(grammar[0]),
          new Span(grammar, 0, 1)
        );
      }
    });
    assert.unreachable("should have thrown");
  } catch (e) {
    assert.instance(e, Error);
    assert.equal(
      (e as Error).message,
      `${path.join(__dirname, fixture)}:3 - Unknown character "b"`
    );
  }
});

test.run();
