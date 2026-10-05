import { beforeEach, describe, expect, it, vi } from "vitest";

const readdir = vi.fn();
const stat = vi.fn();

vi.mock("node:fs", () => ({
  promises: {
    readdir: (...args: unknown[]) => readdir(...args),
    stat: (...args: unknown[]) => stat(...args),
  },
}));

vi.mock("node:os", () => ({
  default: { homedir: () => "C:\\Users\\test" },
}));

const { resolveCookiesFromBrowser } = await import("./browser-cookies.service.js");

describe("resolveCookiesFromBrowser", () => {
  beforeEach(() => {
    readdir.mockReset();
    stat.mockReset();
  });

  it("passes through non-zen browser names unchanged", async () => {
    const result = await resolveCookiesFromBrowser("chrome");
    expect(result).toEqual({ ok: true, value: "chrome" });
  });

  it("resolves 'zen' to firefox:<most recently used profile>", async () => {
    readdir.mockResolvedValue(["a.old", "b.new"]);
    stat.mockImplementation((p: string) =>
      Promise.resolve({ mtimeMs: p.includes("b.new") ? 200 : 100 }),
    );

    const result = await resolveCookiesFromBrowser("zen");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startsWith("firefox:")).toBe(true);
      expect(result.value).toContain("b.new");
      expect(result.value).not.toContain("a.old");
    }
  });

  it("accepts case-insensitive zen aliases", async () => {
    readdir.mockResolvedValue(["only"]);
    stat.mockResolvedValue({ mtimeMs: 1 });
    const result = await resolveCookiesFromBrowser("Zen-Browser");
    expect(result.ok).toBe(true);
  });

  it("fails with ZEN_NOT_FOUND when no profile has cookies.sqlite", async () => {
    readdir.mockResolvedValue(["a", "b"]);
    stat.mockRejectedValue(new Error("ENOENT"));
    const result = await resolveCookiesFromBrowser("zen");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ZEN_NOT_FOUND");
  });

  it("fails with ZEN_NOT_FOUND when the profiles directory doesn't exist", async () => {
    readdir.mockRejectedValue(new Error("ENOENT"));
    const result = await resolveCookiesFromBrowser("zen");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("ZEN_NOT_FOUND");
  });
});
