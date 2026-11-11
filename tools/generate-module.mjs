import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sections = new Set([
  "informacion-basica",
  "material",
  "produccion",
  "proceso",
  "calidad",
  "resultados",
  "reporte",
  "configuracion",
  "administracion",
]);
const templateRoot = fileURLToPath(
  new URL("../templates/module/", import.meta.url),
);
export function generateModule({
  root = process.cwd(),
  name,
  title,
  section = "informacion-basica",
  group = title,
  dryRun = false,
}) {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name || ""))
    throw new Error(
      "El nombre debe usar minúsculas, números y guiones; ejemplo: clientes.",
    );
  if (!title?.trim()) throw new Error("Escribe --title.");
  if (!sections.has(section)) throw new Error("La sección indicada no existe.");
  const featuresRoot = path.resolve(root, "src/features");
  const target = path.resolve(featuresRoot, name);
  if (path.dirname(target) !== featuresRoot)
    throw new Error("El destino debe estar dentro de src/features.");
  if (fs.existsSync(target))
    throw new Error(`El módulo ${name} ya existe; no se sobrescribió.`);
  const registry = path.resolve(root, "src/app/registry.ts");
  const before = fs.readFileSync(registry, "utf8");
  for (const marker of ["// generator:imports:end", "// generator:modules:end"])
    if (before.split(marker).length !== 2)
      throw new Error(`No se encontró un marcador único: ${marker}`);
  const symbol = name.replace(/-([a-z0-9])/g, (_, letter) =>
    letter.toUpperCase(),
  );
  const modulePath = `/${section}/${name}`;
  const values = {
    __NAME__: name,
    __NAME_JSON__: JSON.stringify(name),
    __TITLE_JSON__: JSON.stringify(title.trim()),
    __TITLE_TEXT__: title.trim(),
    __PATH_JSON__: JSON.stringify(modulePath),
    __PATH_TEXT__: modulePath,
    __SECTION_JSON__: JSON.stringify(section),
    __GROUP_JSON__: JSON.stringify(group || title),
    __SYMBOL__: symbol,
  };
  const files = fs
    .readdirSync(templateRoot)
    .filter((file) => file.endsWith(".tpl"))
    .map((file) => {
      let content = fs.readFileSync(path.join(templateRoot, file), "utf8");
      content = content.replace(
        /__[A-Z_]+__/g,
        (token) => values[token] ?? token,
      );
      return { file: path.join(target, file.slice(0, -4)), content };
    });
  const after = before
    .replace(
      "// generator:imports:end",
      `import { ${symbol}Module } from '@/features/${name}/module';\n// generator:imports:end`,
    )
    .replace(
      "// generator:modules:end",
      `${symbol}Module,\n  // generator:modules:end`,
    );
  if (dryRun)
    return {
      target,
      modulePath,
      files: files.map((item) => item.file),
      dryRun: true,
    };
  const created = [];
  try {
    fs.mkdirSync(target, { recursive: true });
    for (const file of files) {
      fs.writeFileSync(file.file, file.content, { flag: "wx" });
      created.push(file.file);
    }
    if (fs.readFileSync(registry, "utf8") !== before)
      throw new Error(
        "El registro cambió mientras se generaba el módulo. Inténtalo de nuevo.",
      );
    fs.writeFileSync(registry, after);
  } catch (error) {
    // Rollback only this invocation's known files; no recursive deletion.
    for (const file of created) fs.unlinkSync(file);
    if (fs.existsSync(target) && fs.readdirSync(target).length === 0)
      fs.rmdirSync(target);
    throw error;
  }
  return {
    target,
    modulePath,
    files: files.map((item) => item.file),
    dryRun: false,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    options = {};
  try {
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (arg === "--help") {
        console.log(
          'npm run module:new -- --name clientes --title "Control de clientes" [--section informacion-basica] [--group "Catálogos"] [--dry-run]',
        );
        process.exit(0);
      }
      if (arg === "--dry-run") {
        options.dryRun = true;
        continue;
      }
      if (
        !["--name", "--title", "--section", "--group"].includes(arg) ||
        !args[index + 1] ||
        args[index + 1].startsWith("--")
      )
        throw new Error(`Argumento inválido: ${arg}`);
      options[arg.slice(2)] = args[++index];
    }
    console.log(JSON.stringify(generateModule(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
