# Code2Graph

Code2Graph is a command-line tool that analyzes React/TypeScript codebases to create comprehensive dependency graphs on the level of individual front-end elements, functions, and database tables. 

The output is a JSON file containing nodes and edges of a graph. 
This serves as input for a graph visualisation tool. 

In the graph, the top node is 'App-root'. 
The next layers are UI elements, APIs, functions, etc. 
The end nodes are database tables or data files. 

Dead code shows up as nodes with no incoming edges. 

Initial focus: React / Typescript.
More software languages to follow later. 

## Current Status

**Phase 1 - Foundation set-up - Complete**: Repository Cloning System
1.1 Project Structure Setup - COMPLETE
1.2 Core Type Definitions - COMPLETE
1.3 Basic CLI Framework - COMPLETE

✅ GitHub repository cloning with progress reporting
✅ Local directory analysis support  
✅ Proper cleanup and error handling
✅ File system scanning for TypeScript/JavaScript files
✅ Secure, sandboxed repository operations
✅ Command-line interface with analyze, help, version command

**Phase 2 - Repository Analysis - Complete**: Enhanced file filtering and validation
2.1 Repository Cloning System - COMPLETE
2.2 File System Scanner - COMPLETE
2.3 Basic AST Parser - COMPLETE
2.4 DependencyAnalyzer - COMPLETE

✅ repository-manager
✅ file-system-scanner with recursive scanning and filtering
✅ analysis-logger with proper logging and test isolation
✅ memory-monitor with memory tracking and warnings
✅ configuration-manager with validation and file operations
✅ dependency-analyzer with graph building - see details below
✅ Comprehensive test coverage (70 tests)

Details on DependencyAnalyzer
✅ Core Dependency Analyser Implementation (src/analyzers/dependency-analyser.ts). Key Methods Implemented: buildDependencyGraph(), traceAPICalls(), analyzeServiceDependencies(), mapDatabaseOperations(), createEdges(), normalizeAPIEndpoints(), detectCircularDependencies()
✅ Comprehensive Type Definitions (src/types/index.ts)
✅ Edge Creation Rules (Following Architecture Document)
✅ API Endpoint Normalization (Converts specific IDs to parameters, e.g., to ':clubid' or ':userid')
✅ Comprehensive Unit Tests (test/dependency-analyser.test.js)
✅ CLI Integration (src/index.ts)



**Phase 3 - React Component Analysis - Complete**: Traversing code and creating graph nodes
3.1 Component Detection - COMPLETE (integrated into AST Parser)
3.2 JSX Element Analysis - COMPLETE (integrated into AST Parser)
3.3 Import/Export Analysis - COMPLETE (integrated into AST Parser)

✅ ast-parser: Full ASTParserImpl class with all required methods
✅ Babel Integration: Proper TypeScript/JavaScript/JSX parsing using @babel/parser
✅ Import/Export Analysis: Comprehensive extraction of module dependencies
✅ JSX Element Detection: Full JSX component analysis with event handlers and data binding
✅ Informative Element Identification: Detection of display, input, data source, and state management elements
✅ CLI Integration: Seamlessly integrated into the existing Code2Graph workflow
✅ Comprehensive Testing: 100% test coverage with robust error handling scenarios

**Phase 4 - Middleware traversal - Complete**: Usage tracking and dead code detection
4.1 Usage Tracking - COMPLETE
4.2 Alive/Dead Code Analysis - COMPLETE
4.3 API and Backend Analysis - COMPLETE

✅ API endpoint analysis: traceAPICalls()
✅ Service dependency analysis: analyzeServiceDependencies()
✅ Database operation mapping: mapDatabaseOperations()
✅ API endpoint normalization: normalizeAPIEndpoints()
✅ Usage tracking for components, functions, and variables
✅ Live code score calculation (0-100)
✅ Dead code detection and identification
✅ Performance warnings for large codebases
✅ usage-tracker: Full UsageTrackerImpl class with comprehensive usage tracking
✅ Component Usage Tracking: Track component usage across files with import/export analysis
✅ Function Usage Tracking: Track function calls and references with cross-file analysis
✅ Variable Usage Tracking: Track variable usage and assignments with scope analysis
✅ Live Code Score Calculation: Implement liveCodeScore (0-100) based on usage patterns
✅ Dead Code Detection: Identify unused components, functions, and variables
✅ Usage Statistics: Comprehensive statistics for codebase analysis
✅ Performance Warnings: Automatic warnings for large codebases and high dead code percentages
✅ Integration with Dependency Analyzer: Seamless integration with existing graph building
✅ Used/unused API endpoint identification
✅ Frontend-to-backend connection mapping
✅ Backend dead code detection and labelling
✅ Analysis of database views and tables
✅ API & Backend progress indicator
✅ Comprehensive Testing: 100% test coverage with edge cases and error handling


**Phase 5 - Output Generation - Complete**: JSON Output Generator
5.1 JSON Output Generator - COMPLETE

✅ JSON output generator with comprehensive metadata
✅ Dead code report generation with recommendations
✅ Output validation system with errors and warnings
✅ File export with automatic directory creation
✅ Formatted JSON output (2-space indentation)
✅ Integration with CLI analysis workflow
✅ Comprehensive test coverage (60+ tests)

Details on JSON Output Generator
✅ Core JSON Generator Implementation (src/generators/json-generator.ts). Key Methods Implemented: generateGraph(), generateDeadCodeReport(), exportToFile(), validateOutput(), formatOutput()
✅ Complete Output Interfaces (JSONOutput, DeadCodeReport, ValidationResult)
✅ Metadata Generation (version, timestamp, repositoryUrl, analysisScope, statistics)
✅ Dead Code Recommendations (type-specific, impact-based, confidence-based)
✅ Comprehensive Unit Tests (test/json-generator.test.js)
✅ CLI Integration with automatic dead code report generation


## Next steps

In the project plan, the following steps need to be implemented. 

Phase 6: Testing and Validation (Week 6) — partial 
(unit tests exist for all components; integration tests needed)

Phase 7: Polish and Documentation (Week 7) — not started

Phase 8: Release and Future Planning (Week 8) — not started
8.2.1 GraphML Output Generator — not started
8.2.2 DOT Output Generator — not started



## Installation

1. Clone this repository:
```bash
git clone https://github.com/NickVanMaele-vonk/code2graph.git
cd code2graph
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Analyze a Repository

```bash
node dist/index.js analyze <repo-url>
```

Examples:
```bash
# Analyze a repository with default settings
node dist/index.js analyze https://github.com/user/repo

# Analyze with custom output format and file
node dist/index.js analyze https://github.com/user/repo -f json -o ./my-analysis.json

# Analyze a specific branch
node dist/index.js analyze https://github.com/user/repo -b develop
```

### Command Options

- `-o, --output <path>`: Output file path (default: ./graph-output.json)
- `-f, --format <format>`: Output format: json, graphml, dot (default: json)
- `-b, --branch <branch>`: Git branch to analyze
- `--depth <depth>`: Git clone depth (default: 1)
- `--timeout <ms>`: Clone timeout in milliseconds (default: 300000)

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Building

```bash
# Build TypeScript to JavaScript
npm run build
```

### Development Mode

```bash
# Run in development mode with auto-restart
npm run dev
```

## Architecture

The tool follows a modular architecture with three main layers:

1. **CLI Layer**: Command-line interface and user interaction
2. **Analysis Layer**: Repository cloning, file scanning, and analysis
3. **Output Layer**: Graph generation and export (planned)

## Current Implementation Details

### Repository Manager (`src/analyzers/repository-manager.ts`)

- **Secure Cloning**: Uses sandboxed environment with read-only access
- **Progress Reporting**: Real-time progress updates during cloning
- **Error Handling**: Comprehensive error handling for network, permission, and validation issues
- **File Scanning**: Recursive scanning with pattern matching and directory exclusion
- **Cleanup**: Automatic cleanup of temporary files and directories

### CLI Interface (`src/index.ts`)

- **Command Structure**: Uses Commander.js for robust CLI handling
- **Help System**: Built-in help and documentation
- **Error Handling**: User-friendly error messages and graceful failure handling

## Contributing

This project is in active development. Please refer to the project documentation in `project-docs/` for detailed specifications and architecture information.

## License

ISC License - see LICENSE file for details.

---

**Note**: This is Phase 2.1 implementation focusing on repository cloning. Additional analysis features will be implemented in subsequent phases.


### author: Nick Van Maele
### date of first commit: 2025-09-19


