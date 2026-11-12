export const ASSISTANT_PERMISSION = {
  pagina: "MAIN_TEMPLATE",
  seccion: "Asistente IA",
  boton: "Usar asistente IA",
} as const;
export const ASSISTANT_CAPABILITIES = {
  artifacts: { ...ASSISTANT_PERMISSION, boton: "Generar archivos IA" },
  audit: { ...ASSISTANT_PERMISSION, boton: "Auditar conversaciones IA" },
  limits: { ...ASSISTANT_PERMISSION, boton: "Administrar cuotas IA" },
} as const;
export const assistantKeys = {
  all: (scope: string) => ["assistant", scope] as const,
  bootstrap: (scope: string) => ["assistant", scope, "bootstrap"] as const,
  conversations: (scope: string, archived: boolean) =>
    ["assistant", scope, "conversations", archived] as const,
  thread: (scope: string, id: string) =>
    ["assistant", scope, "thread", id] as const,
};
export const ATTACH_EXTENSIONS = [
  ".xlsx",
  ".xlsm",
  ".pptx",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".csv",
  ".txt",
  ".md",
  ".json",
  ".zip",
  ".rar",
];
export const MAX_ATTACHMENTS = 100;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
