import { strict as assert } from "assert";
import { Option, Some, None } from "./option";
import { Span } from "./span";

export type Char = string;

export class Source {
  private readonly str: string;
  private currentIndex = 0;
  private indexStack: number[] = [];

  constructor(str: string) {
    this.str = str;
  }

  next(): Option<Char> {
    if (this.currentIndex < this.str.length) {
      return Some(this.str[this.currentIndex++]);
    } else {
      return None;
    }
  }

  peek(by = 0): Option<Char> {
    assert(Number.isInteger(by), "amount to peek must be an integer");
    assert(by >= 0, "amount to peek must be non-negative");

    const peekIndex = this.currentIndex + by;

    if (peekIndex < this.str.length) {
      return Some(this.str[peekIndex]);
    } else {
      return None;
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
