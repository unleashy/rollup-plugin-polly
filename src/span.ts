import { strict as assert } from "assert";

export class Span {
  constructor(
    private readonly contents: string,
    private readonly index: number,
    private readonly length: number
  ) {
    assert(Number.isInteger(index), "index must be an integer");
    assert(Number.isInteger(length), "length must be an integer");
    assert(index >= 0, "index must be non-negative");
    assert(length >= 0, "length must be non-negative");
    assert(
      index + length <= contents.length,
      "index + length must be less than or equal to contents.length"
    );
  }

  get lines(): { start: number; end: number } {
    const start = this.lineAt(this.index);
    const end = this.lineAt(this.index + this.length - 1);
    return { start, end };
  }

  private lineAt(index: number): number {
    const before = this.contents.slice(0, index + 1);
    return count(before, "\n") + 1;
  }

  get text(): string {
    return this.contents.slice(this.index, this.index + this.length);
  }
}

function count(haystack: string, needle: string): number {
  let result = 0;

  for (const c of haystack) {
    if (c === needle) {
      ++result;
    }
  }

  return result;
}
