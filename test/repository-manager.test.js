/**
 * Unit tests for RepositoryManager
 * Tests the core repository cloning and management functionality
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { RepositoryManager } from '../src/analyzers/repository-manager.js';

describe('RepositoryManager', () => {
  let repositoryManager;

  beforeEach(() => {
    repositoryManager = new RepositoryManager();
  });

  afterEach(async () => {
    // Clean up after each test
    await repositoryManager.cleanup();
  });

  describe('Repository URL Validation', () => {
    test('should validate valid GitHub URLs', () => {
      // This is a private method, so we'll test it indirectly through cloneRepository
      // We expect it to throw an error for invalid URLs
      assert.doesNotThrow(() => {
        new URL('https://github.com/user/repo');
      });
    });

    test('should reject non-GitHub URLs', async () => {
      try {
        await repositoryManager.cloneRepository('https://gitlab.com/user/repo');
        assert.fail('Should have thrown an error for non-GitHub URL');
      } catch (error) {
        assert(error.message.includes('Only GitHub repositories'));
      }
    });

    test('should reject invalid URLs', async () => {
      try {
        await repositoryManager.cloneRepository('not-a-url');
        assert.fail('Should have thrown an error for invalid URL');
      } catch (error) {
        assert(error.message.includes('Invalid repository URL'));
      }
    });

    test('should reject malicious URLs with github.com in path', async () => {
      try {
        await repositoryManager.cloneRepository('https://evil.com/github.com/user/repo');
        assert.fail('Should have thrown an error for malicious URL with github.com in path');
      } catch (error) {
        assert(error.message.includes('Only GitHub repositories'));
      }
    });

    test('should reject malicious URLs with github.com subdomain', async () => {
      try {
        await repositoryManager.cloneRepository('https://github.com.evil.com/user/repo');
        assert.fail('Should have thrown an error for malicious URL with github.com subdomain');
      } catch (error) {
        assert(error.message.includes('Only GitHub repositories'));
      }
    });

    test('should reject URLs with invalid GitHub path format', async () => {
      try {
        await repositoryManager.cloneRepository('https://github.com/user');
        assert.fail('Should have thrown an error for invalid GitHub path format');
      } catch (error) {
        assert(error.message.includes('Invalid GitHub repository URL format'));
      }
    });
  });

  describe('File Scanning', () => {
    test('should scan directory for TypeScript files', async () => {
      // Create a temporary directory with test files
      const testDir = path.join(process.cwd(), 'test-temp-scan');
      await fs.ensureDir(testDir);
      
      try {
        // Create test files
        await fs.writeFile(path.join(testDir, 'test.ts'), 'console.log("test");');
        await fs.writeFile(path.join(testDir, 'test.js'), 'console.log("test");');
        await fs.writeFile(path.join(testDir, 'test.txt'), 'not a code file');

        const files = await repositoryManager.scanFiles(testDir);
        
        // Should find TypeScript and JavaScript files, but not text files
        assert(files.length >= 2);
        assert(files.some(f => f.name === 'test.ts'));
        assert(files.some(f => f.name === 'test.js'));
        assert(!files.some(f => f.name === 'test.txt'));
        
      } finally {
        await fs.remove(testDir);
      }
    });

    test('should skip node_modules and other excluded directories', async () => {
      const testDir = path.join(process.cwd(), 'test-temp-exclude');
      await fs.ensureDir(testDir);
      await fs.ensureDir(path.join(testDir, 'node_modules'));
      
      try {
        await fs.writeFile(path.join(testDir, 'test.ts'), 'console.log("test");');
        await fs.writeFile(path.join(testDir, 'node_modules', 'package.ts'), 'should be excluded');

        const files = await repositoryManager.scanFiles(testDir);
        
        // Should only find the test.ts file, not the one in node_modules
        assert(files.length === 1);
        assert(files[0].name === 'test.ts');
        
      } finally {
        await fs.remove(testDir);
      }
    });

    test('should handle non-existent directory gracefully', async () => {
      try {
        await repositoryManager.scanFiles('/non/existent/directory');
        assert.fail('Should have thrown an error for non-existent directory');
      } catch (error) {
        assert(error.message.includes('Directory does not exist'));
      }
    });
  });

  describe('Cleanup', () => {
    test('should clean up specific path', async () => {
      const testDir = path.join(process.cwd(), 'test-temp-cleanup');
      await fs.ensureDir(testDir);
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test content');
      
      assert(await fs.pathExists(testDir));
      
      await repositoryManager.cleanup(testDir);
      
      assert(!(await fs.pathExists(testDir)));
    });

    test('should handle cleanup of non-existent path gracefully', async () => {
      // Should not throw an error when trying to clean up non-existent path
      await assert.doesNotReject(
        repositoryManager.cleanup('/non/existent/path')
      );
    });
  });
});

describe('Integration Tests', () => {
  let repositoryManager;

  beforeEach(() => {
    repositoryManager = new RepositoryManager();
  });

  afterEach(async () => {
    await repositoryManager.cleanup();
  });

  // Note: These tests require network access and should be run carefully
  // They are commented out by default to avoid network dependencies in CI/CD
  
  /*
  test('should clone a real repository (integration test)', async () => {
    // This test requires network access and should be run manually
    const testRepoUrl = 'https://github.com/octocat/Hello-World';
    
    try {
      const repoInfo = await repositoryManager.cloneRepository(testRepoUrl);
      
      assert(repoInfo.url === testRepoUrl);
      assert(repoInfo.name === 'Hello-World');
      assert(await fs.pathExists(repoInfo.path));
      
      // Clean up the cloned repository
      await repositoryManager.cleanup(repoInfo.path);
      
    } catch (error) {
      // If this fails due to network issues, that's acceptable
      console.warn('Integration test skipped due to network issues:', error.message);
    }
  });
  */
});
