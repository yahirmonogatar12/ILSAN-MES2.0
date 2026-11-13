import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FlaskConical,
  IdCard,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/core/auth/useAuth";
import { useForm } from "@/shared/hooks/useForm";
import {
  Alert,
  Button,
  DisclosureMenu,
  FormMessages,
  TextField,
} from "@/shared/ui";
import { ProfileDialog } from "./ProfileDialog";

export function PortalHeader() {
  const auth = useAuth(),
    navigate = useNavigate();
  const username = useRef<HTMLInputElement>(null);
  const header = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(74);
  useLayoutEffect(() => {
    const element = header.current!;
    const measure = () =>
      setHeaderHeight(element.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const [profileOpen, setProfileOpen] = useState(false);
  const [entryNotice, setEntryNotice] = useState(false);
  const logout = useForm({
    initialValues: {},
    validate: () => [],
    onSubmit: () => auth.logout(),
  });
  const login = useForm({
    initialValues: { username: "", password: "" },
    validate: (values) =>
      !values.username.trim() || !values.password
        ? ["Escribe tu usuario y contraseña."]
        : [],
    onSubmit: async (values) => {
      setEntryNotice(false);
      try {
        await auth.login(values.username, values.password);
      } finally {
        login.setField("password", "");
      }
    },
  });
  function requireSession(event: MouseEvent<HTMLAnchorElement>) {
    if (auth.profile) return;
    event.preventDefault();
    setEntryNotice(true);
    username.current?.focus();
  }
  return (
    <>
      <header ref={header} className="landing-header">
        <Link
          to="/inicio"
          className="landing-identity"
          aria-label="Portal ILSAN"
        >
          <img src="/brand/ilsan-logo.png" alt="ILSAN" width={50} height={40} />
          <span>
            Ilsan Electronics
            <br />
            Monterrey Mexico
          </span>
        </Link>
        {auth.profile ? (
          <DisclosureMenu
            align="right"
            className="landing-account"
            label={
              <>
                <UserRound size={21} fill="currentColor" />
                <span className="landing-visually-hidden">Menú de usuario</span>
              </>
            }
          >
            <div className="landing-account-name">
              <span>Bienvenido</span>
              <strong>{auth.profile.nombre_completo}</strong>
            </div>
            <Button
              variant="plain"
              icon={<IdCard size={16} />}
              onClick={() => setProfileOpen(true)}
            >
              Mi Perfil
            </Button>
            <Button
              variant="plain"
              icon={<Settings size={16} />}
              onClick={() => setProfileOpen(true)}
            >
              Configuración
            </Button>
            <Button
              variant="plain"
              icon={<LogOut size={16} />}
              loading={logout.pending}
              onClick={() => void logout.submit()}
            >
              Logout
            </Button>
          </DisclosureMenu>
        ) : (
          <form
            className="landing-login"
            onSubmit={login.handleSubmit}
            aria-label="Iniciar sesión"
          >
            <h2 className="landing-visually-hidden">Iniciar sesión</h2>
            <span className="landing-login-avatar" aria-hidden="true">
              <UserRound size={22} />
            </span>
            <TextField
              ref={username}
              aria-label="Usuario"
              name="username"
              placeholder="Usuario"
              autoComplete="username"
              required
              value={login.values.username}
              disabled={login.pending || auth.checking}
              onChange={(event) =>
                login.setField("username", event.target.value)
              }
            />
            <TextField
              aria-label="Contraseña"
              name="password"
              placeholder="Contraseña"
              autoComplete="current-password"
              type="password"
              required
              value={login.values.password}
              disabled={login.pending || auth.checking}
              onChange={(event) =>
                login.setField("password", event.target.value)
              }
            />
            <Button
              type="submit"
              variant="primary"
              loading={login.pending}
              loadingLabel="Ingresando…"
              disabled={auth.checking}
            >
              Ingresar
            </Button>
          </form>
        )}
        {(entryNotice ||
          login.error ||
          login.errors.length > 0 ||
          logout.error ||
          auth.error) && (
          <div className="landing-feedback">
            {entryNotice && !auth.profile && (
              <Alert>Inicia sesión para abrir esta aplicación.</Alert>
            )}
            <FormMessages
              errors={login.errors}
              error={login.error || logout.error}
            />
            {auth.error && (
              <Alert tone="warning">
                {auth.error.message}{" "}
                <Button size="sm" onClick={() => void auth.retry()}>
                  Volver a conectar
                </Button>
              </Alert>
            )}
          </div>
        )}
      </header>
      <section className="landing-hero" aria-labelledby="landing-title">
        <img
          src="/brand/ilsan-facility.png"
          alt="Planta de Ilsan Electronics en Monterrey"
          fetchPriority="high"
        />
        <div>
          <h1 id="landing-title">Ilsan Electronics</h1>
          <p>¡EXPERTOS EN COMPONENTES ELECTRONICOS!</p>
        </div>
      </section>
      <nav
        className="landing-nav"
        aria-label="Portal corporativo"
        style={{ "--landing-nav-offset": headerHeight + "px" } as CSSProperties}
      >
        <Link to="/inicio" aria-current="page">
          User Info
        </Link>
        <DisclosureMenu
          className="landing-systems"
          label="System Link"
          openOnHover
        >
          <Link to="/mes" onClick={requireSession}>
            <span className="landing-menu-bullet" aria-hidden="true">
              •
            </span>
            ILSAN MES
          </Link>
          <a href="/defect-management" onClick={requireSession}>
            <span className="landing-menu-bullet" aria-hidden="true">
              •
            </span>
            Defect Management
          </a>
          {!auth.profile && (
            <Button
              variant="plain"
              icon={<FlaskConical size={15} />}
              onClick={() => {
                auth.switchMode("demo");
                void navigate("/mes");
              }}
            >
              Ver demostración
            </Button>
          )}
        </DisclosureMenu>
        <a href="/portal-tickets" onClick={requireSession}>
          Support
        </a>
        <a href="/calendario" onClick={requireSession}>
          Calendar
        </a>
      </nav>
      {profileOpen && auth.profile && (
        <ProfileDialog onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}
