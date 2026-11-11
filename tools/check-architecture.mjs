import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import postcss from "postcss";

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesIn(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
}
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end", "extra", "comments", "tokens"].includes(key))
      continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}
const nativeOwners = {
  button: "shared/ui/Button.tsx",
  input: "shared/ui/Fields.tsx",
  select: "shared/ui/Fields.tsx",
  textarea: "shared/ui/Fields.tsx",
  dialog: "shared/ui/Modal.tsx",
  table: "shared/ui/table/DataTable.tsx",
};
/** Structural checks are not a security audit; they guard the declared code boundaries. */
export function checkArchitecture(root = process.cwd()) {
  const source = path.resolve(root, "src"),
    errors = [],
    ids = new Map(),
    routes = new Map();
  const files = filesIn(source).filter(
    (file) =>
      /\.(tsx?|css)$/.test(file) &&
      !/\.test\.tsx?$/.test(file) &&
      !file.includes(`${path.sep}test${path.sep}`),
  );
  for (const file of files) {
    const relative = path.relative(source, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const report = (message) => errors.push(`${relative}: ${message}`);
    if (file.endsWith(".css")) {
      if (relative.startsWith("features/")) {
        const owner = relative.split("/")[1];
        postcss.parse(text).walkRules((rule) => {
          if (
            rule.parent.type === "atrule" &&
            rule.parent.name.endsWith("keyframes")
          )
            return;
          for (const selector of rule.selectors)
            if (!selector.trim().startsWith(`.${owner}-`))
              report(`estilo fuera del namespace .${owner}-: ${selector}`);
        });
      }
      continue;
    }
    const ast = parse(text, {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    let foundDescriptor = false;
    const checkImport = (specifier) => {
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return;
      const target = specifier.startsWith("@/")
        ? specifier.slice(2)
        : path
            .relative(source, path.resolve(path.dirname(file), specifier))
            .split(path.sep)
            .join("/");
      if (target.startsWith("../"))
        report("el código de src no debe importar archivos fuera de src");
      if (
        relative.startsWith("shared/") &&
        /^(core|features|app)\//.test(target)
      )
        report(`shared no debe importar ${target}`);
      if (relative.startsWith("core/") && /^(features|app)\//.test(target))
        report(`core no debe importar ${target}`);
      if (relative.startsWith("features/")) {
        const owner = relative.split("/")[1];
        if (target.startsWith("app/")) report("un módulo no debe importar app");
        if (target.startsWith("features/") && target.split("/")[1] !== owner)
          report(`dependencia directa entre módulos: ${target}`);
      }
      if (
        relative.startsWith("app/") &&
        target.startsWith("features/") &&
        relative !== "app/registry.ts"
      )
        report("solo app/registry.ts puede registrar módulos de features");
    };
    walk(ast, (node) => {
      if (
        [
          "ImportDeclaration",
          "ExportNamedDeclaration",
          "ExportAllDeclaration",
        ].includes(node.type) &&
        node.source?.type === "StringLiteral"
      )
        checkImport(node.source.value);
      if (
        node.type === "ImportExpression" &&
        node.source.type === "StringLiteral"
      )
        checkImport(node.source.value);
      if (
        node.type === "CallExpression" &&
        node.callee.type === "Import" &&
        node.arguments[0]?.type === "StringLiteral"
      )
        checkImport(node.arguments[0].value);
      if (
        node.type === "JSXOpeningElement" &&
        node.name.type === "JSXIdentifier" &&
        nativeOwners[node.name.name] &&
        relative !== nativeOwners[node.name.name]
      )
        report(`usar el componente compartido en lugar de <${node.name.name}>`);
      if (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        node.callee.name === "fetch" &&
        relative !== "core/http.ts"
      )
        report("las solicitudes deben pasar por core/http");
      if (
        /^features\/[^/]+\/module\.ts$/.test(relative) &&
        node.type === "ObjectExpression"
      ) {
        const props = Object.fromEntries(
          node.properties
            .filter((property) => property.type === "ObjectProperty")
            .map((property) => [
              property.key.name || property.key.value,
              property.value,
            ]),
        );
        if (
          props.id?.type !== "StringLiteral" ||
          props.path?.type !== "StringLiteral"
        )
          return;
        foundDescriptor = true;
        const legacyPaths = props.legacyPaths;
        if (
          legacyPaths &&
          (legacyPaths.type !== "ArrayExpression" ||
            legacyPaths.elements.some(
              (element) => element?.type !== "StringLiteral",
            ))
        )
          report("legacyPaths debe declarar un arreglo de rutas literales");
        for (const [value, map, label] of [
          [props.id.value, ids, "id"],
          [props.path.value, routes, "ruta"],
          ...(legacyPaths?.type === "ArrayExpression"
            ? legacyPaths.elements
                .filter((element) => element?.type === "StringLiteral")
                .map((element) => [element.value, routes, "ruta"])
            : []),
        ]) {
          if (map.has(value))
            report(
              `${label} duplicado ${value} (también en ${map.get(value)})`,
            );
          else map.set(value, relative);
        }
        if (
          props.permission?.type === "NullLiteral" &&
          !(
            props.requiredRoles?.type === "ArrayExpression" &&
            props.requiredRoles.elements.length > 0 &&
            props.requiredRoles.elements.every(
              (role) => role?.type === "StringLiteral" && role.value.trim(),
            )
          ) &&
          !(props.demoOnly?.type === "BooleanLiteral" && props.demoOnly.value)
        )
          report(
            "un módulo real debe declarar permiso o requiredRoles; null también se admite con demoOnly",
          );
      }
    });
    if (/^features\/[^/]+\/module\.ts$/.test(relative) && !foundDescriptor)
      report("el descriptor debe declarar id y path como literales");
  }
  return { files: files.length, modules: ids.size, errors };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = checkArchitecture();
    if (result.errors.length) {
      console.error(result.errors.join("\n"));
      process.exitCode = 1;
    } else
      console.log(
        `Arquitectura correcta: ${result.files} archivos, ${result.modules} módulos.`,
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
