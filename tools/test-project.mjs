import fs from "node:fs";
import os from "node:os";
import path from "node:path";
export function testProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mes-v2-tests-"));
  const write = (relative, content) => {
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep))
      throw new Error("Ruta de prueba fuera del proyecto.");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const cleanup = () => {
    // Verify the final absolute directory before a Windows recursive delete.
    const resolved = fs.realpathSync(root),
      base = fs.realpathSync(os.tmpdir());
    if (
      path.dirname(resolved) !== base ||
      !path.basename(resolved).startsWith("mes-v2-tests-")
    )
      throw new Error("Destino de limpieza de pruebas inválido.");
    fs.rmSync(resolved, { recursive: true, force: true });
  };
  return { root, write, cleanup };
}
