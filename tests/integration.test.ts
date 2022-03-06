import { test } from "uvu";
import * as assert from "uvu/assert";
import { testBundle } from "./util";

let parser: (input: string) => boolean;

test.before(async () => {
  try {
    const { module } = await testBundle("fixtures/integration.js");
    parser = module.exports.parser as typeof parser;
  } catch (e) {
    if (e instanceof Error) {
      console.error(`!!! Error:`, e.message);
    } else {
      throw e;
    }
  }
});

test("succeeds for matching input", () => {
  assert.ok(parser("abc"));
  assert.ok(parser("aabbcc"));
  assert.ok(parser("aaabbbccc"));
});

test("fails for non matching input", () => {
  assert.not.ok(parser(""));
  assert.not.ok(parser("a"));
  assert.not.ok(parser("b"));
  assert.not.ok(parser("c"));
  assert.not.ok(parser("cba"));
  assert.not.ok(parser("aaabbbcc"));
});

test.run();
