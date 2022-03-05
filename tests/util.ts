import { rollup } from "rollup";
import * as path from "path";
import polly from "../src";

export async function testBundle(fixturePath: string) {
  const bundle = await rollup({
    input: path.join(__dirname, fixturePath),
    plugins: [polly()],
    external: ["rollup-plugin-polly", "path"]
  });

  const { output } = await bundle.generate({ format: "cjs" });
  const [{ code }] = output;
  const module: { exports: Record<string, unknown> } = { exports: {} };
  const cwd = process.cwd().replace(/\\/g, "\\\\");
  const func = new Function(
    "module",
    "exports",
    "require",
    `process.chdir('${cwd}');\n\n${code}\n\n`
  );

  func(module, module.exports, require);

  return { code, module };
}
