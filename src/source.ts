import { strict as assert } from "assert";
import { Span } from "./span";

export type Char = string;

export class Source {
  private readonly str: string;
  private currentIndex = 0;
  private indexStack: number[] = [];

  constructor(str: string) {
    this.str = str;
  }

  next(): Char | undefined {
    if (this.currentIndex < this.str.length) {
      return this.str[this.currentIndex++];
    } else {
      return undefined;
    }
  }

  peek(by = 0): Char | undefined {
    assert(Number.isInteger(by), "amount to peek must be an integer");
    assert(by >= 0, "amount to peek must be non-negative");

    const peekIndex = this.currentIndex + by;

    if (peekIndex < this.str.length) {
      return this.str[peekIndex];
    } else {
      return undefined;
    }
  }

  pushSpan(): void {
    this.indexStack.push(this.currentIndex);
  }

  popSpan(): Span {
    const start = this.indexStack.pop();
    assert(start !== undefined, "no span to pop");

    return new Span(this.str, start, this.currentIndex - start);
  }
}
