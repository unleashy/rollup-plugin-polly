import { Span } from "../span";
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
  span: Span;
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

  name: (value: string, span: Span): ExprName => ({
    kind: "name",
    value,
    span
  }),
  group: (value: Expr): ExprGroup => ({ kind: "group", value }),
  string: (value: string): ExprString => ({ kind: "string", value }),
  charClass: (value: CharClass[]): ExprCharClass => ({
    kind: "charClass",
    value
  }),

  any: { kind: "any" } as ExprAny,
  end: { kind: "end" } as ExprEnd
};

export type VisitorNext<R> = (expr: Expr) => R;
export type VisitorFn<T extends Expr, R> = (expr: T, next: VisitorNext<R>) => R;

export interface Visitors<R> {
  visitChoice: VisitorFn<ExprChoice, R>;
  visitSequence: VisitorFn<ExprSequence, R>;
  visitPrefix: VisitorFn<ExprPrefix, R>;
  visitSuffix: VisitorFn<ExprSuffix, R>;
  visitName: VisitorFn<ExprName, R>;
  visitGroup: VisitorFn<ExprGroup, R>;
  visitString: VisitorFn<ExprString, R>;
  visitCharClass: VisitorFn<ExprCharClass, R>;
  visitAny: VisitorFn<ExprAny, R>;
  visitEnd: VisitorFn<ExprEnd, R>;
}

export function visit<R>(expr: Expr, visitors: Visitors<R>): R {
  const visitorNext: VisitorNext<R> = next => visit(next, visitors);

  switch (expr.kind) {
    case "choice":
      return visitors.visitChoice(expr, visitorNext);

    case "sequence":
      return visitors.visitSequence(expr, visitorNext);

    case "prefix":
      return visitors.visitPrefix(expr, visitorNext);

    case "suffix":
      return visitors.visitSuffix(expr, visitorNext);

    case "name":
      return visitors.visitName(expr, visitorNext);

    case "group":
      return visitors.visitGroup(expr, visitorNext);

    case "string":
      return visitors.visitString(expr, visitorNext);

    case "charClass":
      return visitors.visitCharClass(expr, visitorNext);

    case "any":
      return visitors.visitAny(expr, visitorNext);

    case "end":
      return visitors.visitEnd(expr, visitorNext);
  }
}
