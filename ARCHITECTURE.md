# Code2Graph Architecture

## Overview

Code2Graph is built with a **modular, two-part architecture** that separates code analysis from visualization. This design allows each part to be used independently and makes the codebase more maintainable and user-friendly.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Code2Graph System                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────┐         ┌─────────────────────────┐
│   Part 1: Analyzer      │         │  Part 2: Visualizer     │
│   (Code → JSON)         │         │  (JSON → Graph)         │
├─────────────────────────┤         ├─────────────────────────┤
│                         │         │                         │
│  Input:                 │         │  Input:                 │
│  - GitHub Repo URL      │         │  - JSON file            │
│  - Local Directory      │         │                         │
│                         │         │  Output:                │
│  Output:                │         │  - Interactive Graph    │
│  - JSON file            │────────▶│  - Web Visualization    │
│  - Metadata             │  JSON   │  - Cytoscape.js         │
│  - Statistics           │         │                         │
│                         │         │                         │
│  Location: src/         │         │  Location: visualizer/  │
│  Tech: TypeScript       │         │  Tech: HTML/CSS/JS      │
│                         │         │                         │
└─────────────────────────┘         └─────────────────────────┘
        │                                    │
        │                                    │
        ▼                                    ▼
  ┌─────────┐                          ┌─────────┐
  │ Can be  │                          │ Can be  │
  │ used    │                          │ used    │
  │ alone   │                          │ alone   │
  └─────────┘                          └─────────┘
```

## Part 1: Analyzer (Code → JSON)

### Purpose
Analyze code repositories and extract dependency information into a structured JSON format.

### Location
- Main codebase: `src/`
- Entry point: `src/index.ts`
- Core modules: `src/analyzers/`, `src/generators/`

### Key Components

#### 1. Repository Manager
- Clones GitHub repositories
- Manages local file scanning
- Handles cleanup and error recovery

#### 2. AST Parser
- Parses TypeScript/JavaScript/JSX files
- Extracts components, functions, and imports
- Uses Babel parser for accurate AST analysis

#### 3. Dependency Analyzer
- Builds dependency graph
- Tracks component relationships
- Identifies external dependencies
- Detects API calls and database operations

#### 4. Usage Tracker
- Calculates live code scores (0-100)
- Identifies dead code
- Tracks usage across files

#### 5. JSON Generator
- Creates structured output
- Includes metadata and statistics
- Generates dead code reports
- Validates output

### Usage

```bash
# Analyze a repository
node dist/index.js analyze <repo-url>

# With options
node dist/index.js analyze <repo-url> -o output.json -f json
```

### Output Format

```json
{
  "version": "1.0.0",
  "timestamp": "2025-10-24T22:04:52.388Z",
  "statistics": {
    "totalNodes": 8,
    "totalEdges": 4,
    "liveCodeNodes": 8,
    "deadCodeNodes": 0
  },
  "graph": {
    "nodes": [...],
    "edges": [...]
  }
}
```

### Independence
- Can be used standalone to generate JSON
- JSON can be consumed by other tools (Gephi, Graphviz, etc.)
- No dependency on visualizer

## Part 2: Visualizer (JSON → Interactive Graph)

### Purpose
Transform code2graph JSON output into an interactive, web-based graph visualization.

### Location
- Directory: `visualizer/`
- Files:
  - `index.html` - Main HTML structure
  - `visualizer.js` - Cytoscape.js logic
  - `styles.css` - Styling
  - `README.md` - Visualizer documentation

### Key Features

#### 1. Interactive Graph
- Zoom and pan controls
- Node selection and highlighting
- Edge visualization with arrows
- Responsive layout

#### 2. Node Styling
- Color-coded by type (functions, external dependencies)
- Different shapes for different node types
- Size based on node importance

#### 3. Controls
- Filter by node type
- Switch layout algorithms
- Search nodes by name
- Load different JSON files

#### 4. Statistics Panel
- Total nodes and edges
- Live/dead code counts
- Dead code percentage

### Technology

- **Cytoscape.js**: Graph visualization library
- **HTML5/CSS3**: Modern web standards
- **Vanilla JavaScript**: No build process required

### Usage

#### Quick Start
1. Place your JSON file in `visualizer/` directory (name it `graph-output.json`)
2. Open `visualizer/index.html` in your browser
3. Graph loads automatically

#### Alternative Usage
1. Open `visualizer/index.html`
2. Click "Load JSON" button
3. Select your JSON file

### Browser Compatibility
- Chrome, Firefox, Safari, Edge (latest versions)
- No server required - runs client-side

### Independence
- Can visualize any JSON in code2graph format
- No dependency on the analyzer
- Works standalone in any browser

## Workflow Integration

### Complete Workflow

```bash
# Step 1: Analyze code
node dist/index.js analyze https://github.com/user/repo

# Step 2: Copy output to visualizer
cp graph-data-files/output.json visualizer/graph-output.json

# Step 3: Open visualizer
# Open visualizer/index.html in your browser
```

### Automated Workflow (Future)

```bash
# One command to do everything
npm run analyze-and-visualize <repo-url>
```

## Benefits of Two-Part Architecture

### 1. Separation of Concerns
- **Analyzer**: Focuses on code analysis
- **Visualizer**: Focuses on user experience

### 2. Independence
- Use analyzer to generate JSON for other tools
- Use visualizer with any compatible JSON source
- Easy to swap visualization technology

### 3. Maintainability
- Changes to analyzer don't affect visualizer
- Changes to visualizer don't affect analyzer
- Easier to test and debug

### 4. Scalability
- Can add multiple visualizers (e.g., D3.js, Sigma.js)
- Can add different output formats (GraphML, DOT)
- Easy to extend either part independently

### 5. User Choice
- Users can use only the analyzer with their own tools
- Users can use the visualizer with data from other sources
- Flexibility for different use cases

## File Structure

```
code2graph/
├── src/                          # Part 1: Analyzer
│   ├── analyzers/                # Analysis modules
│   │   ├── repository-manager.ts
│   │   ├── ast-parser.ts
│   │   ├── dependency-analyser.ts
│   │   └── ...
│   ├── generators/               # Output generation
│   │   └── json-generator.ts
│   ├── types/                    # Type definitions
│   └── index.ts                  # Entry point
│
├── visualizer/                   # Part 2: Visualizer
│   ├── index.html                # Main HTML
│   ├── visualizer.js             # Cytoscape.js logic
│   ├── styles.css                # Styling
│   ├── graph-output.json         # Sample data
│   └── README.md                 # Visualizer docs
│
├── graph-data-files/             # Generated outputs
├── test/                         # Tests for analyzer
├── README.md                     # Main documentation
└── ARCHITECTURE.md               # This file
```

## API Interface Between Parts

### JSON Schema (Part 1 Output / Part 2 Input)

```typescript
interface Code2GraphOutput {
  version: string;
  timestamp: string;
  repositoryUrl: string;
  analysisScope: {
    includedTypes: string[];
    excludedTypes: string[];
  };
  statistics: {
    linesOfCode: number;
    totalNodes: number;
    totalEdges: number;
    deadCodeNodes: number;
    liveCodeNodes: number;
    deadCodePercentage: number;
  };
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

interface GraphNode {
  id: string;
  label: string;
  nodeType: string;
  nodeCategory: string;
  liveCodeScore: number;
  file: string;
  line: number;
  properties: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  properties: Record<string, any>;
}
```

## Future Enhancements

### For Analyzer (Part 1)
- Support for more languages (Python, Java, etc.)
- Additional output formats (GraphML, DOT)
- Plugin system for custom analyzers

### For Visualizer (Part 2)
- Export to PNG/SVG
- 3D visualization option
- Collaboration features
- Custom themes

### Integration
- REST API for remote analysis
- Web-based analyzer interface
- VS Code extension

## Conclusion

The two-part architecture of Code2Graph provides:
- **Clear separation of responsibilities**
- **Independent usage of each part**
- **Easy maintenance and extension**
- **Flexibility for users**
- **Professional code organization**

This architecture makes Code2Graph a robust, scalable, and user-friendly tool for code dependency analysis and visualization.
