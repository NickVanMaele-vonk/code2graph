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