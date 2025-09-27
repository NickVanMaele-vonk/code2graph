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
 */
export interface InformativeElementInfo {
  type: 'display' | 'input' | 'data-source' | 'state-management';
  name: string;
  elementType: string;
  props: Record<string, unknown>;
  eventHandlers: string[];
  dataBindings: string[];
  line?: number;
  column?: number;
  file: string;
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
 */
export type NodeType = "function" | "API" | "table" | "view" | "route" | string;

/**
 * Node category definitions
 */
export type NodeCategory = "front end" | "middleware" | "database";

/**
 * Relationship type definitions
 */
export type RelationshipType = "imports" | "calls" | "uses" | "reads" | "writes to" | "renders";

/**
 * Node information interface
 * Represents a node in the dependency graph
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
 * Component information interface
 * Extended component information for dependency analysis
 */
export interface ComponentInfo {
  name: string;
  type: ComponentType;
  file: string;
  props: PropInfo[];
  state: StateInfo[];
  hooks: HookInfo[];
  children: ComponentInfo[];
  informativeElements: InformativeElement[];
  imports: ImportInfo[];
  exports: ExportInfo[];
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
 */
export interface InformativeElement {
  type: ElementType;
  name: string;
  props: Record<string, unknown>;
  eventHandlers: EventHandler[];
  dataBindings: DataBinding[];
}

/**
 * Element type definitions
 */
export type ElementType = "display" | "input" | "data-source" | "state-management";

/**
 * Event handler interface
 */
export interface EventHandler {
  name: string;
  type: string;
  handler: string;
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
}