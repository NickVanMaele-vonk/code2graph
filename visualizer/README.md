# Code2Graph Visualizer

## Overview

The visualizer module transforms code2graph JSON output into an interactive graph visualization using Cytoscape.js.

## Purpose

This module is the **second part** of the code2graph workflow:
1. **Analyzer** (Part 1): Code → JSON (`code2graph analyze`)
2. **Visualizer** (Part 2): JSON → Interactive Graph (this module)

## Features

- Interactive node and edge visualization
- Zoom, pan, and selection controls
- Node type filtering (functions, external dependencies, etc.)
- Color-coded categories (frontend, library, etc.)
- Search functionality
- Responsive design

## Usage

### Quick Start

1. Generate a graph JSON file using the analyzer:
   ```bash
   npm run analyze <repo-url>
   ```

2. Open the visualizer:
   ```bash
   npm run visualize graph-output.json
   ```

### Manual Usage

1. Copy your `graph-output.json` file to the `visualizer/data/` directory
2. Open `visualizer/index.html` in your browser
3. The graph will load automatically

## Standalone Usage

This module can be used independently with any JSON file that follows the code2graph format:

```json
{
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

## Dependencies

- Cytoscape.js (loaded via CDN)
- No build process required - pure HTML/CSS/JavaScript

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills)
