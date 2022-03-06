import { Span } from "./span";

type Err<Name extends string, Other> = { name: Name } & Other;

function errorKind<Name extends string, Other>(
  k: Err<Name, Other>
): Err<Name, Other> {
  return k;
}

export const errorKinds = Object.freeze({
  // lexer errors
  unknownChar: (char: string) => errorKind({ name: "unknownChar", char }),
  unknownSpecial: (special: string) =>
    errorKind({ name: "unknownSpecial", special }),
  unclosedSpecial: errorKind({ name: "unclosedSpecial" }),
  unclosedString: errorKind({ name: "unclosedString" }),
  unclosedCharacterRange: errorKind({ name: "unclosedCharacterRange" }),
  badUnicodeEscape: errorKind({ name: "badUnicodeEscape" }),

  // parser errors
  badPrimary: errorKind({ name: "badPrimary" }),
  unclosedGroup: errorKind({ name: "unclosedGroup" }),
  colonlessDef: errorKind({ name: "colonlessDef" }),
  namelessDef: errorKind({ name: "namelessDef" }),

  // compiler errors
  unresolvedName: (value: string) =>
    errorKind({ name: "unresolvedName", value })
});

type KindType<K> = K extends (...args: never[]) => unknown ? ReturnType<K> : K;
export type ErrorKind = KindType<typeof errorKinds[keyof typeof errorKinds]>;

export class PollyError extends Error {
  constructor(readonly errorKind: ErrorKind, readonly span: Span) {
    super(`[line ${span.lines.start}-${span.lines.end}] ${errorKind.name}`);

    this.span = span;
  }

  humanise(path: string, lineAdj: number): string {
    const msg = (() => {
      switch (this.errorKind.name) {
        case "unknownChar": {
          const char = JSON.stringify(this.errorKind.char);
          return `Unknown character ${char}`;
        }

        case "unknownSpecial":
          return `Unknown special ${this.errorKind.special}`;

        case "unclosedSpecial":
          return "Expected closing > for special";

        case "unclosedString":
          return "Expected closing quote for string";

        case "unclosedCharacterRange":
          return "Expected closing ] for character class";

        case "badUnicodeEscape": {
          const escape = JSON.stringify(this.span.text);
          return (
            `Bad unicode escape ${escape}; expected something like \\u{abcdef}, ` +
            "where abcdef is the hexadecimal encoding of a valid Unicode code point"
          );
        }

        case "badPrimary": {
          const thing = JSON.stringify(this.span.text);
          return (
            `Unexpected ${thing}; expected a primary like a name, a ` +
            "group, a string, a character class or a special"
          );
        }

        case "unclosedGroup":
          return `Expected closing ) for group`;

        case "colonlessDef": {
          const thing = JSON.stringify(this.span.text);
          return (
            `Unexpected ${thing}; expected a colon to separate a ` +
            "definition's name from its expression"
          );
        }

        case "namelessDef": {
          const thing = JSON.stringify(this.span.text);
          return `Unexpected ${thing}; expected a name for a definition`;
        }

        case "unresolvedName": {
          const name = JSON.stringify(this.errorKind.value);
          return `Cannot find a definition named ${name}`;
        }
      }
    })();

    const lines = (() => {
      const spanLines = this.span.lines;
      return spanLines.start === spanLines.end
        ? `${lineAdj + spanLines.start - 1}`
        : `${lineAdj + spanLines.start - 1}-${lineAdj + spanLines.end - 1}`;
    })();

    return `${path}:${lines} - ${msg}`;
  }
}
