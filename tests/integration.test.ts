import { test } from "uvu";
import * as assert from "uvu/assert";
import { testBundle } from "./util";

let parser: (input: string) => boolean;

test.before(async () => {
  const { module, code } = await testBundle("fixtures/integration.js");
  console.log(code);

  parser = module.exports.parser as typeof parser;
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
