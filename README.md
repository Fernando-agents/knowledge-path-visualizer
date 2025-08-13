# Knowledge Path Visualizer

This project provides a simple, self‑contained web application for exploring a
graph of learning topics.  Inspired by the research tree in **Civilization VI**,
each topic is represented as a node connected to its prerequisites.  The app
tracks your progress through each topic, unlocks new topics as their
dependencies reach a completion threshold, and displays details in a modal
styled with a dark navy/gold theme.

## Features

* **Interactive Graph** – Topics are laid out with a basic force‑directed
  algorithm using [D3.js](https://d3js.org/).  Edges connect each node to its
  prerequisites.  You can drag nodes around the canvas.
* **Progress Tracking** – Each node stores a completion percentage (0, 25,
  50, 75 or 100).  Colour and opacity indicate progress, and locked topics
  appear desaturated until unlocked.
* **Unlocking Logic** – A topic is unlocked once **all** of its
  dependencies reach at least 75 % completion.  Locked topics cannot be
  updated or opened.
* **Detail Modal** – Clicking on an unlocked node opens a modal showing the
  title, description and dependencies.  A drop‑down menu allows you to
  update the progress.  The modal uses a navy gradient background with a
  glowing gold border to evoke the feel of a Civilization VI research card.
* **Persistent State** – Progress for each topic is saved to
  `localStorage`.  Refreshing the page preserves your progress and unlocked
  status.

## Usage

Open `index.html` in a modern web browser.  The graph will load a small
example curriculum by default.  You can edit the `knowledgeGraph` object in
`script.js` to define your own topics and dependencies.  Progress updates
persist automatically via `localStorage`.

## File Structure

```
knowledge-path-visualizer/
├── index.html      – HTML scaffold and DOM container
├── style.css       – Tailored CSS matching a dark navy/gold Civ VI aesthetic
├── script.js       – Core logic: graph layout, rendering, interactions
└── README.md       – Project overview and usage instructions
```

This project does not require any build tools.  All dependencies are loaded
from public CDNs.  No external services are needed; the graph runs entirely
in the browser.
