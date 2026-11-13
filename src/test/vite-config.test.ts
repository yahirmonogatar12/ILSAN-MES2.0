import { readFileSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import type { ProxyOptions } from "vite";
const state = vi.hoisted(() => ({ env: {} as Record<string, string> }));
vi.mock("vite", async (original) => ({
  ...(await original<typeof import("vite")>()),
  loadEnv: vi.fn(() => state.env),
}));
import config from "../../vite.config";

beforeEach(() => {
  state.env = {};
});
async function proxy() {
  if (typeof config !== "function")
    throw new Error("Expected a Vite configuration factory");
  const result = await config({ command: "serve", mode: "test" });
  return result.server!.proxy! as Record<string, ProxyOptions>;
}
it("defaults development and preview requests to the local backend", async () => {
  const value = await proxy();
  expect(value["/backend"].target).toBe("http://127.0.0.1:5000");
  expect(value["/backend"].rewrite!("/backend/api/plan")).toBe("/api/plan");
  expect(value["/backend"].cookieDomainRewrite).toBe("");
});
it("uses an explicitly configured backend for every proxied portal route", async () => {
  state.env.MES_API_TARGET = "https://mes.example:8443";
  for (const target of Object.values(await proxy()))
    expect(target.target).toBe(state.env.MES_API_TARGET);
});
it("ships the environment example documented by the setup instructions", () => {
  expect(readFileSync(".env.example", "utf8")).toContain(
    "MES_API_TARGET=http://127.0.0.1:5000",
  );
  expect(readFileSync(".gitignore", "utf8")).toContain("!.env.example");
});
// @vitest-environment node
