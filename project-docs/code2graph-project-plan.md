# Project Implementation Plan
## Code2Graph - Code Dependency Visualization Tool

### Document Information
- **Version**: 1.1
- **Date**: 2025-10-03
- **Author**: Nick Van Maele
- **Project**: code2graph
- **Timeline**: 6-8 weeks for MVP

---

## 0. Project Overview

### 0.1 Project Goals
- Create a command-line tool for analyzing React/TypeScript codebases
- Generate comprehensive dependency graphs from frontend to database
- Identify dead code with high accuracy
- Provide multiple output formats for visualization
- Build a foundation for future open-source development

### 0.2 Success Criteria
- Successfully analyzes React projects with 100+ components
- Identifies dead code with >90% accuracy
- Typical expected runtime of an analysis to be determined after first tests
- Generates valid JSON output with complete dependency graph
- Handles malformed code without crashing

### 0.3 Project Constraints
- **Timeline**: 8 weeks for MVP
- **Resources**: Single developer
- **Scope**: React/TypeScript focus initially
- **Quality**: Production-ready code with comprehensive testing

---

## 1. Phase 1: Foundation Setup (Week 1)

### 1.1 Project Structure Setup
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Initialize TypeScript project with proper configuration
- [ ] Set up package.json with all required dependencies
- [ ] Create directory structure following architecture
- [ ] Configure ESLint, Prettier, and TypeScript settings
- [ ] Set up Jest testing framework
- [ ] Create basic README and documentation structure
- [ ] Create template files for global and repo-specific configuration
- [ ] Set up ability to run analysis in isolated environment (sandbox)

#### Deliverables:
- Complete project structure
- Working TypeScript build system
- Basic testing setup
- Development environment ready

#### Acceptance Criteria:
- `npm run build` works without errors
- `npm test` runs successfully
- All linting passes
- Project follows TypeScript best practices

### 1.2 Core Type Definitions
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Define core TypeScript interfaces for graph data
- [ ] Create component information types
- [ ] Define analysis result types
- [ ] Set up configuration types
- [ ] Create error handling types
- [ ] Add JSDoc documentation for all types
- [ ] Complete content of global config file and repo-specific config template 

#### Deliverables:
- Complete type definitions in `src/types/`
- Type documentation
- Type validation utilities

#### Acceptance Criteria:
- All types are properly documented
- Types cover all planned functionality
- Type validation works correctly
- No TypeScript compilation errors

### 1.3 Basic CLI Framework
**Duration**: 1 day
**Priority**: High

#### Tasks:
- [ ] Set up Commander.js for CLI interface
- [ ] Create basic command structure
- [ ] Implement help and version commands
- [ ] Add basic error handling
- [ ] Create configuration loading system

#### Deliverables:
- Working CLI interface
- Basic command structure
- Configuration system

#### Acceptance Criteria:
- CLI responds to basic commands
- Help system works correctly
- Configuration loading functions properly
- Error messages are user-friendly

---

## 2. Phase 2: Repository Analysis (Week 2)

### 2.1 Repository Cloning System
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Implement GitHub repository cloning
- [ ] Add support for local directory analysis
- [ ] Create temporary directory management
- [ ] Add cleanup functionality
- [ ] Implement error handling for network issues
- [ ] Add progress reporting for cloning

#### Deliverables:
- Repository cloning functionality
- Local directory analysis support
- Proper cleanup and error handling

#### Acceptance Criteria:
- Can clone public GitHub repositories
- Can analyze local directories
- Properly cleans up temporary files
- Handles network errors gracefully
- Shows progress during cloning

### 2.2 File System Scanner
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Input validation for repository URLs
- [ ] Verify read-only access to repositories
- [ ] Exclude test files from analysis 
- [ ] Implement "Include / Exclude" dialog box to determine scope of analysis 
- [ ] Implement recursive file scanning
- [ ] Add file type filtering (tsx, ts, jsx, js)
- [ ] Create ignore pattern support
- [ ] Add file metadata extraction
- [ ] Implement progress reporting
- [ ] Implement analysis log functionality 
- [ ] Implement memory monitoring system + exit if exceeded
- [ ] Add file validation
- [ ] Add file scan progress indicator to progress dialog

#### Deliverables:
- File scanning system
- File filtering and validation
- Progress reporting

#### Acceptance Criteria:
- Scans directories recursively
- Filters files by type correctly
- Respects ignore patterns
- Extracts file metadata
- Shows scanning progress

### 2.3 Basic AST Parser
**Duration**: 1 day
**Priority**: High

#### Tasks:
- [ ] Set up Babel parser for TypeScript/JavaScript
- [ ] Implement basic file parsing
- [ ] Add error handling for malformed code
- [ ] Create AST node utilities
- [ ] Add AST parser progress indicator to progress dialog

#### Deliverables:
- Basic AST parsing functionality
- Error handling for malformed code
- AST utility functions

#### Acceptance Criteria:
- Parses TypeScript and JavaScript files
- Handles syntax errors gracefully
- Provides useful AST utilities
- Shows parsing progress

### 2.4 DependencyAnalyser
**Duration**: 1 day
**Priority**: High

#### Tasks:
- [ ] Process AST output 
- [ ] DependencyAnalyzer: Trace API calls
- [ ] DependencyAnalyzer: Analyse Service Dependencies
- [ ] DependencyAnalyzer: Map database operations
- [ ] DependencyAnalyzer: Normalize API endpoints
- [ ] DependencyAnalyzer: Detect circular dependencies in graph and stop processing
- [ ] Generate dependency analysis output
- [ ] Implement node label 'category'
- [ ] Implement node label 'datatype'
- [ ] Implement API endpoint normalisation logic 
- [ ] Implement node normalisation logic (merge duplicate nodes)

#### Deliverables:
- Output analysis in JSON format

#### Acceptance Criteria:
- Output analysis accuracy versus manual analysis: match > 90% 


---

## 3. Phase 3: React Component Analysis (Week 3)

### 3.1 Component Detection
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Implement React component identification
- [ ] Detect functional components
- [ ] Detect class components
- [ ] Identify React hooks usage
- [ ] Extract component names and locations
- [ ] Add component type classification
- [ ] Add React progress indicator to progress dialog

#### Deliverables:
- Component detection system
- Component classification
- Component metadata extraction

#### Acceptance Criteria:
- Identifies all React component types
- Extracts component names correctly
- Classifies components by type
- Handles edge cases (anonymous components, etc.)

### 3.2 JSX Element Analysis
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Detect and process AST node type:JSXElement 
- [ ] Detect and process AST node type:JSXExpressionContainer 
- [ ] Detect and process AST node type:CallExpression 
- [ ] Detect and process AST node type:VariableDeclarator/VariableDeclaration 
- [ ] Detect and process AST node type:ArrowFunctionExpression/FunctionDeclaration 
- [ ] Detect and process AST node type:MemberExpression 
- [ ] Identify informative elements (buttons, inputs, etc.)
- [ ] Extract element properties and event handlers
- [ ] Map element relationships
- [ ] Add Edges and EdgeTypes
- [ ] Add element type classification
- [ ] Handle complex JSX patterns
- [ ] Add Javascript progress indicator to progress dialog

#### Deliverables:
- JSX element parsing
- Informative element identification
- Element relationship mapping

#### Acceptance Criteria:
- Correctly identifies informative elements
- Extracts element properties
- Maps element relationships
- Handles complex JSX patterns

### 3.3 Import/Export Analysis
**Duration**: 1 day
**Priority**: High

#### Tasks:
- [ ] Extract import statements
- [ ] Extract export statements
- [ ] Map component dependencies
- [ ] Track external library usage
- [ ] Identify circular dependencies
- [ ] Create dependency graph structure
- [ ] Add Import/Export progress indicator to progress dialog

#### Deliverables:
- Import/export analysis
- Dependency mapping
- Circular dependency detection and resolution 

#### Acceptance Criteria:
- Correctly extracts all imports/exports
- Maps component dependencies accurately
- Identifies circular dependencies and avoids infinite loops 
- Creates proper dependency graph structure

---

## 4. Phase 4: Middleware traversal (Week 4)

### 4.1 Usage Tracking
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Track component usage across files
- [ ] Identify unused components 
- [ ] Track function usage
- [ ] Identify unused functions
- [ ] Track variable usage
- [ ] Create usage statistics
- [ ] Add performance warning for large codebases and trigger "Include / Exclude" dialog
- [ ] Add pop-up warning for analysis running too long 

#### Deliverables:
- Used / unused component detection in middleware
- Used / unused function detection in middleware

#### Acceptance Criteria:
- Accurately tracks component usage
- Identifies unused components correctly
- Tracks function usage properly
- Provides usage statistics

### 4.2 Alive/Dead Code Analysis
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Implement alive/dead code detection algorithms
- [ ] Add liveCodeScore label (values: 0-100) 
- [ ] Add comments in code for dead code removal suggestions
- [ ] Implement false positive filtering

#### Deliverables:
- Code traversal system
- Alive/dead code labelling system


#### Acceptance Criteria:
- Detects dead code with >90% accuracy
- Adds comments in code to mark code as dead 
- Filters false positives effectively

### 4.3 API and Backend Analysis
**Duration**: 1 day
**Priority**: Medium

#### Tasks:
- [ ] Analyze API endpoint usage
- [ ] Track service layer dependencies
- [ ] Identify used/unused API endpoints
- [ ] Map frontend to backend connections
- [ ] Add backend dead code detection and labelling
- [ ] Add analysis of database views and tables
- [ ] Add API & Backend progress indicator to progress dialog

#### Deliverables:
- API usage analysis
- Backend dead code detection
- Frontend-backend mapping (all the way to db tables and views)

#### Acceptance Criteria:
- Tracks API endpoint usage
- Identifies unused API endpoints
- Maps frontend-backend connections
- Detects backend dead code

---

## 5. Phase 5: Output Generation (Week 5)

### 5.1 JSON Output Generator
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Implement JSON graph generation
- [ ] Add metadata to JSON output
- [ ] Add output validation
- [ ] Implement file writing
- [ ] Add output formatting options
- [ ] Add Output File Generation progress indicator to progress dialog

#### Deliverables:
- JSON output generator
- Output validation system

#### Acceptance Criteria:
- Generates valid JSON output
- Includes all required metadata
- Validates output format
- Writes files correctly

---

## 6. Phase 6: Testing and Validation (Week 6)

### 6.1 Unit Testing
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Write unit tests for all analyzers
- [ ] Test output generators
- [ ] Test CLI functionality
- [ ] Test error handling
- [ ] Add test coverage reporting
- [ ] Achieve >90% test coverage

#### Deliverables:
- Comprehensive unit test suite
- Test coverage reports
- Test documentation

#### Acceptance Criteria:
- All components have unit tests
- >90% test coverage achieved
- Tests cover edge cases
- Tests are maintainable

### 6.2 Integration Testing
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] Test with real React projects
- [ ] Test end-to-end analysis pipeline
- [ ] Test with various project structures
- [ ] Test error scenarios
- [ ] Validate output accuracy
- [ ] Performance testing

#### Deliverables:
- Integration test suite
- Real project test results
- Performance benchmarks

#### Acceptance Criteria:
- Works with real React projects
- End-to-end pipeline works correctly
- Handles various project structures
- Meets performance requirements

### 6.3 Validation with Target Project
**Duration**: 1 day
**Priority**: Critical

#### Tasks:
- [ ] Test with martialarts project
- [ ] Validate dead code detection accuracy
- [ ] Check output quality
- [ ] Gather feedback and iterate
- [ ] Document known limitations

#### Deliverables:
- Validation results
- Known limitations document
- Improvement recommendations

#### Acceptance Criteria:
- Successfully analyzes martialarts project
- Dead code detection is accurate
- Output is useful and correct
- Known limitations are documented

---

## 7. Phase 7: Polish and Documentation (Week 7)

### 7.1 CLI Polish
**Duration**: 1 day
**Priority**: High

#### Tasks:
- [ ] Improve CLI user experience
- [ ] Add better error messages
- [ ] Add progress indicators
- [ ] Improve help documentation
- [ ] Add configuration examples
- [ ] Test CLI usability

#### Deliverables:
- Polished CLI interface
- Better user experience
- Improved documentation

#### Acceptance Criteria:
- CLI is user-friendly
- Error messages are helpful
- Progress indicators work
- Help documentation is complete

### 7.2 Documentation
**Duration**: 2 days
**Priority**: High

#### Tasks:
- [ ] Write comprehensive README
- [ ] Create usage examples
- [ ] Document configuration options
- [ ] Add troubleshooting guide
- [ ] Create API documentation
- [ ] Add contribution guidelines

#### Deliverables:
- Complete documentation
- Usage examples
- API documentation

#### Acceptance Criteria:
- Documentation is comprehensive
- Examples are clear and useful
- API is well documented
- Contribution guidelines are clear

### 7.3 Final Testing
**Duration**: 2 days
**Priority**: Critical

#### Tasks:
- [ ] End-to-end testing
- [ ] Performance validation
- [ ] Error handling testing
- [ ] Cross-platform testing
- [ ] Final bug fixes
- [ ] Release preparation

#### Deliverables:
- Final test results
- Performance validation
- Release-ready code

#### Acceptance Criteria:
- All tests pass
- Performance requirements met
- Error handling works correctly
- Code is release-ready

---

## 8. Phase 8: Release and Future Planning (Week 8)

### 8.1 Release Preparation
**Duration**: 1 day
**Priority**: High

#### Tasks:
- [ ] Create release notes
- [ ] Tag version in Git
- [ ] Create GitHub release
- [ ] Update documentation
- [ ] Announce release

#### Deliverables:
- Release notes
- Updated documentation

#### Acceptance Criteria:
- Release notes are complete
- Documentation is updated
- Release is announced

### 8.2 Future Planning
#### 8.2.0 Detail plans for future work
**Duration**: 1 day
**Priority**: Medium

##### Tasks:
- [ ] Plan Phase 2 features
- [ ] Create roadmap document
- [ ] Set up issue tracking
- [ ] Plan community building
- [ ] Document lessons learned
- [ ] Create improvement backlog

##### Deliverables:
- Future roadmap
- Issue tracking setup
- Lessons learned document

##### Acceptance Criteria:
- Clear roadmap for future development
- Issue tracking is set up
- Lessons learned are documented
- Improvement backlog is created

#### 8.2.1 GraphML Output Generator
**Duration**: 1 day
**Priority**: Medium

##### Tasks:
- [ ] Implement GraphML generation
- [ ] Add node and edge attributes
- [ ] Create GraphML validation
- [ ] Add GraphML export functionality
- [ ] Test with GraphML tools

##### Deliverables:
- GraphML output generator
- GraphML validation
- Export functionality

##### Acceptance Criteria:
- Generates valid GraphML
- Includes rich node/edge attributes
- Validates GraphML format
- Works with GraphML tools

#### 8.2.2 DOT Output Generator
**Duration**: 1 day
**Priority**: Medium

##### Tasks:
- [ ] Implement DOT format generation
- [ ] Add node and edge formatting
- [ ] Create DOT validation
- [ ] Add DOT export functionality
- [ ] Test with Graphviz

##### Deliverables:
- DOT output generator
- DOT validation
- Export functionality

##### Acceptance Criteria:
- Generates valid DOT format
- Formats nodes and edges correctly
- Validates DOT format
- Works with Graphviz

#### 8.2.3 Report Generation
**Duration**: 1 day
**Priority**: High

##### Tasks:
- [ ] Create human-readable reports
- [ ] Add dead code summaries
- [ ] Include analysis statistics
- [ ] Add recommendations
- [ ] Create HTML report option

##### Deliverables:
- Human-readable reports
- Dead code summaries
- Analysis statistics

##### Acceptance Criteria:
- Generates clear, useful reports
- Includes dead code summaries
- Provides analysis statistics
- Offers actionable recommendations

#### 8.2.4 Graceful interruption
**Duration**: 3 days
**Priority**: Medium

##### Tasks:
- [ ] Design how to interrupt / restart analysis
- [ ] Implement graceful interruption in code
- [ ] Test graceful interruption 

##### Deliverables:
- code2graph analysis can be stopped and resumed without errors

##### Acceptance Criteria:
- Immediate response to interruption signal
- Showing status "Interrupting..." with a progress bar
- Interrupt gracefully so that restart is possible


#### 8.2.5 File streaming
**Duration**: 5 days
**Priority**: Medium

##### Tasks:
- [ ] Design how to process files in chunks (large codebases)
- [ ] Implement file chunking / file streaming 
- [ ] Test file chunking 

##### Deliverables:
- Ability to chunk large files and process chunks 

##### Acceptance Criteria:
- Large file chunked and processed successfully 


#### 8.2.6 Parallel processing of files
**Duration**: 5 days
**Priority**: Medium

##### Tasks:
- [ ] Design how to process multiple files in parallel
- [ ] Implement parallel file processing
- [ ] Test parallel file processing 

##### Deliverables:
- Ability to process multiple files in parallel 

##### Acceptance Criteria:
- Multiple files processed at same time successfully 



#### 8.2.7 AST caching 
**Duration**: 5 days
**Priority**: Medium

##### Tasks:
- [ ] Design how to cache ASTs of files 
- [ ] Implement caching ASTs of files
- [ ] Test caching ASTs of files 

##### Deliverables:
- Ability to cache ASTs of files for repeated analysis runs  

##### Acceptance Criteria:
- ASTs of files can be re-used several times without rerunning AST 


#### 8.2.8 Accessibility 
**Duration**: 5 days
**Priority**: Medium

##### Tasks:
- [ ] Include ARIA roles and attributes (role="progressbar", aria-valuenow, etc.) for screen readers.


##### Deliverables: 
- Implement screenreader compatibility 

##### Acceptance Criteria:
- Ability to use code2cache via screenreader support  




---

## 9. Risk Management

### 9.1 Technical Risks

#### Risk: AST Parsing Complexity
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Start with simple cases, use proven libraries, extensive testing

#### Risk: Performance Issues
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Performance testing, optimization, streaming processing

#### Risk: Accuracy of Dead Code Detection
- **Probability**: High
- **Impact**: High
- **Mitigation**: Extensive testing, confidence scoring, user feedback

### 9.2 Project Risks

#### Risk: Scope Creep
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Strict scope management, regular reviews, MVP focus

#### Risk: Timeline Delays
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Buffer time, priority management, regular progress reviews

#### Risk: Quality Issues
- **Probability**: Low
- **Impact**: High
- **Mitigation**: Comprehensive testing, code reviews, quality gates

---

## 10. Success Metrics

### 10.1 Technical Metrics
- **Analysis Accuracy**: >95% correct component relationship detection
- **Dead Code Detection**: >90% accuracy in identifying unused code
- **Performance**: Expectation to be set after first tests. Preliminary hope: process 10k payload lines in under 1 minute
- **Reliability**: <1% crash rate on real-world codebases

### 10.2 Project Metrics
- **Timeline**: Complete MVP within 8 weeks
- **Quality**: >90% test coverage
- **Documentation**: Complete user and API documentation
- **Usability**: Users can run basic analysis without documentation

### 10.3 User Experience Metrics
- **Setup Time**: <5 minutes from installation to first analysis
- **Learning Curve**: Basic usage without documentation
- **Output Quality**: Generated graphs are immediately useful

---

## 11. Resource Requirements

### 11.1 Development Resources
- **Developer**: 1 full-time developer
- **Timeline**: 8 weeks
- **Tools**: Development environment, testing tools, documentation tools

### 11.2 Testing Resources
- **Test Projects**: Real React projects for testing
- **Test Data**: Various code patterns and edge cases
- **Performance Testing**: Large repositories for benchmarking

### 11.3 Documentation Resources
- **Documentation Tools**: Markdown, JSDoc, README
- **Examples**: Sample projects and outputs
- **Tutorials**: Step-by-step usage guides

---

*This project plan provides a detailed roadmap for implementing the code2graph tool. It will be updated regularly as progress is made and new insights are gained.*
