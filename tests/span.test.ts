import { test } from "uvu";
import * as assert from "uvu/assert";
import { Span } from "../src/span";

test("Span.constructor does bound and integer checks", () => {
  assert.not.throws(() => new Span("abc", 0, 3));
  assert.not.throws(() => new Span("abc", 3, 0));
  assert.throws(() => new Span("abc", 4, 0));
  assert.throws(() => new Span("abc", 3, 1));
  assert.throws(() => new Span("abc", -1, 0));
  assert.throws(() => new Span("abc", 1, -1));
  assert.throws(() => new Span("abc", 1.5, 2));
  assert.throws(() => new Span("abc", 1, 2.4));
});

test("Span.text returns the right slice", () => {
  const contents = "foobar";

  assert.equal(new Span(contents, 0, 0).text, "");
  assert.equal(new Span(contents, 0, 1).text, "f");
  assert.equal(new Span(contents, 1, 3).text, "oob");
  assert.equal(new Span(contents, 5, 1).text, "r");
});

test("Span.lines returns the right line(s)", () => {
  const contents = "a\n猫\n";

  assert.equal(new Span(contents, 0, 0).lines, { start: 1, end: 1 });
  assert.equal(new Span(contents, 2, 1).lines, { start: 2, end: 2 });
  assert.equal(new Span(contents, 0, 2).lines, { start: 1, end: 2 });
  assert.equal(new Span(contents, 0, 4).lines, { start: 1, end: 3 });
});

test.run();
