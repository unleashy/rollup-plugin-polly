import { namedTypes as types, builders as b } from "ast-types";
import * as recast from "recast";
import { errorKinds, PollyError } from "./error";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Prefix, Suffix, visit, Visitors } from "./syntax";

const PRELUDE = `
let i = 0;

function reset(to) {
  i = to;
  return false;
}

function advance(by) {
  i += by;
  return true;
}

function memoise(map, rule) {
  let memod = map.get(i);
  if (memod === undefined) {
    memod = rule();
    map.set(i, memod);  
  }
  
  return memod;
}
`;

const PIECES = {
  any: `
    function any() {
      return i < input.length ? advance(1) : false;
    }
  `,
  end: `
    function end() {
      return i >= input.length ? true : false;
    }
  `,
  str: `
    function str(s) {
      return input.startsWith(s, i) ? advance(s.length) : false;
    }
  `,
  charClass: `
    function charClass(rgx) {
      return rgx.test(input.slice(i)) ? advance(1) : false;
    }
  `
};

export function compile(grammar: string): types.FunctionExpression {
  const grammarAst = new Parser(new Lexer(grammar)).parse();
  const requiredPieces = new Set<keyof typeof PIECES>();
  const ruleIdent = (name: string) =>
    b.identifier(`$${name.replace("'", "$p")}`);

  const visitors: Visitors<
    | types.ArrowFunctionExpression
    | types.CallExpression
    | types.LogicalExpression
  > = {
    visitChoice(ast, next) {
      /*
        Passes if any choice passes (in order).
          () => {
            const saved = i, expr3 = () => child3;
            if (child1()) return true;
            if (child2()) return true;
            if (expr3()) return true;
            ...
            if (child10()) return true;
            return false;
          }
       */

      const children = ast.value.map(next);
      return b.arrowFunctionExpression(
        [],
        b.blockStatement([
          b.variableDeclaration("const", [
            b.variableDeclarator(b.identifier("saved"), b.identifier("i")),
            ...children.flatMap((child, i) =>
              child.type === "ArrowFunctionExpression"
                ? [b.variableDeclarator(b.identifier(`expr${i}`), child)]
                : []
            )
          ]),
          ...children.map((child, i) =>
            b.ifStatement(
              child.type === "ArrowFunctionExpression"
                ? b.callExpression(b.identifier(`expr${i}`), [])
                : child,
              b.returnStatement(b.literal(true))
            )
          ),
          b.returnStatement(b.literal(false))
        ])
      );
    },

    visitSequence(ast, next) {
      /*
        Passes if all in sequence pass, backtracking otherwise.
          () => {
            const saved = i, expr3 = () => child3;
            if (!child1()) return false;
            if (!child2()) return reset(saved);
            if (!expr3()) return reset(saved);
            ...
            if (!child10()) return reset(saved);
            return true;
          }
       */

      const children = ast.value.map(next);
      return b.arrowFunctionExpression(
        [],
        b.blockStatement([
          b.variableDeclaration("const", [
            b.variableDeclarator(b.identifier("saved"), b.identifier("i")),
            ...children.flatMap((child, i) =>
              child.type === "ArrowFunctionExpression"
                ? [b.variableDeclarator(b.identifier(`expr${i}`), child)]
                : []
            )
          ]),
          ...children.map((child, i) =>
            b.ifStatement(
              b.unaryExpression(
                "!",
                child.type === "ArrowFunctionExpression"
                  ? b.callExpression(b.identifier(`expr${i}`), [])
                  : child
              ),
              b.returnStatement(
                i === 0
                  ? b.literal(false)
                  : b.callExpression(b.identifier("reset"), [
                      b.identifier("saved")
                    ])
              )
            )
          ),
          b.returnStatement(b.literal(true))
        ])
      );
    },

    visitPrefix(node, next) {
      const child = next(node.expr);
      const childAst =
        child.type === "ArrowFunctionExpression"
          ? b.callExpression(child, [])
          : child;
      switch (node.prefix) {
        case Prefix.and:
          /*
            Passes if child passes, without consuming any input.
              () => {
                const saved = i;
                if (!child()) return false;
                return !reset(saved);
              }
              () => {
                const saved = i;
                if (!(() => child)()) return false;
                return !reset(saved);
              }
           */
          return b.arrowFunctionExpression(
            [],
            b.blockStatement([
              b.variableDeclaration("const", [
                b.variableDeclarator(b.identifier("saved"), b.identifier("i"))
              ]),
              b.ifStatement(
                b.unaryExpression("!", childAst),
                b.returnStatement(b.literal(false))
              ),
              b.returnStatement(
                b.unaryExpression(
                  "!",
                  b.callExpression(b.identifier("reset"), [
                    b.identifier("saved")
                  ])
                )
              )
            ])
          );

        case Prefix.not:
          /*
            Passes if child doesn't pass, without consuming any input.
              () => {
                const saved = i;
                if (!child()) return true;
                return reset(saved);
              }
              () => {
                const saved = i;
                if (!(() => child)()) return true;
                return reset(saved);
              }
           */
          return b.arrowFunctionExpression(
            [],
            b.blockStatement([
              b.variableDeclaration("const", [
                b.variableDeclarator(b.identifier("saved"), b.identifier("i"))
              ]),
              b.ifStatement(
                b.unaryExpression("!", childAst),
                b.returnStatement(b.literal(true))
              ),
              b.returnStatement(
                b.callExpression(b.identifier("reset"), [b.identifier("saved")])
              )
            ])
          );
      }
    },

    visitSuffix(node, next) {
      const child = next(node.expr);
      switch (node.suffix) {
        case Suffix.zeroOrOne:
          /*
            Always passes. Ignores the result of child.
              child() || true;
              (() => child)() || true;
           */
          return b.logicalExpression(
            "||",
            child.type === "ArrowFunctionExpression"
              ? b.callExpression(child, [])
              : child,
            b.literal(true)
          );

        case Suffix.zeroOrMore:
          /*
            Always passes. Ignores all the results of repeating child.
              () => {
                while (child()) {}
                return true;
              }
              () => {
                const expr = () => child;
                while (expr()) {}
                return true;
              }
           */
          if (child.type === "ArrowFunctionExpression") {
            return b.arrowFunctionExpression(
              [],
              b.blockStatement([
                b.variableDeclaration("const", [
                  b.variableDeclarator(b.identifier("expr"), child)
                ]),
                b.whileStatement(
                  b.callExpression(b.identifier("expr"), []),
                  b.noop()
                ),
                b.returnStatement(b.literal(true))
              ])
            );
          } else {
            return b.arrowFunctionExpression(
              [],
              b.blockStatement([
                b.whileStatement(child, b.noop()),
                b.returnStatement(b.literal(true))
              ])
            );
          }

        case Suffix.oneOrMore:
          /*
            Passes if child passes once.
              () => {
                if (!child()) return false;
                while (child()) {}
                return true;
              }
              () => {
                const expr = () => child;
                if (!expr()) return false;
                while (expr()) {}
                return true;
              }
           */
          if (child.type === "ArrowFunctionExpression") {
            return b.arrowFunctionExpression(
              [],
              b.blockStatement([
                b.variableDeclaration("const", [
                  b.variableDeclarator(b.identifier("expr"), child)
                ]),
                b.ifStatement(
                  b.unaryExpression(
                    "!",
                    b.callExpression(b.identifier("expr"), [])
                  ),
                  b.returnStatement(b.literal(false))
                ),
                b.whileStatement(
                  b.callExpression(b.identifier("expr"), []),
                  b.noop()
                ),
                b.returnStatement(b.literal(true))
              ])
            );
          } else {
            return b.arrowFunctionExpression(
              [],
              b.blockStatement([
                b.ifStatement(
                  b.unaryExpression("!", child),
                  b.returnStatement(b.literal(false))
                ),
                b.whileStatement(child, b.noop()),
                b.returnStatement(b.literal(true))
              ])
            );
          }
      }
    },

    visitName(name) {
      if (!(name.value in grammarAst.defs)) {
        throw new PollyError(errorKinds.unresolvedName(name.value), name.span);
      }

      return b.callExpression(ruleIdent(name.value), []);
    },

    visitGroup(ast, next) {
      return next(ast.value);
    },

    visitString(str) {
      requiredPieces.add("str");
      return b.callExpression(b.identifier("str"), [b.literal(str.value)]);
    },

    visitCharClass(charClass) {
      requiredPieces.add("charClass");

      const regexClass = charClass.value
        .map(it => (typeof it === "object" ? `${it.from}-${it.to}` : it))
        .join("");

      return b.callExpression(b.identifier("charClass"), [
        b.literal(new RegExp(`^[${regexClass}]`))
      ]);
    },

    visitAny() {
      requiredPieces.add("any");
      return b.callExpression(b.identifier("any"), []);
    },

    visitEnd() {
      requiredPieces.add("end");
      return b.callExpression(b.identifier("end"), []);
    }
  };

  const rules = [];

  for (const [name, expr] of Object.entries(grammarAst.defs)) {
    const body = visit(expr, visitors);

    /*
      Creates a rule function together with its memo map.
        const memoRule = new Map();
        function $rule() {
          return memoise(memoRule, () => [body]);
        }
     */
    const ruleName = ruleIdent(name);
    const memoIdent = b.identifier(`memo${ruleName.name}`);
    rules.push(
      b.variableDeclaration("const", [
        b.variableDeclarator(
          memoIdent,
          b.newExpression(b.identifier("Map"), [])
        )
      ]),
      b.functionDeclaration(
        ruleName,
        [],
        b.blockStatement([
          b.returnStatement(
            b.callExpression(b.identifier("memoise"), [
              memoIdent,
              body.type === "ArrowFunctionExpression"
                ? body
                : b.arrowFunctionExpression([], body)
            ])
          )
        ])
      )
    );
  }

  const pieces = recast.parse(PRELUDE).program.body;

  for (const piece of requiredPieces) {
    pieces.push(...recast.parse(PIECES[piece]).program.body);
  }

  // return $root();
  const kickoff = b.returnStatement(
    b.callExpression(ruleIdent(grammarAst.root), [])
  );

  return b.functionExpression(
    null,
    [b.identifier("input")],
    b.blockStatement([...pieces, ...rules, kickoff])
  );
}
