import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssistantApi, Thread } from "@/core/assistant/types";
import { Messages } from "./Messages";

const conversation = {
  public_id: "conversation-1",
  title: "Prueba",
  language: "es" as const,
  model: "test",
  status: "active",
  updated_at: null,
};

function thread(content: string): Thread {
  return {
    conversation,
    messages: [
      {
        id: 1,
        key: "message-1",
        client_message_id: null,
        role: "assistant",
        content,
        status: "complete",
        created_at: "2026-11-13T00:00:00Z",
        attachments: [],
        artifacts: [],
        visualizations: [],
      },
    ],
    artifacts: [],
  };
}

describe("Messages", () => {
  it("actualiza la colección renderizada cuando cambia el hilo", () => {
    const props = {
      api: {} as AssistantApi,
      scope: "demo",
      language: "es" as const,
    };
    const view = render(<Messages {...props} thread={thread("Inicial")} />);

    expect(screen.getByText("Inicial")).toBeInTheDocument();

    view.rerender(<Messages {...props} thread={thread("Actualizado")} />);

    expect(screen.getByText("Actualizado")).toBeInTheDocument();
    expect(screen.queryByText("Inicial")).not.toBeInTheDocument();
  });
});
