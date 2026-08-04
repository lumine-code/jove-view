const etch = require("@lumine-code/etch");
const OutputView = require("../lib/output-view");

// The stored outputs of a notebook cell are the only thing this package renders
// that a user cannot edit their way out of: a media type that stops rendering
// just shows nothing. Nothing asserted what any of them produced before.

const flush = (view) => etch.updateSync(view);

function mount(outputs, maxHeight = 0) {
  const view = new OutputView({ outputs, maxHeight });
  flush(view);
  return view;
}

describe("output view", () => {
  let view;

  afterEach(() => {
    view?.destroy();
    view = null;
  });

  it("renders a stream, keeping its ANSI colour", () => {
    view = mount([{ output_type: "stream", name: "stdout", text: "hello [31mred[0m" }]);

    expect(view.element.querySelector(".output-stream")).toBeTruthy();
    expect(view.element.textContent).toContain("hello");
    expect(view.element.querySelector("span[style]")).toBeTruthy();
    expect(view.element.textContent).not.toContain("[31m");
  });

  it("renders an error as its traceback", () => {
    view = mount([
      { output_type: "error", ename: "ValueError", evalue: "bad", traceback: ["Trace", "bad"] },
    ]);

    expect(view.element.querySelector(".output-error").textContent).toContain("Trace");
  });

  it("falls back to name and value when an error has no traceback", () => {
    view = mount([{ output_type: "error", ename: "ValueError", evalue: "bad", traceback: [] }]);

    expect(view.element.querySelector(".output-error").textContent).toContain("ValueError: bad");
  });

  it("renders each rich media type", () => {
    const cases = [
      ["text/plain", "42", ".output-text"],
      ["text/html", "<b>bold</b>", ".output-html"],
      ["text/markdown", "# Head", ".output-markdown"],
      ["image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'></svg>", ".output-svg"],
      ["application/json", { a: 1 }, ".output-json"],
    ];

    for (const [mediaType, data, selector] of cases) {
      const single = mount([{ output_type: "display_data", data: { [mediaType]: data } }]);
      expect(single.element.querySelector(selector)).toBeTruthy();
      single.destroy();
    }
  });

  it("renders an image from its base64 data", () => {
    view = mount([{ output_type: "display_data", data: { "image/png": "AAAA" } }]);

    const img = view.element.querySelector("img.output-image");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(img.draggable).toBe(false);
  });

  it("joins the string arrays Jupyter stores multi-line values as", () => {
    view = mount([{ output_type: "display_data", data: { "text/plain": ["one\n", "two"] } }]);

    expect(view.element.textContent).toContain("one");
    expect(view.element.textContent).toContain("two");
  });

  it("prefers the richest representation a bundle offers", () => {
    view = mount([
      {
        output_type: "execute_result",
        data: { "text/plain": "<Figure>", "text/html": "<b>r</b>" },
      },
    ]);

    expect(view.element.querySelector(".output-html")).toBeTruthy();
    expect(view.element.querySelector(".output-text")).toBeFalsy();
  });

  it("renders one entry per output", () => {
    view = mount([
      { output_type: "stream", name: "stdout", text: "a" },
      { output_type: "stream", name: "stdout", text: "b" },
    ]);

    expect(view.element.querySelectorAll(".jupyter-output").length).toBe(2);
  });

  it("applies the maximum height it is given, and drops it again", () => {
    view = mount([{ output_type: "stream", name: "stdout", text: "a" }], 120);
    const outputs = () => view.element.querySelector(".jupyter-outputs");

    expect(outputs().style.maxHeight).toBe("120px");
    expect(outputs().style.overflowY).toBe("auto");

    view.update({ maxHeight: 0 });
    flush(view);

    expect(outputs().style.maxHeight).toBe("");
  });

  it("replaces its content when the outputs change", () => {
    view = mount([{ output_type: "stream", name: "stdout", text: "first" }]);
    expect(view.element.textContent).toContain("first");

    view.update({ outputs: [{ output_type: "stream", name: "stdout", text: "second" }] });
    flush(view);

    expect(view.element.textContent).toContain("second");
    expect(view.element.textContent).not.toContain("first");
  });
});
