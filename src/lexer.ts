import { Source } from "./source";
import { Token, kinds, Kind, CharClass } from "./syntax";
import { Span } from "./span";

export class Lexer {
  private readonly source: Source;

  constructor(input: string) {
    this.source = new Source(input);
  }

  next(): Token {
    this.skipWhitespace();

    this.source.pushSpan();

    const c = this.source.next();
    if (c === undefined) {
      return this.nextSimple(kinds.end);
    } else if (/[A-Za-z_]/.test(c)) {
      return this.nextName();
    }

    // prettier-ignore
    switch (c) {
      case "'": return this.nextSingleQuotedString();
      case '"': return this.nextDoubleQuotedString();
      case "[": return this.nextCharClass();
      case "<": return this.nextSpecial();

      case ":": return this.nextSimple(kinds.colon);
      case "|": return this.nextSimple(kinds.pipe);
      case "&": return this.nextSimple(kinds.and);
      case "!": return this.nextSimple(kinds.not);
      case "?": return this.nextSimple(kinds.question);
      case "*": return this.nextSimple(kinds.star);
      case "+": return this.nextSimple(kinds.plus);
      case "(": return this.nextSimple(kinds.open);
      case ")": return this.nextSimple(kinds.close);

      default:
        throw new LexerError(
          errorKinds.unknownChar(c),
          this.source.popSpan()
        );
    }
  }

  private nextSimple(kind: Kind): Token {
    return new Token(kind, this.source.popSpan());
  }

  private nextName(): Token {
    while (true) {
      const c = this.source.peek();
      if (c !== undefined && /[A-Za-z0-9_]/.test(c)) {
        this.source.next();
      } else {
        break;
      }
    }

    while (this.source.peek() === "'") {
      this.source.next();
    }

    const span = this.source.popSpan();
    return new Token(kinds.name(span.text), span);
  }

  private nextSpecial(): Token {
    const reachedEnd = this.consumeUntil(">");

    const span = this.source.popSpan();
    const kind = (() => {
      // prettier-ignore
      switch (span.text) {
        case "<any>": return kinds.specialAny;
        case "<end>": return kinds.specialEnd;

        default:
          throw new LexerError(
            reachedEnd
              ? errorKinds.unclosedSpecial
              : errorKinds.unknownSpecial(span.text),
            span
          );
      }
    })();

    return new Token(kind, span);
  }

  private nextSingleQuotedString(): Token {
    const reachedEnd = this.consumeUntil("'");

    const span = this.source.popSpan();
    if (reachedEnd) {
      throw new LexerError(errorKinds.unclosedString, span);
    }

    const value = span.text.slice(1, -1);
    return new Token(kinds.string(value), span);
  }

  private nextDoubleQuotedString(): Token {
    let value = "";
    loop: while (true) {
      this.source.pushSpan(); // for error tracking in escapes

      const c = this.source.next();
      if (c === "\\") {
        value += this.nextEscape();
        continue;
      }

      this.source.popSpan(); // get rid of the escape span

      switch (c) {
        case '"':
          break loop;

        case undefined:
          throw new LexerError(
            errorKinds.unclosedString,
            this.source.popSpan()
          );

        default:
          value += c;
      }
    }

    return new Token(kinds.string(value), this.source.popSpan());
  }

  private nextCharClass(): Token {
    let value: CharClass[] = [];

    loop: while (true) {
      let from: string;
      let to: string;

      this.source.pushSpan(); // for error tracking in escapes

      const c = this.source.next();
      if (c === "\\") {
        from = this.nextEscape();
      } else {
        this.source.popSpan(); // get rid of the escape span

        switch (c) {
          case "]":
            break loop;

          case undefined:
            throw new LexerError(
              errorKinds.unclosedCharacterRange,
              this.source.popSpan()
            );

          default:
            from = c;
        }
      }

      if (this.source.peek() === "-" && this.source.peek(1) !== "]") {
        this.source.next(); // skip range sep

        this.source.pushSpan(); // for error tracking in escapes

        const c = this.source.next();
        if (c === "\\") {
          to = this.nextEscape();
        } else {
          this.source.popSpan(); // get rid of the escape span

          switch (c) {
            case undefined:
              throw new LexerError(
                errorKinds.unclosedCharacterRange,
                this.source.popSpan()
              );

            default:
              to = c;
          }
        }

        value.push({ from, to });
      } else {
        value.push(from);
      }
    }

    return new Token(kinds.charClass(value), this.source.popSpan());
  }

  private nextEscape(): string {
    const escape = this.source.next();
    const cooked = (() => {
      // prettier-ignore
      switch (escape) {
        case "n": return "\n";
        case "r": return "\r";
        case "t": return "\t";
        case "\\": return "\\";
        case "u": return this.nextUnicodeEscape();
        default: return escape;
      }
    })();

    this.source.popSpan(); // get rid of the escape span

    if (cooked === undefined) {
      throw new LexerError(errorKinds.unclosedString, this.source.popSpan());
    } else {
      return cooked;
    }
  }

  private nextUnicodeEscape(): string {
    if (this.source.next() !== "{") {
      throw new LexerError(errorKinds.badUnicodeEscape, this.source.popSpan());
    }

    let codePointHex = "";
    while (true) {
      const hex = this.source.next();
      if (hex === "}") break;

      if (hex !== undefined && /[0-9A-Fa-f]/.test(hex)) {
        codePointHex += hex;
      } else {
        throw new LexerError(
          errorKinds.badUnicodeEscape,
          this.source.popSpan()
        );
      }
    }

    try {
      return String.fromCodePoint(Number.parseInt(codePointHex, 16));
    } catch {
      throw new LexerError(errorKinds.badUnicodeEscape, this.source.popSpan());
    }
  }

  private skipWhitespace(): void {
    while (true) {
      const c = this.source.peek();
      switch (c) {
        case " ":
        case "\r":
        case "\t":
        case "\n":
          this.source.next();
          break;

        case "#":
          this.skipComment();
          break;

        default:
          return;
      }
    }
  }

  private skipComment() {
    this.consumeUntil("\n");
  }

  private consumeUntil(needle: string): boolean {
    while (true) {
      const c = this.source.next();
      if (c === undefined) return true;
      if (c === needle) return false;
    }
  }
}

function errorKind<Name extends string, Other>(
  k: { name: Name } & Other
): { name: Name } & Other {
  return k;
}

export const errorKinds = Object.freeze({
  unknownChar: (char: string) => errorKind({ name: "unknownChar", char }),
  unknownSpecial: (special: string) =>
    errorKind({ name: "unknownSpecial", special }),
  unclosedSpecial: errorKind({ name: "unclosedSpecial" }),
  unclosedString: errorKind({ name: "unclosedString" }),
  unclosedCharacterRange: errorKind({ name: "unclosedCharacterRange" }),
  badUnicodeEscape: errorKind({ name: "badUnicodeEscape" })
});

type KindType<K> = K extends (...args: never[]) => unknown ? ReturnType<K> : K;
export type LexerErrorKind = KindType<
  typeof errorKinds[keyof typeof errorKinds]
>;

export class LexerError extends Error {
  constructor(readonly kind: LexerErrorKind, readonly span: Span) {
    super(`[line ${span.humanise()}] ${kind.name}`);

    this.span = span;
  }
}
