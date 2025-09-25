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
