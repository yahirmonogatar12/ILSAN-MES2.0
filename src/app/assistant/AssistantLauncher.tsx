import { lazy, Suspense, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/core/auth/AuthProvider";
import { usePermission } from "@/core/auth/usePermission";
import { ASSISTANT_PERMISSION, assistantKeys } from "@/core/assistant/config";
import {
  Alert,
  Button,
  DialogBody,
  ErrorBoundary,
  IconButton,
  Loading,
  Modal,
} from "@/shared/ui";
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
  return allowed ? <AuthorizedAssistant key={scope} /> : null;
}
function AuthorizedAssistant() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <IconButton
        className="assistant-launcher"
        label="Abrir asistente IA"
        aria-haspopup="dialog"
        aria-expanded={open}
        icon={<img src="/brand/assistant.svg" alt="" />}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      />
      {mounted && (
        <ErrorBoundary
          fallback={(error, reset) =>
            open ? (
              <Modal title="Asistente IA" onClose={close}>
                <DialogBody>
                  <Alert tone="danger">{error.message}</Alert>
                  <Button onClick={reset}>Reintentar</Button>
                </DialogBody>
              </Modal>
            ) : null
          }
        >
          <Suspense
            fallback={
              open ? (
                <Modal title="Asistente IA" onClose={close}>
                  <DialogBody>
                    <Loading />
                  </DialogBody>
                </Modal>
              ) : null
            }
          >
            <AssistantWorkspace open={open} onClose={close} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
