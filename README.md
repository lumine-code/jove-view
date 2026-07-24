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

To install `jove-view`, clone this repository into your Lumine packages directory (`~/.lumine/packages/jove-view`) and restart Lumine. If it is listed in your configured package sources, it can also be installed from the Install pane of the Lumine settings.

## Commands

Workspace commands:

- `jove-view:toggle`: toggle the active notebook item.
- `jove-view:new-notebook`: create a new notebook.
- `jove-view:open-source`: open the active notebook as plain text.

Notebook commands:

- `jove-view:clear-output`: clear active cell output.
- `jove-view:clear-all-outputs`: clear all outputs.
- `jove-view:insert-cell-above`: insert cell above.
- `jove-view:insert-cell-below`: insert cell below.
- `jove-view:delete-cell`: delete cell.
- `jove-view:move-cell-up`: move cell up.
- `jove-view:move-cell-down`: move cell down.
- `jove-view:change-cell-to-code`: change to code cell.
- `jove-view:change-cell-to-markdown`: change to markdown cell.
- `jove-view:change-cell-to-raw`: change to raw cell.
- `jove-view:toggle-cell-output`: toggle output visibility.
- `jove-view:toggle-cell-input`: toggle input visibility.
- `jove-view:enter-edit-mode`: enter edit mode.
- `jove-view:enter-command-mode`: enter command mode.
- `jove-view:focus-previous-cell`: focus previous cell.
- `jove-view:focus-next-cell`: focus next cell.
- `jove-view:focus-first-cell`: focus first cell.
- `jove-view:focus-last-cell`: focus last cell.
- `jove-view:select-previous-cell`: extend selection to previous cell.
- `jove-view:select-next-cell`: extend selection to next cell.
- `jove-view:cut-cell`: cut cell.
- `jove-view:copy-cell`: copy cell.
- `jove-view:paste-cell-below`: paste cell below.
- `jove-view:paste-cell-above`: paste cell above.
- `jove-view:duplicate-cell`: duplicate cell.
- `jove-view:merge-cell-below`: merge with cell below.
- `jove-view:undo-cell-operation`: undo the latest notebook edit.
- `jove-view:redo-cell-operation`: redo the latest notebook edit.
- `jove-view:save`: save notebook.
- `jove-view:save-as`: save notebook as.
- `jove-view:export-to-python`: export to Python script.
- `jove-view:export-to-html`: export to HTML.

Tree-view commands:

- `jove-view:open-notebook`: open the selected `.ipynb` file as a notebook.
- `jove-view:open-source`: open the selected `.ipynb` file as plain text.

## Provided Service `jove.adapter`

Allows [jove-repl](https://github.com/lumine-code/jove-repl) to execute notebook cells using its normal run commands. The adapter maps notebook cells to run targets, supplies source text and metadata, routes kernel output back into cells, stores execution counts, and controls kernel-related focus and navigation.

This service is provided as `jove.adapter@1.0.0` through `provideJoveAdapter`.

## Provided Service `jove.notebook`

Provides access to notebook documents and the active notebook item for packages that need notebook-aware behavior. It exposes `getActiveNotebook()` and `getDocumentRegistry()`.

In your `package.json`:

```json
{
  "consumedServices": {
    "jove.notebook": {
      "versions": {
        "1.0.0": "consumeJoveNotebook"
      }
    }
  }
}
```

## Provided Service `search-adapter`

Allows the search-panel package to search and replace cell source in the active notebook through the buffer find panel:

- `search-panel:show`, `search-panel:find-next`, `search-panel:find-previous`, `search-panel:replace-current`, and `search-panel:replace-all` operate on notebook cell source while the notebook is the active pane item.
- Search scans all cells and reports the total match count in the find panel.
- Navigation enters edit mode, scrolls to the matching cell, focuses its editor, and selects the current match so typing can immediately replace it.
- Markdown cells are searched by source text; navigation switches a rendered markdown cell to edit mode before selecting the text.
- Replace works across code, markdown, and raw cells and updates the notebook document model.

This service is provided as `search-adapter@1.0.0` through `provideSearchAdapter`.

## Provided Service `linter-adapter`

Allows the linter-bundle package to map diagnostics from the notebook backing editor to visible notebook cells. The adapter resolves messages for notebook items, finds the current/next/previous message, and reveals the corresponding cell editor location.

This service is provided as `linter-adapter@1.0.0` through `provideLinterItemAdapter`.

## Provided Service `linter-ui`

Receives linter message updates so notebook-specific UI, such as scrollmap markers, can stay synchronized with diagnostics.

This service is provided as `linter-ui@1.0.0` through `provideLinterUI`.

## Provided Service `navigation-adapter`

Allows the navigation-panel package to show notebook markdown headings as a document outline. Selecting a heading activates the corresponding cell and scrolls it into view.

This service is provided as `navigation-adapter@1.0.0` through `provideNavigationAdapter`.

## Consumed Service `tree-view`

Adds tree-view commands for opening selected `.ipynb` files as notebooks or as plain JSON source.

## Consumed Service `simplemap`

Allows notebook scrollmap markers to render in a standalone scrollbar widget when the scrollmap package is available.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
