/**
 * URL Utilities
 * Helper functions for parsing and extracting information from URLs
 * 
 * Business Logic:
 * - Extracts repository name from GitHub URLs for file naming
 * - Generates standardized output file paths based on repository names
 */

import * as path from 'path';

/**
 * Extracts the repository name from a GitHub URL
 * 
 * Examples:
 * - https://github.com/tomm/react-typescript-helloworld -> react-typescript-helloworld
 * - https://github.com/owner/repo.git -> repo
 * 
 * @param repoUrl - GitHub repository URL
 * @returns Repository name extracted from the URL
 * @throws Error if URL is invalid or cannot be parsed
 */
export function extractRepoName(repoUrl: string): string {
  try {
    // Handle empty or invalid URLs
    if (!repoUrl || repoUrl.trim() === '') {
      throw new Error('Repository URL cannot be empty');
    }

    const urlObj = new URL(repoUrl);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    
    // GitHub URLs should have at least owner/repo format
    if (pathParts.length < 2) {
      throw new Error('Invalid GitHub repository URL format. Expected format: https://github.com/owner/repo');
    }
    
    // Extract repo name (second part) and remove .git extension if present
    const repoName = pathParts[1].replace('.git', '');
    
    return repoName;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL format: ${repoUrl}`);
    }
    throw error;
  }
}

/**
 * Generates the output file path for a repository analysis
 * 
 * The output path follows the pattern: ./graph-data-files/code2graph_<repo-name>.json
 * 
 * @param repoUrl - GitHub repository URL
 * @returns Full output file path
 */
export function generateOutputPath(repoUrl: string): string {
  // Extract repository name from URL
  const repoName = extractRepoName(repoUrl);
  
  // Generate output path with standardized naming convention
  // Format: ./graph-data-files/code2graph_<repo-name>.json
  // Note: We explicitly preserve the './' prefix for consistency across platforms
  // path.join() on Windows may remove the './' prefix, so we ensure it's always present
  const outputDir = 'graph-data-files';
  const fileName = `code2graph_${repoName}.json`;
  const relativePath = path.join(outputDir, fileName);
  
  // Ensure the path starts with './' for consistency
  return `./${relativePath.replace(/\\/g, '/')}`;
}

/**
 * Generates the dead code report file path for a repository analysis
 * 
 * The output path follows the pattern: ./graph-data-files/code2graph_<repo-name>-dead-code-report.json
 * 
 * @param repoUrl - GitHub repository URL
 * @returns Full dead code report file path
 */
export function generateDeadCodeReportPath(repoUrl: string): string {
  // Extract repository name from URL
  const repoName = extractRepoName(repoUrl);
  
  // Generate dead code report path with standardized naming convention
  // Format: ./graph-data-files/code2graph_<repo-name>-dead-code-report.json
  // Note: We explicitly preserve the './' prefix for consistency across platforms
  // path.join() on Windows may remove the './' prefix, so we ensure it's always present
  const outputDir = 'graph-data-files';
  const fileName = `code2graph_${repoName}-dead-code-report.json`;
  const relativePath = path.join(outputDir, fileName);
  
  // Ensure the path starts with './' and uses forward slashes for consistency
  return `./${relativePath.replace(/\\/g, '/')}`;
}

