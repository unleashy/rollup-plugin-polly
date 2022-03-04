import { Span } from "./span";

function errorKind<Name extends string, Other>(
  k: { name: Name } & Other
): { name: Name } & Other {
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
  namelessDef: errorKind({ name: "namelessDef" })
});

type KindType<K> = K extends (...args: never[]) => unknown ? ReturnType<K> : K;
export type ErrorKind = KindType<typeof errorKinds[keyof typeof errorKinds]>;

export class PollyError extends Error {
  constructor(readonly errorKind: ErrorKind, readonly span: Span) {
    super(`[line ${span.humanise()}] ${errorKind.name}`);

    this.span = span;
  }
}
