import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePathLike, runPool, sanitizeFilename } from "./fs.service.js";

describe("sanitizeFilename", () => {
  it("replaces characters invalid on Windows", () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe("a_b_c_d_e_f_g_h_i_j");
  });

  it("trims trailing dots and spaces", () => {
    expect(sanitizeFilename("video... ")).toBe("video");
  });

  it("collapses whitespace", () => {
    expect(sanitizeFilename("my   cool\tvideo")).toBe("my cool video");
  });

  it("never returns an empty string", () => {
    expect(sanitizeFilename("   ")).toBe("untitled");
    expect(sanitizeFilename("...")).toBe("untitled");
  });
});

describe("resolvePathLike", () => {
  const base = path.join("C:", "Users", "me", "Downloads", "omnidl", "images");

  it("resolves '..' against base like cd, not against process.cwd()", () => {
    expect(resolvePathLike(base, "..")).toBe(path.join("C:", "Users", "me", "Downloads", "omnidl"));
  });

  it("resolves a relative sibling path against base", () => {
    expect(resolvePathLike(base, "../boards")).toBe(
      path.join("C:", "Users", "me", "Downloads", "omnidl", "boards"),
    );
  });

  it("resolves a bare folder name as a subfolder of base", () => {
    expect(resolvePathLike(base, "pinterest")).toBe(path.join(base, "pinterest"));
  });

  it("leaves an absolute path untouched", () => {
    const abs = path.join("D:", "Videos");
    expect(resolvePathLike(base, abs)).toBe(abs);
  });

  it("trims surrounding whitespace before resolving", () => {
    expect(resolvePathLike(base, "  ..  ")).toBe(path.join("C:", "Users", "me", "Downloads", "omnidl"));
  });
});

describe("runPool", () => {
  it("processes all items and preserves order of results", async () => {
    const results = await runPool([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : -1))).toEqual([
      10, 20, 30, 40, 50,
    ]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await runPool([1, 2, 3, 4, 5, 6], 2, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("captures rejections without aborting the batch", async () => {
    const results = await runPool([1, 2, 3], 1, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]?.status).toBe("rejected");
    expect(results[2]?.status).toBe("fulfilled");
  });
});
