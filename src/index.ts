import type { Plugin } from "rollup";
import { createFilter } from "@rollup/pluginutils";
import * as recast from "recast";
import * as types from "ast-types";
import { compile as actualCompile } from "./compiler";
import { PollyError } from "./error";

export interface Options {
  include?: string | string[];
  exclude?: string | string[];
}

export default function polly(options: Options = {}): Plugin {
  const filter = createFilter(
    options.include ?? "**/*.{js,jsx,ts,tsx}",
    options.exclude
  );

  const compile =
    (options as { __secret__compilerMock?: typeof actualCompile })
      .__secret__compilerMock ?? actualCompile;

  return {
    name: "polly",

    transform(code, id) {
      if (!filter(id)) return null;

      const ast = recast.parse(code, { parser: this, sourceFileName: id });

      let localCreateParserName: string | undefined;
      types.visit(ast, {
        visitImportDeclaration(path) {
          const node = path.node;
          if (node.source.value !== "rollup-plugin-polly") {
            return false;
          }

          // As per the ESTree spec, `specifiers` is always present
          // <https://github.com/estree/estree/blob/master/es2015.md#importdeclaration>
          const specs = node.specifiers!;
          const createParserSpecI = specs.findIndex(
            spec =>
              spec.type === "ImportSpecifier" &&
              spec.imported.name === "createParser"
          );
          if (createParserSpecI === -1) {
            return false;
          }

          const createParserSpec = specs[
            createParserSpecI
          ] as types.namedTypes.ImportSpecifier;

          // As per the ESTree spec, `local` is always present
          // <https://github.com/estree/estree/blob/master/es2015.md#modulespecifier>
          localCreateParserName = createParserSpec.local!.name;

          if (specs.length <= 1) {
            path.prune();
          } else {
            path.get("specifiers", createParserSpecI).prune();
          }

          return false;
        },
        visitTaggedTemplateExpression(path) {
          if (localCreateParserName === undefined) {
            return false;
          }

          const node = path.node;
          if (
            !(
              node.tag.type === "Identifier" &&
              node.tag.name === localCreateParserName
            )
          ) {
            return false;
          }

          const grammar = node.quasi.quasis[0].value.raw;

          try {
            const compiled = compile(grammar);

            path.replace(compiled);
          } catch (e) {
            if (e instanceof PollyError) {
              throw new Error(e.humanise(id, node.loc?.start.line ?? 1));
            } else {
              throw e;
            }
          }

          return false;
        }
      });

      const result = recast.print(ast, { sourceMapName: "map.json" });

      return {
        code: result.code,
        map: { mappings: result.map.mappings }
      };
    }
  };
}

export type Parser = (code: string) => unknown;

export function createParser(_grammar: TemplateStringsArray): Parser {
  throw new Error(
    "createParser was called at runtime; did you set rollup-plugin-polly as " +
      "one of your plugins in rollup/vite?"
  );
}
