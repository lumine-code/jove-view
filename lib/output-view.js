/**
 * OutputView - static renderer for stored Jupyter cell outputs.
 */

const Anser = require("anser");
const { renderLatexToSvg } = require("./latex");
const markdown = require("./markdown");

const PLOTLY_MIME = "application/vnd.plotly.v1+json";
let plotlyModule;

// Resolve plotly.js-dist lazily: prefer a local install, otherwise reuse the
// copy shipped with jove-repl (always present, it provides the kernels).
function loadPlotly() {
  if (plotlyModule !== undefined) return plotlyModule;
  try {
    plotlyModule = require("plotly.js-dist");
  } catch (error) {
    try {
      const path = require("path");
      const base = atom.packages.resolvePackagePath("jove-repl");
      plotlyModule = base ? require(path.join(base, "node_modules", "plotly.js-dist")) : null;
    } catch (fallbackError) {
      plotlyModule = null;
    }
  }
  return plotlyModule;
}

function asText(value) {
  if (Array.isArray(value)) return value.join("");
  return value == null ? "" : String(value);
}

// Jupyter bundles carry multi-line values as string arrays, so join before
// handing anything to the shared renderer.
function renderMarkdown(value) {
  return markdown.renderMarkdown(asText(value));
}

function adjustColorForContrast(rgbValues) {
  const parts = rgbValues.split(",").map((part) => parseInt(part.trim(), 10));
  if (parts.length !== 3) return rgbValues;

  const [red, green, blue] = parts;
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  if (luminance < 0.5) {
    return `${Math.min(255, red + 100)}, ${Math.min(255, green + 100)}, ${Math.min(
      255,
      blue + 100,
    )}`;
  }

  return `${Math.max(0, red - 100)}, ${Math.max(0, green - 100)}, ${Math.max(0, blue - 100)}`;
}

function appendAnsiText(parent, text) {
  const parsed = Anser.ansiToJson(asText(text), { remove_empty: true });

  for (const part of parsed) {
    if (!part.content) continue;

    const { fg, bg, decoration } = part;
    let foreground = fg || null;
    const background = bg || null;

    const span = document.createElement("span");
    span.textContent = part.content;

    if (foreground && background && foreground === background) {
      foreground = adjustColorForContrast(foreground);
    }
    if (foreground) span.style.color = `rgb(${foreground})`;
    if (background) span.style.backgroundColor = `rgb(${background})`;
    if (decoration === "bold") span.style.fontWeight = "bold";
    else if (decoration === "italic") span.style.fontStyle = "italic";
    else if (decoration === "underline") span.style.textDecoration = "underline";

    parent.appendChild(span);
  }
}

function appendText(parent, className, text) {
  const pre = document.createElement("pre");
  pre.className = className;
  appendAnsiText(pre, text);
  parent.appendChild(pre);
}

function appendPlotly(parent, figureData) {
  const Plotly = loadPlotly();
  if (!Plotly) return false;

  let figure = figureData;
  if (typeof figure === "string") {
    try {
      figure = JSON.parse(figure);
    } catch (error) {
      return false;
    }
  }
  if (!figure || typeof figure !== "object") return false;

  const container = document.createElement("div");
  container.className = "output-plotly plotly-container";
  container.style.width = "100%";
  container.style.minHeight = "400px";

  // Transparent backgrounds so the plot blends with the editor theme.
  const layout = {
    ...(figure.layout || {}),
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  };
  if (layout.width) container.style.width = `${layout.width}px`;
  if (layout.height) {
    container.style.height = `${layout.height}px`;
    container.style.minHeight = `${layout.height}px`;
  }

  parent.appendChild(container);
  // Defer plotting until the output tree is attached to the document, so
  // plotly measures the real container width instead of a detached node.
  requestAnimationFrame(() => {
    if (!container.isConnected) return;
    Plotly.newPlot(container, {
      data: figure.data || [],
      layout,
      frames: figure.frames || [],
      config: { responsive: true },
    }).catch(() => {
      container.remove();
    });
  });
  return true;
}

// Render a `text/latex` output to an SVG via MathJax. Rendering is async (the
// MathJax ESM build loads lazily on first use), so a placeholder is shown and
// swapped for the SVG once ready. The render token guards against a later
// re-render or destroy superseding this output while the promise is in flight.
function appendLatex(parent, latexData, view) {
  const wrapper = document.createElement("div");
  wrapper.className = "output-latex";
  const raw = asText(latexData);
  const token = view ? view._renderToken : null;
  const stale = () => view != null && view._renderToken !== token;

  const loading = document.createElement("span");
  loading.className = "output-latex-loading";
  loading.textContent = "Rendering…";
  wrapper.appendChild(loading);
  parent.appendChild(wrapper);

  renderLatexToSvg(raw)
    .then((result) => {
      if (stale()) return;
      if (result.svg) {
        wrapper.innerHTML = result.svg;
        wrapper.classList.toggle("output-latex-display", !!result.displayMode);
      } else {
        // Delimiter-free LaTeX renders as plain text.
        wrapper.textContent = result.textContent != null ? result.textContent : raw;
      }
    })
    .catch(() => {
      if (stale()) return;
      // Fall back to the raw LaTeX source if MathJax fails to load or render.
      wrapper.textContent = raw;
    });
}

function appendMimeBundle(parent, output, view) {
  const data = output.data || {};

  if (data[PLOTLY_MIME] && appendPlotly(parent, data[PLOTLY_MIME])) {
    return;
  }

  if (data["image/png"] || data["image/jpeg"] || data["image/gif"]) {
    const mime = data["image/png"] ? "image/png" : data["image/jpeg"] ? "image/jpeg" : "image/gif";
    const img = document.createElement("img");
    img.className = "output-image";
    img.src = `data:${mime};base64,${asText(data[mime]).replace(/\s/g, "")}`;
    img.draggable = false;
    parent.appendChild(img);
    return;
  }

  if (data["image/svg+xml"]) {
    const wrapper = document.createElement("div");
    wrapper.className = "output-svg";
    wrapper.innerHTML = asText(data["image/svg+xml"]);
    parent.appendChild(wrapper);
    return;
  }

  if (data["text/html"]) {
    const wrapper = document.createElement("div");
    wrapper.className = "output-html";
    wrapper.innerHTML = asText(data["text/html"]);
    parent.appendChild(wrapper);
    return;
  }

  if (data["text/markdown"]) {
    const wrapper = document.createElement("div");
    wrapper.className = "output-markdown";
    wrapper.innerHTML = renderMarkdown(data["text/markdown"]);
    parent.appendChild(wrapper);
    return;
  }

  if (data["text/latex"]) {
    appendLatex(parent, data["text/latex"], view);
    return;
  }

  if (data["application/json"]) {
    appendText(
      parent,
      "output-json output-code",
      JSON.stringify(data["application/json"], null, 2),
    );
    return;
  }

  if (data["text/plain"]) {
    appendText(parent, "output-text", data["text/plain"]);
  }
}

class OutputView {
  constructor(props) {
    this.props = props;
    this.element = document.createElement("div");
    this.element.className = "jove-output-container";
    this._lastOutputsHash = null;
    this._lastMaxHeight = null;
    // Bumped on every re-render/destroy so an in-flight async LaTeX render can
    // tell it has been superseded before touching a now-stale node.
    this._renderToken = 0;
    // Block image drag-and-drop from outputs (catches imgs embedded in
    // text/html outputs that don't go through the image MIME branch).
    this.element.addEventListener("dragstart", (event) => {
      if (event.target?.tagName === "IMG") event.preventDefault();
    });
    this.renderContent();
  }

  _getOutputsHash(outputs) {
    if (!outputs || outputs.length === 0) return "empty";
    return JSON.stringify(outputs);
  }

  renderOutput(output, index) {
    const item = document.createElement("div");
    item.className = `jove-output output-${output.output_type || "unknown"}`;
    item.dataset.outputIndex = String(index);

    if (output.output_type === "stream") {
      appendText(item, `output-stream output-${output.name || "stream"}`, output.text);
    } else if (output.output_type === "error") {
      const traceback =
        output.traceback && output.traceback.length
          ? output.traceback
          : [`${output.ename || "Error"}: ${output.evalue || ""}`];
      appendText(item, "output-error", traceback.join("\n"));
    } else if (output.output_type === "display_data" || output.output_type === "execute_result") {
      appendMimeBundle(item, output, this);
    } else if (output.text) {
      appendText(item, "output-text", output.text);
    }

    return item;
  }

  renderContent() {
    const { outputs, maxHeight } = this.props;
    this._lastOutputsHash = this._getOutputsHash(outputs);
    this._lastMaxHeight = maxHeight;
    this._renderToken += 1;

    const wrapper = document.createElement("div");
    wrapper.className = "jove-outputs";
    if (maxHeight > 0) {
      wrapper.style.maxHeight = `${maxHeight}px`;
      wrapper.style.overflowY = "auto";
    }

    for (const [index, output] of (outputs || []).entries()) {
      wrapper.appendChild(this.renderOutput(output, index));
    }

    this.element.innerHTML = "";
    this.element.appendChild(wrapper);
  }

  update(props) {
    this.props = { ...this.props, ...props };

    const newHash = this._getOutputsHash(this.props.outputs);
    const maxHeightChanged = this.props.maxHeight !== this._lastMaxHeight;

    if (newHash === this._lastOutputsHash && !maxHeightChanged) return;

    if (newHash === this._lastOutputsHash && maxHeightChanged) {
      const container = this.element.querySelector(".jove-outputs");
      if (container) {
        if (this.props.maxHeight > 0) {
          container.style.maxHeight = `${this.props.maxHeight}px`;
          container.style.overflowY = "auto";
        } else {
          container.style.maxHeight = "";
          container.style.overflowY = "";
        }
        this._lastMaxHeight = this.props.maxHeight;
        return;
      }
    }

    this.renderContent();
  }

  destroy() {
    this._renderToken += 1;
    this.element = null;
  }
}

module.exports = OutputView;
