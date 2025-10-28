/**
 * Core type definitions for Code2Graph
 * Following the architecture document specifications
 */

/**
 * Repository information interface
 */
export interface RepositoryInfo {
  url: string;
  name: string;
  path: string;
  branch?: string;
  commit?: string;
}

/**
 * File information interface
 */
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  content?: string;
}

/**
 * Analysis configuration interface
 */
export interface AnalysisConfig {
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
  maxFiles: number;
  timeout: number;
  outputFormat: 'json' | 'graphml' | 'dot';
  outputPath: string;
}

/**
 * Progress reporting interface
 */
export interface ProgressInfo {
  step: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

/**
 * Error information interface
 */
export interface AnalysisError {
  type: 'network' | 'permission' | 'syntax' | 'validation' | 'system';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
}

/**
 * Repository cloning options
 */
export interface CloneOptions {
  branch?: string;
  depth?: number;
  timeout?: number;
  progressCallback?: (progress: ProgressInfo) => void;
}

/**
 * CLI analysis options interface
 * Defines the structure for command-line analysis options
 */
export interface CLIAnalysisOptions {
  output: string;
  format: 'json' | 'graphml' | 'dot';
  branch?: string;
  depth: string;
  timeout: string;
}

/**
 * Repository validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: AnalysisError[];
  warnings: AnalysisError[];
}

/**
 * File scanning configuration interface
 */
export interface FileScanConfig {
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
  maxFiles: number;
  excludeTestFiles: boolean;
  customExclusions: string[];
}

/**
 * File scanning result interface
 */
export interface FileScanResult {
  files: FileInfo[];
  totalFiles: number;
  totalSize: number;
  excludedFiles: number;
  errors: AnalysisError[];
  warnings: AnalysisError[];
}

/**
 * Analysis logger interface
 */
export interface AnalysisLogger {
  logInfo(message: string, context?: Record<string, unknown>): void;
  logWarning(message: string, context?: Record<string, unknown>): void;
  logError(message: string, context?: Record<string, unknown>): void;
  getLogPath(): string;
}

/**
 * Memory monitoring interface
 */
export interface MemoryMonitor {
  getCurrentUsage(): number;
  getUsagePercentage(): number;
  checkMemoryWarning(): boolean;
  checkMemoryError(): boolean;
  getMemoryInfo(): MemoryInfo;
}

/**
 * Memory information interface
 */
export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  warningThreshold: number;
  errorThreshold: number;
}

/**
 * Include/Exclude dialog configuration
 */
export interface IncludeExcludeConfig {
  recommendedLimit: number;
  currentLinesOfCode: number;
  fileTypes: {
    gitignore: boolean;
    frontend: boolean;
    middleware: boolean;
    database: boolean;
  };
}

/**
 * Progress reporting for file scanning
 */
export interface FileScanProgress {
  step: 'scanning' | 'validating' | 'filtering';
  current: number;
  total: number;
  percentage: number;
  message: string;
  currentFile?: string;
}

/**
 * AST Node interface for Babel AST nodes
 * Represents any AST node from @babel/types
 * Using unknown instead of any for better type safety
 */
export interface ASTNode {
  type: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  [key: string]: unknown;
}

/**
 * Import information extracted from AST
 */
export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  defaultImport?: string;
  namespaceImport?: string;
  line?: number;
  column?: number;
}

/**
 * Import specifier information
 */
export interface ImportSpecifier {
  name: string;
  imported?: string;
  local?: string;
  type: 'default' | 'named' | 'namespace';
}

/**
 * Export information extracted from AST
 */
export interface ExportInfo {
  name: string;
  type: 'default' | 'named' | 'namespace' | 'all';
  source?: string;
  line?: number;
  column?: number;
}

/**
 * JSX Element information extracted from AST
 */
export interface JSXElementInfo {
  name: string;
  type: 'element' | 'fragment';
  props: Record<string, unknown>;
  children: JSXElementInfo[];
  line?: number;
  column?: number;
  hasEventHandlers: boolean;
  hasDataBinding: boolean;
}

/**
 * Informative element information
 * Elements that exchange internal data with users
 * UPDATED (Phase A): Changed eventHandlers to EventHandler[] objects and added parentComponent tracking
 * UPDATED (Semantic Filtering): Added semantic identifier fields for JSX element node creation filtering
 */
export interface InformativeElementInfo {
  type: 'display' | 'input' | 'data-source' | 'state-management';
  name: string;
  elementType: string;
  props: Record<string, unknown>;
  eventHandlers: EventHandler[]; // UPDATED (Phase A): Now uses full EventHandler objects instead of strings
  dataBindings: string[];
  line?: number;
  column?: number;
  file: string;
  parentComponent?: string; // NEW (Phase A): Name of the component that contains this element (tracked via AST scope)
  semanticIdentifier?: string; // NEW (Semantic Filtering): Semantic name from aria-label, data-testid, id, or text content
  hasSemanticIdentifier?: boolean; // NEW (Semantic Filtering): Quick flag for filtering decisions (true if semanticIdentifier exists)
}

/**
 * AST Parser interface
 * Defines the contract for AST parsing functionality
 */
export interface ASTParser {
  parseFile(filePath: string): Promise<ASTNode>;
  extractImports(ast: ASTNode): ImportInfo[];
  extractExports(ast: ASTNode): ExportInfo[];
  extractJSXElements(ast: ASTNode): JSXElementInfo[];
  extractInformativeElements(ast: ASTNode, filePath: string): InformativeElementInfo[];
  extractComponentDefinitions(ast: ASTNode, filePath: string): ComponentDefinitionInfo[];
  findASTNodeTypes(ast: ASTNode, targetTypes: string[]): ASTNode[];
  isInformativeElement(node: ASTNode): boolean;
  detectDisplayElements(ast: ASTNode): InformativeElementInfo[];
  detectInputElements(ast: ASTNode): InformativeElementInfo[];
  detectDataSources(ast: ASTNode): InformativeElementInfo[];
  detectStateManagement(ast: ASTNode): InformativeElementInfo[];
}

/**
 * Graph Types for Dependency Analysis
 * Following the architecture document specifications
 */

/**
 * Data type definitions for nodes
 */
export type DataType = "array" | "list" | "integer" | "table" | "view" | string;

/**
 * Node type definitions
 * UPDATED (Phase A): Added "external-dependency" for external library nodes
 * UPDATED (Change Request 002): Added "ui-section" for UI section/tab nodes
 * 
 * Context: UI sections represent major navigation sections (tabs, menu items)
 * that group related components. They enable hierarchical visualization showing
 * which components belong to which UI section.
 * 
 * Business Logic: "ui-section" nodes use "displays" relationships to show
 * section membership, distinct from "contains" which shows internal structure.
 */
export type NodeType = "function" | "API" | "table" | "view" | "route" | "external-dependency" | "ui-section" | string;

/**
 * Node category definitions (4-tier architecture)
 * UPDATED (Phase A): Added "library" for external dependency nodes
 * UPDATED (Change Request 002): 
 * - Changed "front end" to "front-end" (hyphenated) for consistency
 * - Added "api" as a distinct layer for API endpoints
 * - Evolved from 3-tier to 4-tier architecture following event flow
 * 
 * Context: Categories determine left-to-right positioning in hierarchical layout
 * following the sequence of events triggered in code.
 * 
 * Business Logic - Event Flow Principle (left to right):
 * 1. "front-end": UI sections, components, buttons, forms (leftmost - user interaction starts)
 * 2. "middleware": Business logic functions, handlers, validators (center-left - processing layer)
 * 3. "api": API endpoints and routes (center-right - API layer)
 * 4. "database": Database tables, views, queries (rightmost - data persistence)
 * 5. "library": External dependencies (positioned based on usage context)
 * 
 * Example Event Flow:
 * User clicks button → handleClick() → validateInput() → /api/users → users_table
 *    [front-end]        [middleware]     [middleware]      [api]       [database]
 */
export type NodeCategory = "front-end" | "api" | "middleware" | "database" | "library";

/**
 * Code ownership type definitions
 * NEW (Phase A): Distinguishes custom code from external libraries
 * - "internal": Custom code written by developers (analyzed in detail)
 * - "external": Standard libraries and packages (treated as black-box infrastructure)
 */
export type CodeOwnership = "internal" | "external";

/**
 * Relationship type definitions
 * UPDATED (Phase A): Added "contains" for structural parent-child relationships
 * UPDATED (Change Request 002): Added "displays" for UI section-to-component relationships
 * 
 * Context: Relationships define edge semantics in the dependency graph.
 * 
 * Business Logic - Relationship Semantics:
 * - "displays": UI Section → Component (section-level membership)
 *   Example: [Manage Tab] --displays--> [ClubMembersButton]
 *   Semantic: "This section shows this component to the user"
 * 
 * - "contains": Component → JSX Element (structural parent-child)
 *   Example: [ContactForm] --contains--> [EmailField]
 *   Semantic: "This component structurally owns this element"
 * 
 * - "renders": Component → Component (component usage)
 * - "imports": Component → External Package (dependency)
 * - "calls": Component/JSX/API → Function/API (invocation)
 * - "reads": API → Database Table/View (data read)
 * - "writes to": API → Database Table/View (data write)
 * - "uses": Generic usage relationship
 * 
 * Key Distinction: A tab "displays" a button (UI organization),
 * while a form "contains" a field (internal structure).
 */
export type RelationshipType = "imports" | "calls" | "uses" | "reads" | "writes to" | "renders" | "contains" | "displays";

/**
 * Node information interface
 * Represents a node in the dependency graph
 * UPDATED (Phase A): Added codeOwnership and isInfrastructure for custom code focus
 */
export interface NodeInfo {
  id: string;
  label: string;
  nodeType: NodeType;
  nodeCategory: NodeCategory;
  datatype: DataType;
  liveCodeScore: number;
  file: string;
  line?: number;
  column?: number;
  codeOwnership: CodeOwnership; // NEW (Phase A): Distinguishes custom code ("internal") from external libraries ("external")
  isInfrastructure?: boolean; // NEW (Phase A): Flag for easy filtering of external dependencies
  properties: Record<string, unknown>;
}

/**
 * Edge information interface
 * Represents an edge in the dependency graph
 */
export interface EdgeInfo {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  properties: Record<string, unknown>;
}

/**
 * Dependency graph interface
 * Complete graph structure with nodes, edges, and metadata
 */
export interface DependencyGraph {
  nodes: NodeInfo[];
  edges: EdgeInfo[];
  metadata: GraphMetadata;
}

/**
 * Graph metadata interface
 * Contains information about the analysis and graph generation
 */
export interface GraphMetadata {
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
  };
}

/**
 * Component definition information extracted from AST
 * Phase 1: Represents individual component definitions found in files
 * Used by AST parser to identify functional and class components
 */
export interface ComponentDefinitionInfo {
  name: string;
  type: ComponentType;
  file: string;
  line?: number;
  column?: number;
  isExported: boolean;
  extendsComponent?: string; // For class components: "React.Component", "Component", etc.
}

/**
 * Render location interface
 * NEW (Phase A): Tracks where a component is rendered (JSX usage locations)
 * Stores JSX instances as metadata on component definitions, not as separate nodes
 */
export interface RenderLocation {
  file: string;
  line: number;
  context: string; // e.g., "ReactDOM.render", "JSX usage", "Used in ComponentName"
}

/**
 * Component information interface
 * Extended component information for dependency analysis
 * UPDATED (Phase A): Added renderLocations to track JSX usage as metadata
 * UPDATED (Phase G): Fixed informativeElements type to InformativeElementInfo[] for consistency
 */
export interface ComponentInfo {
  name: string;
  type: ComponentType;
  file: string;
  line?: number;
  column?: number;
  props: PropInfo[];
  state: StateInfo[];
  hooks: HookInfo[];
  children: ComponentInfo[];
  informativeElements: InformativeElementInfo[]; // Phase G: Fixed type - must have file property for edge creation
  imports: ImportInfo[];
  exports: ExportInfo[];
  renderLocations?: RenderLocation[]; // NEW (Phase A): JSX usage locations stored as metadata, not separate nodes
}

/**
 * Component type definitions
 */
export type ComponentType = "functional" | "class" | "hook" | "service" | "api" | "database";

/**
 * Property information interface
 */
export interface PropInfo {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: unknown;
}

/**
 * State information interface
 */
export interface StateInfo {
  name: string;
  type: string;
  initialValue?: unknown;
  setter?: string;
}

/**
 * Hook information interface
 */
export interface HookInfo {
  name: string;
  type: string;
  dependencies: string[];
  returnType?: string;
}

/**
 * Informative element interface
 * Elements that exchange internal data with users
 * 
 * @deprecated Use InformativeElementInfo instead (Phase G)
 * 
 * This interface is DEPRECATED and kept only for backward compatibility.
 * It lacks critical properties (file, elementType) and uses incorrect dataBindings type (DataBinding[] vs string[]).
 * 
 * Use InformativeElementInfo which:
 * - Includes file property (required for edge creation)
 * - Includes elementType property (required for node categorization)
 * - Uses string[] for dataBindings (correct format from AST parser)
 * - Aligns with ComponentInfo.informativeElements type
 */
export interface InformativeElement {
  type: ElementType;
  name: string;
  props: Record<string, unknown>;
  eventHandlers: EventHandler[];
  dataBindings: DataBinding[];
  line?: number;
  column?: number;
}

/**
 * Element type definitions
 */
export type ElementType = "display" | "input" | "data-source" | "state-management";

/**
 * Event handler interface
 * UPDATED (Phase A): Enhanced documentation for event handler analysis
 * Used to track event handlers with detailed information about handler types and function calls
 */
export interface EventHandler {
  name: string;        // Event name: "onClick", "onChange", "onSubmit"
  type: string;        // Handler type: "function-reference", "arrow-function", "function-expression"
  handler: string;     // Function(s) called: "handleClick" or "validateInput, callAPI" for multiple calls
}

/**
 * Data binding interface
 */
export interface DataBinding {
  source: string;
  target: string;
  type: string;
}

/**
 * API call information interface
 */
export interface APICallInfo {
  name: string;
  endpoint: string;
  method: string;
  file: string;
  line?: number;
  column?: number;
  normalizedEndpoint: string;
}

/**
 * Service information interface
 */
export interface ServiceInfo {
  name: string;
  type: string;
  file: string;
  dependencies: string[];
  operations: ServiceOperation[];
}

/**
 * Service operation interface
 */
export interface ServiceOperation {
  name: string;
  type: string;
  parameters: string[];
  returnType?: string;
  databaseOperations: DatabaseOperation[];
}

/**
 * Database operation information interface
 */
export interface DatabaseOperationInfo {
  operation: string;
  table: string;
  type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
  file: string;
  line?: number;
  column?: number;
}

/**
 * Database operation interface
 */
export interface DatabaseOperation {
  operation: string;
  table: string;
  type: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT";
  conditions?: string[];
  fields?: string[];
}

/**
 * Service graph interface
 */
export interface ServiceGraph {
  services: ServiceInfo[];
  dependencies: ServiceDependency[];
}

/**
 * Service dependency interface
 */
export interface ServiceDependency {
  from: string;
  to: string;
  type: string;
  operations: string[];
}

/**
 * Cycle information interface
 * For circular dependency detection
 */
export interface CycleInfo {
  nodes: string[];
  type: string;
  severity: "warning" | "error";
  description: string;
}

/**
 * API Pattern Detection Types
 * For robust API endpoint normalization
 */

/**
 * Pattern type definitions
 */
export type PatternType = "uuid" | "numeric" | "alphanumeric" | "hyphenated" | "underscore" | "dot-separated" | "mixed-case" | "query-param" | "fragment" | "versioned" | "nested" | "unknown";

/**
 * Pattern information interface
 */
export interface PatternInfo {
  type: PatternType;
  regex: RegExp;
  parameterName: string;
  confidence: number;
  examples: string[];
  frequency: number;
}

/**
 * Pattern analysis result interface
 */
export interface PatternAnalysisResult {
  detectedPatterns: PatternInfo[];
  mostCommonPattern: PatternInfo | null;
  patternDistribution: Record<PatternType, number>;
  totalEndpoints: number;
  normalizedEndpoints: string[];
}

/**
 * Endpoint segment information
 */
export interface EndpointSegment {
  value: string;
  isParameter: boolean;
  parameterType?: PatternType;
  originalValue: string;
  position: number;
}

/**
 * Endpoint analysis result
 */
export interface EndpointAnalysisResult {
  originalEndpoint: string;
  normalizedEndpoint: string;
  segments: EndpointSegment[];
  detectedPatterns: PatternType[];
  confidence: number;
}

/**
 * Pattern detector interface
 */
export interface PatternDetector {
  detectPatterns(endpoints: string[]): PatternAnalysisResult;
  analyzeEndpoint(endpoint: string, patterns: PatternInfo[]): EndpointAnalysisResult;
  normalizeEndpoint(endpoint: string, patterns: PatternInfo[]): string;
  getPatternConfidence(pattern: PatternInfo, endpoint: string): number;
}

/**
 * Usage tracking information interface
 * Tracks how components, functions, and variables are used
 */
export interface UsageInfo {
  id: string;
  name: string;
  type: 'component' | 'function' | 'variable' | 'api' | 'database';
  file: string;
  line?: number;
  column?: number;
  definitionLocation: {
    file: string;
    line?: number;
    column?: number;
  };
  usageLocations: UsageLocation[];
  isUsed: boolean;
  usageCount: number;
  liveCodeScore: number;
}

/**
 * Usage location information
 * Where a component/function/variable is used
 */
export interface UsageLocation {
  file: string;
  line?: number;
  column?: number;
  usageType: 'import' | 'call' | 'reference' | 'assignment';
  context?: string;
}

/**
 * Usage statistics interface
 * Provides comprehensive usage statistics for the codebase
 */
export interface UsageStatistics {
  totalComponents: number;
  usedComponents: number;
  unusedComponents: number;
  totalFunctions: number;
  usedFunctions: number;
  unusedFunctions: number;
  totalVariables: number;
  usedVariables: number;
  unusedVariables: number;
  totalAPIs: number;
  usedAPIs: number;
  unusedAPIs: number;
  totalDatabaseEntities: number;
  usedDatabaseEntities: number;
  unusedDatabaseEntities: number;
  deadCodePercentage: number;
  liveCodePercentage: number;
}

/**
 * Performance warning interface
 * Warnings for large codebases that might impact performance
 */
export interface PerformanceWarning {
  type: 'large_codebase' | 'memory_usage' | 'analysis_time';
  severity: 'warning' | 'error';
  message: string;
  recommendation?: string;
  threshold: number;
  actualValue: number;
}

/**
 * Usage Tracker interface
 * Defines the contract for usage tracking functionality
 */
export interface UsageTracker {
  trackComponentUsage(components: ComponentInfo[]): UsageInfo[];
  trackFunctionUsage(functions: FunctionInfo[]): UsageInfo[];
  trackVariableUsage(variables: VariableInfo[]): UsageInfo[];
  calculateUsageStatistics(usageInfos: UsageInfo[]): UsageStatistics;
  calculateLiveCodeScores(usageInfos: UsageInfo[]): Map<string, number>;
  detectDeadCode(usageInfos: UsageInfo[]): DeadCodeInfo[];
  generatePerformanceWarnings(statistics: UsageStatistics): PerformanceWarning[];
}

/**
 * Function information interface
 * Extended function information for usage tracking
 */
export interface FunctionInfo {
  name: string;
  type: 'function' | 'arrow-function' | 'method' | 'async-function';
  file: string;
  line?: number;
  column?: number;
  parameters: string[];
  returnType?: string;
  isExported: boolean;
  isImported: boolean;
  calls: string[];
  calledBy: string[];
}

/**
 * Variable information interface
 * Extended variable information for usage tracking
 */
export interface VariableInfo {
  name: string;
  type: 'const' | 'let' | 'var';
  file: string;
  line?: number;
  column?: number;
  value?: unknown;
  isExported: boolean;
  isImported: boolean;
  isUsed: boolean;
  usedIn: string[];
}

/**
 * Dead code information interface
 * Information about dead code detected in the analysis
 */
export interface DeadCodeInfo {
  id: string;
  name: string;
  type: 'component' | 'function' | 'variable' | 'api' | 'database';
  file: string;
  line?: number;
  column?: number;
  reason: 'unused' | 'unreachable' | 'no_incoming_edges';
  confidence: number;
  suggestions: string[];
  impact: 'low' | 'medium' | 'high';
}

/**
 * Dependency Analyzer interface
 * Defines the contract for dependency analysis functionality
 */
export interface DependencyAnalyzer {
  buildDependencyGraph(components: ComponentInfo[]): DependencyGraph;
  traceAPICalls(components: ComponentInfo[]): APICallInfo[];
  analyzeServiceDependencies(services: ServiceInfo[]): ServiceGraph;
  mapDatabaseOperations(services: ServiceInfo[]): DatabaseOperationInfo[];
  createEdges(nodes: NodeInfo[]): EdgeInfo[];
  normalizeAPIEndpoints(endpoints: string[]): string[];
  detectCircularDependencies(graph: DependencyGraph): CycleInfo[];
  analyzeAPIPatterns(endpoints: string[]): PatternAnalysisResult;
  // Phase 4.1: Usage Tracking methods
  trackComponentUsage(components: ComponentInfo[]): UsageInfo[];
  calculateUsageStatistics(usageInfos: UsageInfo[]): UsageStatistics;
  detectDeadCode(usageInfos: UsageInfo[]): DeadCodeInfo[];
  generatePerformanceWarnings(statistics: UsageStatistics): PerformanceWarning[];
}

/**
 * Router Detection and Route Extraction Types
 * Phase 2: Router Detection (Change Request 002)
 * 
 * Context: Enables generic detection of routing configurations across different frameworks
 * to identify UI sections (tabs, pages, menu items) for hierarchical visualization.
 */

/**
 * Section type definitions for UI routing
 * Categorizes different types of navigable UI sections
 */
export type SectionType = 'tab' | 'page' | 'menu' | 'modal' | 'panel' | 'view';

/**
 * Route information extracted from router configuration
 * Represents a navigable route in the application
 */
export interface RouteInfo {
  path: string;              // Route path: "/manage", "/library/:id"
  component: string;         // Component name: "Manage", "Library"
  label?: string;            // Display label (derived from component or explicit)
  file: string;              // File where route is defined
  line?: number;             // Line number in file
  column?: number;           // Column number in file
  sectionType: SectionType;  // Type of UI section: 'tab', 'page', 'menu', etc.
  children?: RouteInfo[];    // Nested routes (for hierarchical routing)
  metadata?: Record<string, unknown>; // Additional route metadata
}

/**
 * Framework type for router detection
 */
export type RouterFramework = 'react-router' | 'wouter' | 'next-js' | 'vue-router' | 'angular-router' | 'generic';

/**
 * Router detection pattern configuration
 * Defines how to detect and extract routes for different frameworks
 */
export interface RouterDetectionPattern {
  framework: RouterFramework;
  routerLibraries: string[];  // Import sources: ['react-router-dom', 'wouter']
  routePatterns: {
    componentProp: string[];   // Props that indicate component: ['component', 'element', 'render']
    pathProp: string[];        // Props that indicate path: ['path', 'to', 'route']
    nodeTypes: string[];       // AST node types to look for: ['JSXElement', 'ObjectExpression']
    elementNames: string[];    // Element names: ['Route', 'Switch', 'Routes']
  };
  priority: number;           // Detection priority (higher = checked first)
}

/**
 * Navigation element information
 * Represents non-route UI navigation elements (menu items, icons, buttons)
 */
export interface NavigationElementInfo {
  name: string;              // Element name or label
  target?: string;           // Navigation target (path or component)
  type: 'button' | 'link' | 'icon' | 'menu-item';
  sectionType: SectionType;  // Associated section type
  file: string;              // File where element is defined
  line?: number;             // Line number
  column?: number;           // Column number
  eventHandler?: string;     // Navigation handler function
  metadata?: Record<string, unknown>;
}

/**
 * Router analysis result
 * Contains all routes and navigation elements detected in the codebase
 */
export interface RouterAnalysisResult {
  routes: RouteInfo[];
  navigationElements: NavigationElementInfo[];
  routerFiles: string[];     // Files identified as router configurations
  framework: RouterFramework | 'multiple' | 'unknown';
  totalRoutes: number;
  totalNavigationElements: number;
}

/**
 * Component Tree and Section Mapping Types
 * Phase 3: Component Mapping (Change Request 002)
 * 
 * Context: Enables hierarchical component tree traversal to map components
 * to their parent UI sections for "displays" relationship creation.
 */

/**
 * Component tree node representing a component and its children
 * Used to build complete component hierarchy for each route/section
 */
export interface ComponentTreeNode {
  componentId: string;           // Unique ID for the component node in graph
  componentName: string;         // Component name (e.g., "Manage", "ClubMembersButton")
  file: string;                  // File where component is defined
  children: ComponentTreeNode[]; // Child components used by this component
  parentSections: string[];      // Section IDs this component belongs to (can be multiple)
  depth: number;                 // Depth in tree (root = 0)
  isShared: boolean;             // True if component is used in multiple sections
}

/**
 * Usage context for a component within a section
 * Distinguishes between different ways a component is used
 */
export type ComponentUsageContext = 'primary-content' | 'modal' | 'dialog' | 'shared-utility' | 'nested-component';

/**
 * Component-to-section mapping
 * Tracks which sections display which components
 */
export interface ComponentToSectionMapping {
  componentId: string;           // Component node ID in graph
  componentName: string;         // Component name for debugging
  sectionIds: string[];          // Array of section IDs (supports shared components)
  usageLocations: {              // Detailed usage information
    sectionId: string;           // Which section uses this component
    context: ComponentUsageContext; // How it's used (primary, modal, etc.)
    file: string;                // File where usage occurs
    line?: number;               // Line number of usage
  }[];
  isRootComponent: boolean;      // True if this is the route component itself
}