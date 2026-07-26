import { describe, expect, it } from "vitest";

import { parseMetaRefresh } from "../src/metaRefresh.js";

describe("parseMetaRefresh", () => {
  it("parses standard delay + url", () => {
    const r = parseMetaRefresh('<meta http-equiv="refresh" content="0; url=https://x.example/next">');
    expect(r).toEqual({ delaySeconds: 0, url: "https://x.example/next" });
  });

  it("is case-insensitive and tolerant of attribute order", () => {
    const r = parseMetaRefresh('<META CONTENT="5;URL=/rel" HTTP-EQUIV="Refresh">');
    expect(r).toEqual({ delaySeconds: 5, url: "/rel" });
  });

  it("handles single-quoted url values inside a double-quoted content attr", () => {
    const r = parseMetaRefresh('<meta http-equiv="refresh" content="2; url=\'/q\'">');
    expect(r?.url).toBe("/q");
  });

  it("records a same-page refresh as null url", () => {
    const r = parseMetaRefresh('<meta http-equiv="refresh" content="3">');
    expect(r).toEqual({ delaySeconds: 3, url: null });
  });

  it("ignores non-refresh meta tags", () => {
    expect(parseMetaRefresh('<meta name="viewport" content="width=device-width">')).toBeNull();
  });

  it("returns null when there is no meta refresh", () => {
    expect(parseMetaRefresh("<html><body>hi</body></html>")).toBeNull();
  });

  it("preserves large delays so callers can reject them", () => {
    const r = parseMetaRefresh('<meta http-equiv="refresh" content="30; url=/slow">');
    expect(r).toEqual({ delaySeconds: 30, url: "/slow" });
  });
});
