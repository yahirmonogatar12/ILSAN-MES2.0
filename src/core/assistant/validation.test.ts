import { describe, expect, it } from "vitest";
import { requiredInteger } from "@/shared/lib/parse";
import {
  artifact,
  attachment,
  decodeEvent,
  language,
  limits,
  message,
  quota,
  usage,
} from "./model";

describe("strict assistant numbers", () => {
  it.each([
    "invalid",
    "",
    "  ",
    true,
    false,
    [],
    {},
    NaN,
    Infinity,
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid counters, quotas and sizes %j", (value) => {
    expect(() => requiredInteger(value, "quantity")).toThrow();
    expect(() => limits({ daily_token_limit: value })).toThrow();
    expect(() => usage({ request_count: value })).toThrow();
    expect(() =>
      attachment({ filename: "plan.xlsx", size_bytes: value }),
    ).toThrow();
    expect(() => artifact({ id: "file", row_count: value })).toThrow();
  });
  it("preserves zero quotas, inherited quotas and historical numeric strings", () => {
    expect(
      limits({
        daily_request_limit: "0",
        daily_token_limit: null,
        daily_artifact_limit: "12",
      }),
    ).toEqual({
      daily_request_limit: 0,
      daily_token_limit: null,
      daily_artifact_limit: 12,
    });
    expect(
      usage({ request_count: "10", artifact_count: 0, input_tokens: null }),
    ).toEqual({
      request_count: 10,
      artifact_count: 0,
      input_tokens: 0,
      output_tokens: 0,
    });
    expect(limits(undefined).daily_token_limit).toBeNull();
    expect(usage(null).input_tokens).toBe(0);
  });
  it.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    "",
    true,
    "invalid",
    Number.MAX_SAFE_INTEGER + 1,
  ])("requires a positive message or quota id %j", (id) => {
    expect(() => message({ id, content: "hello" })).toThrow();
    expect(() =>
      quota({ id, subject_type: "user", subject_key: "qa" }),
    ).toThrow();
  });
  it("normalizes valid integer ids and retains optional legacy metadata", () => {
    expect(message({ id: "42", content: null }).id).toBe(42);
    expect(
      quota({ id: "12", subject_type: "role", subject_key: "operator" }).id,
    ).toBe(12);
    expect(
      attachment({ filename: "old.xlsx", size_bytes: null }).size_bytes,
    ).toBe(0);
    expect(artifact({ id: "old-file" }).row_count).toBe(0);
  });
  it.each([[], "invalid", false])(
    "rejects malformed usage and limits objects %j",
    (value) => {
      expect(() => limits(value)).toThrow();
      expect(() => usage(value)).toThrow();
    },
  );
  it("rejects invalid final message ids instead of silently dropping them", () => {
    expect(() => decodeEvent("done", { message_id: "invalid" })).toThrow(
      /message_id/,
    );
    expect(decodeEvent("done", {})).toMatchObject({
      type: "done",
      messageId: undefined,
    });
  });
  it("accepts only supported language strings", () => {
    expect(language("es")).toBe("es");
    expect(language({ toString: () => "es" })).toBe("auto");
  });
});
