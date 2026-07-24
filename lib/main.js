const { CompositeDisposable, Disposable } = require("atom");
const path = require("path");

/**
 * Jupyter Next Package
 * Provides notebook UI, navigation, and cell model editing within Lumine.
 */

// Lazy-loaded modules
let NotebookDocumentRegistry = null;
let NotebookScrollmap = null;
let JoveAdapterService = null;
let NotebookSearchAdapter = null;

function getNotebookDocumentRegistry() {
  if (!NotebookDocumentRegistry) {
    NotebookDocumentRegistry = require("./notebook-document-registry");
  }
  return NotebookDocumentRegistry;
}

function getNotebookScrollmap() {
  if (!NotebookScrollmap) {
    NotebookScrollmap = require("./scrollmap-integration");
  }
  return NotebookScrollmap;
}

function getJoveAdapterService() {
  if (!JoveAdapterService) {
    JoveAdapterService = require("./jove-adapter");
  }
  return JoveAdapterService;
}

function getNotebookSearchAdapter() {
  if (!NotebookSearchAdapter) {
    NotebookSearchAdapter = require("./notebook-search");
  }
  return NotebookSearchAdapter;
}

/**
 * Helper to delegate a method call to the active notebook or its view
 * @param {Object} context - The module context (this)
 * @param {string} methodName - Method name to call
 * @param {boolean} useView - If true, delegate to notebook.view instead
 * @param {...any} args - Arguments to pass to the method
 */
function delegateToNotebook(context, methodName, useView = false, ...args) {
  const notebook = context.getActiveNotebook();
  if (!notebook) return;

  const target = useView ? notebook.view : notebook;
  if (target && typeof target[methodName] === "function") {
    return target[methodName](...args);
  }
}

function getOutputContainerForNode(node) {
  if (!node) return null;

  const element = node.nodeType === 1 ? node : node.parentElement;
  return element?.closest?.(".jove-output-container") || null;
}

function getSelectedOutputText(event) {
  const selection = window.getSelection?.();
  const text = selection?.toString();
  if (!text) return "";

  if (event?.target?.closest?.(".jove-output-container")) return text;

  const anchorOutput = getOutputContainerForNode(selection.anchorNode);
  const focusOutput = getOutputContainerForNode(selection.focusNode);
  return anchorOutput || focusOutput ? text : "";
}

function copyOutputSelection(event) {
  const text = getSelectedOutputText(event);
  if (!text) return false;

  atom.clipboard.write(text);
  event?.preventDefault?.();
  event?.stopPropagation?.();
  event?.stopImmediatePropagation?.();
  return true;
}

module.exports = {
  config: require("../package.json").configSchema,

  /**
   * Activates the package and registers notebook commands.
   * @param {Object} state - Serialized state from previous session
   */
  activate() {
    this.disposables = new CompositeDisposable();
    this.documentRegistry = this.documentRegistry || null;
    this.notebookEditors = this.notebookEditors || new Set();
    this.notebookScrollmaps = this.notebookScrollmaps || new Map();
    this.Simplemap = this.Simplemap || null;
    this.workspaceOpenerDisposable = null;
    this.lastTreeViewContextPath = null;
    this.treeViewService = null;

    // Register commands
    this.disposables.add(
      atom.commands.add("atom-workspace", {
        "jove-view:toggle": () => this.toggle(),
        "jove-view:new-notebook": () => this.newNotebook(),
        "jove-view:open-source": () => this.openSource(),
      }),
    );

    // Register notebook-specific commands
    this.disposables.add(
      atom.commands.add("atom-workspace", {
        "jove-view:clear-output": () => this.clearOutput(),
        "jove-view:clear-all-outputs": () => this.clearAllOutputs(),
        "jove-view:insert-cell-above": () => this.insertCellAbove(),
        "jove-view:insert-cell-below": () => this.insertCellBelow(),
        "jove-view:insert-cell-below-and-edit": () => this.insertCellBelowAndEdit(),
        "jove-view:insert-cell-below-and-extend-selection": () =>
          this.insertCellBelowAndExtendSelection(),
        "jove-view:insert-cell-above-and-extend-selection": () =>
          this.insertCellAboveAndExtendSelection(),
        "jove-view:delete-cell": () => this.deleteCell(),
        "jove-view:move-cell-up": () => this.moveCellUp(),
        "jove-view:move-cell-down": () => this.moveCellDown(),
        "jove-view:change-cell-to-code": () => this.changeCellType("code"),
        "jove-view:change-cell-to-markdown": () => this.changeCellType("markdown"),
        "jove-view:change-cell-to-raw": () => this.changeCellType("raw"),
        "jove-view:toggle-cell-output": () => this.toggleCellOutput(),
        "jove-view:toggle-cell-input": () => this.toggleCellInput(),
        "jove-view:export-to-python": () => this.exportToPython(),
        "jove-view:export-to-html": () => this.exportToHtml(),
        // Mode switching
        "jove-view:enter-edit-mode": () => this.enterEditMode(),
        "jove-view:enter-command-mode": (event) => this.enterCommandMode(event),
        // Navigation
        "jove-view:focus-previous-cell": () => this.focusPreviousCell(),
        "jove-view:focus-next-cell": () => this.focusNextCell(),
        "jove-view:focus-first-cell": () => this.focusFirstCell(),
        "jove-view:focus-last-cell": () => this.focusLastCell(),
        "jove-view:select-previous-cell": () => this.selectPreviousCell(),
        "jove-view:select-next-cell": () => this.selectNextCell(),
        // Save
        "jove-view:save": () => this.save(),
        "jove-view:save-as": () => this.saveAs(),
        // Undo/Redo notebook edits
        "jove-view:undo-cell-operation": () => this.undoCellOperation(),
        "jove-view:redo-cell-operation": () => this.redoCellOperation(),
        // Cut/Copy/Paste cells
        "jove-view:cut-cell": () => this.cutCell(),
        "jove-view:copy-cell": () => this.copyCell(),
        "jove-view:paste-cell-below": () => this.pasteCellBelow(),
        "jove-view:paste-cell-above": () => this.pasteCellAbove(),
        // Duplicate cell
        "jove-view:duplicate-cell": () => this.duplicateCell(),
        // Merge cells
        "jove-view:merge-cell-below": () => this.mergeCellBelow(),
      }),
    );

    // Copy selected text from cell output
    this.disposables.add(
      atom.commands.add(".jove-output-container", {
        "jove-view:copy-output-selection": (event) => copyOutputSelection(event),
        "core:copy": (event) => copyOutputSelection(event),
      }),
    );

    this.disposables.add(
      atom.contextMenu.add({
        ".jove-output-container": [
          {
            label: "Copy",
            command: "jove-view:copy-output-selection",
            shouldDisplay: () => !!getSelectedOutputText(),
          },
        ],
      }),
    );

    // Map core:save and core:save-as to notebook save when a notebook is active
    // Use .jove-notebook-container selector to only handle saves within notebooks
    this.disposables.add(
      atom.commands.add(".jove-notebook-container", {
        "core:save": (event) => {
          event.stopPropagation();
          this.save();
        },
        "core:save-as": (event) => {
          event.stopPropagation();
          this.saveAs();
        },
        "core:undo": (event) => {
          event.stopPropagation();
          this.undoCellOperation();
        },
        "core:redo": (event) => {
          event.stopPropagation();
          this.redoCellOperation();
        },
        "core:copy": (event) => {
          if (event?.target?.closest?.("atom-text-editor")) return;
          copyOutputSelection(event);
        },
      }),
    );

    this.disposables.add(
      atom.commands.add("atom-text-editor.jove-cell-editor", {
        "core:undo": (event) => {
          event.preventDefault?.();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          const container = event.target.closest(".jove-notebook-container");
          const notebook = container?._joveNotebookEditor;
          if (notebook) {
            notebook.undoCellOperation();
          } else {
            this.undoCellOperation();
          }
        },
        "core:redo": (event) => {
          event.preventDefault?.();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          const container = event.target.closest(".jove-notebook-container");
          const notebook = container?._joveNotebookEditor;
          if (notebook) {
            notebook.redoCellOperation();
          } else {
            this.redoCellOperation();
          }
        },
      }),
    );

    this.disposables.add(
      atom.commands.add(".tree-view", {
        "jove-view:open-notebook": (event) => {
          event.stopPropagation();
          this.openSelectedTreeViewNotebook(event);
        },
        "jove-view:open-source": (event) => {
          event.stopPropagation();
          this.openSelectedTreeViewSource(event);
        },
      }),
    );

    const rememberTreeViewContextPath = (event) => {
      const fileEntry = event.target?.closest?.('.tree-view [is="tree-view-file"]');
      if (!fileEntry) return;
      this.lastTreeViewContextPath =
        fileEntry.getPath?.() || fileEntry.fileName?.dataset?.path || null;
    };
    document.addEventListener("contextmenu", rememberTreeViewContextPath, true);
    this.disposables.add(
      new Disposable(() => {
        document.removeEventListener("contextmenu", rememberTreeViewContextPath, true);
      }),
    );

    // Scroll commands — handled on .jove-notebook so smooth-scroll handles
    // text editors inside cells while this handles the notebook container itself
    this.disposables.add(
      atom.commands.add(".jove-notebook", {
        "smooth-scroll:scroll-up": () => delegateToNotebook(this, "scrollUp", true),
        "smooth-scroll:scroll-down": () => delegateToNotebook(this, "scrollDown", true),
      }),
    );

    // Clear cell timers when the active notebook's kernel is shut down.  Use
    // onWillDispatch so we fire regardless of which package's handler ends
    // up calling stopPropagation on the shutdown command.
    this.disposables.add(
      atom.commands.onWillDispatch((event) => {
        if (event?.type !== "jove-repl:shutdown-kernel") return;
        const container = event.target?.closest?.(".jove-notebook-container");
        const notebook = container?._joveNotebookEditor || this.getActiveNotebook();
        notebook?.document?.clearAllCellTimers?.();
      }),
    );

    this.disposables.add(
      atom.config.onDidChange("jove-view.notebook.useOpener", ({ newValue }) => {
        if (newValue !== false) {
          this.registerWorkspaceOpener();
        } else {
          this.unregisterWorkspaceOpener();
        }
      }),
    );

    // Register opener for .ipynb files
    this.registerWorkspaceOpener();

    this.disposables.add(
      atom.workspace.onDidAddPaneItem(({ item }) => {
        this.trackNotebookEditor(item);
      }),
    );

    // Note: Notebook restoration is handled by Lumine's workspace via the
    // JoveNotebookEditor deserializer. We don't need to manually re-open
    // notebooks here as that would cause duplicate tabs.
    this.discoverNotebookEditors();
    requestAnimationFrame(() => this.discoverNotebookEditors());
  },

  deactivate() {
    try {
      // First, destroy notebook editors (this will trigger document cleanup)
      this.destroyNotebookScrollmaps();
      this.notebookEditors.forEach((editor) => {
        try {
          if (editor.destroy) {
            editor.destroy();
          }
        } catch (e) {
          console.error("[jove-view] Error destroying editor:", e);
        }
      });
      this.notebookEditors.clear();

      // Then destroy document registry
      if (this.documentRegistry) {
        try {
          this.documentRegistry.destroy();
        } catch (e) {
          console.error("[jove-view] Error destroying document registry:", e);
        }
        this.documentRegistry = null;
      }

      this.disposables.dispose();
      this.workspaceOpenerDisposable = null;
    } catch (e) {
      console.error("[jove-view] Error during deactivation:", e);
    }
  },

  serialize() {
    // Notebook editors are serialized individually by Lumine's workspace
    // via the JoveNotebookEditor.serialize() method.
    // We don't need to track open notebooks at the package level.
    return {};
  },

  // Deserializer for notebook editors
  deserializeNotebookEditor(state) {
    // Ensure notebookEditors set exists
    if (!this.notebookEditors) {
      this.notebookEditors = new Set();
    }
    if (!this.notebookScrollmaps) {
      this.notebookScrollmaps = new Map();
    }

    if (!state || (!state.filePath && !state.notebookData)) {
      return null;
    }

    // Use JoveNotebookEditor's static deserialize method
    // This checks for existing editors first (to prevent reload when moving panes)
    // and returns a placeholder that loads async if creating new
    const JoveNotebookEditor = require("./jove-notebook-editor");
    const editor = JoveNotebookEditor.deserialize(state, {
      documentRegistry: this.getDocumentRegistry(),
    });

    this.trackNotebookEditor(editor);

    return editor;
  },

  // Service providers
  provideJoveNotebook() {
    return {
      getActiveNotebook: () => this.getActiveNotebook(),
      getDocumentRegistry: () => this.getDocumentRegistry(),
    };
  },

  provideJoveAdapter() {
    const AdapterService = getJoveAdapterService();
    return new AdapterService();
  },

  provideSearchAdapter() {
    const SearchAdapter = getNotebookSearchAdapter();
    return {
      handlesItem: (item) => this.isNotebookEditor(item),
      getAdapterForItem: (item) => {
        if (!this.isNotebookEditor(item) || item._destroyed) return null;
        if (!item._searchAdapter) {
          item._searchAdapter = new SearchAdapter(item);
        }
        return item._searchAdapter;
      },
    };
  },

  provideLinterUI() {
    return {
      name: "jove-view",
      render: ({ messages }) => {
        this.linterMessages = messages || [];
        this.broadcastLinterMessages();
      },
      didBeginLinting: () => {},
      didFinishLinting: () => {},
      dispose: () => {},
    };
  },

  broadcastLinterMessages() {
    if (!this.notebookScrollmaps) return;
    for (const scrollmap of this.notebookScrollmaps.values()) {
      scrollmap.setLinterMessages?.(this.linterMessages || []);
    }
  },

  provideLinterItemAdapter() {
    return {
      handlesItem: (item) => item?.constructor?.name === "JoveNotebookEditor",
      getMessagesForItem: (item, messages) => {
        return messages.filter((message) => item.ownsLinterMessage?.(message));
      },
      getTextEditorForItem: (item) => item.getSourceEditor(),
      getCurrentMessage: (item, messages) => item.getCurrentLinterMessage(messages),
      getNextMessage: (item, messages) => item.getNextLinterMessage(messages),
      getPreviousMessage: (item, messages) => item.getPreviousLinterMessage(messages),
      revealMessage: (item, message) => item.revealLinterMessage(message),
    };
  },

  provideNavigationAdapter() {
    return {
      handlesItem: (item) => item?.constructor?.name === "JoveNotebookEditor",
      observeHeaders: (item, callback) => item.observeNavigationHeaders(callback),
      navigateTo: (item, header) => item.revealNavigationHeader(header),
    };
  },

  consumeTreeView(service) {
    this.treeViewService = service;
    return new Disposable(() => {
      this.treeViewService = null;
    });
  },

  useWorkspaceOpener() {
    return atom.config.get("jove-view.notebook.useOpener") !== false;
  },

  registerWorkspaceOpener() {
    if (!this.useWorkspaceOpener() || this.workspaceOpenerDisposable) return;

    this.workspaceOpenerDisposable = atom.workspace.addOpener((uri, options = {}) => {
      if (options.skipJoveViewOpener) return;
      if (uri && uri.toLowerCase().endsWith(".ipynb")) {
        return this.openNotebook(uri);
      }
    });
    this.disposables.add(this.workspaceOpenerDisposable);
  },

  unregisterWorkspaceOpener() {
    if (!this.workspaceOpenerDisposable) return;
    this.workspaceOpenerDisposable.dispose();
    this.workspaceOpenerDisposable = null;
  },

  consumeSimpleMap(Simplemap) {
    this.Simplemap = Simplemap;
    this.discoverNotebookEditors();
    for (const editor of this.notebookEditors || []) {
      this.setupNotebookScrollmap(editor);
    }
    return new Disposable(() => {
      this.Simplemap = null;
      this.destroyNotebookScrollmaps();
    });
  },

  isNotebookEditor(item) {
    return item?.constructor?.name === "JoveNotebookEditor";
  },

  discoverNotebookEditors() {
    for (const item of atom.workspace.getPaneItems()) {
      this.trackNotebookEditor(item);
    }
  },

  trackNotebookEditor(editor) {
    if (!this.isNotebookEditor(editor) || editor._destroyed) return;
    this.notebookEditors = this.notebookEditors || new Set();
    this.notebookScrollmaps = this.notebookScrollmaps || new Map();

    if (!this.notebookEditors.has(editor)) {
      this.notebookEditors.add(editor);
      editor.onDidDestroy(() => {
        this.notebookEditors.delete(editor);
        this.destroyNotebookScrollmap(editor);
      });
    }

    this.setupNotebookScrollmap(editor);
  },

  setupNotebookScrollmap(editor) {
    this.notebookScrollmaps = this.notebookScrollmaps || new Map();
    if (!this.Simplemap || !editor || this.notebookScrollmaps?.has(editor)) return;
    const ScrollmapClass = getNotebookScrollmap();
    const scrollmap = new ScrollmapClass(editor, this.Simplemap);
    this.notebookScrollmaps.set(editor, scrollmap);
    if (this.linterMessages?.length) {
      scrollmap.setLinterMessages(this.linterMessages);
    }
  },

  destroyNotebookScrollmap(editor) {
    const scrollmap = this.notebookScrollmaps?.get(editor);
    if (!scrollmap) return;
    scrollmap.destroy();
    this.notebookScrollmaps.delete(editor);
  },

  destroyNotebookScrollmaps() {
    for (const scrollmap of this.notebookScrollmaps?.values() || []) {
      scrollmap.destroy();
    }
    this.notebookScrollmaps?.clear();
  },

  // Core functionality
  getDocumentRegistry() {
    if (!this.documentRegistry) {
      const RegistryClass = getNotebookDocumentRegistry();
      this.documentRegistry = new RegistryClass();
    }
    return this.documentRegistry;
  },

  getActiveNotebook() {
    const item = atom.workspace.getCenter().getActivePaneItem();
    if (item && item.constructor.name === "JoveNotebookEditor") {
      return item;
    }
    return null;
  },

  async openNotebook(uri) {
    // Check if there's already an open editor for this file
    // If so, create a copy (like split pane) to share the same document
    const normalizedUri = uri ? path.normalize(uri).toLowerCase() : null;

    if (normalizedUri) {
      // Search all pane items for an existing editor with this path
      // This includes deserialized editors that might not be in notebookEditors yet
      const JoveNotebookEditor = require("./jove-notebook-editor");

      for (const paneContainer of [
        atom.workspace.getCenter(),
        atom.workspace.getLeftDock(),
        atom.workspace.getRightDock(),
        atom.workspace.getBottomDock(),
      ]) {
        if (!paneContainer) continue;
        for (const pane of paneContainer.getPanes()) {
          for (const item of pane.getItems()) {
            if (!(item instanceof JoveNotebookEditor)) continue;
            if (item._destroyed) continue;

            const existingPath = item.getPath();
            if (existingPath && path.normalize(existingPath).toLowerCase() === normalizedUri) {
              // Found matching editor - wait for it to finish loading if needed
              if (item._loadingPromise) {
                await item._loadingPromise;
              }

              // After loading, verify editor is ready and not destroyed
              if (item._destroyed || !item.document || !item.view) {
                continue;
              }

              // Ensure it's tracked in notebookEditors
              this.trackNotebookEditor(item);

              // Create a copy that shares the document
              const editor = item.copy();
              this.trackNotebookEditor(editor);

              return editor;
            }
          }
        }
      }
    }

    // No existing ready editor found - create new one via registry
    // The registry handles document sharing at the document level
    const registry = this.getDocumentRegistry();
    const editor = await registry.buildEditor(uri);
    this.trackNotebookEditor(editor);

    return editor;
  },

  async openSource(filePath = null) {
    const sourcePath = filePath || this.getActiveNotebook()?.getPath?.();
    if (!sourcePath) return;

    if (!sourcePath.toLowerCase().endsWith(".ipynb")) {
      atom.notifications.addWarning("Can only open notebook source for .ipynb files", {
        detail: sourcePath,
        dismissable: true,
      });
      return;
    }

    const existingEditor = atom.workspace
      .getTextEditors()
      .find((editor) => editor.getPath && editor.getPath() === sourcePath);

    if (existingEditor) {
      const pane = atom.workspace.paneForItem(existingEditor);
      if (pane) {
        pane.activateItem(existingEditor);
        pane.activate();
        return existingEditor;
      }
    }

    const editor = await atom.workspace.createItemForURI(sourcePath, {
      skipJoveViewOpener: true,
    });
    return atom.workspace.open(editor);
  },

  async openSelectedTreeViewSource(event = null) {
    const selectedPath = this.getSelectedTreeViewNotebookPath(event);
    if (!selectedPath) return;
    return this.openSource(selectedPath);
  },

  async openSelectedTreeViewNotebook(event = null) {
    const selectedPath = this.getSelectedTreeViewNotebookPath(event);
    if (!selectedPath) return;

    const editor = await this.openNotebook(selectedPath);
    const pane = atom.workspace.getCenter().getActivePane();
    pane.activateItem(editor);
    pane.activate();
    return editor;
  },

  getSelectedTreeViewNotebookPath(event = null) {
    const clickedEntry = event?.target?.closest?.('[is="tree-view-file"]');
    const clickedPath = clickedEntry?.getPath?.() || clickedEntry?.fileName?.dataset?.path;
    if (clickedPath?.toLowerCase?.().endsWith(".ipynb")) {
      return clickedPath;
    }

    if (this.lastTreeViewContextPath?.toLowerCase?.().endsWith(".ipynb")) {
      return this.lastTreeViewContextPath;
    }

    const selectedPaths = this.treeViewService?.selectedPaths?.() || [];
    const selectedPath = selectedPaths.find((entryPath) =>
      entryPath.toLowerCase().endsWith(".ipynb"),
    );

    if (!selectedPath) {
      atom.notifications.addWarning("Select a .ipynb file", {
        dismissable: true,
      });
    }

    return selectedPath;
  },

  async newNotebook() {
    const registry = this.getDocumentRegistry();
    const editor = await registry.buildEditor(null);
    this.trackNotebookEditor(editor);

    atom.workspace.getActivePane().activateItem(editor);
    return editor;
  },

  toggle() {
    const notebook = this.getActiveNotebook();
    if (notebook) {
      atom.workspace.toggle(notebook);
    } else {
      this.newNotebook();
    }
  },

  // Output operations
  clearOutput() {
    delegateToNotebook(this, "clearOutput");
  },
  clearAllOutputs() {
    delegateToNotebook(this, "clearAllOutputs");
  },

  // Cell insertion
  insertCellAbove() {
    delegateToNotebook(this, "insertCellAbove");
  },
  insertCellBelow() {
    delegateToNotebook(this, "insertCellBelow");
  },
  insertCellBelowAndEdit() {
    delegateToNotebook(this, "insertCellBelowAndEdit");
  },
  insertCellBelowAndExtendSelection() {
    delegateToNotebook(this, "insertCellBelowAndExtendSelection");
  },
  insertCellAboveAndExtendSelection() {
    delegateToNotebook(this, "insertCellAboveAndExtendSelection");
  },

  // Cell manipulation
  deleteCell() {
    delegateToNotebook(this, "deleteCell");
  },
  moveCellUp() {
    delegateToNotebook(this, "moveCellUp");
  },
  moveCellDown() {
    delegateToNotebook(this, "moveCellDown");
  },
  changeCellType(type) {
    delegateToNotebook(this, "changeCellType", false, type);
  },
  toggleCellOutput() {
    delegateToNotebook(this, "toggleCellOutput");
  },
  toggleCellInput() {
    delegateToNotebook(this, "toggleCellInput");
  },

  // Export functions
  exportToPython() {
    delegateToNotebook(this, "exportToPython");
  },
  exportToHtml() {
    delegateToNotebook(this, "exportToHtml");
  },

  // Mode switching (delegate to view)
  enterEditMode() {
    delegateToNotebook(this, "enterEditMode", true);
  },
  enterCommandMode(event) {
    if (this.shouldLetEscapeReduceCursors(event)) {
      event.abortKeyBinding();
      return;
    }
    delegateToNotebook(this, "enterCommandMode", true);
  },

  shouldLetEscapeReduceCursors(event) {
    const target = event?.target;
    const editorElement =
      target?.closest?.("atom-text-editor.jove-cell-editor") ||
      (target?.matches?.("atom-text-editor.jove-cell-editor") ? target : null);
    const editor = editorElement?.getModel?.();
    return (editor?.getCursors?.().length || 0) > 1;
  },

  // Navigation (delegate to view)
  focusPreviousCell() {
    delegateToNotebook(this, "focusPreviousCell", true);
  },
  focusNextCell() {
    delegateToNotebook(this, "focusNextCell", true);
  },
  focusFirstCell() {
    delegateToNotebook(this, "focusFirstCell", true);
  },
  focusLastCell() {
    delegateToNotebook(this, "focusLastCell", true);
  },
  selectPreviousCell() {
    delegateToNotebook(this, "selectPreviousCell", true);
  },
  selectNextCell() {
    delegateToNotebook(this, "selectNextCell", true);
  },

  // Save
  save() {
    delegateToNotebook(this, "save");
  },

  saveAs() {
    const notebook = this.getActiveNotebook();
    if (notebook) {
      // Use Lumine's pane to show save dialog properly
      const pane = atom.workspace.paneForItem(notebook);
      if (pane) {
        pane.saveItemAs(notebook);
      }
    }
  },

  // Undo/Redo notebook edits
  undoCellOperation() {
    delegateToNotebook(this, "undoCellOperation");
  },
  redoCellOperation() {
    delegateToNotebook(this, "redoCellOperation");
  },

  // Cut/Copy/Paste cells
  cutCell() {
    delegateToNotebook(this, "cutCell");
  },
  copyCell() {
    delegateToNotebook(this, "copyCell");
  },
  pasteCellBelow() {
    delegateToNotebook(this, "pasteCellBelow");
  },
  pasteCellAbove() {
    delegateToNotebook(this, "pasteCellAbove");
  },
  duplicateCell() {
    delegateToNotebook(this, "duplicateCell");
  },

  // Merge cells
  mergeCellBelow() {
    delegateToNotebook(this, "mergeCellBelow");
  },
};
