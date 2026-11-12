export type Language = "auto" | "es" | "en" | "ko";
export interface Conversation {
  public_id: string;
  title: string;
  language: Language;
  model: string;
  status: string;
  updated_at: string | null;
  username?: string;
}
export interface Usage {
  request_count: number;
  artifact_count: number;
  input_tokens: number;
  output_tokens: number;
}
export interface Limits {
  daily_request_limit: number | null;
  daily_token_limit: number | null;
  daily_artifact_limit: number | null;
}
export interface Bootstrap {
  configured: boolean;
  model: string;
  can_generate_artifacts: boolean;
  can_audit: boolean;
  can_manage_limits: boolean;
  can_use_plan: boolean;
  usage: Usage;
  limits: Limits;
}
export interface Attachment {
  filename: string;
  kind?: string;
  extension?: string;
  size_bytes?: number;
  file_ref?: string;
}
export interface UploadedFile extends Attachment {
  file_ref: string;
}
export interface Artifact {
  id: string;
  type: string;
  title: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  row_count: number;
  status: string;
  expires_at: string | null;
  source: string | null;
  filters: Record<string, unknown>;
}
export interface Visualization {
  id: string;
  type: string;
  date_from?: string;
  date_to?: string;
  source?: string;
  areas?: Record<string, unknown>[];
  sources?: Record<string, unknown>[];
  omitted_areas?: string[];
  omitted_sources?: string[];
}
export interface Message {
  id: number;
  key: string;
  client_message_id: string | null;
  role: string;
  content: string;
  status: string;
  created_at: string | null;
  attachments: Attachment[];
  artifacts: Artifact[];
  visualizations: Visualization[];
}
export interface Thread {
  conversation: Conversation;
  messages: Message[];
  artifacts: Artifact[];
}
export interface PageContext {
  path: string;
  title: string;
  container_id: string | null;
  module_title?: string;
}
export interface SendRequest {
  content: string;
  client_message_id: string;
  language: Language;
  page_context: PageContext;
  file_ref: string | null;
  file_refs: string[];
}
export type ChatEvent =
  | { type: "ack"; userId: number; assistantId: number }
  | { type: "delta"; text: string }
  | { type: "progress"; message: string }
  | { type: "artifact"; artifact: Artifact }
  | { type: "visualization"; visualization: Visualization }
  | { type: "usage"; usage: Usage; limits: Limits }
  | { type: "notice"; message: string }
  | { type: "error"; message: string }
  | {
      type: "done";
      messageId?: number;
      artifacts: Artifact[];
      visualizations: Visualization[];
    };
export interface Quota extends Limits {
  id: number;
  subject_type: "user" | "role";
  subject_key: string;
}
export interface QuotaPayload extends Limits {
  subject_type: "user" | "role";
  subject_key: string;
}
export interface AssistantApi {
  bootstrap(signal?: AbortSignal): Promise<Bootstrap>;
  conversations(
    archived: boolean,
    signal?: AbortSignal,
  ): Promise<Conversation[]>;
  thread(id: string, signal?: AbortSignal, before?: number): Promise<Thread>;
  create(language: Language): Promise<Conversation>;
  update(
    id: string,
    patch: { status?: "archived" | "active"; language?: Language },
  ): Promise<Conversation>;
  remove(id: string): Promise<void>;
  upload(id: string, file: File, signal?: AbortSignal): Promise<UploadedFile>;
  send(
    id: string,
    payload: SendRequest,
    receive: (event: ChatEvent) => void,
    signal: AbortSignal,
  ): Promise<void>;
  file(
    artifact: Artifact,
    preview?: boolean,
    signal?: AbortSignal,
  ): Promise<{ blob: Blob; name: string }>;
  regenerate(id: string): Promise<Artifact>;
  audit(username: string, signal?: AbortSignal): Promise<Conversation[]>;
  auditThread(id: string, signal?: AbortSignal): Promise<Thread>;
  quotas(signal?: AbortSignal): Promise<Quota[]>;
  saveQuota(payload: QuotaPayload): Promise<void>;
}
