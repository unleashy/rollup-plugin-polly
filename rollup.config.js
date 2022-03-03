import sucrase from "@rollup/plugin-sucrase";
import resolve from "@rollup/plugin-node-resolve";
import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "cjs",
      exports: "named",
      generatedCode: "es2015"
    },
    {
      file: pkg.module,
      format: "es",
      generatedCode: "es2015"
    }
  ],
  external: [...Object.keys(pkg.dependencies), "assert", "path"],
  plugins: [
    resolve({
      extensions: [".js", ".ts"]
    }),
    sucrase({
      exclude: ["node_modules/**"],
      transforms: ["typescript"]
    })
  ]
};
