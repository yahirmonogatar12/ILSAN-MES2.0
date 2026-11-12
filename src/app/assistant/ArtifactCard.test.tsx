import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/app/providers";
import { createAssistantApi } from "@/core/assistant/api";
import { artifact } from "@/core/assistant/model";
import { saveDownload } from "@/core/http";
import { ArtifactCard } from "./ArtifactCard";
import { translations } from "./i18n";
vi.mock("@/core/http", async (original) => ({
  ...(await original<typeof import("@/core/http")>()),
  saveDownload: vi.fn(),
}));
const file = artifact({
  id: "art",
  type: "xlsx",
  title: "Inventario",
  filename: "inventario.xlsx",
  status: "ready",
  mime_type:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
describe("assistant generated files", () => {
  it("hides regeneration when the artifact permission is absent", () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ArtifactCard
          artifact={file}
          api={createAssistantApi("live", "qa")}
          scope="qa"
          conversation="chat"
          canGenerate={false}
          t={translations.es}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: "Regenerar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Descargar" })).toBeVisible();
  });
  it("aborts a download and discards a late response after leaving the session", async () => {
    let signal!: AbortSignal,
      finish!: (file: { blob: Blob; name: string }) => void;
    const download = vi.fn(async (_artifact, _preview, currentSignal) => {
      signal = currentSignal;
      return new Promise<{ blob: Blob; name: string }>((resolve) => {
        finish = resolve;
      });
    });
    const view = render(
      <QueryClientProvider client={createQueryClient()}>
        <ArtifactCard
          artifact={file}
          api={{ ...createAssistantApi("live", "qa"), file: download }}
          scope="qa"
          conversation="chat"
          canGenerate
          t={translations.es}
        />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Descargar" }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () =>
      finish({ blob: new Blob(["data"]), name: "late.xlsx" }),
    );
    expect(saveDownload).not.toHaveBeenCalled();
  });
});
