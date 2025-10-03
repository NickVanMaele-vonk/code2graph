/**
 * Unit tests for AnalysisLogger
 * Tests the logging functionality for code2graph analysis operations
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import * as fsBuiltin from 'node:fs/promises';
import { AnalysisLogger } from '../dist/analyzers/analysis-logger.js';

describe('AnalysisLogger', () => {
  let logger;
  let testRepoUrl;

  beforeEach(async () => {
    testRepoUrl = 'https://github.com/testuser/testrepo';
    logger = new AnalysisLogger(testRepoUrl);
    
    // Root cause fix: Ensure log directory exists before each test
    // This prevents race conditions where afterEach cleanup from previous test
    // might still be running when this test starts
    const logDir = path.dirname(logger.getLogPath());
    await fs.ensureDir(logDir);
  });

  afterEach(async () => {
    // Clean up log files
    const logPath = logger.getLogPath();
    if (await fs.pathExists(logPath)) {
      await fs.remove(logPath);
    }
  });

  describe('Log File Creation', () => {
    test('should create log file with correct name', () => {
      const logPath = logger.getLogPath();
      assert(logPath.includes('testrepo-analysis.log'));
      assert(logPath.includes('log'));
    });

    test('should handle repository URLs with .git suffix', () => {
      const loggerWithGit = new AnalysisLogger('https://github.com/testuser/testrepo.git');
      const logPath = loggerWithGit.getLogPath();
      assert(logPath.includes('testrepo-analysis.log'));
    });

    test('should handle invalid repository URLs gracefully', () => {
      const loggerInvalid = new AnalysisLogger('invalid-url');
      const logPath = loggerInvalid.getLogPath();
      assert(logPath.includes('invalid-url'));
    });
  });

  describe('Logging Operations', () => {
    test('should log info messages', async () => {
      const message = 'Test info message';
      const context = { testKey: 'testValue' };
      
      await logger.logInfo(message, context);
      
      const logPath = logger.getLogPath();
      assert(await fs.pathExists(logPath));
      
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('INFO'));
      assert(logContent.includes(message));
      assert(logContent.includes('testKey'));
      assert(logContent.includes('testValue'));
    });

    test('should log warning messages', async () => {
      const message = 'Test warning message';
      
      await logger.logWarning(message);
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('WARNING'));
      assert(logContent.includes(message));
    });

    test('should log error messages', async () => {
      const message = 'Test error message';
      const context = { errorCode: 500 };
      
      await logger.logError(message, context);
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('ERROR'));
      assert(logContent.includes(message));
      assert(logContent.includes('errorCode'));
    });

    test('should include timestamps in log entries', async () => {
      const message = 'Test timestamp message';
      
      await logger.logInfo(message);
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      
      // Check for ISO timestamp format
      const timestampRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/;
      assert(timestampRegex.test(logContent));
    });

    test('should handle logging without context', async () => {
      const message = 'Test message without context';
      
      // Clear log file to ensure clean test
      const logPath = logger.getLogPath();
      if (await fs.pathExists(logPath)) {
        await fs.remove(logPath);
      }
      
      await logger.logInfo(message);
      
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      
      // Find our specific log entry
      const lines = logContent.split('\n').filter(line => line.trim() !== '');
      const ourEntry = lines.find(line => line.includes(message));
      
            
      // Verify our entry exists and doesn't contain "Context:"
      assert(ourEntry, 'Could not find our log entry');
      assert(ourEntry.includes(message), 'Our entry should contain our message');
      assert(!ourEntry.includes('Context:'), 'Our entry should not contain "Context:"');
    });
  });

  describe('Specialized Logging Methods', () => {
    test('should log analysis start', async () => {
      const repoUrl = 'https://github.com/testuser/testrepo';
      const repoPath = '/path/to/repo';
      
      await logger.logAnalysisStart(repoUrl, repoPath);
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('Analysis started'));
      
      // Parse the log content to safely check for the repository URL
      const logLines = logContent.split('\n');
      const analysisStartLine = logLines.find(line => line.includes('Analysis started'));
      assert(analysisStartLine, 'Analysis start log entry not found');
      
      // Check that the log entry contains the expected repository URL in the context
      assert(analysisStartLine.includes('"repositoryUrl":"https://github.com/testuser/testrepo"'), 'Repository URL not found in log context');
      assert(analysisStartLine.includes('"repositoryPath":"/path/to/repo"'), 'Repository path not found in log context');
    });

    test('should log analysis completion', async () => {
      const summary = {
        filesFound: 100,
        totalSize: 1024000,
        errors: 0,
        warnings: 2
      };
      
      await logger.logAnalysisComplete(summary);
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      
      // Find our specific log entry
      const lines = logContent.split('\n').filter(line => line.trim() !== '');
      const ourEntry = lines.find(line => line.includes('Analysis completed'));
      
      // Verify our entry exists and contains expected content
      assert(ourEntry, 'Could not find our log entry');
      assert(ourEntry.includes('Analysis completed'), 'Our entry should contain "Analysis completed"');
      assert(ourEntry.includes('filesFound'), 'Our entry should contain "filesFound"');
      assert(ourEntry.includes('100'), 'Our entry should contain "100"');
    });

    test('should log scan progress', async () => {
      await logger.logScanProgress(50, 100, 'test-file.ts');
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('File scanning progress'));
      assert(logContent.includes('50/100'));
      assert(logContent.includes('test-file.ts'));
    });

    test('should log memory usage', async () => {
      const memoryInfo = {
        used: 1024000,
        total: 2048000,
        percentage: 50
      };
      
      await logger.logMemoryUsage(memoryInfo);
      
      const logPath = logger.getLogPath();
      assert(await fs.pathExists(logPath));
      
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('Memory usage'));
      assert(logContent.includes('1024000'));
    });

    test('should log configuration', async () => {
      const config = {
        includePatterns: ['**/*.ts', '**/*.tsx'],
        maxFileSize: 10485760
      };
      
      await logger.logConfiguration(config);
      
      const logPath = logger.getLogPath();
      const logContent = await fsBuiltin.readFile(logPath, 'utf-8');
      assert(logContent.includes('Configuration loaded'));
      assert(logContent.includes('includePatterns'));
    });
  });

  describe('Error Handling', () => {
    test('should handle log file write errors gracefully', async () => {
      // Create a logger with an invalid path to force write errors
      const invalidLogger = new AnalysisLogger('test');
      // Mock the log path to an invalid location
      invalidLogger.getLogPath = () => '/invalid/path/that/does/not/exist/logfile.log';
      
      // Should not throw an error
      await assert.doesNotReject(
        invalidLogger.logInfo('Test message')
      );
    });
  });
});
