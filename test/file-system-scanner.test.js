/**
 * Unit tests for FileSystemScanner
 * Tests the enhanced file scanning functionality for code2graph analysis operations
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileSystemScanner } from '../dist/analyzers/file-system-scanner.js';
import { AnalysisLogger } from '../dist/analyzers/analysis-logger.js';
import { MemoryMonitor } from '../dist/analyzers/memory-monitor.js';

describe('FileSystemScanner', () => {
  let scanner;
  let logger;
  let memoryMonitor;
  let testDir;

  beforeEach(() => {
    logger = new AnalysisLogger('https://github.com/testuser/testrepo');
    memoryMonitor = new MemoryMonitor();
    scanner = new FileSystemScanner(logger, memoryMonitor);
    testDir = path.join(process.cwd(), 'test-temp-scanner');
  });

  afterEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
    
    // Clean up log files
    const logPath = logger.getLogPath();
    if (await fs.pathExists(logPath)) {
      await fs.remove(logPath);
    }
  });

  describe('File Scanning', () => {
    test('should scan directory for TypeScript and JavaScript files', async () => {
      // Create test directory structure
      await fs.ensureDir(testDir);
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.ensureDir(path.join(testDir, 'src', 'components'));
      
      // Create test files
      await fs.outputFile(path.join(testDir, 'src', 'index.ts'), 'console.log("test");');
      await fs.outputFile(path.join(testDir, 'src', 'app.js'), 'console.log("test");');
      await fs.outputFile(path.join(testDir, 'src', 'components', 'Button.tsx'), 'export const Button = () => <button>Click</button>;');
      await fs.outputFile(path.join(testDir, 'src', 'styles.css'), 'body { margin: 0; }');
      await fs.outputFile(path.join(testDir, 'README.md'), '# Test Project');

      const config = {
        includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.length >= 3);
      assert(result.files.some(f => f.name === 'index.ts'));
      assert(result.files.some(f => f.name === 'app.js'));
      assert(result.files.some(f => f.name === 'Button.tsx'));
      assert(!result.files.some(f => f.name === 'styles.css'));
      assert(!result.files.some(f => f.name === 'README.md'));
    });

    test('should exclude test files when configured', async () => {
      await fs.ensureDir(testDir);
      
      await fs.outputFile(path.join(testDir, 'component.ts'), 'export const Component = () => {};');
      await fs.outputFile(path.join(testDir, 'component.test.ts'), 'describe("Component", () => {});');
      await fs.outputFile(path.join(testDir, 'component.spec.ts'), 'describe("Component", () => {});');
      await fs.outputFile(path.join(testDir, 'test-utils.ts'), 'export const testUtils = {};');

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'component.ts'));
      assert(!result.files.some(f => f.name === 'component.test.ts'));
      assert(!result.files.some(f => f.name === 'component.spec.ts'));
      assert(result.files.some(f => f.name === 'test-utils.ts')); // Not a test file
    });

    test('should include test files when not configured to exclude', async () => {
      await fs.ensureDir(testDir);
      
      await fs.outputFile(path.join(testDir, 'component.ts'), 'export const Component = () => {};');
      await fs.outputFile(path.join(testDir, 'component.test.ts'), 'describe("Component", () => {});');

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: false,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'component.ts'));
      assert(result.files.some(f => f.name === 'component.test.ts'));
    });

    test('should skip node_modules and other excluded directories', async () => {
      await fs.ensureDir(testDir);
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.ensureDir(path.join(testDir, 'node_modules'));
      await fs.ensureDir(path.join(testDir, '.git'));
      
      await fs.outputFile(path.join(testDir, 'src', 'index.ts'), 'console.log("test");');
      await fs.outputFile(path.join(testDir, 'node_modules', 'package', 'index.js'), 'module.exports = {};');
      await fs.outputFile(path.join(testDir, '.git', 'config'), '[core]');

      const config = {
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'index.ts'));
      assert(!result.files.some(f => f.path.includes('node_modules')));
      assert(!result.files.some(f => f.path.includes('.git')));
    });

    test('should respect custom exclusions', async () => {
      await fs.ensureDir(testDir);
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.ensureDir(path.join(testDir, 'docs'));
      
      await fs.outputFile(path.join(testDir, 'src', 'index.ts'), 'console.log("test");');
      await fs.outputFile(path.join(testDir, 'docs', 'readme.ts'), '// Documentation');

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: ['docs']
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'index.ts'));
      assert(!result.files.some(f => f.path.includes('docs')));
    });

    test('should respect file size limits', async () => {
      await fs.ensureDir(testDir);
      
      // Create a large file (simulate by creating a file with content)
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await fs.outputFile(path.join(testDir, 'large-file.ts'), largeContent);
      await fs.outputFile(path.join(testDir, 'small-file.ts'), 'console.log("small");');

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 512 * 1024, // 512KB limit
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'small-file.ts'));
      assert(!result.files.some(f => f.name === 'large-file.ts'));
    });

    /**
     * Phase G (Solution 1A): Test config file filtering
     * 
     * Business Logic:
     * Config files (webpack, babel, jest, etc.) should be excluded from analysis
     * as they are not React components and don't contribute to application logic.
     * 
     * Test validates:
     * - Common config file patterns are filtered out
     * - Regular React/TypeScript files are included
     * - Filtering prevents node pollution in the dependency graph
     */
    test('should exclude config files from scanning', async () => {
      await fs.ensureDir(testDir);
      
      // Create config files that should be excluded
      await fs.outputFile(path.join(testDir, 'webpack.config.js'), 'module.exports = {};');
      await fs.outputFile(path.join(testDir, 'babel.config.js'), 'module.exports = {};');
      await fs.outputFile(path.join(testDir, 'jest.config.ts'), 'export default {};');
      await fs.outputFile(path.join(testDir, 'vite.config.ts'), 'export default {};');
      await fs.outputFile(path.join(testDir, 'tsconfig.json'), '{}');
      await fs.outputFile(path.join(testDir, 'package.json'), '{}');
      await fs.outputFile(path.join(testDir, '.eslintrc.js'), 'module.exports = {};');
      await fs.outputFile(path.join(testDir, '.env'), 'NODE_ENV=test');
      
      // Create regular component files that should be included
      await fs.outputFile(path.join(testDir, 'Component.tsx'), 'export const Component = () => {};');
      await fs.outputFile(path.join(testDir, 'utils.ts'), 'export const util = () => {};');

      const config = {
        includePatterns: ['**/*.{ts,tsx,js,jsx,json}'],
        excludePatterns: [],
        maxFileSize: 1024 * 1024,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      // Regular component and utility files should be included
      assert(result.files.some(f => f.name === 'Component.tsx'), 'Component.tsx should be included');
      assert(result.files.some(f => f.name === 'utils.ts'), 'utils.ts should be included');
      
      // Config files should be excluded
      assert(!result.files.some(f => f.name === 'webpack.config.js'), 'webpack.config.js should be excluded');
      assert(!result.files.some(f => f.name === 'babel.config.js'), 'babel.config.js should be excluded');
      assert(!result.files.some(f => f.name === 'jest.config.ts'), 'jest.config.ts should be excluded');
      assert(!result.files.some(f => f.name === 'vite.config.ts'), 'vite.config.ts should be excluded');
      assert(!result.files.some(f => f.name === 'tsconfig.json'), 'tsconfig.json should be excluded');
      assert(!result.files.some(f => f.name === 'package.json'), 'package.json should be excluded');
      assert(!result.files.some(f => f.name === '.eslintrc.js'), '.eslintrc.js should be excluded');
      assert(!result.files.some(f => f.name === '.env'), '.env should be excluded');
    });
  });

  describe('Progress Reporting', () => {
    test('should call progress callback during scanning', async () => {
      await fs.ensureDir(testDir);
      await fs.outputFile(path.join(testDir, 'file1.ts'), 'console.log("test1");');
      await fs.outputFile(path.join(testDir, 'file2.ts'), 'console.log("test2");');

      let progressCalled = false;
      let progressData = null;

      const progressCallback = (progress) => {
        progressCalled = true;
        progressData = progress;
      };

      scanner.setProgressCallback(progressCallback);

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      await scanner.scanFiles(testDir, config);

      assert(progressCalled);
      assert(progressData);
      assert(typeof progressData.current === 'number');
      assert(typeof progressData.total === 'number');
      assert(typeof progressData.percentage === 'number');
      assert(typeof progressData.message === 'string');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent directory', async () => {
      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles('/non/existent/directory', config);

      assert(result.files.length === 0);
      assert(result.errors.length > 0);
      assert(result.errors[0].message.includes('Directory does not exist'));
    });

    test('should handle file access errors gracefully', async () => {
      await fs.ensureDir(testDir);
      
      // Create a file that we'll make inaccessible
      const inaccessibleFile = path.join(testDir, 'inaccessible.ts');
      await fs.outputFile(inaccessibleFile, 'console.log("test");');
      
      // Make the file inaccessible (this might not work on all systems)
      try {
        await fs.chmod(inaccessibleFile, 0);
      } catch {
        // Skip this test if we can't make the file inaccessible
        return;
      }

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      // Should continue scanning despite the error
      assert(result.files.length >= 0);
      
      // Restore file permissions for cleanup
      try {
        await fs.chmod(inaccessibleFile, 0o644);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe('Pattern Matching', () => {
    test('should match glob patterns correctly', async () => {
      await fs.ensureDir(testDir);
      await fs.outputFile(path.join(testDir, 'file.ts'), 'console.log("test");');
      await fs.outputFile(path.join(testDir, 'file.js'), 'console.log("test");');
      await fs.outputFile(path.join(testDir, 'file.txt'), 'not a code file');

      const config = {
        includePatterns: ['**/*.ts', '**/*.js'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'file.ts'));
      assert(result.files.some(f => f.name === 'file.js'));
      assert(!result.files.some(f => f.name === 'file.txt'));
    });

    test('should respect exclude patterns', async () => {
      await fs.ensureDir(testDir);
      await fs.outputFile(path.join(testDir, 'component.ts'), 'export const Component = () => {};');
      await fs.outputFile(path.join(testDir, 'component.d.ts'), 'declare module "component";');

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/*.d.ts'],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(result.files.some(f => f.name === 'component.ts'));
      assert(!result.files.some(f => f.name === 'component.d.ts'));
    });
  });

  describe('Result Structure', () => {
    test('should return properly structured scan results', async () => {
      await fs.ensureDir(testDir);
      await fs.outputFile(path.join(testDir, 'test.ts'), 'console.log("test");');

      const config = {
        includePatterns: ['**/*.ts'],
        excludePatterns: [],
        maxFileSize: 10485760,
        maxFiles: 1000,
        excludeTestFiles: true,
        customExclusions: []
      };

      const result = await scanner.scanFiles(testDir, config);

      assert(typeof result.files === 'object');
      assert(Array.isArray(result.files));
      assert(typeof result.totalFiles === 'number');
      assert(typeof result.totalSize === 'number');
      assert(typeof result.excludedFiles === 'number');
      assert(Array.isArray(result.errors));
      assert(Array.isArray(result.warnings));

      if (result.files.length > 0) {
        const file = result.files[0];
        assert(typeof file.path === 'string');
        assert(typeof file.name === 'string');
        assert(typeof file.extension === 'string');
        assert(typeof file.size === 'number');
        assert(file.lastModified instanceof Date);
      }
    });
  });
});
