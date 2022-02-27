import { test } from "uvu";
import * as assert from "uvu/assert";

test("dummy", () => {
  assert.is(1 + 1, 2);
});

test.run();
