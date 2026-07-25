/**
 * LaTeX -> SVG rendering with MathJax 4, mirrored from jupyter-repl so stored
 * notebook outputs render the same math the live REPL does.
 *
 * MathJax is loaded lazily and asynchronously from the ESM (`mjs`) build of
 * `@mathjax/src` via dynamic `import()`, so the large modules load off the
 * render path the first time a `text/latex` output appears instead of blocking
 * with a synchronous require. The headless `liteAdaptor` + SVG output produce a
 * self-contained SVG string that can be injected directly.
 */

// Memoized initialization promise; resolves to { adaptor, htmlDoc }. Reset to
// null on failure so a later render can retry.
let mjPromise = null;

function ensureMathJax() {
  if (mjPromise) return mjPromise;

  mjPromise = (async () => {
    const [{ mathjax }, { TeX }, { SVG }, { liteAdaptor }, { RegisterHTMLHandler }] =
      await Promise.all([
        import("@mathjax/src/mjs/mathjax.js"),
        import("@mathjax/src/mjs/input/tex.js"),
        import("@mathjax/src/mjs/output/svg.js"),
        import("@mathjax/src/mjs/adaptors/liteAdaptor.js"),
        import("@mathjax/src/mjs/handlers/html.js"),
      ]);

    // TeX packages register themselves as import side effects (v4 requires
    // explicit registration).
    await Promise.all([
      import("@mathjax/src/mjs/input/tex/base/BaseConfiguration.js"),
      import("@mathjax/src/mjs/input/tex/ams/AmsConfiguration.js"),
      import("@mathjax/src/mjs/input/tex/newcommand/NewcommandConfiguration.js"),
      import("@mathjax/src/mjs/input/tex/action/ActionConfiguration.js"),
      import("@mathjax/src/mjs/input/tex/color/ColorConfiguration.js"),
    ]);

    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);

    const tex = new TeX({
      packages: ["base", "ams", "newcommand", "action", "color"],
    });
    const svg = new SVG({
      fontCache: "local",
      linebreaks: { inline: false, width: "100000em" }, // Disable line-breaking
    });
    const htmlDoc = mathjax.document("", { InputJax: tex, OutputJax: svg });

    return { adaptor, htmlDoc };
  })().catch((err) => {
    console.error("MathJax initialization error:", err);
    mjPromise = null;
    throw err;
  });

  return mjPromise;
}

// Strip math delimiters from a LaTeX string, mirroring jupyter-repl so the two
// packages agree on what counts as display vs inline vs plain text.
function stripDelimiters(latex) {
  const stripped = latex.trim();

  // Multiple equation environments -> combine into a single gathered block.
  const envPattern =
    /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g;
  const envMatches = [...stripped.matchAll(envPattern)];

  if (envMatches.length > 1) {
    const contents = envMatches.map((m) => m[2].trim());
    return {
      math: "\\begin{gathered}" + contents.join(" \\\\ ") + "\\end{gathered}",
      displayMode: true,
    };
  }

  if (envMatches.length === 1) {
    return { math: envMatches[0][2].trim(), displayMode: true };
  }

  // Multiple inline/display math blocks -> combine into a gathered block.
  const inlineMathPattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  const mathMatches = [...stripped.matchAll(inlineMathPattern)];

  if (mathMatches.length > 1) {
    const contents = mathMatches.map((m) => (m[1] || m[2]).trim());
    return {
      math: "\\begin{gathered}" + contents.join(" \\\\ ") + "\\end{gathered}",
      displayMode: true,
    };
  }

  if (stripped.startsWith("$$") && stripped.endsWith("$$")) {
    return { math: stripped.slice(2, -2), displayMode: true };
  }
  if (stripped.startsWith("\\[") && stripped.endsWith("\\]")) {
    return { math: stripped.slice(2, -2), displayMode: true };
  }

  if (stripped.startsWith("$") && stripped.endsWith("$") && stripped.length > 2) {
    return { math: stripped.slice(1, -1), displayMode: false };
  }
  if (stripped.startsWith("\\(") && stripped.endsWith("\\)")) {
    return { math: stripped.slice(2, -2), displayMode: false };
  }

  // No math delimiters found - treat as plain text.
  return { math: null, isTextMode: true, original: stripped };
}

function renderToSvg(api, latex, displayMode) {
  const node = api.htmlDoc.convert(latex, { display: displayMode });
  return api.adaptor.innerHTML(node);
}

/**
 * Strip delimiters, ensure MathJax is loaded, and render LaTeX to an SVG string.
 * Returns `{ textContent }` for delimiter-free input or `{ svg, displayMode }`
 * for math.
 */
async function renderLatexToSvg(latex) {
  const result = stripDelimiters(latex || "");
  if (result.isTextMode) {
    return { textContent: result.original };
  }
  const api = await ensureMathJax();
  return {
    svg: renderToSvg(api, result.math, result.displayMode),
    displayMode: result.displayMode,
  };
}

module.exports = { renderLatexToSvg, stripDelimiters };
