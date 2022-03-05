import { namedTypes as types, builders as b } from "ast-types";
import * as recast from "recast";
import { errorKinds, PollyError } from "./error";
import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { Prefix, Suffix, visit, Visitors } from "./syntax";

const PRELUDE = `
const $fail = NaN;
function $isFail(r) {
  return Number.isNaN(r);
}
`;

const PIECES = {
  or: `
    function $or(...exprs) {
      return i => {
        let r;
        for (const expr of exprs) {
          if (!$isFail(r = expr(i))) return r;
        }
        
        return $fail;
      };
    }
  `,

  seq: `
    function $seq(...exprs) {
      return i => {
        let r = 0;
        for (const expr of exprs) {
          if ($isFail(r += expr(r + i))) return $fail;
        }
        return r;
      };
    }
  `,

  and: `
    function $and(expr) {
      return i => $isFail(expr(i)) ? $fail : 0;
    }
  `,

  not: `
    function $not(expr) {
      return i => $isFail(expr(i)) ? 0 : $fail;
    }
  `,

  maybe: `
    function $maybe(expr) {
      return i => {
        const r = expr(i);
        return !$isFail(r) ? r : 0;
      };
    }
  `,

  many: `
    function $many(expr) {
      return i => {
        let r = 0;
        let v;
        while (!$isFail(v = expr(r + i))) {
          r += v;
        }
        return r;
      };
    }
  `,

  many1: `
    function $many1(expr) {
      return i => {
        let r = expr(i);
        if ($isFail(r)) return $fail;
      
        let v;
        while (!$isFail(v = expr(r + i))) {
          r += v;
        }
        return r;
      };
    }
  `,

  any: `
    function $any(i) {
      return i < input.length ? 1 : $fail;
    }
  `,
  end: `
    function $end(i) {
      return i >= input.length ? 0 : $fail;
    }
  `,
  str: `
    function $str(s) {
      return i => input.startsWith(s, i) ? s.length : $fail;
    }
  `,
  charClass: `
    function $charClass(rgx) {
      return i => rgx.test(input.slice(i)) ? 1 : $fail; 
    }
  `
};

export function compile(grammar: string): types.FunctionExpression {
  const grammarAst = new Parser(new Lexer(grammar)).parse();
  const requiredPieces = new Set<keyof typeof PIECES>();

  const visitors: Visitors<types.CallExpression | types.Identifier> = {
    visitChoice(ast, next) {
      requiredPieces.add("or");

      return b.callExpression(
        b.identifier("$or"),
        ast.value.map(expr => next(expr))
      );
    },

    visitSequence(ast, next) {
      requiredPieces.add("seq");

      return b.callExpression(
        b.identifier("$seq"),
        ast.value.map(expr => next(expr))
      );
    },

    visitPrefix(node, next) {
      switch (node.prefix) {
        case Prefix.and:
          requiredPieces.add("and");
          return b.callExpression(b.identifier("$and"), [next(node.expr)]);

        case Prefix.not:
          requiredPieces.add("not");
          return b.callExpression(b.identifier("$not"), [next(node.expr)]);
      }
    },

    visitSuffix(node, next) {
      switch (node.suffix) {
        case Suffix.zeroOrOne:
          requiredPieces.add("maybe");
          return b.callExpression(b.identifier("$maybe"), [next(node.expr)]);

        case Suffix.zeroOrMore:
          requiredPieces.add("many");
          return b.callExpression(b.identifier("$many"), [next(node.expr)]);

        case Suffix.oneOrMore:
          requiredPieces.add("many1");
          return b.callExpression(b.identifier("$many1"), [next(node.expr)]);
      }
    },

    visitName(name) {
      if (!(name.value in grammarAst.defs)) {
        throw new PollyError(errorKinds.unresolvedName(name.value), name.span);
      }

      return b.callExpression(b.identifier(name.value), []);
    },

    visitGroup(ast, next) {
      return next(ast.value);
    },

    visitString(str) {
      requiredPieces.add("str");
      return b.callExpression(b.identifier("$str"), [b.literal(str.value)]);
    },

    visitCharClass(charClass) {
      requiredPieces.add("charClass");

      const regexClass = charClass.value
        .map(it => (typeof it === "object" ? `${it.from}-${it.to}` : it))
        .join("");

      return b.callExpression(b.identifier("$charClass"), [
        b.literal(new RegExp(`^[${regexClass}]`))
      ]);
    },

    visitAny() {
      requiredPieces.add("any");
      return b.identifier("$any");
    },

    visitEnd() {
      requiredPieces.add("end");
      return b.identifier("$end");
    }
  };

  const ruleFns = [];

  for (const [name, expr] of Object.entries(grammarAst.defs)) {
    const body = visit(expr, visitors);
    const fn = b.functionDeclaration(
      b.identifier(name),
      [],
      b.blockStatement([b.returnStatement(body)])
    );

    ruleFns.push(fn);
  }

  const pieces = recast.parse(PRELUDE).program.body;

  for (const piece of requiredPieces) {
    pieces.push(...recast.parse(PIECES[piece]).program.body);
  }

  // return !$isFail(ROOT()(0));
  const kickoff = b.returnStatement(
    b.unaryExpression(
      "!",
      b.callExpression(b.identifier("$isFail"), [
        b.callExpression(b.callExpression(b.identifier(grammarAst.root), []), [
          b.literal(0)
        ])
      ])
    )
  );

  return b.functionExpression(
    null,
    [b.identifier("input")],
    b.blockStatement([...pieces, ...ruleFns, kickoff])
  );
}
