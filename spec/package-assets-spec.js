const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));

// Guards for the CSON -> JSON and Less -> CSS modernization and the jove.*
// service rebrand. Jupyter's own names (the source.jupyter grammar, the
// "jupyter" keyword) must be preserved.
describe("jove-view package assets", () => {
  it("ships keymaps, menus, and the grammar as JSON, not CSON", () => {
    expect(exists("keymaps/jove-view.json")).toBe(true);
    expect(exists("menus/jove-view.json")).toBe(true);
    expect(exists("grammars/jupyter.json")).toBe(true);
    expect(exists("keymaps/jupyter-next.cson")).toBe(false);
    expect(exists("menus/jupyter-next.cson")).toBe(false);
    expect(exists("grammars/jupyter.cson")).toBe(false);
  });

  it("parses the keymap and menu, and every menu entry uses `command`", () => {
    const keymap = JSON.parse(read("keymaps/jove-view.json"));
    expect(keymap[".jove-notebook"]).toBeDefined();
    // The run bindings delegate to jove-repl (the execution engine).
    expect(keymap[".jove-notebook"]["ctrl-enter"]).toBe("jove-repl:run-cell");

    const menu = JSON.parse(read("menus/jove-view.json"));
    expect(Array.isArray(menu.menu)).toBe(true);
    expect(JSON.stringify(menu)).not.toContain('"commands"');
  });

  it("keeps the Jupyter grammar scope but exposes it as JSON", () => {
    const grammar = JSON.parse(read("grammars/jupyter.json"));
    expect(grammar.scopeName).toBe("source.jupyter");
    expect(grammar.fileTypes).toContain("ipynb");
  });

  it("ships a CSS stylesheet built on custom properties, not Less", () => {
    expect(exists("styles/jove-view.css")).toBe(true);
    expect(exists("styles/jupyter-next.less")).toBe(false);
    const css = read("styles/jove-view.css");
    expect(css).toContain("var(--");
    expect(css).not.toContain('@import "ui-variables"');
    const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cssWithoutComments).not.toMatch(/\bfade\(|\baverage\(|\blighten\(/);
  });

  it("provides the jove.* services and keeps jupyter as a descriptive keyword", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.name).toBe("jove-view");
    expect(pkg.providedServices["jove.adapter"]).toBeDefined();
    expect(pkg.providedServices["jove.notebook"]).toBeDefined();
    expect(pkg.providedServices["hydrogen-adapter"]).toBeUndefined();
    expect(pkg.providedServices["jupyter"]).toBeUndefined();
    // Jupyter is the target platform, so it stays as a package keyword.
    expect(pkg.keywords).toContain("jupyter");
  });
});
