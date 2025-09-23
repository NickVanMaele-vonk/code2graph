# Architecture Document
## Code2Graph - Code Dependency Visualization Tool

### Document Information
- **Version**: 1.0
- **Date**: 2024-12-19
- **Author**: Nick Van Maele
- **Project**: code2graph

---

## 1. Architecture Overview

### 1.1 System Purpose
Code2Graph is a static analysis tool that creates comprehensive dependency graphs of React/TypeScript applications, focusing on component-level relationships and dead code detection.

### 1.2 Architecture Principles
- **Modular Design**: Separate concerns into distinct, testable modules
- **Extensibility**: Easy to add new analyzers and output formats
- **Performance**: Efficient processing of large codebases
- **Reliability**: Graceful handling of malformed or complex code
- **Maintainability**: Clear separation of concerns and comprehensive testing

### 1.3 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Layer     │    │  Analysis Layer │    │  Output Layer   │
│                 │    │                 │    │                 │
│ • Command       │───▶│ • Repository   │───▶│ • JSON          │
│   Processing    │    │   Cloner        │    │   Generator     │
│ • Configuration │    │ • File Scanner  │    │ • GraphML       │
│ • Error         │    │ • AST Parser    │    │   Generator     │
│   Handling      │    │ • Component     │    │ • DOT Generator │
│                 │    │   Analyzer      │    │ • Report        │
│                 │    │ • Dead Code     │    │   Generator     │
│                 │    │   Detector      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 2. Core Components

### 2.1 CLI Layer (`src/cli/`)

#### 2.1.1 Command Interface (`index.ts`)
```typescript
interface CLIInterface {
  analyze(repoUrl: string, options: AnalysisOptions): Promise<void>;
  generateConfig(options: ConfigOptions): void;
  validateConfig(configPath: string): boolean;
}
```

**Responsibilities:**
- Parse command-line arguments
- Handle user input validation
- Coordinate analysis workflow
- Display results and progress
- Error handling and user feedback

#### 2.1.2 Configuration Manager (`config.ts`)
```typescript
interface ConfigManager {
  loadConfig(path: string): AnalysisConfig;
  validateConfig(config: AnalysisConfig): ValidationResult;
  getDefaultConfig(): AnalysisConfig;
}
```

**Responsibilities:**
- Load and validate global and repo-specific configuration files
- Provide default configurations
- Handle configuration inheritance
- Validate analysis rules and patterns

### 2.2 Analysis Layer (`src/analyzers/`)

#### 2.2.1 Repository Manager (`repository-manager.ts`)
```typescript
interface RepositoryManager {
  cloneRepository(url: string, targetPath: string): Promise<void>;
  scanFiles(directory: string, patterns: string[]): FileInfo[];
  cleanup(path: string): void;
}
```

**Responsibilities:**
- Clone GitHub repositories
- Validate file formats and software languages used
- Scan file systems for relevant files
- Manage temporary storage
- Clean up after analysis

#### 2.2.2 AST Parser (`ast-parser.ts`)
```typescript
interface ASTParser {
  parseFile(filePath: string): ASTNode;
  extractImports(ast: ASTNode): ImportInfo[];
  extractExports(ast: ASTNode): ExportInfo[];
  extractJSXElements(ast: ASTNode): JSXElementInfo[];
  extractInformativeElements(ast: ASTNode): InformativeElementInfo[];
  findASTNodeTypes(ast: ASTNode, targetTypes: string[]): ASTNode[];
}
```

**Responsibilities:**
- Parse TypeScript/JavaScript files using @babel/parser
- Extract import/export information
- Parse JSX elements and components
- Identify specific AST node types: JSXElement, JSXExpressionContainer, CallExpression, VariableDeclarator/VariableDeclaration, ArrowFunctionExpression/FunctionDeclaration, MemberExpression
- Handle different file types and syntax
- Detect informative elements through AST traversal

#### 2.2.3 React Analyzer (`react-analyzer.ts`)
```typescript
interface ReactAnalyzer {
  analyzeComponent(filePath: string, ast: ASTNode): ComponentInfo;
  findInformativeElements(ast: ASTNode): InformativeElement[];
  extractHooks(ast: ASTNode): HookInfo[];
  analyzeProps(ast: ASTNode): PropInfo[];
  detectDisplayElements(ast: ASTNode): DisplayElementInfo[];
  detectInputElements(ast: ASTNode): InputElementInfo[];
  detectDataSources(ast: ASTNode): DataSourceInfo[];
  detectStateManagement(ast: ASTNode): StateInfo[];
  collapseDuplicateNodes(nodes: NodeInfo[]): NodeInfo[];
}
```

**Responsibilities:**
- Identify React components (functional, class, hooks)
- Find informative elements using specific AST patterns
- Detect display elements: JSX elements with JSXExpressionContainer containing props/state data
- Detect input elements: JSX elements with event handlers (onClick, onChange, onSubmit)
- Detect data sources: CallExpression patterns for API calls
- Detect state management: VariableDeclarator with useState patterns
- Extract component props and state
- Analyze component lifecycle and effects
- Collapse duplicate nodes representing same logical concept

#### 2.2.4 Dependency Analyzer (`dependency-analyzer.ts`)
```typescript
interface DependencyAnalyzer {
  buildDependencyGraph(components: ComponentInfo[]): DependencyGraph;
  traceAPICalls(components: ComponentInfo[]): APICallInfo[];
  analyzeServiceDependencies(services: ServiceInfo[]): ServiceGraph;
  mapDatabaseOperations(services: ServiceInfo[]): DatabaseOperationInfo[];
  createEdges(nodes: NodeInfo[]): EdgeInfo[];
  normalizeAPIEndpoints(endpoints: string[]): string[];
  detectCircularDependencies(graph: DependencyGraph): CycleInfo[];
}
```

**Responsibilities:**
- Build component dependency graphs
- Trace API calls from frontend to backend
- Analyze service layer dependencies
- Map database operations and schema usage
- Create edges with direction from caller to callee, from data to database
- Create edges with types {"calls", "reads", "writes to"}
- Handle multiple outgoing edges for event handlers with multiple function calls
- Handle multiple edges to multiple table nodes for single fetch operations
- Normalize API endpoints with parameters (e.g., :clubid instead of specific IDs)
- Detect circular dependencies and stop after second traversal

#### 2.2.5 Dead Code Detector (`dead-code-detector.ts`)
```typescript
interface DeadCodeDetector {
  findUnusedComponents(graph: DependencyGraph): ComponentInfo[];
  findUnusedFunctions(graph: DependencyGraph): FunctionInfo[];
  findUnusedAPIs(graph: DependencyGraph): APIEndpointInfo[];
  findUnusedDatabaseEntities(graph: DependencyGraph): DatabaseEntityInfo[];
}
```

**Responsibilities:**
- Identify unused components and functions
- Detect unused API endpoints
- Find unused database tables and fields
- Generate dead code reports

#### 2.2.6 Progress Reporter (`progress-reporter.ts`)
```typescript
TODO
```

**Key elements:**
- Component-Based Design: Encapsulate the progress bar as reusable React component that accepts progress state as a prop.
- State Management: Use React state (useState) or global state (e.g., Redux, Context API) to control the progress value, updating it based on app process events.
- Animation & Visual Feedback: Use CSS transitions or React Native Animated API for smooth progress changes and user feedback.
- Decoupling UI and Logic: progress calculation and timing logic separate from UI components 

Note: Accessibility via ARIA roles and attributes (role="progressbar", aria-valuenow, etc.) for screen readers.


**Responsibilities:**
- Estimate progress of a component and pass to Progress window in UI

**Best practices:**
- Use global state for progress if multiple components need it or it reflects app-wide process state.
- Use animated transitions for better UX.
- Separate UI rendering from business logic.
- Handle indeterminate states gracefully with spinner or looping animations if progress % isn’t known.
- Ensure responsiveness for different device sizes.

**Resources and Examples:**
- React Native progress bar libraries like react-native-progress offer customizable UI and API.
- CSS animated progress bars with React use transform: translateX() for smooth sliding.
- Accessible progress bars should have screen reader-friendly attributes.

**Code example:**
```typescript
// Indicative code example
// NO obligation to use this literally. Instead, see it as a conceptual example. 

import React, { useState, useEffect, FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Define a type for the props
interface ProgressBarProps {
  progress: number;
}

// ProgressBar component with typed props
const ProgressBar: FC<ProgressBarProps> = ({ progress }) => {
  return (
    <View style={styles.container}>
      <View style={[styles.filler, { width: `${progress}%` }]} />
      <Text>{progress}%</Text>
    </View>
  );
};

// Parent or container component managing the progress state
const ParentComponent: FC = () => {
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => (prev >= 100 ? 100 : prev + 10));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <ProgressBar progress={progress} />;
};

const styles = StyleSheet.create({
  container: {
    height: 20,
    width: '100%',
    backgroundColor: '#e0e0de',
    borderRadius: 50,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  filler: {
    height: '100%',
    backgroundColor: '#3b5998',
  },
});

export default ParentComponent;

```



#### 2.2.7 Analysis Logger (`analysis-logger.ts`)
```typescript
TODO
```

**Responsibilities:**
- Read file path and file name of analyis log file from configuration file
- Log all status messages, warnings, and errors to the analysis log file


#### 2.2.8 Internal Tester (`internal-tester.ts`)
```typescript
TODO
```

**Responsibilities:**
- Run tests against code2graph data and results
- Report success or failure
- Provide comprehensive summary of test cycle

#### 2.2.9 Database Analyser (`db-analyser.ts`)
```typescript
TODO
```

**Responsibilities:**
- Interpret SQL statement
- Return tables or views so that nodes can be created

#### 2.2.10 Memory Monitor (`memory-monitor.ts`)
```typescript
TODO
```

**Responsibilities:**
- Monitor memory usage
- Warn at warning threshold (80%) and throw error at memory full (100%) 

#### 2.2.11 Error handler (`error-handler.ts`)
```typescript
TODO
```

**Responsibilities:**
- Catch errors thrown by other components
- Process errors
- Log errors to analysis log file
- Trigger actions





### 2.3 Output Layer (`src/generators/`)

#### 2.3.1 JSON Generator (`json-generator.ts`)
```typescript
interface JSONGenerator {
  generateGraph(graph: DependencyGraph): GraphJSON;
  generateDeadCodeReport(deadCode: DeadCodeInfo[]): DeadCodeReport;
  exportToFile(data: any, filePath: string): void;
}
```

**Responsibilities:**
- Generate structured JSON output
- Create dead code reports
- Export data to files
- Validate output format

#### 2.3.2 GraphML Generator (`graphml-generator.ts`)
```typescript
interface GraphMLGenerator {
  generateGraphML(graph: DependencyGraph): string;
  addNodeAttributes(node: NodeInfo): GraphMLNode;
  addEdgeAttributes(edge: EdgeInfo): GraphMLEdge;
}
```

**Responsibilities:**
- Generate GraphML format for professional tools
- Add rich node and edge attributes
- Support for complex graph visualizations
- Export to GraphML standard format

#### 2.3.3 DOT Generator (`dot-generator.ts`)
```typescript
interface DOTGenerator {
  generateDOT(graph: DependencyGraph): string;
  formatNode(node: NodeInfo): string;
  formatEdge(edge: EdgeInfo): string;
}
```

**Responsibilities:**
- Generate DOT format for Graphviz
- Format nodes and edges appropriately
- Support for different graph layouts
- Export to DOT standard format

---

## 3. Data Models

### 3.1 Core Types (`src/types/`)

#### 3.1.1 Graph Types
```typescript
interface DependencyGraph {
  nodes: NodeInfo[];
  edges: EdgeInfo[];
  metadata: GraphMetadata;
}

interface NodeInfo {
  id: string;
  label: string;
  nodeType: NodeType; 
  nodeCategory: NodeCategory;
  datatype: DataType;
  liveCodeScore: number;
  file: string;
  line?: number;
  column?: number;
  properties: Record<string, any>;
}

interface EdgeInfo {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  properties: Record<string, any>;
}

// Type Definitions
type DataType = "array" | "list" | "integer" | "table" | "view" | string;
type NodeType =  "function" | "API" | "table" | "view" | "route" | string;
type NodeCategory = "front end" | "middleware" | "database";
type RelationshipType = "imports" | "calls" | "uses" | "reads" | "writes to" | "renders";

```

#### 3.1.2 Component Types
```typescript
interface ComponentInfo {
  name: string;
  type: ComponentType;
  file: string;
  props: PropInfo[];
  state: StateInfo[];
  hooks: HookInfo[];
  children: ComponentInfo[];
  informativeElements: InformativeElement[];
}

interface InformativeElement {
  type: ElementType;
  name: string;
  props: Record<string, any>;
  eventHandlers: EventHandler[];
  dataBindings: DataBinding[];
}
```

#### 3.1.3 Analysis Types
```typescript
interface AnalysisResult {
  graph: DependencyGraph;
  deadCode: DeadCodeInfo[];
  metrics: AnalysisMetrics;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
}

interface DeadCodeInfo {
  type: DeadCodeType;
  name: string;
  file: string;
  reason: string;
  confidence: number;
  suggestions: string[];
}
```

---

## 4. Technology Stack

### 4.1 Core Technologies
- **Language**: TypeScript (primary), JavaScript (compatibility)
- **Runtime**: Node.js 18+
- **CLI Framework**: Commander.js or Yargs
- **AST Parsing**: @babel/parser, @babel/traverse, @babel/types
- **Testing**: Jest with TypeScript support
- **Build**: esbuild or tsup for fast compilation
- **Linting**: ESLint with TypeScript rules

### 4.2 Dependencies
```json
{
  "dependencies": {
    "@babel/parser": "^7.23.0",
    "@babel/traverse": "^7.23.0",
    "@babel/types": "^7.23.0",
    "commander": "^11.0.0",
    "fs-extra": "^11.0.0",
    "glob": "^10.0.0",
    "simple-git": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0",
    "esbuild": "^0.19.0"
  }
}
```

### 4.3 Development Tools
- **Package Manager**: npm or yarn
- **Version Control**: Git with conventional commits
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint, Prettier, Husky
- **Documentation**: JSDoc, Markdown

---

## 5. Data Flow

### 5.1 Analysis Pipeline

```
Repository URL
     │
     ▼
┌─────────────┐
│ Clone Repo  │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Scan Files  │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Parse AST   │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Analyze     │
│ Components  │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Build       │
│ Dependency  │
│ Graph       │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Detect      │
│ Dead Code   │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Generate    │
│ Output      │
└─────────────┘
```

### 5.2 Error Handling Flow

```
Analysis Step
     │
     ▼
┌─────────────┐
│ Try Execute │
└─────────────┘
     │
     ▼
┌─────────────┐    ┌─────────────┐
│ Success?    │───▶│ Continue    │
└─────────────┘    └─────────────┘
     │
     ▼
┌─────────────┐
│ Log Error   │
└─────────────┘
     │
     ▼
┌─────────────┐
│ Skip &      │
│ Continue    │
└─────────────┘
```

---

## 6. Performance Considerations

### 6.1 Memory Management
- **Streaming Processing**: Process files in chunks to avoid memory issues
- **Garbage Collection**: Explicit cleanup of large objects
- **Memory Monitoring**: Track memory usage during analysis. Warn at 80% full. Stop execution at 100% full and exit with error "Fatal error: memory capacity exceeded". 
- **File Caching**: Cache parsed ASTs for repeated analysis

### 6.2 Processing Optimization
- **Parallel Processing**: Analyze multiple files concurrently
- **Incremental Analysis**: Only re-analyze changed files
- **Smart Filtering**: Skip irrelevant files early
- **Lazy Loading**: Load components only when needed

### 6.3 Scalability
- **Large Repository Support**: Handle repositories with 10,000+ files
- **Expected Node Count**: 2,500-3,000 nodes for 100k lines of code
- **Progress Reporting**: Show analysis progress for long operations
- **Cancellation**: Allow users to cancel long-running operations
- **Continue/Stop Dialog**: Popup for long-running analysis with user choice
- **Resume Capability**: Resume interrupted analysis

---

## 7. Security Considerations

### 7.1 Repository Security
- **Sandboxed Execution**: Run analysis in isolated environment
- **Input Validation**: Validate all repository URLs and file paths
- **Permission Checks**: Verify read-only access to repositories
- **Cleanup**: Ensure temporary files are properly cleaned up

### 7.2 Code Security
- **No Code Execution**: Never execute analyzed code
- **Static Analysis Only**: No runtime behavior analysis
- **Safe Parsing**: Handle malformed code safely
- **Error Isolation**: Prevent analysis errors from affecting system

---

## 8. Testing Strategy

### 8.1 Unit Testing
- **Component Tests**: Test individual analyzers and generators
- **Mock Dependencies**: Mock file system and network operations
- **Edge Cases**: Test with malformed and complex code
- **Performance Tests**: Benchmark analysis speed and memory usage

### 8.2 Integration Testing
- **End-to-End Tests**: Test complete analysis pipeline
- **Real Repository Tests**: Test with actual React projects
- **Output Validation**: Verify generated graphs are correct
- **Regression Tests**: Ensure changes don't break existing functionality

### 8.3 Test Data
- **Fixture Repositories**: Small, controlled test repositories
- **Sample Components**: Various React component patterns
- **Edge Cases**: Malformed code, complex dependencies
- **Performance Benchmarks**: Large repositories for performance testing

---

## 9. Deployment Architecture

### 9.1 Distribution Methods
Priority for initial versions: 
- **GitHub Releases**: Tagged releases with changelog

Other possible methods that might be implemented in future but excluded for now:  
- **NPM Package**: Node.js distribution method
- **Binary Releases**: Standalone executables for different platforms
- **Docker Image**: Containerized version for CI/CD

### 9.2 Installation Methods
```bash
# NPM Global Installation
npm install -g code2graph

# NPM Local Installation
npm install code2graph

# Binary Download
curl -L https://github.com/user/code2graph/releases/latest/download/code2graph-linux -o code2graph
chmod +x code2graph
```

### 9.3 Configuration Management
- **Global Config**: System-wide configuration
- **Project Config**: Repository-specific configuration
- **Command Line**: Override configuration via CLI options
- **Environment Variables**: Configuration via environment

---

## 10. Future Architecture Considerations

### 10.1 Extensibility
- **Plugin System**: Allow third-party analyzers
- **Custom Output Formats**: Support for new output formats
- **Framework Support**: Easy addition of new frameworks
- **Language Support**: Extension to other languages

### 10.2 Scalability
- **Distributed Analysis**: Support for analyzing multiple repositories
- **Caching Layer**: Cache analysis results for faster re-analysis
- **API Server**: REST API for programmatic access
- **Web Interface**: Browser-based analysis tool

### 10.3 Integration
- **IDE Extensions**: Real-time analysis in development environments
- **CI/CD Integration**: Automated analysis in build pipelines
- **Monitoring**: Track analysis metrics and performance
- **Alerting**: Notify on dead code detection or architecture issues

---

*This architecture document provides the technical foundation for the code2graph project and will be updated as the system evolves and new requirements emerge.*

