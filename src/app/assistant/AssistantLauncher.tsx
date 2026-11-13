import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/useAuth";
import { usePermission } from "@/core/auth/usePermission";
import { ASSISTANT_PERMISSION, assistantKeys } from "@/core/assistant/config";
import {
  Alert,
  Button,
  DialogBody,
  ErrorBoundary,
  IconButton,
} from "@/shared/ui";
import { usePersistentState } from "@/shared/hooks/usePersistentState";
import { AssistantPanel } from "./AssistantPanel";
import { AssistantLoading } from "./AssistantSkeleton";
import { useLauncherPosition } from "./useLauncherPosition";
import "./launcher.css";

const AssistantWorkspace = lazy(() => import("./AssistantWorkspace"));
export function AssistantLauncher() {
  const { scope } = useAuth();
  const permission = usePermission(ASSISTANT_PERMISSION);
  const client = useQueryClient();
  const allowed = permission.data === true && !permission.isError;
  useEffect(() => {
    if (allowed) return;
    void client.cancelQueries({ queryKey: assistantKeys.all(scope) });
    client.removeQueries({ queryKey: assistantKeys.all(scope) });
  }, [allowed, client, scope]);
  return allowed ? <AuthorizedAssistant key={scope} scope={scope} /> : null;
}
function AuthorizedAssistant({ scope }: { scope: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const position = useLauncherPosition(scope);
  const [expanded, setExpanded] = usePersistentState(
    "mes-ai-expanded:" + scope,
    false,
    (value) => value === true,
  );
  const toggle = () => setExpanded((value) => !value);
  const close = () => setOpen(false);
  return (
    <>
      <IconButton
        {...position.handlers}
        className="assistant-launcher"
        label="Abrir asistente IA"
        title="Abrir asistente IA. Arrastra hacia un lado o usa las flechas izquierda y derecha."
        data-side={position.side ?? undefined}
        data-dragging={position.dragging || undefined}
        style={position.style}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        aria-haspopup="dialog"
        aria-expanded={open}
        icon={<img src="/brand/assistant.svg" alt="" draggable={false} />}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      />
      {mounted && (
        <ErrorBoundary
          fallback={(error, reset) =>
            open ? (
              <AssistantPanel
                expanded={expanded}
                onToggle={toggle}
                onClose={close}
              >
                <DialogBody>
                  <Alert tone="danger">{error.message}</Alert>
                  <Button onClick={reset}>Reintentar</Button>
                </DialogBody>
              </AssistantPanel>
            ) : null
          }
        >
          <Suspense
            fallback={
              open ? (
                <AssistantLoading
                  expanded={expanded}
                  onToggle={toggle}
                  onClose={close}
                />
              ) : null
            }
          >
            <AssistantWorkspace
              open={open}
              onClose={close}
              expanded={expanded}
              onToggle={toggle}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
