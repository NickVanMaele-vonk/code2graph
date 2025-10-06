# Product Requirements Document (PRD)
## Code2Graph - Code Dependency Visualization Tool

### Document Information
- **Version**: 1.1
- **Date**: 2025-10-06
- **Author**: Nick Van Maele
- **Project**: code2graph

---

## 1. Executive Summary

### 1.1 Product Vision
Code2Graph is a command-line tool that analyzes full stack codebases to create comprehensive dependency graphs, with a primary focus on identifying dead code and visualizing the complete flow from frontend components to database operations.

### 1.2 Problem Statement
AI-generated code often contains duplicate and unused components, making the resulting full stack codebases difficult to maintain and understand. Current tools provide file-level dependency analysis but lack the granular component-level insights needed to identify dead code and understand the complete data flow through a full-stack application.

### 1.3 Solution Overview
A specialized tool that:
- Analyzes React components at the **component level** (not file level), detecting individual functional and class components within files
- Prioritizes granular analysis of **custom code** while treating external libraries as black-box infrastructure
- Traces dependencies from frontend UI elements through API calls to backend services and database operations
- Follows **UI → Database flow** principle for intuitive dependency understanding
- Generates structured graph data in multiple formats (JSON, GraphML, DOT) with clear distinction between custom code and external dependencies
- Identifies dead code by tracking unused components, functions, and database entities
- Provides visual representations of the complete application architecture with filtering capabilities

---

## 2. Target Users

### 2.1 Primary Users
- **React/TypeScript/Full Stack Developers**: Need to understand and clean up their codebases
- **Code Reviewers**: Want to identify unused code and understand component relationships
- **Technical Leads**: Need architectural overviews and dead code identification
- **AI-Assisted Development Teams**: Specifically those using AI tools that generate duplicate code

### 2.2 Secondary Users
- **DevOps Engineers**: Need to understand application dependencies for deployment
- **QA Engineers**: Want to understand component relationships for testing strategies
- **New Team Members**: Need to quickly understand codebase architecture

---

## 3. Core Features

### 3.1 Primary Features (MVP)

#### 3.1.1 Repository Analysis
- **GitHub Repository Cloning**: Clone and analyze remote repositories
- **File System Scanning**: Recursively scan for React/TypeScript files
- **Multi-format Support**: Handle .tsx, .ts, .jsx, .js files
- **Security**: ensure read-only view on repo, always use sandbox environment, and never execute repo code

#### 3.1.2 Component Analysis
- **React Component Detection**: 
  - Identify individual components within files (component-level granularity, not file-level)
  - Support functional components (arrow functions, function declarations, function expressions)
  - Support class components extending React.Component or Component
  - Validate React naming conventions (uppercase first letter)
  - Filter detection to React files only (.tsx/.jsx extensions or files importing React)
  - Track precise source locations (file, line, column) for each component
  - Handle multiple components per file correctly
  - Exclude non-component files (webpack.config.js, utility files, etc.)
- **Informative Element Identification**: Find components that exchange internal data with users:
  - Components that display database data to users (e.g., displaying a list of club members)
  - Components that capture user input or choices (e.g., forms, dialogs with Accept/Reject buttons)
  - Note: Labels and non-interactive elements are not considered informative
- **Programmatic identification**: Analyze AST using @babel/parser to identify:
  - **Primary AST Node Types**: JSXElement, JSXExpressionContainer, CallExpression, VariableDeclarator/VariableDeclaration, ArrowFunctionExpression/FunctionDeclaration, MemberExpression
  - **Display Elements**: JSX elements with JSXExpressionContainer containing props/state data
  - **Input Elements**: JSX elements with event handlers (onClick, onChange, onSubmit)
  - **Event Handler Analysis**: Extract function calls from event handlers:
    - Function references: `onClick={handleClick}` → identifies "handleClick" as target function
    - Arrow functions: `onClick={() => { func1(); func2(); }}` → identifies ["func1", "func2"] as targets
    - Inline functions: `onClick={function() { doSomething(); }}` → identifies ["doSomething"] as target
    - Multiple calls per handler supported for complete data flow tracking
  - **Data Sources**: CallExpression patterns for API calls
  - **State Management**: VariableDeclarator with useState patterns
  - **Node Creation Rules**: Imported components become nodes if used; data arrays/variables become nodes; functions handling data/interaction become nodes; API endpoints normalized with parameters (e.g., :clubid); database tables/views become nodes; conditionally rendered components become nodes; JSX fragments analyzed same as regular JSX
  - **Node Collapse Logic**: Multiple nodes representing same data collapse into one if they lead to same database table
  - **Naming Conventions**: Use import alias for components; use array variable name for data arrays; use function name for functions; use parameterized form for API endpoints
  - **Data Typing**: Each node has "datatype" label with values {"array", "list", "integer", "table", "view"} and "category" label with values {"front end", "middleware", "database"}
  - **What Does NOT Become a Node**: External APIs (become end nodes in path); React Context providers; UI-only elements (styling, navigation without data capture); early return components; index files (containers); unused imports
  - **Edge Creation Rules**: Direction from caller to callee, from data to database; types {"imports", "calls", "reads", "writes to", "renders", "contains"}; event handlers with multiple function calls get multiple outgoing edges; single fetch with multiple tables gets multiple edges to each table; circular dependencies stop after second traversal
  - **Event Handler Edges**: Create "calls" edges from JSX elements to handler functions based on parsed event handler expressions; supports function references, arrow functions, and inline functions; enables complete user interaction flow: User → Button → handleClick → validateInput → API → Database
- **JSX Element Parsing**: Analyze JSX structure to identify component relationships
- **Import/Export Mapping**: Track component dependencies and usage
- **Circular Dependency Detection**: Identify problematic dependency cycles

#### 3.1.3 Dependency Tracing
- **Edge Direction Philosophy**: All edges follow UI → Database flow for intuitive tracing
  - Component → Import (dependency on external library)
  - Component → JSX Element (structural parent-child with "contains" relationship)
  - Component A → Component B (component usage with "renders" relationship)
  - Component → API (invocation with "calls" relationship)
  - API → Database (data access with "reads" or "writes to" relationship)
- **Frontend-to-API Mapping**: Connect React components to API endpoint calls
- **API Route Analysis**: Identify Express.js routes and middleware (framework-agnostic approach)
- **Service Layer Analysis**: Track business logic functions between API routes and database operations (e.g., getUserById, calculateTotalPrice)
- **Database Operations Analysis**: Connect services to database operations, focusing on:
  - Tables and views only (persistent data entities)
  - SELECT, UPSERT, INSERT statements that read/update table data
- **External Dependency Handling**:
  - Create one node per external package (not per import statement)
  - Minimal detail (package name, version) to reduce noise
  - Flag as infrastructure for easy filtering
  - Example: All React imports → single "react" node
- **JSX Instance Handling**:
  - Store JSX usage as metadata on component definitions (renderLocations)
  - Do not create separate nodes for JSX instances (avoids duplication)
  - Track WHERE components are rendered without creating redundant nodes
- **Recursion Prevention**: Prevent self-referencing edges to avoid infinite loops while supporting same-file component usage

#### 3.1.4 Dead Code Detection
- **Dead Code Definition**: Code defined in one location but never called anywhere else in the same repository
- **Detection Method**: Based on static code analysis within the target repo, detect nodes with no incoming edges (liveCodeScore = 0)
- **Scope**: App repository only, excluding test files in first version. Test files are files stored in ./test or have "test" or "tst" in their file name or file extension
- **Assumption**: Repository is self-contained with no external callers
- **Examples**: API endpoint `/api/:clubid/persons/` is dead code if defined but never called in the codebase
- **Scoring Method**: 100 = confirmed incoming edge, meaning that at least one other function or code fragment is calling the current node; 0 = no incoming edge based on static code analysis of repo; scores 1-99 are probability scores to be used in a future version of code2graph that takes into account calls from external code. 
- **Category**: each node has a label "category" which stores the name of the layer in which the node is active. Possible values are "front end", "middleware", "database". (This list of values can be extended when the need arises)

#### 3.1.5 Output Generation
- **JSON Format**: Primary structured output format with complete dependency graph
- **GraphML Format**: For professional graph analysis tools
- **DOT Format**: For Graphviz visualization
- **Node Structure**: Every function/informative element = node, function calls = edges
- **Edge types**: possible values for relationship: "imports" | "calls" | "uses" | "reads" | "writes to" | "renders" | "contains"
  - "contains": Component → JSX Element (structural parent-child)
  - "renders": Component → Component (component usage/rendering)
  - "imports": Component → External Package (dependency)
  - "calls": Component/API → API/Function (invocation)
  - "reads": API → Database Table/View (data read)
  - "writes to": API → Database Table/View (data write)
- **Dead Code Identification**: Nodes with liveCodeScore = 0 (no incoming edges)
- **Live Code Identification**: Nodes with liveCodeScore = 100 (has incoming edges)
- **Dead Code Report**: List dead codes, i.e., nodes with liveCodeScore = 0

### 3.2 Secondary Features (Future Releases)

#### 3.2.1 Advanced Analysis
- **Code Complexity Metrics**: Calculate coupling and cohesion metrics
- **Change Impact Analysis**: Predict what breaks when components are modified
- **Performance Impact Analysis**: Identify components that affect performance

#### 3.2.2 Enhanced Output Formats
- **Mermaid Diagrams**: For documentation integration
- **Interactive HTML Reports**: Web-based visualization
- **SVG Export**: High-quality static visualizations
- **CSV Export**: For spreadsheet analysis

#### 3.2.3 Integration Features
- **CI/CD Integration**: GitHub Actions, GitLab CI workflows
- **IDE Extensions**: VS Code plugin for real-time analysis
- **Web Interface**: Browser-based analysis tool
- **API Server**: REST API for programmatic access

---

## 4. Technical Requirements

### 4.1 Input Requirements
- **Repository Sources**: GitHub URLs, local directories
- **Supported Languages**: TypeScript, JavaScript, JSX, TSX
- **Framework Support**: React (primary), Next.js, Gatsby (future)
- **Backend Support**: Express.js, Node.js APIs (primary)

### 4.2 Output Requirements
- **JSON Schema**: Structured graph data with nodes, edges, and liveCodeScore labels
- **Performance Targets**: 
  - Recommended limit: 100,000 lines of payload code (500 files × 200 lines each)
  - Recommended file limit: 500 files
  - Expected node count: 2,500-3,000 nodes for 100k lines of code
  - Processing time: To be determined after unit tests
  - Memory limit: To be determined after initial testing
  - If limits are exceeded, warn user about potential performance impact, but continue. 
- **Definition**: 
  - Line of code: any line in the file counts as one line - includes comments and blank lines
  - Line of payload code: line of code that helps to define functionality - excludes comments and blank lines 
- **Accuracy**: >95% accuracy in component relationship detection
- **Reliability**: Handle malformed code gracefully without crashing
  - If function or other granular code element is malformed: "Error: <name> has bad syntax. Skipped." (where <name> is the name given in the code to that element)=> go to next code element.
  - If code file is inaccessible: "Error: file <full-path-and-file-name> is not accessible. Skipped." => go to next file. 
  - If repo cloning fails during cloning: "Fatal error: repository cloning failed. Please clone again." => stop execution
  - If repo is corrupt after cloning: "Fatal error: repository is corrupt. Please clone again." => stop execution

### 4.3 Platform Requirements
- **Operating Systems**: Windows, macOS, Linux
- **Node.js**: Version 18+ required
- **Memory**: Minimum 4GB RAM for large codebases
- **Storage**: Temporary storage for cloned repositories

### 4.4 Logging
For each repo being analyzed, create file './log/<repo-name>-analysis.log. Add code2graph steps, warnings, and errors as new separate lines. 
Example: if repo URL = 'https://github.com/JohnDoe/codeSample then add './log/codeSample-analysis.log'

---

## 5. User Experience Requirements

### 5.1 Command Line Interface
- **Simple Commands**: `code2graph analyze <repo-url>`
- **Include/Exclude Dialog**: Interactive dialog for selecting analysis scope
- **Output Options**: `--format json|graphml|dot --output file.json`
- **Configuration**: Global and repository-specific configuration files (JSON format)
- **Progress Reporting**: Progress bars for each major analysis step

### 5.2 Configuration System
- **Global Configuration** (part of code2graph repository): 
  - Maximum analysis runtime duration with user prompt (default:5 min)
  - Default output file format preferences (default: JSON)
- **Repository-Specific Configuration** (template is part of code2graph repository but user must specify one file per analysed repo):
  - Repo files and folders to exclude (default: include everything except files and folders listed in .gitignore)
  - Output format preferences (overrides global configuration. If empty, take value from global configuration)
  - Analysis depth settings (front-end, API, routes, database) (default: full stack)

### 5.3 Error Handling
- **Memory Management**: Two-tier system with performance warning (memory at 80%) and memory error (memory at 100% = memory full) 
- **Performance Warning**: Dialog showing recommended limit vs actual lines of code with Include/Exclude options
- **Memory Error**: Hard stop with error message and dialog to reconfigure
- **Long Running Analysis**: If analysis runs a long time, popup alerts user with Continue/Stop button options
- **Syntax Errors**: Log error, skip malformed function, continue processing
- **Network Issues**: Fatal error, stop execution, ask user to restart
- **Permission Issues**: Skip file, log error, continue analysis
- **Progress Reporting**: Progress bars for each major step with log summaries

---

## 6. Success Metrics

### 6.1 Functional Metrics
- **Analysis Accuracy**: >95% correct component relationship detection
- **Dead Code Detection**: >90% accuracy in identifying unused code (nodes with no incoming edges)
- **Performance**: 
  - Recommended limit: 100,000 lines of code (500 files)
  - Processing time: To be determined after unit tests
  - Memory usage: To be determined after initial testing
- **Reliability**: <1% crash rate on real-world codebases

### 6.2 User Experience Metrics
- **Setup Time**: <5 minutes from GitHub clone to first analysis
- **Learning Curve**: Users can run basic analysis with minimal documentation
- **Output Quality**: Generated graphs with liveCodeScore labels are immediately useful for dead code identification
- **User Flow**: 12-step process from installation to visualization completion

### 6.3 Adoption Metrics
- **GitHub Stars**: Target 100+ stars in first 6 months
- **Repository Clones**: Target 1000+ clones in first 3 months
- **Community Contributions**: Active issue reports and pull requests

---

## 7. Constraints and Assumptions

### 7.1 Technical Constraints
- **Language Support**: Initially limited to TypeScript/JavaScript ecosystem
- **Framework Support**: Primary focus on React, framework-agnostic backend analysis
- **Analysis Depth**: Static analysis only, no runtime behavior analysis
- **Repository Access**: Requires read access to target repositories
- **Distribution**: GitHub clone only, no NPM package in first version
- **Database Analysis**: Include nodes for database tables and views

### 7.2 Business Constraints
- **Development Timeline**: None
- **Resource Limitations**: Single developer initially
- **Open Source**: MIT license, community-driven development
- **No Commercial Support**: Community support only
- **Distribution**: GitHub repository clone only for first version

### 7.3 Assumptions
- **User Knowledge**: Users have basic command-line experience
- **Code Quality**: Target codebases follow standard React/TypeScript patterns
- **Repository Structure**: Standard project structures with clear separation of concerns
- **Network Access**: Users have internet access for repository cloning

---

## 8. Risk Assessment

### 8.1 Technical Risks
- **Complexity**: AST parsing and dependency analysis is complex
- **Performance**: Large codebases may cause memory/performance issues
- **Accuracy**: Static analysis may miss dynamic dependencies
- **Maintenance**: Keeping up with React/TypeScript ecosystem changes

### 8.2 Mitigation Strategies
- **Incremental Development**: Start with simple cases, add complexity gradually
- **Performance Testing**: Regular testing with large codebases
- **Community Feedback**: Early user testing to validate accuracy
- **Modular Architecture**: Easy to extend and maintain

---

## 9. Future Roadmap

### 9.1 Phase 1 (Months 1-2): MVP
- Basic React component analysis
- Dead code detection
- JSON output format
- Command-line interface
- Graceful interruption: Allow to interrupt analysis and resume at later time


### 9.2 Phase 2 (Months 3-4): Enhanced Analysis
- Backend API analysis
- Multiple output formats
- Configuration system

### 9.3 Phase 3 (Months 5-6): Advanced Features
- Code metrics and complexity analysis
- Web interface
- CI/CD integration

### 9.4 Phase 4 (Months 7+): Ecosystem Integration
- IDE extensions
- Additional framework support
- API server
- Community features

---

## 10. Output Format Specification

### 10.1 JSON Output Structure
- **Graph Data**: Complete dependency graph with nodes and edges
- **Node Properties**: 
  - `id`: Unique identifier
  - `label`: Human-readable name
  - `type`: Component type ("function" | "API" | "table" | "view" | "route" | "external-dependency" | string)
  - `file`: Source file location
  - `line`: Line number (optional, required for components)
  - `column`: Column number (optional, required for components)
  - `liveCodeScore`: Integer 0-100 (0 = dead code, 100 = live code)
  - `datatype`: Data type label (array, list, integer, table, view, etc.)
  - `category`: Layer category (front end, middleware, database, library)
  - `codeOwnership`: "internal" (custom code) or "external" (standard libraries) - enables filtering
  - `isInfrastructure`: Boolean flag for external dependencies (enables easy filtering)
- **Edge Properties**:
  - `source`: Source node ID
  - `target`: Target node ID
  - `relationship`: Type of relationship ("imports" | "calls" | "uses" | "reads" | "writes to" | "renders" | "contains")
  - Direction follows UI → Database flow principle
- **Metadata**:
  - Version number of code2graph tool
  - UTC timestamp of output file creation
  - Repository URL analyzed
  - Types of code included/excluded
  - Number of lines of code analyzed
  - Total number of nodes created
  - Total number of edges created

### 10.2 Visualization Requirements
- **Dead Code Highlighting**: Red fill for nodes with liveCodeScore = 0
- **Code Ownership Distinction**: 
  - Internal nodes (custom code): Colored, detailed display
  - External nodes (libraries): Grayed out, minimal display
- **Filtering Options**:
  - Show only dead nodes (liveCodeScore = 0)
  - Show only live nodes (liveCodeScore = 100)
  - Show only custom code (codeOwnership = "internal")
  - Show only external dependencies (isInfrastructure = true)
  - Show everything with visual distinction (default)
- **Graph Layout**: Clear visualization of dependency relationships following UI → Database flow

### 10.3 Configuration-Based Output
- **File Format**: Specified in global configuration
- **Output Path**: Specified in repository-specific configuration
- **Default**: JSON format, current directory

---

## 11. User Experience Flow

### 11.1 Complete User Journey
1. **Clone Repository**: User clones code2graph from GitHub
2. **Start Application**: User runs code2graph locally
3. **Documentation Access**: Pop-up dialog links to documentation
4. **Repository Input**: User provides repository URL to analyze
5. **Initial Analysis**: Tool shows file count and lines of code
6. **Include/Exclude Dialog**: Interactive dialog for analysis scope selection
7. **Configuration Save**: Settings written to global and repo-specific config files
8. **Analysis Progress**: Progress bars for each major step with log summaries
9. **Error Handling**: Either stop with error or continue until completion
10. **Completion**: Success/failure message with Close button
11. **Output Review**: User consults output file
12. **Visualization**: User feeds output into recommended graph visualization tool

### 11.2 Include/Exclude Dialog Features
- **Information Section**:
  - Recommended upper limit for lines of code
  - Lines of code currently selected
- **Selection Table**:
  - Type of item (Files in .gitignore, Frontend, Routes/APIs, Database)
  - Include/Exclude radio buttons
  - Default: Exclude .gitignore and Database, Include others
- **Actions**: Save config and Cancel buttons

---

## 12. Acceptance Criteria

### 12.1 MVP Acceptance Criteria
- [ ] Successfully analyzes a React/TypeScript project with 100+ components
- [ ] Identifies dead code with >90% accuracy (nodes with no incoming edges)
- [ ] Generates valid JSON output with complete dependency graph and liveCodeScore labels
- [ ] Processes analysis within recommended limits (100k lines, 500 files)
- [ ] Handles malformed code without crashing (skip function, log error, continue)
- [ ] Provides interactive Include/Exclude dialog for analysis scope
- [ ] Shows progress bars for each major analysis step
- [ ] Includes comprehensive documentation and 12-step user flow
- [ ] Works with GitHub repository cloning (no NPM package required)

### 12.2 Quality Gates
- [ ] All unit tests pass
- [ ] Integration tests with real projects pass
- [ ] Performance benchmarks met
- [ ] Code review completed
- [ ] Documentation complete
- [ ] Security review completed (if applicable)

---

## 13. Testing and Validation Strategy

### 13.1 Validation Approach
- **Initial Testing**: Use small known repository, manually count nodes/edges, compare with code2graph output
- **Iterative Refinement**: Identify deviations, refine node definitions, repeat until aligned
- **Progressive Testing**: Test with increasingly larger codebases after initial validation
- **Manual Validation**: User provides detailed feedback to align definitions

### 13.2 Test Cases
- Simple React components with basic imports/exports
- Complex components with hooks, props, and state
- Components with conditional rendering
- API routes with middleware
- Database queries with multiple tables
- Edge cases: malformed code, complex dependencies

---

## 14. Installation and Distribution

### 14.1 First Version Distribution
- **Method**: GitHub repository clone only
- **No NPM Package**: Focus on other distribution mechanisms in future versions
- **Requirements**: Node.js 18+, Git access
- **Setup**: Clone repository, follow README instructions

### 14.2 Documentation Requirements
- **Principle Explanation**: How code2graph analyzes codebases (frontend to database tracing)
- **Installation Guide**: How to clone repo and start the application
- **Usage Instructions**: How to provide repository URL and use Include/Exclude dialog
- **Output Interpretation**: How to use output files with recommended visualization tool
- **Troubleshooting**: Common issues and solutions

---

## 15. Custom Code Focus Philosophy

### 15.1 Core Principle
Code2Graph prioritizes granular analysis of **custom code** while treating **external libraries as black-box infrastructure**.

### 15.2 Analogy
Like analyzing a keyboard press:
- **Focus on**: User presses 'b' → Letter 'b' appears on screen
- **Abstract away**: Electronic contact → ASCII code → Windows interpretation → Graphics card → Pixel activation

Applied to React applications:
- **Focus on**: MainComponent defined → Rendered at location → User clicks button → API called → Database updated
- **Abstract away**: React.Component internals → React rendering engine → Event system implementation

### 15.3 Implementation Strategy

#### Custom Code (Internal)
- **Granularity**: Component-level, not file-level
- **Detail**: Full properties (props, state, hooks, line numbers, render locations)
- **Node Count**: One node per actual component definition
- **Example**: File with 3 components → 3 nodes

#### External Dependencies (Infrastructure)
- **Granularity**: Package-level, not import-level
- **Detail**: Minimal (package name, version only)
- **Node Count**: One node per external package
- **Example**: 5 React imports in 3 files → 1 "react" node

### 15.4 User Benefits
1. **Reduced Noise**: Focus on what matters (your code)
2. **Scalability**: Fewer nodes for large applications
3. **Clarity**: Clear distinction between custom and external
4. **Flexibility**: Easy filtering to show/hide external dependencies
5. **Performance**: Faster analysis and rendering with fewer nodes

### 15.5 Filtering Strategy
```typescript
// Default view: Show everything with visual distinction
allNodes

// Custom code only: Focus on your code
nodes.filter(n => n.codeOwnership === "internal")

// External dependencies only: Audit dependencies
nodes.filter(n => n.isInfrastructure === true)

// Dead code only: Cleanup focus
nodes.filter(n => n.liveCodeScore === 0)

// Live custom code: Active development focus
nodes.filter(n => n.codeOwnership === "internal" && n.liveCodeScore === 100)
```

---

*This PRD serves as the foundation for the code2graph project and will be updated as requirements evolve and new insights are gained through development and user feedback.*
