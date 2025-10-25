/**
 * Unit tests for URL Utilities
 * Tests the URL parsing and output path generation functionality
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractRepoName, generateOutputPath, generateDeadCodeReportPath } from '../dist/utils/url-utils.js';

describe('URL Utilities', () => {
  describe('extractRepoName', () => {
    test('should extract repo name from standard GitHub URL', () => {
      const url = 'https://github.com/tomm/react-typescript-helloworld';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'react-typescript-helloworld');
    });

    test('should extract repo name from GitHub URL with .git extension', () => {
      const url = 'https://github.com/owner/repo.git';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'repo');
    });

    test('should extract repo name from GitHub URL with trailing slash', () => {
      const url = 'https://github.com/owner/repo/';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'repo');
    });

    test('should extract repo name from complex repository name', () => {
      const url = 'https://github.com/NickVanMaele-vonk/code2graph';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'code2graph');
    });

    test('should throw error for empty URL', () => {
      assert.throws(
        () => extractRepoName(''),
        /Repository URL cannot be empty/
      );
    });

    test('should throw error for invalid URL format', () => {
      assert.throws(
        () => extractRepoName('not-a-url'),
        /Invalid URL format/
      );
    });

    test('should throw error for URL without repo name', () => {
      assert.throws(
        () => extractRepoName('https://github.com/'),
        /Invalid GitHub repository URL format/
      );
    });

    test('should throw error for URL with only owner', () => {
      assert.throws(
        () => extractRepoName('https://github.com/owner'),
        /Invalid GitHub repository URL format/
      );
    });

    test('should handle URL with query parameters', () => {
      const url = 'https://github.com/owner/repo?ref=main';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'repo');
    });

    test('should handle URL with hash', () => {
      const url = 'https://github.com/owner/repo#readme';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'repo');
    });

    test('should handle repo names with special characters', () => {
      const url = 'https://github.com/owner/repo-name_with-special.chars';
      const repoName = extractRepoName(url);
      
      assert.strictEqual(repoName, 'repo-name_with-special.chars');
    });
  });

  describe('generateOutputPath', () => {
    test('should generate correct output path for standard GitHub URL', () => {
      const url = 'https://github.com/tomm/react-typescript-helloworld';
      const outputPath = generateOutputPath(url);
      
      // Normalize path separators for cross-platform compatibility
      const normalizedPath = outputPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_react-typescript-helloworld.json');
    });

    test('should generate correct output path with .git extension', () => {
      const url = 'https://github.com/owner/repo.git';
      const outputPath = generateOutputPath(url);
      
      const normalizedPath = outputPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_repo.json');
    });

    test('should generate correct output path for code2graph repo', () => {
      const url = 'https://github.com/NickVanMaele-vonk/code2graph';
      const outputPath = generateOutputPath(url);
      
      const normalizedPath = outputPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_code2graph.json');
    });

    test('should generate correct output path for repo with hyphens', () => {
      const url = 'https://github.com/facebook/create-react-app';
      const outputPath = generateOutputPath(url);
      
      const normalizedPath = outputPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_create-react-app.json');
    });

    test('should throw error for invalid URL', () => {
      assert.throws(
        () => generateOutputPath('invalid-url'),
        /Invalid URL format/
      );
    });

    test('should throw error for empty URL', () => {
      assert.throws(
        () => generateOutputPath(''),
        /Repository URL cannot be empty/
      );
    });
  });

  describe('generateDeadCodeReportPath', () => {
    test('should generate correct dead code report path for standard GitHub URL', () => {
      const url = 'https://github.com/tomm/react-typescript-helloworld';
      const reportPath = generateDeadCodeReportPath(url);
      
      const normalizedPath = reportPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_react-typescript-helloworld-dead-code-report.json');
    });

    test('should generate correct dead code report path with .git extension', () => {
      const url = 'https://github.com/owner/repo.git';
      const reportPath = generateDeadCodeReportPath(url);
      
      const normalizedPath = reportPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_repo-dead-code-report.json');
    });

    test('should generate correct dead code report path for code2graph repo', () => {
      const url = 'https://github.com/NickVanMaele-vonk/code2graph';
      const reportPath = generateDeadCodeReportPath(url);
      
      const normalizedPath = reportPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_code2graph-dead-code-report.json');
    });

    test('should generate correct dead code report path for repo with hyphens', () => {
      const url = 'https://github.com/facebook/create-react-app';
      const reportPath = generateDeadCodeReportPath(url);
      
      const normalizedPath = reportPath.replace(/\\/g, '/');
      assert.strictEqual(normalizedPath, './graph-data-files/code2graph_create-react-app-dead-code-report.json');
    });

    test('should throw error for invalid URL', () => {
      assert.throws(
        () => generateDeadCodeReportPath('invalid-url'),
        /Invalid URL format/
      );
    });

    test('should throw error for empty URL', () => {
      assert.throws(
        () => generateDeadCodeReportPath(''),
        /Repository URL cannot be empty/
      );
    });
  });

  describe('Path consistency', () => {
    test('should generate matching paths for main output and dead code report', () => {
      const url = 'https://github.com/owner/repo';
      const outputPath = generateOutputPath(url);
      const reportPath = generateDeadCodeReportPath(url);
      
      // Both should be in the same directory
      const normalizedOutput = outputPath.replace(/\\/g, '/');
      const normalizedReport = reportPath.replace(/\\/g, '/');
      
      assert(normalizedOutput.startsWith('./graph-data-files/'));
      assert(normalizedReport.startsWith('./graph-data-files/'));
      
      // Report should include the base output name
      assert(normalizedReport.includes('code2graph_repo'));
      assert(normalizedOutput.includes('code2graph_repo'));
    });

    test('should follow consistent naming convention', () => {
      const url = 'https://github.com/owner/my-awesome-repo';
      const outputPath = generateOutputPath(url);
      const reportPath = generateDeadCodeReportPath(url);
      
      const normalizedOutput = outputPath.replace(/\\/g, '/');
      const normalizedReport = reportPath.replace(/\\/g, '/');
      
      // Check naming convention
      assert.strictEqual(normalizedOutput, './graph-data-files/code2graph_my-awesome-repo.json');
      assert.strictEqual(normalizedReport, './graph-data-files/code2graph_my-awesome-repo-dead-code-report.json');
    });
  });
});

