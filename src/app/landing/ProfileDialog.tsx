import { useState } from "react";
import { useAuth } from "@/core/auth/useAuth";
import type { ProfileUpdate } from "@/core/auth/types";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DialogBody,
  DialogFooter,
  FormMessages,
  Modal,
  TextField,
} from "@/shared/ui";
import { validateProfile } from "./profile";

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const [saved, setSaved] = useState(false);
  const editable = auth.profile?.editable !== false;
  const form = useForm<ProfileUpdate>({
    initialValues: {
      nombre_completo: auth.profile?.nombre_completo || "",
      email: auth.profile?.email || "",
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
    validate: validateProfile,
    onSubmit: async (values) => {
      setSaved(false);
      try {
        await auth.saveProfile(values);
        setSaved(true);
      } finally {
        form.setValues((previous) => ({
          ...previous,
          current_password: "",
          new_password: "",
          confirm_password: "",
        }));
      }
    },
  });
  return (
    <Modal
      title="Configuración de usuario"
      subtitle="Mi Perfil"
      onClose={onClose}
      busy={form.pending}
      size="lg"
      className="landing-profile"
    >
      <DialogBody>
        <form
          id="landing-profile-form"
          className="landing-profile-form"
          onSubmit={form.handleSubmit}
        >
          <div className="landing-profile-grid">
            <TextField
              label="Usuario"
              value={auth.profile?.username || ""}
              readOnly
            />
            <TextField label="Rol" value={auth.profile?.rol || ""} readOnly />
          </div>
          <TextField
            label="Nombre completo"
            autoComplete="name"
            value={form.values.nombre_completo}
            maxLength={120}
            disabled={!editable || form.pending}
            required
            initialFocus
            onChange={(event) => {
              setSaved(false);
              form.setField("nombre_completo", event.target.value);
            }}
          />
          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            value={form.values.email}
            disabled={!editable || form.pending}
            onChange={(event) => {
              setSaved(false);
              form.setField("email", event.target.value);
            }}
          />
          <h3>Cambiar contraseña</h3>
          <p>Completa los tres campos para cambiar tu contraseña.</p>
          <TextField
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={form.values.current_password}
            disabled={!editable || form.pending}
            onChange={(event) => {
              setSaved(false);
              form.setField("current_password", event.target.value);
            }}
          />
          <div className="landing-profile-grid">
            <TextField
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              value={form.values.new_password}
              disabled={!editable || form.pending}
              onChange={(event) => {
                setSaved(false);
                form.setField("new_password", event.target.value);
              }}
            />
            <TextField
              label="Confirmar nueva contraseña"
              type="password"
              autoComplete="new-password"
              value={form.values.confirm_password}
              disabled={!editable || form.pending}
              onChange={(event) => {
                setSaved(false);
                form.setField("confirm_password", event.target.value);
              }}
            />
          </div>
          {!editable && (
            <Alert tone="warning">
              El servidor permite consultar este perfil.
            </Alert>
          )}
          <FormMessages errors={form.errors} error={form.error} />
          {saved && (
            <Alert tone="success">Perfil actualizado correctamente.</Alert>
          )}
        </form>
      </DialogBody>
      <DialogFooter>
        <Button disabled={form.pending} onClick={onClose}>
          Cerrar
        </Button>
        <Button
          type="submit"
          form="landing-profile-form"
          variant="primary"
          loading={form.pending}
          disabled={!editable}
        >
          Guardar cambios
        </Button>
      </DialogFooter>
    </Modal>
  );
}
