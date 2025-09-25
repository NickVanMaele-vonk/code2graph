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