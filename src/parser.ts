import { PollyError, errorKinds } from "./error";
import { Lexer } from "./lexer";
import {
  Expr,
  Grammar,
  Kinds,
  Prefix,
  Suffix,
  Token,
  TokenOfKind,
  ast,
  kinds
} from "./syntax";

export class Parser {
  private readonly lexer: PeekableLexer;

  constructor(lexer: Lexer) {
    this.lexer = new PeekableLexer(lexer);
  }

  parse(): Grammar {
    return this.parseGrammar();
  }

  private parseGrammar(): Grammar {
    const rootDef = this.parseDefinition();
    const defs = { [rootDef.name]: rootDef.expr };

    while (!this.lexer.peek().isEnd) {
      const def = this.parseDefinition();
      defs[def.name] = def.expr;
    }

    return ast.grammar(rootDef.name, defs);
  }

  private parseDefinition() {
    const name = this.expectKind(
      "name",
      token => new PollyError(errorKinds.namelessDef, token.span)
    );

    this.expectKind(
      "colon",
      token => new PollyError(errorKinds.colonlessDef, token.span)
    );

    const expr = this.parseExpr();

    return { name: name.kind.value, expr };
  }

  private parseExpr(): Expr {
    return this.parseChoice();
  }

  private parseChoice(): Expr {
    const exprs: Expr[] = [this.parseSequence()];

    while (this.lexer.peek().kind === kinds.pipe) {
      this.lexer.next();
      exprs.push(this.parseSequence());
    }

    return exprs.length === 1 ? exprs[0] : ast.choice(...exprs);
  }

  private parseSequence(): Expr {
    const exprs: Expr[] = [];

    while (this.isSequenceable()) {
      exprs.push(this.parsePrefix());
    }

    return exprs.length === 1 ? exprs[0] : ast.sequence(...exprs);
  }

  private isSequenceable(): boolean {
    const peek = this.lexer.peek();
    return !(
      peek.isEnd ||
      this.isDefStart() ||
      peek.kind === kinds.pipe ||
      peek.kind === kinds.close
    );
  }

  private isDefStart(): boolean {
    return (
      this.lexer.peek(0).kind.name === "name" &&
      this.lexer.peek(1).kind === kinds.colon
    );
  }

  private parsePrefix(): Expr {
    const prefix = (() => {
      // prettier-ignore
      switch (this.lexer.peek().kind) {
        case kinds.and: return Prefix.and;
        case kinds.not: return Prefix.not;
        default: return undefined;
      }
    })();

    if (prefix === undefined) {
      return this.parseSuffix();
    } else {
      this.lexer.next();
      const expr = this.parseSuffix();

      return ast.prefix(prefix, expr);
    }
  }

  private parseSuffix(): Expr {
    const expr = this.parsePrimary();

    const suffix = (() => {
      // prettier-ignore
      switch (this.lexer.peek().kind) {
        case kinds.question: return Suffix.zeroOrOne;
        case kinds.star: return Suffix.zeroOrMore;
        case kinds.plus: return Suffix.oneOrMore;
        default: return undefined;
      }
    })();

    if (suffix === undefined) {
      return expr;
    } else {
      this.lexer.next();
      return ast.suffix(expr, suffix);
    }
  }

  private parsePrimary(): Expr {
    const token = this.lexer.next();
    const kind = token.kind;
    switch (kind.name) {
      case "name":
        return ast.name(kind.value, token.span);

      case "open":
        return this.parseGroup(token);

      case "string":
        return ast.string(kind.value);

      case "charClass":
        return ast.charClass(kind.value);

      case "specialAny":
        return ast.any;

      case "specialEnd":
        return ast.end;

      default:
        throw new PollyError(errorKinds.badPrimary, token.span);
    }
  }

  private parseGroup(openToken: Token): Expr {
    const expr = this.parseExpr();
    this.expectKind(
      "close",
      () => new PollyError(errorKinds.unclosedGroup, openToken.span)
    );

    return ast.group(expr);
  }

  private expectKind<K extends keyof Kinds>(
    kind: K,
    makeErr: (badToken: Token) => PollyError
  ): TokenOfKind<K> {
    const token = this.lexer.next();
    if (token.kind.name === kind) {
      return token as TokenOfKind<K>;
    } else {
      throw makeErr(token);
    }
  }
}

class PeekableLexer {
  private readonly lexer: Lexer;
  private peekBuf: Token[] = [];

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  next(): Token {
    if (this.peekBuf.length === 0) {
      return this.lexer.next();
    } else {
      return this.peekBuf.shift()!;
    }
  }

  peek(by = 0): Token {
    this.fillPeekBufUpTo(by);
    return this.peekBuf[by];
  }

  private fillPeekBufUpTo(amount: number) {
    while (this.peekBuf.length <= amount) {
      this.peekBuf.push(this.lexer.next());
    }
  }
}
