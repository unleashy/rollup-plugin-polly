import { CharClass } from "./token";

export interface Grammar<Root extends string = string> {
  root: Root;
  defs: Record<string, Expr> & { [p in Root]: Expr };
}

export type Expr =
  | ExprChoice
  | ExprSequence
  | ExprPrefix
  | ExprSuffix
  | ExprName
  | ExprGroup
  | ExprString
  | ExprCharClass
  | ExprAny
  | ExprEnd;

export interface ExprChoice {
  kind: "choice";
  value: Expr[];
}

export interface ExprSequence {
  kind: "sequence";
  value: Expr[];
}

export enum Prefix {
  and,
  not
}

export interface ExprPrefix {
  kind: "prefix";
  prefix: Prefix;
  expr: Expr;
}

export enum Suffix {
  zeroOrOne,
  zeroOrMore,
  oneOrMore
}

export interface ExprSuffix {
  kind: "suffix";
  expr: Expr;
  suffix: Suffix;
}

export interface ExprName {
  kind: "name";
  value: string;
}

export interface ExprGroup {
  kind: "group";
  value: Expr;
}

export interface ExprString {
  kind: "string";
  value: string;
}

export interface ExprCharClass {
  kind: "charClass";
  value: CharClass[];
}

export interface ExprAny {
  kind: "any";
}

export interface ExprEnd {
  kind: "end";
}

export const ast = {
  grammar: <Root extends string>(
    root: Root,
    defs: Record<string, Expr> & { [p in Root]: Expr }
  ): Grammar<Root> => ({
    root,
    defs
  }),

  choice: (...value: Expr[]): ExprChoice => ({ kind: "choice", value }),

  sequence: (...value: Expr[]): ExprSequence => ({ kind: "sequence", value }),

  prefix: (prefix: Prefix, expr: Expr): ExprPrefix => ({
    kind: "prefix",
    prefix,
    expr
  }),

  suffix: (expr: Expr, suffix: Suffix): ExprSuffix => ({
    kind: "suffix",
    expr,
    suffix
  }),

  name: (value: string): ExprName => ({ kind: "name", value }),
  group: (value: Expr): ExprGroup => ({ kind: "group", value }),
  string: (value: string): ExprString => ({ kind: "string", value }),
  charClass: (value: CharClass[]): ExprCharClass => ({
    kind: "charClass",
    value
  }),

  any: { kind: "any" } as ExprAny,
  end: { kind: "end" } as ExprEnd
};
