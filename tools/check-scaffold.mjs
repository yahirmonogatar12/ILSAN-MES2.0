import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { generateModule } from "./generate-module.mjs";
import { checkArchitecture } from "./check-architecture.mjs";

const require = createRequire(import.meta.url);
const project = path.resolve("output/scaffold-check", randomUUID());
try {
  fs.mkdirSync(path.join(project, "src/app"), { recursive: true });
  fs.writeFileSync(
    path.join(project, "src/app/registry.ts"),
    "import type { ModuleDefinition } from '@/core/modules/types';\n// generator:imports:start\n// generator:imports:end\nexport const modules: readonly ModuleDefinition[] = [\n// generator:modules:start\n// generator:modules:end\n];\n",
  );
  const generated = generateModule({
    root: project,
    name: "clientes-ejemplo",
    title: "Control de clientes",
    section: "informacion-basica",
  });
  const relativeConfig = path
    .relative(project, path.resolve("tsconfig.json"))
    .split(path.sep)
    .join("/");
  const originalSource = path
    .relative(project, path.resolve("src"))
    .split(path.sep)
    .join("/");
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        extends: relativeConfig,
        compilerOptions: {
          paths: { "@/*": ["./src/*", `${originalSource}/*`] },
        },
        include: ["src/**/*.ts", "src/**/*.tsx"],
      },
      null,
      2,
    ),
  );
  const issues = checkArchitecture(project);
  if (issues.errors.length) throw new Error(issues.errors.join("\n"));
  const compiler = path.resolve(
    path.dirname(require.resolve("typescript/package.json")),
    "bin/tsc",
  );
  const result = spawnSync(
    process.execPath,
    [compiler, "-p", path.join(project, "tsconfig.json"), "--noEmit"],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
  else
    console.log(
      `Plantilla generada, registrada y compilada: ${path.relative(project, generated.target)}`,
    );
} finally {
  // The generated project is only evidence for this run; keep output/ from growing.
  fs.rmSync(project, { recursive: true, force: true });
}
