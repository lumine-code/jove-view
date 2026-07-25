# jove-view

Open and edit Jupyter notebooks.

## Features

- **Notebook editing**: open and edit `.ipynb` files with a cell-based interface, command/edit modes, and keyboard-driven navigation.
- **Cell operations**: insert, delete, move, merge, cut, copy, paste, duplicate, change type, and reorder cells by drag and drop.
- **Rich output**: render stored notebook outputs including text, images, SVG, HTML, LaTeX, and markdown, with ANSI color support.
- **Multi-select and history**: anchor-based multi-cell selection and buffer-based undo/redo of notebook edits.
- **Execution integration**: run cells through the jove-repl kernel engine via the `jove.adapter` service, with per-cell run buttons and live execution status.
- **Notebook search**: search and replace cell source through the search-panel package, entering edit mode on the matching cell.
- **Open source**: open any `.ipynb` as plain JSON text from an active notebook or the tree-view.
- **Editor integrations**: expose cells to linter, navigation, and scrollmap adapters so headings, selection, and diagnostics appear on the scrollbar.
- **Export**: save notebooks as Python scripts or HTML.

## Installation

To install `jove-view` search for _jove-view_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/jove-view`.

## Commands

Commands available in `atom-workspace`:

- `jove-view:toggle`: toggle the active notebook item,
- `jove-view:new-notebook`: create a new notebook,
- `jove-view:open-source`: open the active notebook as plain text,
- `jove-view:clear-output`: clear active cell output,
- `jove-view:clear-all-outputs`: clear all outputs,
- `jove-view:insert-cell-above`: insert cell above,
- `jove-view:insert-cell-below`: insert cell below,
- `jove-view:insert-cell-below-and-edit`: insert cell below and enter edit mode,
- `jove-view:insert-cell-above-and-extend-selection`: insert cell above and extend the selection to it,
- `jove-view:insert-cell-below-and-extend-selection`: insert cell below and extend the selection to it,
- `jove-view:delete-cell`: delete cell,
- `jove-view:move-cell-up`: move cell up,
- `jove-view:move-cell-down`: move cell down,
- `jove-view:change-cell-to-code`: change to code cell,
- `jove-view:change-cell-to-markdown`: change to markdown cell,
- `jove-view:change-cell-to-raw`: change to raw cell,
- `jove-view:toggle-cell-output`: toggle output visibility,
- `jove-view:toggle-cell-input`: toggle input visibility,
- `jove-view:enter-edit-mode`: enter edit mode,
- `jove-view:enter-command-mode`: enter command mode,
- `jove-view:focus-previous-cell`: focus previous cell,
- `jove-view:focus-next-cell`: focus next cell,
- `jove-view:focus-first-cell`: focus first cell,
- `jove-view:focus-last-cell`: focus last cell,
- `jove-view:select-previous-cell`: extend selection to previous cell,
- `jove-view:select-next-cell`: extend selection to next cell,
- `jove-view:cut-cell`: cut cell,
- `jove-view:copy-cell`: copy cell,
- `jove-view:paste-cell-below`: paste cell below,
- `jove-view:paste-cell-above`: paste cell above,
- `jove-view:duplicate-cell`: duplicate cell,
- `jove-view:merge-cell-below`: merge with cell below,
- `jove-view:undo-cell-operation`: undo the latest notebook edit,
- `jove-view:redo-cell-operation`: redo the latest notebook edit,
- `jove-view:save`: save notebook,
- `jove-view:save-as`: save notebook as,
- `jove-view:export-to-python`: export to Python script,
- `jove-view:export-to-html`: export to HTML.

Commands available in `.jove-output-container`:

- `jove-view:copy-output-selection`: copy the selected output text to the clipboard.

Commands available in `.tree-view`:

- `jove-view:open-notebook`: open the selected `.ipynb` file as a notebook,
- `jove-view:open-source`: open the selected `.ipynb` file as plain text.

## Services

- **jove.adapter** (`1.0.0`): provided to let [jove-repl](https://github.com/lumine-code/jove-repl) execute notebook cells with its normal run commands, routing kernel output, execution counts, focus, and navigation back into the notebook.
- **jove.notebook** (`1.0.0`): provided to expose notebook documents and the active notebook item to packages that need notebook-aware behavior.
- **search-adapter** (`1.0.0`): provided to let the search-panel package find and replace cell source in the active notebook.
- **linter-adapter** (`1.0.0`): provided to map linter diagnostics from the backing editor onto the visible notebook cells.
- **linter-ui** (`1.0.0`): provided to receive linter message updates so notebook scrollmap markers stay in sync with diagnostics.
- **navigation-adapter** (`1.0.0`): provided to show notebook markdown headings as a document outline, activating and revealing the cell on selection.
- **tree-view** (`^1.0.0`): consumed to add tree-view entries for opening a selected `.ipynb` as a notebook or as plain JSON source.
- **simplemap** (`^1.0.0`): consumed to render notebook scrollmap markers in a standalone scrollbar widget.

## Integration

### `jove.notebook`

The service exposes `getActiveNotebook()` and `getDocumentRegistry()`. Consume it from your `package.json`:

```json
{
  "consumedServices": {
    "jove.notebook": {
      "versions": {
        "^1.0.0": "consumeJoveNotebook"
      }
    }
  }
}
```

### `search-adapter`

While a notebook is the active pane item, `search-panel:show`, `search-panel:find-next`, `search-panel:find-previous`, `search-panel:replace-current`, and `search-panel:replace-all` operate on cell source:

- Search scans all cells and reports the total match count in the find panel.
- Navigation enters edit mode, scrolls to the matching cell, focuses its editor, and selects the current match so typing can immediately replace it.
- Markdown cells are searched by source text; navigation switches a rendered markdown cell to edit mode before selecting the text.
- Replace works across code, markdown, and raw cells and updates the notebook document model.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
