/**
 * File System Scanner
 * Enhanced file scanning with filtering, validation, and progress reporting
 * Following Phase 2.2 requirements from the project plan
 */

import * as fs from 'fs-extra';
import * as fsBuiltin from 'node:fs/promises';
import * as path from 'path';
import { 
  FileInfo, 
  FileScanConfig, 
  FileScanResult, 
  FileScanProgress, 
  AnalysisError
} from '../types/index.js';
import { AnalysisLogger } from './analysis-logger.js';
import { MemoryMonitor } from './memory-monitor.js';

/**
 * File System Scanner class
 * Implements comprehensive file scanning with enhanced filtering, validation, and progress reporting
 * Supports include/exclude patterns, file size limits, and test file exclusion
 */
export class FileSystemScanner {
  private readonly logger: AnalysisLogger;
  private readonly memoryMonitor: MemoryMonitor;
  private progressCallback?: (progress: FileScanProgress) => void;

  /**
   * Constructor initializes file system scanner with logging and memory monitoring
   * 
   * @param logger - Analysis logger for logging scan operations
   * @param memoryMonitor - Memory monitor for tracking memory usage
   */
  constructor(logger: AnalysisLogger, memoryMonitor: MemoryMonitor) {
    this.logger = logger;
    this.memoryMonitor = memoryMonitor;
  }

  /**
   * Sets progress callback for file scanning progress reporting
   * 
   * @param callback - Progress callback function
   */
  setProgressCallback(callback: (progress: FileScanProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Scans a directory for files matching the specified configuration
   * Implements comprehensive file scanning with filtering, validation, and progress reporting
   * 
   * @param directory - Directory path to scan
   * @param config - File scanning configuration
   * @returns Promise<FileScanResult> - File scanning results with metadata
   */
  async scanFiles(directory: string, config: FileScanConfig): Promise<FileScanResult> {
    try {
      await this.logger.logInfo('Starting file system scan', {
        directory,
        config: {
          includePatterns: config.includePatterns,
          excludePatterns: config.excludePatterns,
          maxFileSize: config.maxFileSize,
          maxFiles: config.maxFiles,
          excludeTestFiles: config.excludeTestFiles
        }
      });

      // Validate directory exists and is accessible
      if (!await fs.pathExists(directory)) {
        const error: AnalysisError = {
          type: 'system',
          message: `Directory does not exist: ${directory}`
        };
        await this.logger.logError('Directory validation failed', { error });
        return {
          files: [],
          totalFiles: 0,
          totalSize: 0,
          excludedFiles: 0,
          errors: [error],
          warnings: []
        };
      }

      const stats = await fsBuiltin.stat(directory);
      if (!stats.isDirectory()) {
        const error: AnalysisError = {
          type: 'system',
          message: `Path is not a directory: ${directory}`
        };
        await this.logger.logError('Path validation failed', { error });
        return {
          files: [],
          totalFiles: 0,
          totalSize: 0,
          excludedFiles: 0,
          errors: [error],
          warnings: []
        };
      }

      // Initialize scan results
      const result: FileScanResult = {
        files: [],
        totalFiles: 0,
        totalSize: 0,
        excludedFiles: 0,
        errors: [],
        warnings: []
      };

      // First pass: count total files for progress reporting
      const totalFiles = await this.countFiles(directory, config);
      result.totalFiles = totalFiles;

      await this.logger.logInfo('File count completed', { totalFiles });

      // Second pass: scan and collect files
      await this.scanDirectoryRecursive(directory, config, result, 0, totalFiles);

      // Log scan completion
      await this.logger.logInfo('File system scan completed', {
        filesFound: result.files.length,
        totalFiles: result.totalFiles,
        excludedFiles: result.excludedFiles,
        totalSize: result.totalSize,
        errors: result.errors.length,
        warnings: result.warnings.length
      });

      return result;

    } catch (error) {
      const analysisError: AnalysisError = {
        type: 'system',
        message: `Error scanning files in ${directory}: ${error}`,
        stack: error instanceof Error ? error.stack : undefined
      };
      
      await this.logger.logError('File system scan failed', { error: analysisError });
      
      return {
        files: [],
        totalFiles: 0,
        totalSize: 0,
        excludedFiles: 0,
        errors: [analysisError],
        warnings: []
      };
    }
  }

  /**
   * Counts total files matching the configuration for progress reporting
   * 
   * @param directory - Directory to count files in
   * @param config - File scanning configuration
   * @returns Promise<number> - Total number of matching files
   */
  private async countFiles(directory: string, config: FileScanConfig): Promise<number> {
    let count = 0;
    
    try {
      const entries = await fsBuiltin.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          if (!this.shouldSkipDirectory(entry.name, config)) {
            count += await this.countFiles(fullPath, config);
          }
        } else if (entry.isFile()) {
          if (this.matchesIncludePattern(entry.name, config.includePatterns) &&
              !this.matchesExcludePattern(entry.name, config.excludePatterns) &&
              !this.isTestFile(entry.name, config.excludeTestFiles)) {
            count++;
          }
        }
      }
    } catch (error) {
      // Log error but continue counting
      await this.logger.logWarning(`Error counting files in ${directory}: ${error}`);
    }

    return count;
  }

  /**
   * Recursively scans a directory for files matching the configuration
   * 
   * @param directory - Directory to scan
   * @param config - File scanning configuration
   * @param result - Scan result object to populate
   * @param currentCount - Current file count for progress reporting
   * @param totalFiles - Total files for progress calculation
   */
  private async scanDirectoryRecursive(
    directory: string,
    config: FileScanConfig,
    result: FileScanResult,
    currentCount: number,
    totalFiles: number
  ): Promise<void> {
    try {
      const entries = await fsBuiltin.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          if (!this.shouldSkipDirectory(entry.name, config)) {
            await this.scanDirectoryRecursive(fullPath, config, result, currentCount, totalFiles);
          }
        } else if (entry.isFile()) {
          currentCount++;
          
          // Report progress
          if (this.progressCallback) {
            const percentage = Math.round((currentCount / totalFiles) * 100);
            this.progressCallback({
              step: 'scanning',
              current: currentCount,
              total: totalFiles,
              percentage: percentage,
              message: `Scanning files... (${currentCount}/${totalFiles})`,
              currentFile: entry.name
            });
          }

          // Check if file should be included
          if (this.shouldIncludeFile(entry.name, fullPath, config)) {
            try {
              const fileInfo = await this.extractFileInfo(fullPath, config);
              if (fileInfo) {
                result.files.push(fileInfo);
                result.totalSize += fileInfo.size;
              } else {
                result.excludedFiles++;
              }
            } catch (error) {
              const analysisError: AnalysisError = {
                type: 'system',
                message: `Error processing file ${fullPath}: ${error}`,
                file: fullPath
              };
              result.errors.push(analysisError);
              await this.logger.logError('File processing error', { error: analysisError });
            }
          } else {
            result.excludedFiles++;
          }

          // Check memory usage
          if (this.memoryMonitor.checkMemoryError()) {
            const error: AnalysisError = {
              type: 'system',
              message: 'Fatal error: memory capacity exceeded'
            };
            result.errors.push(error);
            await this.logger.logError('Memory capacity exceeded', { error });
            throw new Error('Fatal error: memory capacity exceeded');
          } else if (this.memoryMonitor.checkMemoryWarning()) {
            const warning: AnalysisError = {
              type: 'system',
              message: 'Warning: memory usage is high'
            };
            result.warnings.push(warning);
            await this.logger.logWarning('High memory usage detected', { 
              memoryUsage: this.memoryMonitor.getFormattedMemoryUsage() 
            });
          }
        }
      }
    } catch (error) {
      // Log error but continue scanning other directories
      await this.logger.logWarning(`Error scanning directory ${directory}: ${error}`);
    }
  }

  /**
   * Determines if a file should be included in the scan results
   * 
   * Business Logic:
   * - Filters out config files (webpack, babel, jest, etc.) that are not React components
   * - Filters out test files when configured
   * - Applies custom include/exclude patterns
   * 
   * Context (Phase G - Solution 1A):
   * Config files should not be analyzed as they're not functional React code.
   * This prevents nodes like "webpack.config" from appearing in the graph.
   * 
   * @param filename - File name
   * @param fullPath - Full file path
   * @param config - File scanning configuration
   * @returns boolean - True if file should be included
   */
  private shouldIncludeFile(filename: string, fullPath: string, config: FileScanConfig): boolean {
    // Check include patterns
    if (!this.matchesIncludePattern(filename, config.includePatterns)) {
      return false;
    }

    // Check exclude patterns
    if (this.matchesExcludePattern(filename, config.excludePatterns)) {
      return false;
    }

    // Check custom exclusions
    if (config.customExclusions.some(exclusion => fullPath.includes(exclusion))) {
      return false;
    }

    // Phase G (Solution 1A): Check if it's a config file that should be excluded
    // Config files are not React components and should not be analyzed
    if (this.isConfigFile(filename)) {
      return false;
    }

    // Check if it's a test file
    if (this.isTestFile(filename, config.excludeTestFiles)) {
      return false;
    }

    return true;
  }

  /**
   * Determines if a directory should be skipped during scanning
   * 
   * @param dirName - Directory name
   * @param config - File scanning configuration
   * @returns boolean - True if directory should be skipped
   */
  private shouldSkipDirectory(dirName: string, config: FileScanConfig): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      'temp',
      'tmp',
      'logs',
      'log'
    ];

    // Check standard skip directories
    if (skipDirs.includes(dirName) || dirName.startsWith('.')) {
      return true;
    }

    // Check custom exclusions
    if (config.customExclusions.some(exclusion => dirName.includes(exclusion))) {
      return true;
    }

    return false;
  }

  /**
   * Checks if a filename matches any of the include patterns
   * 
   * @param filename - File name to check
   * @param patterns - Include patterns to match against
   * @returns boolean - True if file matches any include pattern
   */
  private matchesIncludePattern(filename: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matchesPattern(filename, pattern));
  }

  /**
   * Checks if a filename matches any of the exclude patterns
   * 
   * @param filename - File name to check
   * @param patterns - Exclude patterns to match against
   * @returns boolean - True if file matches any exclude pattern
   */
  private matchesExcludePattern(filename: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matchesPattern(filename, pattern));
  }

  /**
   * Checks if a filename matches a specific pattern
   * 
   * Phase G: Enhanced to handle brace expansion patterns like {ts,tsx,js}
   * 
   * @param filename - File name to check
   * @param pattern - Pattern to match against (supports glob and brace expansion)
   * @returns boolean - True if file matches the pattern
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern.includes('*')) {
      // Handle glob patterns with proper regex conversion
      let escapedPattern = pattern.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
      
      // Phase G: Handle brace expansion {ts,tsx,js} → (ts|tsx|js)
      // This is required for patterns like **/*.{ts,tsx,js,jsx,json}
      escapedPattern = escapedPattern.replace(/\{([^}]+)\}/g, (match, group) => {
        const alternatives = group.split(',').map((s: string) => s.trim());
        return `(${alternatives.join('|')})`;
      });
      
      // Handle ** (any directory depth)
      escapedPattern = escapedPattern.replace(/\*\*\//g, '(?:.*/)?');
      
      // Handle single * (any characters except path separators)
      escapedPattern = escapedPattern.replace(/\*/g, '[^/]*');
      
      // Create regex with anchors to match the entire filename
      const regex = new RegExp(`^${escapedPattern}$`);
      
      // Test both the filename directly and as if it were at the end of a path
      return regex.test(filename) || regex.test(`/${filename}`);
    }
    
    // For patterns without *, check if filename ends with the pattern
    return filename.endsWith(pattern);
  }

  /**
   * Determines if a file is a test file that should be excluded
   * 
   * @param filename - File name to check
   * @param excludeTestFiles - Whether to exclude test files
   * @returns boolean - True if file is a test file and should be excluded
   */
  private isTestFile(filename: string, excludeTestFiles: boolean): boolean {
    if (!excludeTestFiles) {
      return false;
    }

    // Check for test file patterns
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /\.tst\./,
      /test\./,
      /spec\./,
      /tst\./
    ];

    return testPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Determines if a file is a configuration file that should be excluded
   * 
   * Business Logic:
   * Configuration files (webpack, babel, jest, etc.) are not React components
   * and should not be analyzed. They define build/test infrastructure, not application logic.
   * 
   * Context (Phase G - Solution 1A):
   * Prevents config files from being parsed and creating unnecessary nodes in the graph.
   * According to PRD Section 3.1.2: "What Does NOT Become a Node" includes config files.
   * 
   * Implementation Strategy:
   * Uses pattern matching to detect common config file naming conventions:
   * - Files ending with .config.js/ts (webpack.config.js, babel.config.ts)
   * - Files matching known config patterns (vite.config, rollup.config)
   * - tsconfig.json and similar configuration files
   * 
   * @param filename - File name to check
   * @returns boolean - True if file is a config file and should be excluded
   */
  private isConfigFile(filename: string): boolean {
    // Config file patterns based on common JavaScript/TypeScript ecosystem configurations
    const configPatterns = [
      // Generic .config pattern (webpack.config.js, babel.config.ts, etc.)
      /\.config\.(js|ts|cjs|mjs)$/,
      
      // Build tool configs
      /webpack\./i,
      /vite\./i,
      /rollup\./i,
      /esbuild\./i,
      /parcel\./i,
      
      // Transpiler/compiler configs
      /babel\.config/i,
      /tsconfig\.json$/i,
      /jsconfig\.json$/i,
      
      // Test framework configs
      /jest\.config/i,
      /vitest\.config/i,
      /karma\.config/i,
      /mocha\.config/i,
      
      // Linter/formatter configs
      /eslint\.config/i,
      /\.eslintrc/i,
      /prettier\.config/i,
      /\.prettierrc/i,
      
      // Package/dependency configs
      /package\.json$/i,
      /package-lock\.json$/i,
      /yarn\.lock$/i,
      /pnpm-lock\.yaml$/i,
      
      // Environment configs
      /\.env$/i,
      /\.env\./i
    ];

    return configPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Extracts file information from a file path with validation
   * 
   * @param filePath - Path to the file
   * @param config - File scanning configuration
   * @returns Promise<FileInfo | null> - File information or null if file should be excluded
   */
  private async extractFileInfo(filePath: string, config: FileScanConfig): Promise<FileInfo | null> {
    try {
      const stats = await fsBuiltin.stat(filePath);
      
      // Check file size limit
      if (stats.size > config.maxFileSize) {
        await this.logger.logWarning(`File size exceeds limit: ${filePath}`, {
          fileSize: stats.size,
          maxFileSize: config.maxFileSize
        });
        return null;
      }

      // Check if we've reached the maximum number of files
      if (config.maxFiles > 0) {
        // This check would need to be done at a higher level since we don't have the current count here
        // For now, we'll include the file and let the calling code handle the limit
      }

      const ext = path.extname(filePath);
      const name = path.basename(filePath);

      return {
        path: filePath,
        name: name,
        extension: ext,
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch (error) {
      await this.logger.logError(`Error extracting file info for ${filePath}: ${error}`);
      return null;
    }
  }
}
