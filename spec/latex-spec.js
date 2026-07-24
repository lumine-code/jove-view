/* global describe, it, expect */

const { renderLatexToSvg, stripDelimiters } = require("../lib/latex");

// Exercises the async ESM MathJax load path that renders stored `text/latex`
// notebook outputs. renderLatexToSvg dynamically imports the `mjs` build of
// `@mathjax/src` and renders through the headless liteAdaptor, so it needs no
// browser DOM and runs in the spec env.
describe("LaTeX MathJax rendering (async ESM load)", () => {
  it("classifies inline, display, and delimiter-free input", () => {
    expect(stripDelimiters("$x$").displayMode).toBe(false);
    expect(stripDelimiters("$$x$$").displayMode).toBe(true);
    expect(stripDelimiters("plain text").isTextMode).toBe(true);
  });

  it("loads MathJax from the ESM build and renders inline TeX to an SVG string", async () => {
    const out = await renderLatexToSvg("$x^2 + 1$");
    expect(out.svg).toContain("<svg");
    expect(out.displayMode).toBe(false);
  });

  it("renders display math from $$...$$", async () => {
    const out = await renderLatexToSvg("$$\\frac{1}{2}$$");
    expect(out.svg).toContain("<svg");
    expect(out.displayMode).toBe(true);
  });

  it("uses an AMS-package construct without erroring", async () => {
    const out = await renderLatexToSvg("$$\\begin{align} a &= b \\end{align}$$");
    expect(out.svg).toContain("<svg");
  });

  it("returns text mode for input without math delimiters", async () => {
    const out = await renderLatexToSvg("just plain text");
    expect(out.textContent).toBe("just plain text");
    expect(out.svg).toBeUndefined();
  });
});
