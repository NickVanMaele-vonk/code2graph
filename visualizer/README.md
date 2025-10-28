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
- **Zoom-independent node sizing**: Node icons maintain constant screen size when zooming, reducing visual clutter while preserving spatial relationships
- **Zoom-independent label sizing**: Labels stay readable at all zoom levels
- Node type filtering (functions, external dependencies, etc.)
- Color-coded categories (frontend, library, etc.)
- Search functionality
- Multiple layout algorithms (Force-Directed, Grid, Circle, Concentric, Breadth-First)
- Node details panel with comprehensive information
- Hover tooltips for quick node information
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

## Technical Details

### Zoom-Independent Node Sizing

The visualizer implements a custom zoom behavior that keeps node icons at constant screen size regardless of zoom level:

**Business Logic**: When users zoom in/out to explore the graph, they need to see more/less of the graph area, but the node icons themselves don't need to grow/shrink. This reduces visual clutter and improves usability.

**Implementation**:
- Node sizes are calculated based on degree (number of connections): 0-20 connections → 20-100 pixels
- Base sizes are stored when nodes are added to the graph
- On zoom events, node sizes are adjusted inversely: `adjustedSize = baseSize / zoomLevel`
- Result: Nodes appear at constant size on screen, but distances between nodes change naturally with zoom

**Key Functions**:
- `setupZoomIndependentNodeSizes()`: Registers zoom event handler
- `calculateAndStoreBaseSize(node)`: Calculates and stores base sizes based on node degree
- Automatically recalculates on layout changes

### Zoom-Independent Label Sizing

Labels use a hybrid approach:
- Cytoscape's built-in `min-zoomed-font-size` prevents shrinking when zoomed out (minimum 8px)
- Custom zoom handler caps maximum size when zoomed in (maximum 12px)
- Result: Labels stay readable at all zoom levels without becoming oversized

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- IE11+ (with polyfills)

## Testing

Tests for the visualizer functionality are located in `test/visualizer.test.js`. To run tests:

```bash
npm test -- test/visualizer.test.js
```

**Note**: The test file currently requires additional setup to run in a Node.js environment. See the test file comments for details on making the tests executable.

### Manual Testing

To manually test the zoom-independent node sizing:

1. Load a graph with multiple nodes
2. Zoom in using the mouse wheel or pinch gesture
3. Verify that node icons stay approximately the same size on screen
4. Verify that distances between nodes increase (nodes spread apart)
5. Zoom out and verify nodes don't shrink
6. Change layouts and verify behavior persists
