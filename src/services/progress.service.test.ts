import { describe, expect, it } from "vitest";
import {
  formatProgress,
  parseYtDlpDestination,
  parseYtDlpProgress,
} from "./progress.service.js";

describe("parseYtDlpProgress", () => {
  it("parses a full progress line", () => {
    const info = parseYtDlpProgress("[download]  42.3% of 10.51MiB at 1.24MiB/s ETA 00:12");
    expect(info).toEqual({ percent: 42.3, speed: "1.24MiB/s", eta: "00:12" });
  });

  it("parses 100% without ETA", () => {
    const info = parseYtDlpProgress("[download] 100% of 10.51MiB in 00:08");
    expect(info?.percent).toBe(100);
  });

  it("handles Unknown speed/ETA", () => {
    const info = parseYtDlpProgress("[download]   0.0% of ~ 5.00MiB at Unknown speed ETA Unknown");
    expect(info?.percent).toBe(0);
    expect(info?.speed).toBeUndefined();
  });

  it("returns undefined for non-progress lines", () => {
    expect(parseYtDlpProgress("[youtube] abc: Downloading webpage")).toBeUndefined();
  });
});

describe("parseYtDlpDestination", () => {
  it("captures Destination lines as intermediate", () => {
    const d = parseYtDlpDestination("[download] Destination: C:\\media\\video [abc].f137.mp4");
    expect(d).toEqual({ filePath: "C:\\media\\video [abc].f137.mp4", final: false });
  });

  it("captures Merger output as final", () => {
    const d = parseYtDlpDestination('[Merger] Merging formats into "C:\\media\\video [abc].mp4"');
    expect(d).toEqual({ filePath: "C:\\media\\video [abc].mp4", final: true });
  });

  it("captures ExtractAudio output as final", () => {
    const d = parseYtDlpDestination("[ExtractAudio] Destination: C:\\media\\song [abc].mp3");
    expect(d).toEqual({ filePath: "C:\\media\\song [abc].mp3", final: true });
  });

  it("captures already-downloaded files", () => {
    const d = parseYtDlpDestination("[download] C:\\media\\video [abc].mp4 has already been downloaded");
    expect(d).toEqual({ filePath: "C:\\media\\video [abc].mp4", final: false });
  });
});

describe("formatProgress", () => {
  it("joins percent, speed and eta", () => {
    expect(formatProgress({ percent: 42.3, speed: "1.2MiB/s", eta: "00:12" })).toBe(
      "42.3% | 1.2MiB/s | ETA 00:12",
    );
  });

  it("falls back to status text", () => {
    expect(formatProgress({ status: "3 file(s)" })).toBe("3 file(s)");
  });
});
