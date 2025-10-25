/**
 * Unit tests for ConfigurationManager
 * Tests the configuration loading and management functionality for code2graph
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs-extra';
import * as fsBuiltin from 'node:fs/promises';
import * as path from 'path';
import { ConfigurationManager } from '../dist/analyzers/configuration-manager.js';

describe('ConfigurationManager', () => {
  let configManager;
  let testConfigDir;
  let globalConfigPath;
  let repoConfigPath;

  beforeEach(() => {
    testConfigDir = path.join(process.cwd(), 'test-temp-config');
    globalConfigPath = path.join(testConfigDir, 'global-config.json');
    repoConfigPath = path.join(testConfigDir, 'repo-config.json');
    
    configManager = new ConfigurationManager(globalConfigPath);
  });

  afterEach(async () => {
    // Clean up test configuration files
    if (await fs.pathExists(testConfigDir)) {
      await fs.remove(testConfigDir);
    }
  });

  describe('Global Configuration Loading', () => {
    test('should load valid global configuration', async () => {
      const validConfig = {
        includePatterns: ['**/*.ts', '**/*.tsx'],
        excludePatterns: ['**/node_modules/**'],
        maxFileSize: 10485760,
        maxFiles: 500,
        timeout: 300000,
        defaultOutputFormat: 'json',
        memoryWarningThreshold: 0.8,
        memoryErrorThreshold: 1.0
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(validConfig, null, 2));

      const result = await configManager.loadGlobalConfig();

      assert(result.isValid);
      assert(result.errors.length === 0);
    });

    test('should validate required fields in global configuration', async () => {
      const invalidConfig = {
        // Missing includePatterns and excludePatterns
        maxFileSize: 10485760
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(invalidConfig, null, 2));

      const result = await configManager.loadGlobalConfig();

      assert(!result.isValid);
      assert(result.errors.length > 0);
      assert(result.errors.some(e => e.message.includes('includePatterns')));
      assert(result.errors.some(e => e.message.includes('excludePatterns')));
    });

    test('should validate numeric values in global configuration', async () => {
      const invalidConfig = {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**'],
        maxFileSize: -1, // Invalid negative value
        maxFiles: 'invalid', // Invalid non-numeric value
        timeout: 0 // Invalid zero value
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(invalidConfig, null, 2));

      const result = await configManager.loadGlobalConfig();

      assert(!result.isValid);
      assert(result.errors.length > 0);
      assert(result.errors.some(e => e.message.includes('maxFileSize')));
      assert(result.errors.some(e => e.message.includes('maxFiles')));
      assert(result.errors.some(e => e.message.includes('timeout')));
    });

    test('should validate output format in global configuration', async () => {
      const invalidConfig = {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**'],
        defaultOutputFormat: 'invalid-format'
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(invalidConfig, null, 2));

      const result = await configManager.loadGlobalConfig();

      assert(!result.isValid);
      assert(result.errors.length > 0);
      assert(result.errors.some(e => e.message.includes('defaultOutputFormat')));
    });

    test('should handle missing global configuration file', async () => {
      const result = await configManager.loadGlobalConfig();

      assert(!result.isValid);
      assert(result.errors.length > 0);
      assert(result.errors[0].message.includes('not found'));
    });

    test('should handle malformed JSON in global configuration', async () => {
      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, 'invalid json content');

      const result = await configManager.loadGlobalConfig();

      assert(!result.isValid);
      assert(result.errors.length > 0);
      assert(result.errors[0].message.includes('Error loading global configuration'));
    });
  });

  describe('Repository Configuration Loading', () => {
    test('should load valid repository configuration', async () => {
      const validRepoConfig = {
        outputFormat: 'json',
        outputPath: './custom-output.json',
        analysisDepth: {
          frontend: true,
          middleware: true,
          database: false
        },
        customPatterns: {
          include: ['**/*.custom.ts'],
          exclude: ['**/temp/**']
        }
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(repoConfigPath, JSON.stringify(validRepoConfig, null, 2));

      const result = await configManager.loadRepoConfig(repoConfigPath);

      assert(result.isValid);
      assert(result.errors.length === 0);
    });

    test('should handle missing repository configuration gracefully', async () => {
      const result = await configManager.loadRepoConfig('/non/existent/config.json');

      assert(result.isValid);
      assert(result.warnings.length > 0);
      assert(result.warnings[0].message.includes('not found'));
    });

    test('should validate repository configuration format', async () => {
      const invalidRepoConfig = {
        outputFormat: 'invalid-format',
        analysisDepth: 'invalid-object'
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(repoConfigPath, JSON.stringify(invalidRepoConfig, null, 2));

      const result = await configManager.loadRepoConfig(repoConfigPath);

      assert(!result.isValid);
      assert(result.errors.length > 0);
      assert(result.errors.some(e => e.message.includes('outputFormat')));
      assert(result.errors.some(e => e.message.includes('analysisDepth')));
    });
  });

  describe('Configuration Merging', () => {
    beforeEach(async () => {
      // Set up valid global configuration
      const globalConfig = {
        includePatterns: ['**/*.ts', '**/*.tsx'],
        excludePatterns: ['**/node_modules/**'],
        maxFileSize: 10485760,
        maxFiles: 500,
        timeout: 300000,
        defaultOutputFormat: 'json'
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2));
      await configManager.loadGlobalConfig();
    });

    test('should merge global and repository configurations', async () => {
      const repoConfig = {
        outputFormat: 'graphml',
        outputPath: './custom-output.graphml',
        customPatterns: {
          include: ['**/*.custom.ts'],
          exclude: ['**/temp/**']
        }
      };

      await fsBuiltin.writeFile(repoConfigPath, JSON.stringify(repoConfig, null, 2));
      await configManager.loadRepoConfig(repoConfigPath);

      const merged = configManager.getMergedConfig();

      assert(merged.outputFormat === 'graphml'); // Repository override
      assert(merged.outputPath === './custom-output.graphml'); // Repository override
      assert(merged.includePatterns.includes('**/*.ts')); // From global
      assert(merged.includePatterns.includes('**/*.custom.ts')); // From repository
      assert(merged.maxFileSize === 10485760); // From global
    });

    test('should use global configuration when no repository config', async () => {
      const merged = configManager.getMergedConfig();

      assert(merged.outputFormat === 'json'); // From global
      // Updated default output path to match new directory structure and naming convention
      assert(merged.outputPath === './graph-data-files/code2graph_<repo-name>.json'); // Default
      assert(merged.includePatterns.length === 2); // From global
      assert(merged.maxFileSize === 10485760); // From global
    });

    test('should throw error when global config not loaded', () => {
      const uninitializedManager = new ConfigurationManager();
      
      assert.throws(() => {
        uninitializedManager.getMergedConfig();
      }, /Global configuration not loaded/);
    });
  });

  describe('File Scan Configuration', () => {
    beforeEach(async () => {
      const globalConfig = {
        includePatterns: ['**/*.ts', '**/*.tsx'],
        excludePatterns: ['**/node_modules/**'],
        maxFileSize: 10485760,
        maxFiles: 500,
        timeout: 300000,
        defaultOutputFormat: 'json'
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2));
      await configManager.loadGlobalConfig();
    });

    test('should generate file scan configuration', () => {
      const fileScanConfig = configManager.getFileScanConfig();

      assert(Array.isArray(fileScanConfig.includePatterns));
      assert(Array.isArray(fileScanConfig.excludePatterns));
      assert(typeof fileScanConfig.maxFileSize === 'number');
      assert(typeof fileScanConfig.maxFiles === 'number');
      assert(typeof fileScanConfig.excludeTestFiles === 'boolean');
      assert(Array.isArray(fileScanConfig.customExclusions));
      assert(fileScanConfig.excludeTestFiles === true);
    });

    test('should include custom exclusions from repository config', async () => {
      const repoConfig = {
        excludeFiles: ['temp', 'cache']
      };

      await fsBuiltin.writeFile(repoConfigPath, JSON.stringify(repoConfig, null, 2));
      await configManager.loadRepoConfig(repoConfigPath);

      const fileScanConfig = configManager.getFileScanConfig();

      assert(fileScanConfig.customExclusions.includes('temp'));
      assert(fileScanConfig.customExclusions.includes('cache'));
    });
  });

  describe('Include/Exclude Dialog Configuration', () => {
    beforeEach(async () => {
      const globalConfig = {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**'],
        maxFileSize: 10485760,
        maxFiles: 500,
        timeout: 300000,
        defaultOutputFormat: 'json'
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2));
      await configManager.loadGlobalConfig();
    });

    test('should generate include/exclude dialog configuration', () => {
      const dialogConfig = configManager.getIncludeExcludeConfig(50000);

      assert(typeof dialogConfig.recommendedLimit === 'number');
      assert(typeof dialogConfig.currentLinesOfCode === 'number');
      assert(typeof dialogConfig.fileTypes === 'object');
      assert(typeof dialogConfig.fileTypes.gitignore === 'boolean');
      assert(typeof dialogConfig.fileTypes.frontend === 'boolean');
      assert(typeof dialogConfig.fileTypes.middleware === 'boolean');
      assert(typeof dialogConfig.fileTypes.database === 'boolean');
      
      assert(dialogConfig.currentLinesOfCode === 50000);
      assert(dialogConfig.fileTypes.frontend === true);
      assert(dialogConfig.fileTypes.middleware === true);
      assert(dialogConfig.fileTypes.database === true);
      assert(dialogConfig.fileTypes.gitignore === false);
    });
  });

  describe('Memory Configuration', () => {
    test('should get memory monitoring configuration', () => {
      const memoryConfig = configManager.getMemoryConfig();

      assert(typeof memoryConfig.warningThreshold === 'number');
      assert(typeof memoryConfig.errorThreshold === 'number');
      assert(memoryConfig.warningThreshold >= 0);
      assert(memoryConfig.warningThreshold <= 1);
      assert(memoryConfig.errorThreshold >= 0);
      assert(memoryConfig.errorThreshold <= 1);
    });

    test('should use custom memory thresholds from global config', async () => {
      const globalConfig = {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**'],
        memoryWarningThreshold: 0.7,
        memoryErrorThreshold: 0.9
      };

      await fs.ensureDir(testConfigDir);
      await fsBuiltin.writeFile(globalConfigPath, JSON.stringify(globalConfig, null, 2));
      await configManager.loadGlobalConfig();

      const memoryConfig = configManager.getMemoryConfig();

      assert(memoryConfig.warningThreshold === 0.7);
      assert(memoryConfig.errorThreshold === 0.9);
    });
  });

  describe('Repository Configuration Template', () => {
    test('should create repository configuration template', async () => {
      const repoUrl = 'https://github.com/testuser/testrepo';
      const templatePath = path.join(testConfigDir, 'template.json');

      await fs.ensureDir(testConfigDir);

      await configManager.createRepoConfigTemplate(repoUrl, templatePath);

      assert(await fs.pathExists(templatePath));

      const templateContent = await fsBuiltin.readFile(templatePath, 'utf-8');
      const template = JSON.parse(templateContent);

      assert(template.repositoryUrl === repoUrl);
      assert(Array.isArray(template.excludeFiles));
      assert(Array.isArray(template.excludeFolders));
      assert(typeof template.analysisDepth === 'object');
      assert(typeof template.customPatterns === 'object');
      assert(typeof template.outputPath === 'string');
    });
  });
});
