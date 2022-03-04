import { Span } from "../span";

export type CharClass = string | { from: string; to: string };

function kind<Name extends string, Other>(
  k: { name: Name } & Other
): { name: Name } & Other {
  return k;
}

export const kinds = Object.freeze({
  end: kind({ name: "end" }),
  colon: kind({ name: "colon" }),
  pipe: kind({ name: "pipe" }),
  and: kind({ name: "and" }),
  not: kind({ name: "not" }),
  question: kind({ name: "question" }),
  star: kind({ name: "star" }),
  plus: kind({ name: "plus" }),
  open: kind({ name: "open" }),
  close: kind({ name: "close" }),

  specialAny: kind({ name: "specialAny" }),
  specialEnd: kind({ name: "specialEnd" }),

  string: (value: string) => kind({ name: "string", value }),
  charClass: (value: CharClass[]) => kind({ name: "charClass", value }),
  name: (value: string) => kind({ name: "name", value })
});

export type Kinds = typeof kinds;

type KindType<K> = K extends (...args: never[]) => unknown ? ReturnType<K> : K;
export type Kind = KindType<Kinds[keyof Kinds]>;

export class Token<K extends Kind = Kind> {
  constructor(readonly kind: K, readonly span: Span) {}

  humanise(): string {
    const text = JSON.stringify(this.span.text);
    return `${this.kind.name}:${this.span.humanise()} (${text})`;
  }

  get isEnd(): boolean {
    return this.kind === kinds.end;
  }
}

export type TokenOfKind<K extends keyof Kinds> = Token<KindType<Kinds[K]>>;
