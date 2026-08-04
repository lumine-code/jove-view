const { NotebookChrome, showChrome } = require("../lib/notebook-chrome");

// The pane's loading and failure states were HTML strings assigned to the
// container's innerHTML, and the failure one interpolated the error message —
// so a message carrying markup was parsed as markup rather than shown.

describe("notebook chrome", () => {
  let chrome;

  afterEach(() => {
    chrome?.destroy();
    chrome = null;
  });

  it("shows a loading placeholder", () => {
    chrome = new NotebookChrome();

    expect(chrome.element.classList.contains("jupyter-notebook-loading")).toBe(true);
    expect(chrome.element.querySelector(".loading-spinner-large")).toBeTruthy();
    expect(chrome.element.textContent).toContain("Loading notebook");
  });

  it("shows why a notebook could not be opened", () => {
    chrome = new NotebookChrome({ error: "No document" });

    expect(chrome.element.classList.contains("error-message")).toBe(true);
    expect(chrome.element.textContent).toBe("Failed to load notebook: No document");
  });

  it("shows markup in an error message as text", () => {
    chrome = new NotebookChrome({ error: "<img src=x onerror=alert(1)>" });

    expect(chrome.element.querySelector("img")).toBe(null);
    expect(chrome.element.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("replaces whatever the container held", () => {
    const container = document.createElement("div");
    container.innerHTML = "<span>stale</span>";

    chrome = showChrome(container);

    expect(container.textContent).not.toContain("stale");
    expect(container.querySelector(".jupyter-notebook-loading")).toBeTruthy();
  });
});
