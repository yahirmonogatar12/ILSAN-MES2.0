import { useRef } from "react";
import { Paperclip, Send, Square, X } from "lucide-react";
import { Button, IconButton, TextareaField, TextField } from "@/shared/ui";
import { ATTACH_EXTENSIONS } from "@/core/assistant/config";
import type { AssistantSession } from "./useAssistantSession";
import { labels } from "./i18n";
export function ChatComposer({ session }: { session: AssistantSession }) {
  const input = useRef<HTMLInputElement>(null);
  const t = labels(session.language);
  const used =
    (session.bootstrap.data?.usage.input_tokens ?? 0) +
    (session.bootstrap.data?.usage.output_tokens ?? 0);
  const limit = session.bootstrap.data?.limits.daily_token_limit;
  const disabled =
    !session.bootstrap.data?.configured ||
    session.stream.pending ||
    (session.selected !== null &&
      (!session.detail.data || !!session.detail.error));
  return (
    <form
      className="assistant-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void session.send();
      }}
    >
      <TextareaField
        label={t.message}
        containerClassName="assistant-message-field"
        aria-label={t.message}
        initialFocus
        maxLength={8000}
        rows={2}
        value={session.draft}
        disabled={disabled}
        placeholder={t.placeholder}
        onChange={(event) => session.setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (!session.busy) void session.send();
          }
        }}
      />
      <TextField
        ref={input}
        type="file"
        multiple
        accept={ATTACH_EXTENSIONS.join(",")}
        containerClassName="assistant-file-input"
        aria-label="Adjuntar archivos"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void session.upload(files);
        }}
      />
      {(session.files.length > 0 || session.uploading) && (
        <div className="assistant-attachments" role="status">
          {session.files.map((file) => (
            <span className="assistant-file-chip" key={file.file_ref}>
              <span title={file.filename}>{file.filename}</span>
              <IconButton
                label={"Quitar " + file.filename}
                icon={<X size={12} />}
                disabled={session.busy}
                onClick={() => session.removeFile(file.file_ref)}
              />
            </span>
          ))}
          {session.uploading && (
            <span className="assistant-uploading">
              {session.uploading} · Subiendo…
            </span>
          )}
        </div>
      )}
      <div className="assistant-composer-actions">
        <small className="assistant-usage">
          {limit != null
            ? used.toLocaleString("es-MX") +
              " / " +
              limit.toLocaleString("es-MX") +
              " tokens"
            : ""}
        </small>
        <IconButton
          label="Adjuntar archivos"
          icon={<Paperclip size={17} />}
          disabled={session.busy || !session.bootstrap.data?.configured}
          onClick={() => input.current?.click()}
        />
        {session.stream.pending ? (
          <Button
            size="sm"
            icon={<Square size={13} />}
            onClick={session.stream.stop}
          >
            {t.stop}
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            variant="primary"
            icon={<Send size={14} />}
            disabled={
              disabled ||
              session.busy ||
              (!session.draft.trim() && !session.files.length)
            }
          >
            {t.send}
          </Button>
        )}
      </div>
    </form>
  );
}
