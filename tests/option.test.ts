import { AssertionError } from "assert";
import { test } from "uvu";
import * as assert from "uvu/assert";
import * as fc from "fast-check";
import { Some, None, O } from "../src/option";

test("Some throws if given an undefined", () => {
  assert.throws(
    () => Some(undefined),
    (e: unknown) => e instanceof TypeError
  );
});

test("O.match pattern matches on an option", () => {
  fc.assert(
    fc.property(
      fc.anything().filter(it => it !== undefined),
      value =>
        assert.is(
          O.match(
            Some(value),
            some => some,
            none => ({}) // dummy but significant, will not === value
          ),
          value
        )
    )
  );

  assert.is(
    O.match(
      None,
      some => some,
      none => 3.14159
    ),
    3.14159
  );
});

test("O.then passes the option forwards in a chain", () => {
  assert.equal(
    O.then(Some(999), some => Some([some])),
    Some([999])
  );

  assert.is(
    O.then(Some(123), some => None),
    None
  );

  assert.is(
    O.then(None, () => Some(999)),
    None
  );
});

test("O.map changes the value inside a Some", () => {
  assert.equal(
    O.map(Some(999), some => some + 1),
    Some(1000)
  );

  assert.is(
    O.map(None, () => 999),
    None
  );
});

test("O.filter turns a Some into a None if the predicate is false", () => {
  const o = Some(999);

  assert.is(
    O.filter(o, some => true),
    o
  );

  assert.is(
    O.filter(o, some => false),
    None
  );

  assert.is(
    O.map(None, () => true),
    None
  );
});

test("O.unwrap takes the value out of a Some", () => {
  assert.is(O.unwrap(Some(999)), 999);

  assert.throws(
    () => O.unwrap(None),
    (e: unknown) => e instanceof AssertionError
  );
});

test("O.unwrapOr takes the value out of a Some, or returns the default", () => {
  assert.is(
    O.unwrapOr(Some(999), () => ({} as unknown)),
    999
  );

  assert.is(
    O.unwrapOr(None, () => 123),
    123
  );
});

test.run();
