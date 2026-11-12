import { readFile } from "node:fs/promises";
import { test as base, expect } from "@playwright/test";

interface ApiCall {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
}
export interface MesFixture {
  calls: ApiCall[];
  date: string;
  allowAssistant: boolean;
  invalidQuota: boolean;
}
export const test = base.extend<{ mes: MesFixture }>({
  mes: async ({ page }, use) => {
    const mes: MesFixture = {
      calls: [],
      date: "2026-11-09",
      allowAssistant: true,
      invalidQuota: false,
    };
    const errors: string[] = [],
      unexpected: string[] = [];
    const workbook = await readFile(
      new URL("./fixtures/materials.xlsx", import.meta.url),
    );
    const materials = Array.from({ length: 520 }, (_, index) => ({
      numero_parte: "QA-" + String(index + 1).padStart(3, "0"),
      clasificacion: index % 2 ? "IMD" : "SMD",
      propiedad_material: "SMD",
      especificacion_material: "Componente de prueba " + (index + 1),
      unidad_medida: "EA",
      unidad_empaque: "2000",
      vendedor: "ILS",
      vendedores: ["ILS"],
      costos: [],
      fecha_registro: "2026-11-12",
      usuario_registro: "QA",
    }));
    const inventory: Record<string, string | number | null> = {
      lgemm: 0,
      isemm: 0,
      svc: 0,
      dif: 0,
      pendiente: 0,
      rework: 0,
      smt: 0,
      imd: 0,
      i0: 0,
      line: null,
      ref_date: "2026-11-09",
    };
    const schedule: Record<string, number | null> = { [mes.date]: 10 };
    const conversation = {
      public_id: "browser-chat",
      title: "Consulta de prueba",
      language: "es",
      model: "Servidor de pruebas",
      status: "active",
      updated_at: "2026-11-12 10:00:00",
    };
    const artifact = {
      id: "browser-file",
      type: "xlsx",
      title: "Inventario de prueba",
      filename: "materials.xlsx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size_bytes: workbook.length,
      row_count: 1,
      status: "ready",
      filters: {},
    };
    let exists = false;
    let messages: Record<string, unknown>[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.clock.setFixedTime(new Date("2026-11-12T16:00:00Z"));
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("mes-v2:mode", JSON.stringify("live"));
    });
    await page.route("**/backend/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const path = url.pathname.replace(/^\/backend/, "");
      let body: Record<string, unknown> | null = null;
      if (
        request.headers()["content-type"]?.includes("application/json") &&
        request.postData()
      )
        body = JSON.parse(request.postData()!) as Record<string, unknown>;
      mes.calls.push({ path, method: request.method(), body });
      const json = (value: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (path === "/api/mi-perfil")
        return json({
          perfil: {
            username: "browser-qa",
            nombre_completo: "Usuario de pruebas",
            rol: "operador",
          },
        });
      if (path === "/obtener_permisos_usuario_actual")
        return json({
          usuario: "browser-qa",
          rol: "operador",
          permisos: {
            LISTA_INFORMACIONBASICA: {
              "Control de material": ["Control de material"],
            },
            LISTA_CONTROLDEPRODUCCION: {
              "Control de plan de produccion": [
                "Part Planning LG",
                "Proyeccion",
              ],
            },
            MAIN_TEMPLATE: {
              "Asistente IA": mes.allowAssistant
                ? ["Usar asistente IA", "Generar archivos IA"]
                : [],
            },
          },
        });
      if (path.endsWith("/control_material/catalogos"))
        return json({
          clasificaciones: ["SMD", "IMD"],
          propiedades: ["SMD"],
          unidades_empaque: ["2000"],
          unidades_medida: ["EA"],
          monedas: ["USD"],
        });
      if (path.endsWith("/control_material/materiales")) {
        const term = (url.searchParams.get("q") ?? "").toLowerCase();
        const classification = url.searchParams.get("clasificacion");
        const records = materials.filter(
          (row) =>
            row.numero_parte.toLowerCase().includes(term) &&
            (!classification || row.clasificacion === classification),
        );
        return json({ success: true, records, total: records.length });
      }
      if (
        path.endsWith("/control_material/export") ||
        path === "/api/ai/artifacts/browser-file/download"
      )
        return route.fulfill({
          contentType: artifact.mime_type,
          headers: {
            "Content-Disposition": 'attachment; filename="materials.xlsx"',
          },
          body: workbook,
        });
      if (path === "/api/part-planning/plan") {
        const date = url.searchParams.get("date_from")!;
        mes.date = date;
        return json({
          success: true,
          date_from: date,
          date_to: url.searchParams.get("date_to"),
          dates: [date],
          page: Number(url.searchParams.get("page")),
          page_size: Number(url.searchParams.get("page_size")),
          total_parts: 1,
          rows: [
            {
              part_no: "PLAN-001",
              qty: { [date]: 120 },
              sched: {
                [date]: schedule[date] === undefined ? 10 : schedule[date],
              },
              proj: { [date]: -5 },
              inv: inventory,
              total: 120,
              req_lg: 100,
              sched_total: schedule[date] === undefined ? 10 : schedule[date],
            },
          ],
        });
      }
      if (path === "/api/part-planning/schedule" && body) {
        schedule[String(body.sched_date)] =
          body.sched_qty == null ? null : Number(body.sched_qty);
        return json({ success: true });
      }
      if (path === "/api/part-planning/inventory/field" && body) {
        inventory[String(body.field)] = Number(body.value);
        return json({ success: true });
      }
      if (path === "/api/ai/bootstrap")
        return json({
          success: true,
          configured: true,
          model: "Servidor de pruebas",
          can_generate_artifacts: true,
          can_audit: false,
          can_manage_limits: false,
          usage: {
            request_count: 0,
            artifact_count: 0,
            input_tokens: 0,
            output_tokens: 0,
          },
          limits: {
            daily_request_limit: 50,
            daily_token_limit: mes.invalidQuota ? "invalid" : 100000,
            daily_artifact_limit: 10,
          },
        });
      if (path === "/api/ai/conversations") {
        if (request.method() === "POST") {
          exists = true;
          return json({ conversation }, 201);
        }
        return json({ conversations: exists ? [conversation] : [] });
      }
      if (path === "/api/ai/conversations/browser-chat/messages")
        return json({ conversation, messages });
      if (path === "/api/ai/conversations/browser-chat/artifacts")
        return json({ artifacts: messages.length ? [artifact] : [] });
      if (
        path === "/api/ai/conversations/browser-chat/messages/stream" &&
        body
      ) {
        const userId = messages.length + 1,
          assistantId = userId + 1;
        const content =
          "Respuesta autorizada para " +
          String(
            (body.page_context as Record<string, unknown>)?.module_title ??
              "MES",
          ) +
          ".";
        messages.push(
          {
            id: userId,
            role: "user",
            client_message_id: body.client_message_id,
            content: body.content,
            status: "complete",
          },
          {
            id: assistantId,
            role: "assistant",
            content,
            status: "complete",
            content_json: { artifacts: [artifact] },
          },
        );
        const event = (name: string, data: unknown) =>
          "event: " + name + "\ndata: " + JSON.stringify(data) + "\n\n";
        return route.fulfill({
          contentType: "text/event-stream",
          body:
            event("ack", {
              user_message_id: userId,
              assistant_message_id: assistantId,
            }) +
            event("delta", { text: content }) +
            event("artifact_ready", artifact) +
            event("done", { message_id: assistantId, artifacts: [artifact] }),
        });
      }
      if (
        path === "/api/ai/conversations/browser-chat" &&
        request.method() === "PATCH"
      ) {
        Object.assign(conversation, body);
        return json({ conversation });
      }
      if (
        path === "/api/ai/conversations/browser-chat" &&
        request.method() === "DELETE"
      ) {
        exists = false;
        messages = [];
        return json({ success: true });
      }
      unexpected.push(request.method() + " " + path);
      return json({ error: "Endpoint ausente en el contrato de pruebas" }, 503);
    });
    await use(mes);
    expect(unexpected, "Solicitudes fuera del contrato de pruebas").toEqual([]);
    expect(errors, "Errores de JavaScript o consola").toEqual([]);
  },
});
export { expect };
