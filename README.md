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

**Phase 2.1 Implementation Complete**: Repository Cloning System

The tool currently implements:
- ✅ GitHub repository cloning with progress reporting
- ✅ Local directory analysis support  
- ✅ Proper cleanup and error handling
- ✅ File system scanning for TypeScript/JavaScript files
- ✅ Secure, sandboxed repository operations
- ✅ Command-line interface with analyze command

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
npm start analyze <repo-url>
```

Examples:
```bash
# Analyze a repository with default settings
npm start analyze https://github.com/user/repo

# Analyze with custom output format and file
npm start analyze https://github.com/user/repo -f json -o ./my-analysis.json

# Analyze a specific branch
npm start analyze https://github.com/user/repo -b develop
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

## Next Steps

The following phases are planned:

- **Phase 2.2**: File System Scanner (enhanced file filtering and validation)
- **Phase 2.3**: Basic AST Parser (TypeScript/JavaScript parsing)
- **Phase 2.4**: Dependency Analyzer (component relationship analysis)
- **Phase 3**: React Component Analysis
- **Phase 4**: Middleware Traversal and Dead Code Detection

## Contributing

This project is in active development. Please refer to the project documentation in `project-docs/` for detailed specifications and architecture information.

## License

ISC License - see LICENSE file for details.

---

**Note**: This is Phase 2.1 implementation focusing on repository cloning. Additional analysis features will be implemented in subsequent phases.


### author: Nick Van Maele
### date of first commit: 2025-09-19


