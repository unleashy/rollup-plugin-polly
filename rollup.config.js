import sucrase from "@rollup/plugin-sucrase";
import resolve from "@rollup/plugin-node-resolve";
import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    { file: pkg.main, format: "cjs", exports: "auto" },
    { file: pkg.module, format: "es" }
  ],
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
