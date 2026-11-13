import { describe, expect, it } from "vitest";
import { ApiError, ensureResponse } from "./http";

describe("HTTP errors", () => {
  it("preserves the backend payload for diagnostics and field validation", async () => {
    const payload = {
      error: "La solicitud no es válida.",
      fields: { partNumber: "El número de parte ya existe." },
    };
    const response = new Response(JSON.stringify(payload), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });

    await expect(ensureResponse(response)).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: "ApiError",
        message: payload.error,
        status: 422,
        payload,
      }),
    );
  });
});
