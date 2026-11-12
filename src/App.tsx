import { useAuth } from "@/core/auth/AuthProvider";
import { useLocation } from "react-router-dom";
import { ModuleCatalogProvider } from "@/core/modules/ModuleCatalog";
import { modules, sections } from "./app/registry";
import { Workspace } from "./app/workspace/Workspace";
import { LandingPage } from "./app/pages/LandingPage";
import { AssistantLauncher } from "./app/assistant/AssistantLauncher";

export function App() {
  const { profile, scope, mode } = useAuth();
  const { pathname } = useLocation();
  if (
    !profile ||
    ["/", "/inicio", "/login"].includes(pathname.replace(/\/$/, "") || "/")
  )
    return <LandingPage />;
  // A different user/runtime starts a fresh workspace with no previous forms.
  return (
    <ModuleCatalogProvider modules={modules} sections={sections}>
      <Workspace
        key={scope}
        modules={modules}
        sections={sections}
        scope={scope}
        mode={mode}
      >
        <AssistantLauncher key={"assistant-" + scope} />
      </Workspace>
    </ModuleCatalogProvider>
  );
}
