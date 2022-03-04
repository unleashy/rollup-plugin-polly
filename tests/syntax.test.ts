import { test } from "uvu";
import * as assert from "uvu/assert";
import { Span } from "../src/span";
import { Token, kinds } from "../src/syntax";

test("Token.humanise returns an appropriate representation", () => {
  const token = new Token(kinds.end, new Span("foo", 0, 3));

  assert.is(token.humanise(), `end:1 ("foo")`);
});

test("Token.isEnd returns true if the token is of errorKind end", () => {
  assert.is(new Token(kinds.end, new Span("", 0, 0)).isEnd, true);
  assert.is(new Token(kinds.colon, new Span("", 0, 0)).isEnd, false);
});

test.run();
