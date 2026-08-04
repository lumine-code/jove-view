/**
 * OutputView - renders the outputs stored in a notebook cell.
 */

const etch = require("@lumine-code/etch");
const Anser = require("anser");
const { renderLatexToSvg } = require("./latex");
const markdown = require("./markdown");

const PLOTLY_MIME = "application/vnd.plotly.v1+json";
let plotlyModule;

// Resolve plotly.js-dist lazily: prefer a local install, otherwise reuse the
// copy shipped with jupyter-repl (always present, it provides the kernels).
function loadPlotly() {
  if (plotlyModule !== undefined) return plotlyModule;
  try {
    plotlyModule = require("plotly.js-dist");
  } catch (error) {
    try {
      const path = require("path");
      const base = atom.packages.resolvePackagePath("jupyter-repl");
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
    return `${Math.min(255, red + 100)}, ${Math.min(255, green + 100)}, ${Math.min(255, blue + 100)}`;
  }
  return `${Math.max(0, red - 100)}, ${Math.max(0, green - 100)}, ${Math.max(0, blue - 100)}`;
}

/** Text with ANSI escapes, as coloured virtual nodes. */
function ansiNodes(text) {
  const parsed = Anser.ansiToJson(asText(text), { remove_empty: true });

  return parsed.map((part) => {
    if (!part.content) return null;

    const { fg, bg, decoration } = part;
    let foreground = fg || null;
    const background = bg || null;

    if (foreground && background && foreground === background) {
      foreground = adjustColorForContrast(foreground);
    }

    const style = {};
    if (foreground) style.color = `rgb(${foreground})`;
    if (background) style.backgroundColor = `rgb(${background})`;
    if (decoration === "bold") style.fontWeight = "bold";
    else if (decoration === "italic") style.fontStyle = "italic";
    else if (decoration === "underline") style.textDecoration = "underline";

    if (Object.keys(style).length === 0) return part.content;
    return <span style={style}>{part.content}</span>;
  });
}

function renderText(className, text) {
  return <pre className={className}>{ansiNodes(text)}</pre>;
}

/**
 * A Plotly figure. Plotly owns the node once it has drawn into it, so this is a
 * component: the plot is created after the element is attached (it measures the
 * container) and torn down when the component goes.
 */
class PlotlyOutput {
  constructor(props) {
    this.props = props;
    this.plotly = null;
    etch.initialize(this);
    this.plot();
  }

  figure() {
    let figure = this.props.data;
    if (typeof figure === "string") {
      try {
        figure = JSON.parse(figure);
      } catch (error) {
        return null;
      }
    }
    return figure && typeof figure === "object" ? figure : null;
  }

  plot() {
    const Plotly = loadPlotly();
    const figure = this.figure();
    if (!Plotly || !figure) return;

    // Defer until the output tree is attached to the document, so plotly
    // measures the real container width instead of a detached node.
    requestAnimationFrame(() => {
      if (!this.element || !this.element.isConnected) return;
      this.plotly = Plotly;
      Plotly.newPlot(this.element, {
        data: figure.data || [],
        layout: {
          ...(figure.layout || {}),
          // Transparent, so the plot blends with the editor theme.
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
        },
        frames: figure.frames || [],
        config: { responsive: true },
      }).catch(() => {
        this.plotly = null;
      });
    });
  }

  render() {
    const layout = (this.figure() || {}).layout || {};
    const style = { width: "100%", minHeight: "400px" };
    if (layout.width) style.width = `${layout.width}px`;
    if (layout.height) {
      style.height = `${layout.height}px`;
      style.minHeight = `${layout.height}px`;
    }
    return <div className="output-plotly plotly-container" style={style} />;
  }

  update(props) {
    if (props.data === this.props.data) {
      this.props = props;
      return Promise.resolve();
    }
    this.props = props;
    return etch.update(this).then(() => this.plot());
  }

  destroy() {
    if (this.plotly && this.element) {
      this.plotly.purge(this.element);
    }
    return etch.destroy(this);
  }
}

/**
 * A `text/latex` output. MathJax loads lazily on first use, so a placeholder
 * shows until the SVG is ready; the token guards against a later render or a
 * destroy superseding one still in flight.
 */
class LatexOutput {
  constructor(props) {
    this.props = props;
    this.svg = null;
    this.displayMode = false;
    this.textContent = null;
    this.renderToken = 0;
    etch.initialize(this);
    this.renderLatex();
  }

  async renderLatex() {
    const token = ++this.renderToken;
    const raw = asText(this.props.data);
    try {
      const result = await renderLatexToSvg(raw);
      if (token !== this.renderToken) return;
      this.svg = result.svg || null;
      this.displayMode = Boolean(result.displayMode);
      this.textContent = result.svg ? null : (result.textContent ?? raw);
    } catch (error) {
      if (token !== this.renderToken) return;
      // Fall back to the raw LaTeX source if MathJax fails to load or render.
      this.svg = null;
      this.textContent = raw;
    }
    return etch.update(this);
  }

  render() {
    const className = `output-latex${this.displayMode ? " output-latex-display" : ""}`;
    if (this.svg) {
      return <div className={className} innerHTML={this.svg} />;
    }
    if (this.textContent != null) {
      return <div className={className}>{this.textContent}</div>;
    }
    return (
      <div className="output-latex">
        <span className="output-latex-loading">Rendering…</span>
      </div>
    );
  }

  update(props) {
    if (props.data === this.props.data) {
      this.props = props;
      return Promise.resolve();
    }
    this.props = props;
    this.svg = null;
    this.textContent = null;
    return this.renderLatex();
  }

  destroy() {
    // Supersede any render still in flight.
    this.renderToken += 1;
    return etch.destroy(this);
  }
}

/** The richest representation the bundle offers, in the order we prefer them. */
function renderMimeBundle(output) {
  const data = output.data || {};

  if (data[PLOTLY_MIME] && loadPlotly()) {
    return <PlotlyOutput data={data[PLOTLY_MIME]} />;
  }

  const imageMime = data["image/png"]
    ? "image/png"
    : data["image/jpeg"]
      ? "image/jpeg"
      : data["image/gif"]
        ? "image/gif"
        : null;
  if (imageMime) {
    const src = `data:${imageMime};base64,${asText(data[imageMime]).replace(/\s/g, "")}`;
    return <img className="output-image" src={src} draggable={false} />;
  }

  if (data["image/svg+xml"]) {
    return <div className="output-svg" innerHTML={asText(data["image/svg+xml"])} />;
  }
  if (data["text/html"]) {
    return <div className="output-html" innerHTML={asText(data["text/html"])} />;
  }
  if (data["text/markdown"]) {
    return <div className="output-markdown" innerHTML={renderMarkdown(data["text/markdown"])} />;
  }
  if (data["text/latex"]) {
    return <LatexOutput data={data["text/latex"]} />;
  }
  if (data["application/json"]) {
    return renderText("output-json output-code", JSON.stringify(data["application/json"], null, 2));
  }
  if (data["text/plain"]) {
    return renderText("output-text", data["text/plain"]);
  }
  return null;
}

function renderOutput(output) {
  if (output.output_type === "stream") {
    return renderText(`output-stream output-${output.name || "stream"}`, output.text);
  }
  if (output.output_type === "error") {
    const traceback =
      output.traceback && output.traceback.length
        ? output.traceback
        : [`${output.ename || "Error"}: ${output.evalue || ""}`];
    return renderText("output-error", traceback.join("\n"));
  }
  if (output.output_type === "display_data" || output.output_type === "execute_result") {
    return renderMimeBundle(output);
  }
  if (output.text) {
    return renderText("output-text", output.text);
  }
  return null;
}

class OutputView {
  constructor(props) {
    this.props = props;
    etch.initialize(this);

    // Block image drag-and-drop from outputs (catches imgs embedded in
    // text/html outputs that don't go through the image MIME branch).
    this.element.addEventListener("dragstart", (event) => {
      if (event.target?.tagName === "IMG") event.preventDefault();
    });
  }

  render() {
    const { outputs, maxHeight } = this.props;
    const style = maxHeight > 0 ? { maxHeight: `${maxHeight}px`, overflowY: "auto" } : {};

    return (
      <div className="jupyter-output-container">
        <div className="jupyter-outputs" style={style}>
          {(outputs || []).map((output, index) => (
            <div
              key={index}
              className={`jupyter-output output-${output.output_type || "unknown"}`}
              attributes={{ "data-output-index": String(index) }}
            >
              {renderOutput(output)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  update(props) {
    this.props = { ...this.props, ...props };
    return etch.update(this);
  }

  destroy() {
    return etch.destroy(this);
  }
}

module.exports = OutputView;
