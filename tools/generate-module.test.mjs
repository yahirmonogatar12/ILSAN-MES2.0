import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateModule } from "./generate-module.mjs";
import { testProject } from "./test-project.mjs";
const projects = [];
function fixture() {
  const project = testProject();
  projects.push(project);
  project.write(
    "src/app/registry.ts",
    "// generator:imports:start\n// generator:imports:end\nexport const modules = [\n// generator:modules:start\n// generator:modules:end\n];\n",
  );
  return project;
}
afterEach(() => {
  for (const project of projects.splice(0)) project.cleanup();
});
test("genera un módulo funcional y lo registra una sola vez sin depender de Materiales", () => {
  const { root } = fixture();
  const result = generateModule({
    root,
    name: "clientes",
    title: "Control de clientes",
  });
  assert.equal(result.files.length, 5);
  const registry = fs.readFileSync(
    path.join(root, "src/app/registry.ts"),
    "utf8",
  );
  assert.equal(registry.split("clientesModule,").length, 2);
  const page = fs.readFileSync(path.join(result.target, "Page.tsx"), "utf8");
  assert.match(page, /DataGrid/);
  assert.match(page, /useForm/);
  assert.doesNotMatch(page, /features\/materials/);
  assert.match(
    fs.readFileSync(path.join(result.target, "module.ts"), "utf8"),
    /demoOnly: true/,
  );
  assert.throws(
    () => generateModule({ root, name: "clientes", title: "Otra" }),
    /no se sobrescribió/,
  );
});
test("rechaza rutas con traversal y no escribe fuera de features", () => {
  const { root } = fixture();
  for (const name of ["../escape", "a/b", "C:\\otra", "Mayusculas"])
    assert.throws(
      () => generateModule({ root, name, title: "Prueba" }),
      /nombre/,
    );
});
test("dry-run no escribe archivos ni modifica el registro", () => {
  const { root } = fixture();
  const before = fs.readFileSync(
    path.join(root, "src/app/registry.ts"),
    "utf8",
  );
  const result = generateModule({
    root,
    name: "clientes",
    title: "Clientes",
    dryRun: true,
  });
  assert.equal(fs.existsSync(result.target), false);
  assert.equal(
    fs.readFileSync(path.join(root, "src/app/registry.ts"), "utf8"),
    before,
  );
});
test("valida marcadores y sección antes de crear archivos", () => {
  const project = fixture();
  assert.throws(
    () =>
      generateModule({
        root: project.root,
        name: "clientes",
        title: "Clientes",
        section: "inventada",
      }),
    /sección/,
  );
  project.write("src/app/registry.ts", "export const modules = [];");
  assert.throws(
    () =>
      generateModule({
        root: project.root,
        name: "clientes",
        title: "Clientes",
      }),
    /marcador/,
  );
  assert.equal(
    fs.existsSync(path.join(project.root, "src/features/clientes")),
    false,
  );
});
test("preserva comillas y caracteres españoles como literales de código", () => {
  const { root } = fixture();
  const result = generateModule({
    root,
    name: "clientes-qa",
    title: 'Clientes "México"',
  });
  const descriptor = fs.readFileSync(
    path.join(result.target, "module.ts"),
    "utf8",
  );
  assert.match(descriptor, /Clientes \\"México\\"/);
  assert.match(descriptor, /clientesQaModule/);
});
