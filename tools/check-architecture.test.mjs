import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { checkArchitecture } from "./check-architecture.mjs";
import { testProject } from "./test-project.mjs";
const projects = [];
function fixture() {
  const p = testProject();
  projects.push(p);
  return p;
}
afterEach(() => {
  for (const p of projects.splice(0)) p.cleanup();
});
test("rechaza dependencias de shared/core hacia un módulo de negocio", () => {
  const p = fixture();
  p.write(
    "src/shared/ui/Bad.tsx",
    "import {x} from '@/features/materials/types'; export const a=x;",
  );
  p.write("src/core/Bad.ts", "export {x} from '@/features/materials/types';");
  assert.equal(checkArchitecture(p.root).errors.length, 2);
});
test("rechaza imports cruzados entre módulos y controles nativos duplicados", () => {
  const p = fixture();
  p.write(
    "src/features/clientes/Page.tsx",
    "import {x} from '@/features/materials/model'; export default function Page(){return <button>{x}</button>;}",
  );
  const errors = checkArchitecture(p.root).errors;
  assert(errors.some((x) => x.includes("entre módulos")));
  assert(errors.some((x) => x.includes("<button>")));
});
test("rechaza estilos globales en features y permite namespaces propios", () => {
  const p = fixture();
  p.write(
    "src/features/clientes/module.css",
    "table { color:red; } .clientes-module .name { color:blue; }",
  );
  assert.equal(checkArchitecture(p.root).errors.length, 1);
});
test("detecta rutas repetidas y módulos reales sin permiso", () => {
  const p = fixture();
  p.write(
    "src/features/a/module.ts",
    "export const a={id:'a',path:'/a',legacyPaths:['/anterior'],permission:null};",
  );
  p.write(
    "src/features/b/module.ts",
    "export const b={id:'b',path:'/a',legacyPaths:['/anterior'],permission:null,demoOnly:true};",
  );
  const errors = checkArchitecture(p.root).errors;
  assert(errors.some((x) => x.includes("ruta duplicado")));
  assert(errors.some((x) => x.includes("ruta duplicado /anterior")));
  assert(errors.some((x) => x.includes("declarar permiso")));
});
test("permite una aplicación por capas con un descriptor demo", () => {
  const p = fixture();
  p.write(
    "src/features/clientes/module.ts",
    "import {x} from '@/shared/ui'; export const m={id:'clientes',path:'/clientes',permission:null,demoOnly:true};",
  );
  assert.deepEqual(checkArchitecture(p.root).errors, []);
});

test("admite roles explícitos y rechaza un acceso sin roles requeridos válidos", () => {
  const p = fixture();
  p.write(
    "src/features/central/module.ts",
    "export const m={id:'central',path:'/admin/panel',permission:null,requiredRoles:['superadmin']};",
  );
  assert.deepEqual(checkArchitecture(p.root).errors, []);
  for (const roles of ["[]", "['']", "[variable]"]) {
    p.write(
      "src/features/central/module.ts",
      `export const m={id:'central',path:'/admin/panel',permission:null,requiredRoles:${roles}};`,
    );
    assert(
      checkArchitecture(p.root).errors.some((error) =>
        error.includes("declarar permiso"),
      ),
    );
  }
});
