import { AssertionError } from "assert";
import { test } from "uvu";
import * as assert from "uvu/assert";
import * as fc from "fast-check";
import { Some, None } from "../src/option";
import { Span } from "../src/span";
import { Source } from "../src/source";

function sourceToString(source: Source): string {
  let arr = [];

  let c;
  while ((c = source.next()) !== None) {
    arr.push(c);
  }

  return arr.join("");
}

test("Source.next outputs chars in sequence", () => {
  fc.assert(
    fc.property(fc.string(), str => {
      const source = new Source(str);
      assert.is(sourceToString(source), str);
    })
  );
});

test("Source.peek outputs chars without moving forwards", () => {
  const source = new Source("abc");

  assert.is(source.peek(), Some("a"));
  assert.is(source.peek(0), Some("a"));
  assert.is(source.peek(1), Some("b"));
  assert.is(source.peek(2), Some("c"));

  assert.is(source.next(), Some("a"));

  assert.is(source.peek(), Some("b"));

  source.next();

  assert.is(source.peek(1), None);
});

test("Source.peek throws for negative and non-integer peek amounts", () => {
  const source = new Source("abc");

  assert.throws(
    () => source.peek(-1),
    (e: unknown) => e instanceof AssertionError
  );

  assert.throws(
    () => source.peek(0.5),
    (e: unknown) => e instanceof AssertionError
  );
});

test("Source.pushSpan and Source.popSpan manage the Span stack", () => {
  const str = "a(b(c))";
  const source = new Source(str);

  source.pushSpan(); // span 1 - push at index 0

  // go to (b(c))
  source.next(); // a
  source.next(); // (

  source.pushSpan(); // span 2 - push at index 2

  // go to (c)
  source.next(); // b
  source.next(); // (

  source.pushSpan(); // span 3 - push at index 4

  // finish and pop
  source.next(); // c

  const span3 = source.popSpan(); // span 3 - pop at index 5 (length 1)

  source.next(); // )

  const span2 = source.popSpan(); // span 2 - pop at index 6 (length 4)

  source.next(); // )
  source.next(); // eof

  const span1 = source.popSpan(); // pop at index 7 (length 7)

  assert.equal(span1, new Span(str, 0, 7));
  assert.equal(span2, new Span(str, 2, 4));
  assert.equal(span3, new Span(str, 4, 1));
});

test("Source.popSpan asserts if there is no span to pop", () => {
  assert.throws(
    () => new Source("").popSpan(),
    (e: unknown) => e instanceof AssertionError
  );
});

test.run();
