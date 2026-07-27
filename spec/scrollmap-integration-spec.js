const NotebookScrollmap = require("../lib/scrollmap-integration");

const { normalizeLinterSeverity } = NotebookScrollmap;

// The notebook strip mirrors the linter hub's severity model, so it has to know
// every tier the hub can hand it -- a missing one would silently render as the
// wrong colour instead of failing.
describe("notebook scrollmap linter severities", () => {
  it("passes every severity of the hub model through unchanged", () => {
    expect(normalizeLinterSeverity("error")).toBe("error");
    expect(normalizeLinterSeverity("warning")).toBe("warning");
    expect(normalizeLinterSeverity("info")).toBe("info");
    expect(normalizeLinterSeverity("hint")).toBe("hint");
  });

  it("degrades an unknown severity to the neutral middle, never to error", () => {
    expect(normalizeLinterSeverity("critical")).toBe("info");
    expect(normalizeLinterSeverity(undefined)).toBe("info");
    expect(normalizeLinterSeverity(4)).toBe("info");
  });
});
