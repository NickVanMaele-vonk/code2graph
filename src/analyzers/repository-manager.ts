/**
 * Repository Manager
 * Handles cloning, scanning, and cleanup of repositories
 * Following Phase 2.1 requirements from the project plan
 */

import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  RepositoryInfo,
  FileInfo,
  CloneOptions,
  AnalysisError,
  ValidationResult
} from '../types/index.js';

/**
 * Repository Manager class
 * Implements GitHub repository cloning, local directory analysis, and cleanup functionality
 */
export class RepositoryManager {
  private readonly tempDir: string;
  private readonly clonedReposDir: string;

  /**
   * Constructor initializes temporary directories for repository management
   * Creates sandboxed environment for safe repository operations
   */
  constructor() {
    // Create temporary directories in a sandboxed environment
    this.tempDir = path.join(os.tmpdir(), 'code2graph-temp');
    this.clonedReposDir = path.join(process.cwd(), 'cloned-repos');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensures required directories exist for repository operations
   * Creates directories if they don't exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.ensureDir(this.tempDir);
      await fs.ensureDir(this.clonedReposDir);
    } catch (error) {
      throw new Error(`Failed to create required directories: ${error}`);
    }
  }

  /**
   * Clones a GitHub repository to a temporary location
   * Implements secure, read-only repository cloning with progress reporting
   * 
   * @param url - GitHub repository URL
   * @param targetPath - Optional target path, defaults to temp directory
   * @param options - Clone options including branch, depth, and progress callback
   * @returns Promise<RepositoryInfo> - Information about the cloned repository
   */
  async cloneRepository(
    url: string, 
    targetPath?: string, 
    options: CloneOptions = {}
  ): Promise<RepositoryInfo> {
    try {
      // Validate repository URL
      const validation = this.validateRepositoryUrl(url);
      if (!validation.isValid) {
        throw new Error(`Invalid repository URL: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // Generate target path if not provided
      const repoPath = targetPath || this.generateRepositoryPath(url);
      
      // Ensure target directory exists
      await fs.ensureDir(repoPath);

      // Configure git options for secure, read-only cloning
      // SimpleGitOptions interface requires config and trimmed properties
      const gitOptions: SimpleGitOptions = {
        baseDir: repoPath,
        binary: 'git',
        maxConcurrentProcesses: 1,
        timeout: {
          block: options.timeout || 300000 // 5 minutes default timeout
        },
        // Required by SimpleGitOptions interface - config array for git configuration
        config: [],
        // Required by SimpleGitOptions interface - trimmed output flag
        trimmed: false
      };

      const git: SimpleGit = simpleGit(gitOptions);

      // Report cloning start
      if (options.progressCallback) {
        options.progressCallback({
          step: 'cloning',
          current: 0,
          total: 100,
          percentage: 0,
          message: `Starting to clone repository: ${url}`
        });
      }

      // Clone repository with specified options
      const cloneOptions = [
        '--single-branch',
        '--no-tags',
        '--depth', (options.depth || 1).toString()
      ];

      if (options.branch) {
        cloneOptions.push('--branch', options.branch);
      }

      await git.clone(url, '.', cloneOptions);

      // Get repository information
      const repoInfo = await this.extractRepositoryInfo(url, repoPath, git);

      // Report cloning completion
      if (options.progressCallback) {
        options.progressCallback({
          step: 'cloning',
          current: 100,
          total: 100,
          percentage: 100,
          message: `Successfully cloned repository: ${repoInfo.name}`
        });
      }

      return repoInfo;

    } catch (error) {
      // Handle different types of errors with appropriate error handling
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          throw new Error(`Fatal error: repository not found. Please check the URL and try again.`);
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
          throw new Error(`Fatal error: repository cloning failed due to network issues. Please try again.`);
        } else if (error.message.includes('permission') || error.message.includes('access')) {
          throw new Error(`Fatal error: repository cloning failed due to permission issues. Please check repository access.`);
        }
      }
      throw new Error(`Fatal error: repository cloning failed. Please clone again.`);
    }
  }

  /**
   * Analyzes a local directory for relevant files
   * Scans file system recursively and extracts file metadata
   * 
   * @param directory - Directory path to scan
   * @param patterns - File patterns to include (defaults to TypeScript/JavaScript files)
   * @returns Promise<FileInfo[]> - Array of file information
   */
  async scanFiles(directory: string, patterns: string[] = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']): Promise<FileInfo[]> {
    try {
      // Validate directory exists and is accessible
      if (!await fs.pathExists(directory)) {
        throw new Error(`Directory does not exist: ${directory}`);
      }

      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${directory}`);
      }

      const files: FileInfo[] = [];
      
      // Recursively scan directory
      await this.scanDirectoryRecursive(directory, patterns, files);
      
      return files;

    } catch (error) {
      throw new Error(`Error scanning files in ${directory}: ${error}`);
    }
  }

  /**
   * Recursively scans a directory for files matching the specified patterns
   * 
   * @param dir - Directory to scan
   * @param patterns - File patterns to match
   * @param files - Array to collect file information
   */
  private async scanDirectoryRecursive(
    dir: string, 
    patterns: string[], 
    files: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and other common directories to exclude
          if (!this.shouldSkipDirectory(entry.name)) {
            await this.scanDirectoryRecursive(fullPath, patterns, files);
          }
        } else if (entry.isFile()) {
          // Check if file matches any of the patterns
          if (this.matchesPattern(entry.name, patterns)) {
            const fileInfo = await this.extractFileInfo(fullPath);
            files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      // Log error but continue scanning other files
      console.warn(`Error scanning directory ${dir}: ${error}`);
    }
  }

  /**
   * Determines if a directory should be skipped during scanning
   * 
   * @param dirName - Directory name
   * @returns boolean - True if directory should be skipped
   */
  private shouldSkipDirectory(dirName: string): boolean {
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
      'tmp'
    ];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * Checks if a filename matches any of the specified patterns
   * 
   * @param filename - File name to check
   * @param patterns - Patterns to match against
   * @returns boolean - True if file matches any pattern
   */
  private matchesPattern(filename: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      if (pattern.includes('*')) {
        // Simple glob pattern matching
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filename);
      }
      return filename.endsWith(pattern);
    });
  }

  /**
   * Extracts file information from a file path
   * 
   * @param filePath - Path to the file
   * @returns Promise<FileInfo> - File information
   */
  private async extractFileInfo(filePath: string): Promise<FileInfo> {
    try {
      const stats = await fs.stat(filePath);
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
      throw new Error(`Error extracting file info for ${filePath}: ${error}`);
    }
  }

  /**
   * Cleans up temporary files and directories
   * Implements secure cleanup to prevent data leakage
   * 
   * @param path - Path to clean up (optional, cleans all temp files if not specified)
   */
  async cleanup(cleanupPath?: string): Promise<void> {
    try {
      if (cleanupPath) {
        // Clean up specific path
        if (await fs.pathExists(cleanupPath)) {
          await fs.remove(cleanupPath);
        }
      } else {
        // Clean up all temporary files
        if (await fs.pathExists(this.tempDir)) {
          await fs.remove(this.tempDir);
        }
        // Note: We don't clean up cloned-repos directory as it may contain user data
      }
    } catch (error) {
      console.warn(`Warning: Failed to clean up ${cleanupPath || 'temporary files'}: ${error}`);
    }
  }

  /**
   * Validates a repository URL
   * Ensures URL is a valid GitHub repository URL
   * Security: Validates hostname to prevent URL injection attacks
   * 
   * @param url - Repository URL to validate
   * @returns ValidationResult - Validation result with errors if any
   */
  private validateRepositoryUrl(url: string): ValidationResult {
    const errors: AnalysisError[] = [];
    const warnings: AnalysisError[] = [];

    try {
      // Parse URL to validate format and extract components
      const urlObj = new URL(url);
      
      // Security: Validate hostname exactly matches github.com to prevent subdomain/path injection
      // This prevents malicious URLs like 'evil.com/github.com/repo' or 'github.com.evil.com/repo'
      if (urlObj.hostname !== 'github.com') {
        errors.push({
          type: 'validation',
          message: 'Only GitHub repositories (github.com) are supported'
        });
      }

      // Check if it's an HTTPS URL (more secure than SSH for public repos)
      if (urlObj.protocol !== 'https:') {
        warnings.push({
          type: 'validation',
          message: 'HTTPS URLs are recommended for better security'
        });
      }

      // Additional security: Validate path format for GitHub repository structure
      // GitHub repo URLs should be in format: /owner/repo or /owner/repo.git
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length < 2) {
        errors.push({
          type: 'validation',
          message: 'Invalid GitHub repository URL format. Expected: https://github.com/owner/repo'
        });
      }

    } catch {
      errors.push({
        type: 'validation',
        message: 'Invalid URL format'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generates a safe repository path for cloning
   * Creates a unique path based on repository URL
   * 
   * @param url - Repository URL
   * @returns string - Generated repository path
   */
  private generateRepositoryPath(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repo = pathParts[1].replace('.git', '');
        return path.join(this.clonedReposDir, `${owner}-${repo}-${Date.now()}`);
      }
      
      throw new Error('Invalid repository URL format');
    } catch (error) {
      throw new Error(`Failed to generate repository path: ${error}`);
    }
  }

  /**
   * Extracts repository information from a cloned repository
   * 
   * @param url - Original repository URL
   * @param repoPath - Path to the cloned repository
   * @param git - Git instance for the repository
   * @returns Promise<RepositoryInfo> - Repository information
   */
  private async extractRepositoryInfo(
    url: string, 
    repoPath: string, 
    git: SimpleGit
  ): Promise<RepositoryInfo> {
    try {
      // Extract repository name from URL
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      const name = pathParts.length >= 2 ? pathParts[1].replace('.git', '') : 'unknown';

      // Get current branch
      let branch: string | undefined;
      try {
        const branchInfo = await git.branch();
        branch = branchInfo.current;
      } catch {
        // Branch info might not be available, continue without it
      }

      // Get current commit
      let commit: string | undefined;
      try {
        const log = await git.log({ maxCount: 1 });
        commit = log.latest?.hash;
      } catch {
        // Commit info might not be available, continue without it
      }

      return {
        url,
        name,
        path: repoPath,
        branch,
        commit
      };

    } catch (error) {
      throw new Error(`Failed to extract repository information: ${error}`);
    }
  }
}
