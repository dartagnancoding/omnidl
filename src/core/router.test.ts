import { describe, expect, it } from "vitest";
import { route } from "./router.js";

describe("route", () => {
  it("routes YouTube URLs to yt-dlp", () => {
    const r = route("https://www.youtube.com/watch?v=abc123");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.adapter.name).toBe("yt-dlp");
      expect(r.value.isFallback).toBe(false);
    }
  });

  it("routes Pinterest URLs to gallery-dl", () => {
    for (const url of [
      "https://br.pinterest.com/user/board/",
      "https://www.pinterest.com/pin/12345/",
      "https://pin.it/abc",
    ]) {
      const r = route(url);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.adapter.name).toBe("gallery-dl");
    }
  });

  it("falls back to yt-dlp for unknown domains", () => {
    const r = route("https://some-unknown-video-site.example/v/1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.adapter.name).toBe("yt-dlp");
      expect(r.value.isFallback).toBe(true);
    }
  });

  it("rejects invalid URLs", () => {
    const r = route("not a url");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_URL");
  });

  it("rejects non-http protocols", () => {
    const r = route("ftp://example.com/file");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_URL");
  });

  it("does not match lookalike domains (e.g. notyoutube.com)", () => {
    const r = route("https://notyoutube.com/watch?v=abc");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.isFallback).toBe(true);
  });
});
