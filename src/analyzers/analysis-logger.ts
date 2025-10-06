/**
 * Analysis Logger
 * Handles logging of analysis steps, warnings, and errors to analysis log files
 * Following Phase 2.2 requirements from the project plan
 */

import * as fs from 'fs-extra';
import * as fsBuiltin from 'node:fs/promises';
import * as path from 'path';
import { AnalysisLogger as IAnalysisLogger } from '../types/index.js';

/**
 * Analysis Logger class
 * Implements comprehensive logging for code2graph analysis operations
 * Creates repository-specific log files in ./log/ directory
 */
export class AnalysisLogger implements IAnalysisLogger {
  private readonly logPath: string;
  private readonly logDir: string;

  /**
   * Constructor initializes logging system for a specific repository
   * Creates log directory and file based on repository name
   * 
   * @param repoUrl - Repository URL to create log file for
   */
  constructor(repoUrl: string) {
    // Extract repository name from URL for log file naming
    const repoName = this.extractRepoName(repoUrl);
    this.logDir = path.join(process.cwd(), 'log');
    this.logPath = path.join(this.logDir, `${repoName}-analysis.log`);
  }

  /**
   * Logs informational messages to the analysis log file
   * 
   * @param message - Information message to log
   * @param context - Optional context object with additional information
   */
  async logInfo(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.writeLogEntry('INFO', message, context);
  }

  /**
   * Logs warning messages to the analysis log file
   * 
   * @param message - Warning message to log
   * @param context - Optional context object with additional information
   */
  async logWarning(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.writeLogEntry('WARNING', message, context);
  }

  /**
   * Logs error messages to the analysis log file
   * 
   * @param message - Error message to log
   * @param context - Optional context object with additional information
   */
  async logError(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.writeLogEntry('ERROR', message, context);
  }

  /**
   * Gets the path to the current log file
   * 
   * @returns string - Path to the log file
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Writes a log entry to the analysis log file
   * Formats entries with timestamp, level, message, and optional context
   * 
   * @param level - Log level (INFO, WARNING, ERROR)
   * @param message - Log message
   * @param context - Optional context object
   */
  private async writeLogEntry(level: string, message: string, context?: Record<string, unknown>): Promise<void> {
    try {
      // Ensure log directory exists before writing
      await fs.ensureDir(this.logDir);
      
      const timestamp = new Date().toISOString();
      const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
      const logEntry = `[${timestamp}] ${level}: ${message}${contextStr}\n`;
      
      // Use explicit UTF-8 encoding and append mode flag for reliability
      // This ensures proper file handling across different platforms (Windows, Linux, macOS)
      await fsBuiltin.appendFile(this.logPath, logEntry, { encoding: 'utf-8', flag: 'a' });
    } catch (logError) {
      // If logging fails, fall back to console output
      console.warn(`Failed to write to log file ${this.logPath}: ${logError}`);
      console.log(`[${new Date().toISOString()}] ${level}: ${message}`);
    }
  }

  /**
   * Extracts repository name from GitHub URL for log file naming
   * 
   * @param repoUrl - Repository URL
   * @returns string - Repository name for log file
   */
  private extractRepoName(repoUrl: string): string {
    try {
      const urlObj = new URL(repoUrl);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length >= 2) {
        return pathParts[1].replace('.git', '');
      }
      
      // Fallback to sanitized URL if parsing fails
      return repoUrl.replace(/[^a-zA-Z0-9]/g, '-');
    } catch {
      // Fallback to sanitized URL if parsing fails
      return repoUrl.replace(/[^a-zA-Z0-9]/g, '-');
    }
  }

  /**
   * Logs analysis start with repository information
   * 
   * @param repoUrl - Repository URL being analyzed
   * @param repoPath - Local path to cloned repository
   */
  async logAnalysisStart(repoUrl: string, repoPath: string): Promise<void> {
    await this.logInfo('Analysis started', {
      repositoryUrl: repoUrl,
      repositoryPath: repoPath,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Logs analysis completion with summary statistics
   * 
   * @param summary - Analysis summary statistics
   */
  async logAnalysisComplete(summary: Record<string, unknown>): Promise<void> {
    await this.logInfo('Analysis completed', {
      ...summary,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Logs file scanning progress
   * 
   * @param current - Current file being processed
   * @param total - Total files to process
   * @param currentFile - Name of current file
   */
  async logScanProgress(current: number, total: number, currentFile?: string): Promise<void> {
    const percentage = Math.round((current / total) * 100);
    const context: Record<string, unknown> = {
      progress: `${current}/${total} (${percentage}%)`
    };
    
    if (currentFile) {
      context.currentFile = currentFile;
    }
    
    await this.logInfo('File scanning progress', context);
  }

  /**
   * Logs memory usage information
   * 
   * @param memoryInfo - Memory usage information
   */
  async logMemoryUsage(memoryInfo: Record<string, unknown>): Promise<void> {
    await this.logInfo('Memory usage', memoryInfo);
  }

  /**
   * Logs configuration information
   * 
   * @param config - Configuration being used
   */
  async logConfiguration(config: Record<string, unknown>): Promise<void> {
    await this.logInfo('Configuration loaded', config);
  }
}
