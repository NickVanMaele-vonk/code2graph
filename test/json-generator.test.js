/**
 * JSON Generator Tests
 * Comprehensive test suite for JSON output generation
 * Tests all methods and edge cases for the JSONGeneratorImpl class
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { JSONGeneratorImpl } from '../dist/generators/json-generator.js';

// Get current directory for test file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('JSONGeneratorImpl', () => {
  let jsonGenerator;
  let testOutputDir;

  // Sample dependency graph for testing
  const createSampleGraph = () => ({
    nodes: [
      {
        id: 'node1',
        label: 'ComponentA',
        nodeType: 'function',
        nodeCategory: 'front end',
        datatype: 'array',
        liveCodeScore: 100,
        file: '/src/components/ComponentA.tsx',
        line: 10,
        column: 5,
        properties: {}
      },
      {
        id: 'node2',
        label: 'UnusedComponent',
        nodeType: 'function',
        nodeCategory: 'front end',
        datatype: 'object',
        liveCodeScore: 0,
        file: '/src/components/UnusedComponent.tsx',
        line: 15,
        column: 0,
        properties: {}
      },
      {
        id: 'node3',
        label: 'api/users',
        nodeType: 'API',
        nodeCategory: 'middleware',
        datatype: 'array',
        liveCodeScore: 100,
        file: '/src/api/users.ts',
        line: 20,
        properties: {}
      }
    ],
    edges: [
      {
        id: 'edge1',
        source: 'node1',
        target: 'node3',
        relationship: 'calls',
        properties: {}
      }
    ],
    metadata: {
      version: '1.0.0',
      timestamp: '2024-01-01T00:00:00.000Z',
      repositoryUrl: 'https://github.com/test/repo',
      analysisScope: {
        includedTypes: ['tsx', 'ts', 'jsx', 'js'],
        excludedTypes: ['test', 'spec']
      },
      statistics: {
        linesOfCode: 1000,
        totalNodes: 3,
        totalEdges: 1,
        deadCodeNodes: 1,
        liveCodeNodes: 2
      }
    }
  });

  // Sample dead code information for testing
  const createSampleDeadCode = () => [
    {
      id: 'dead1',
      name: 'UnusedComponent',
      type: 'component',
      file: '/src/components/UnusedComponent.tsx',
      line: 15,
      column: 0,
      reason: 'no_incoming_edges',
      confidence: 95,
      suggestions: ['Remove this component as it is not used anywhere'],
      impact: 'high'
    },
    {
      id: 'dead2',
      name: 'unusedFunction',
      type: 'function',
      file: '/src/utils/helpers.ts',
      line: 42,
      reason: 'unused',
      confidence: 90,
      suggestions: ['Remove this function'],
      impact: 'medium'
    },
    {
      id: 'dead3',
      name: 'api/unused-endpoint',
      type: 'api',
      file: '/src/api/unused.ts',
      line: 10,
      reason: 'no_incoming_edges',
      confidence: 85,
      suggestions: ['Remove this API endpoint'],
      impact: 'low'
    }
  ];

  beforeEach(async () => {
    jsonGenerator = new JSONGeneratorImpl();
    testOutputDir = path.join(__dirname, 'test-output-json-generator');
    await fs.ensureDir(testOutputDir);
  });

  afterEach(async () => {
    // Clean up test output directory
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  describe('generateGraph', () => {
    it('should generate valid JSON output from dependency graph', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      assert.ok(jsonOutput, 'JSON output should exist');
      assert.equal(jsonOutput.version, '1.0.0', 'Version should match');
      assert.ok(jsonOutput.timestamp, 'Timestamp should exist');
      assert.equal(jsonOutput.repositoryUrl, graph.metadata.repositoryUrl, 'Repository URL should match');
      assert.deepEqual(jsonOutput.analysisScope, graph.metadata.analysisScope, 'Analysis scope should match');
    });

    it('should include all nodes in the output', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      assert.equal(jsonOutput.graph.nodes.length, 3, 'Should have 3 nodes');
      assert.deepEqual(jsonOutput.graph.nodes, graph.nodes, 'Nodes should match input');
    });

    it('should include all edges in the output', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      assert.equal(jsonOutput.graph.edges.length, 1, 'Should have 1 edge');
      assert.deepEqual(jsonOutput.graph.edges, graph.edges, 'Edges should match input');
    });

    it('should include correct statistics', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      assert.equal(jsonOutput.statistics.totalNodes, 3, 'Total nodes should be 3');
      assert.equal(jsonOutput.statistics.totalEdges, 1, 'Total edges should be 1');
      assert.equal(jsonOutput.statistics.deadCodeNodes, 1, 'Dead code nodes should be 1');
      assert.equal(jsonOutput.statistics.liveCodeNodes, 2, 'Live code nodes should be 2');
      assert.equal(jsonOutput.statistics.linesOfCode, 1000, 'Lines of code should be 1000');
    });

    it('should calculate dead code percentage correctly', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      const expectedPercentage = Math.round((1 / 3) * 100); // 1 dead node out of 3 total
      assert.equal(jsonOutput.statistics.deadCodePercentage, expectedPercentage, 'Dead code percentage should be correct');
    });

    it('should handle empty graph', () => {
      const emptyGraph = {
        nodes: [],
        edges: [],
        metadata: {
          version: '1.0.0',
          timestamp: '2024-01-01T00:00:00.000Z',
          repositoryUrl: 'https://github.com/test/empty',
          analysisScope: {
            includedTypes: ['tsx'],
            excludedTypes: ['test']
          },
          statistics: {
            linesOfCode: 0,
            totalNodes: 0,
            totalEdges: 0,
            deadCodeNodes: 0,
            liveCodeNodes: 0
          }
        }
      };

      const jsonOutput = jsonGenerator.generateGraph(emptyGraph);

      assert.ok(jsonOutput, 'JSON output should exist for empty graph');
      assert.equal(jsonOutput.graph.nodes.length, 0, 'Should have 0 nodes');
      assert.equal(jsonOutput.graph.edges.length, 0, 'Should have 0 edges');
      assert.equal(jsonOutput.statistics.deadCodePercentage, 0, 'Dead code percentage should be 0 for empty graph');
    });

    it('should throw error for invalid graph', () => {
      assert.throws(
        () => jsonGenerator.generateGraph(null),
        /JSON generation failed/,
        'Should throw error for null graph'
      );
    });
  });

  describe('generateDeadCodeReport', () => {
    it('should generate valid dead code report', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      assert.ok(report, 'Dead code report should exist');
      assert.equal(report.version, '1.0.0', 'Version should match');
      assert.ok(report.timestamp, 'Timestamp should exist');
      assert.equal(report.repositoryUrl, 'https://github.com/test/repo', 'Repository URL should match');
    });

    it('should include correct summary statistics', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      assert.equal(report.summary.totalDeadCodeItems, 3, 'Total dead code items should be 3');
      assert.equal(report.summary.impactDistribution.high, 1, 'High impact items should be 1');
      assert.equal(report.summary.impactDistribution.medium, 1, 'Medium impact items should be 1');
      assert.equal(report.summary.impactDistribution.low, 1, 'Low impact items should be 1');
    });

    it('should include all dead code items', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      assert.equal(report.deadCodeItems.length, 3, 'Should have 3 dead code items');
      assert.deepEqual(report.deadCodeItems, deadCode, 'Dead code items should match input');
    });

    it('should generate recommendations', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      assert.ok(Array.isArray(report.recommendations), 'Recommendations should be an array');
      assert.ok(report.recommendations.length > 0, 'Should have recommendations');
    });

    it('should generate recommendations for high impact items', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      const hasHighImpactRecommendation = report.recommendations.some(r =>
        r.includes('high-impact')
      );
      assert.ok(hasHighImpactRecommendation, 'Should have high impact recommendation');
    });

    it('should generate type-specific recommendations', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      const hasComponentRecommendation = report.recommendations.some(r =>
        r.includes('component')
      );
      const hasFunctionRecommendation = report.recommendations.some(r =>
        r.includes('function')
      );
      const hasAPIRecommendation = report.recommendations.some(r =>
        r.includes('API')
      );

      assert.ok(hasComponentRecommendation, 'Should have component recommendation');
      assert.ok(hasFunctionRecommendation, 'Should have function recommendation');
      assert.ok(hasAPIRecommendation, 'Should have API recommendation');
    });

    it('should handle empty dead code array', () => {
      const report = jsonGenerator.generateDeadCodeReport([], 'https://github.com/test/repo');

      assert.ok(report, 'Report should exist for empty dead code');
      assert.equal(report.summary.totalDeadCodeItems, 0, 'Total items should be 0');
      assert.ok(report.recommendations.length > 0, 'Should have positive feedback recommendation');
      assert.ok(
        report.recommendations.some(r => r.includes('No dead code detected')),
        'Should have no dead code message'
      );
    });

    it('should throw error for invalid input', () => {
      assert.throws(
        () => jsonGenerator.generateDeadCodeReport(null, 'https://github.com/test/repo'),
        /Dead code report generation failed/,
        'Should throw error for null dead code'
      );
    });
  });

  describe('exportToFile', () => {
    it('should export JSON output to file', async () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);
      const filePath = path.join(testOutputDir, 'test-output.json');

      await jsonGenerator.exportToFile(jsonOutput, filePath);

      const fileExists = await fs.pathExists(filePath);
      assert.ok(fileExists, 'Output file should exist');

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedContent = JSON.parse(fileContent);

      assert.deepEqual(parsedContent, jsonOutput, 'File content should match output');
    });

    it('should export dead code report to file', async () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');
      const filePath = path.join(testOutputDir, 'dead-code-report.json');

      await jsonGenerator.exportToFile(report, filePath);

      const fileExists = await fs.pathExists(filePath);
      assert.ok(fileExists, 'Report file should exist');

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedContent = JSON.parse(fileContent);

      assert.deepEqual(parsedContent, report, 'File content should match report');
    });

    it('should create output directory if it does not exist', async () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);
      const nestedDir = path.join(testOutputDir, 'nested', 'deep', 'path');
      const filePath = path.join(nestedDir, 'output.json');

      await jsonGenerator.exportToFile(jsonOutput, filePath);

      const dirExists = await fs.pathExists(nestedDir);
      const fileExists = await fs.pathExists(filePath);

      assert.ok(dirExists, 'Nested directory should be created');
      assert.ok(fileExists, 'Output file should exist in nested directory');
    });

    it('should format JSON with proper indentation', async () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);
      const filePath = path.join(testOutputDir, 'formatted-output.json');

      await jsonGenerator.exportToFile(jsonOutput, filePath);

      const fileContent = await fs.readFile(filePath, 'utf-8');

      assert.ok(fileContent.includes('\n'), 'File should have newlines');
      assert.ok(fileContent.includes('  '), 'File should have indentation');
    });

    it('should throw error for invalid file path', async () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);
      const invalidPath = '';

      await assert.rejects(
        async () => jsonGenerator.exportToFile(jsonOutput, invalidPath),
        /JSON export failed/,
        'Should throw error for invalid path'
      );
    });

    it('should validate data before exporting', async () => {
      const invalidData = { version: '1.0.0' }; // Missing required fields
      const filePath = path.join(testOutputDir, 'invalid-output.json');

      await assert.rejects(
        async () => jsonGenerator.exportToFile(invalidData, filePath),
        /Output validation failed/,
        'Should throw error for invalid data'
      );
    });
  });

  describe('validateOutput', () => {
    it('should validate valid JSON output', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      const result = jsonGenerator.validateOutput(jsonOutput);

      assert.ok(result.isValid, 'Valid output should pass validation');
      assert.equal(result.errors.length, 0, 'Should have no errors');
    });

    it('should validate valid dead code report', () => {
      const deadCode = createSampleDeadCode();
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');

      const result = jsonGenerator.validateOutput(report);

      assert.ok(result.isValid, 'Valid report should pass validation');
      assert.equal(result.errors.length, 0, 'Should have no errors');
    });

    it('should detect missing version', () => {
      const invalidOutput = {
        timestamp: '2024-01-01T00:00:00.000Z',
        repositoryUrl: 'https://github.com/test/repo',
        graph: { nodes: [], edges: [] },
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(invalidOutput);

      assert.ok(!result.isValid, 'Should fail validation');
      assert.ok(
        result.errors.some(e => e.message.includes('version')),
        'Should have version error'
      );
    });

    it('should detect missing timestamp', () => {
      const invalidOutput = {
        version: '1.0.0',
        repositoryUrl: 'https://github.com/test/repo',
        graph: { nodes: [], edges: [] },
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(invalidOutput);

      assert.ok(!result.isValid, 'Should fail validation');
      assert.ok(
        result.errors.some(e => e.message.includes('timestamp')),
        'Should have timestamp error'
      );
    });

    it('should detect missing graph', () => {
      const invalidOutput = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        repositoryUrl: 'https://github.com/test/repo',
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(invalidOutput);

      assert.ok(!result.isValid, 'Should fail validation');
      assert.ok(
        result.errors.some(e => e.message.includes('graph')),
        'Should have graph error'
      );
    });

    it('should detect invalid nodes array', () => {
      const invalidOutput = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        repositoryUrl: 'https://github.com/test/repo',
        graph: { nodes: 'not-an-array', edges: [] },
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(invalidOutput);

      assert.ok(!result.isValid, 'Should fail validation');
      assert.ok(
        result.errors.some(e => e.message.includes('nodes')),
        'Should have nodes error'
      );
    });

    it('should detect missing node id', () => {
      const invalidOutput = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        repositoryUrl: 'https://github.com/test/repo',
        graph: {
          nodes: [{ label: 'test' }], // Missing id
          edges: []
        },
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(invalidOutput);

      assert.ok(!result.isValid, 'Should fail validation');
      assert.ok(
        result.errors.some(e => e.message.includes('id')),
        'Should have id error'
      );
    });

    it('should detect missing edge source/target', () => {
      const invalidOutput = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        repositoryUrl: 'https://github.com/test/repo',
        graph: {
          nodes: [],
          edges: [{ id: 'edge1' }] // Missing source and target
        },
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(invalidOutput);

      assert.ok(!result.isValid, 'Should fail validation');
      assert.ok(
        result.errors.some(e => e.message.includes('source') || e.message.includes('target')),
        'Should have source/target error'
      );
    });

    it('should handle null data', () => {
      const result = jsonGenerator.validateOutput(null);

      assert.ok(!result.isValid, 'Should fail validation for null');
      assert.ok(
        result.errors.some(e => e.message.includes('null or undefined')),
        'Should have null error'
      );
    });

    it('should generate warnings for missing optional fields', () => {
      const outputWithWarnings = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        repositoryUrl: '', // Empty repository URL
        graph: {
          nodes: [{ id: 'node1' }], // Missing label and liveCodeScore
          edges: []
        },
        statistics: {},
        analysisScope: { includedTypes: [], excludedTypes: [] }
      };

      const result = jsonGenerator.validateOutput(outputWithWarnings);

      assert.ok(result.warnings.length > 0, 'Should have warnings');
    });
  });

  describe('formatOutput', () => {
    it('should format output with default indentation', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      const formatted = jsonGenerator.formatOutput(jsonOutput);

      assert.ok(formatted.includes('\n'), 'Should have newlines');
      assert.ok(formatted.includes('  '), 'Should have 2-space indentation');
    });

    it('should format output with custom indentation', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      const formatted = jsonGenerator.formatOutput(jsonOutput, { indent: 4 });

      assert.ok(formatted.includes('    '), 'Should have 4-space indentation');
    });

    it('should format output in compact mode', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      const formatted = jsonGenerator.formatOutput(jsonOutput, { compact: true });

      // Compact mode should have fewer newlines
      const compactNewlines = (formatted.match(/\n/g) || []).length;
      const normalFormatted = jsonGenerator.formatOutput(jsonOutput);
      const normalNewlines = (normalFormatted.match(/\n/g) || []).length;

      assert.ok(compactNewlines < normalNewlines, 'Compact mode should have fewer newlines');
    });

    it('should produce valid JSON string', () => {
      const graph = createSampleGraph();
      const jsonOutput = jsonGenerator.generateGraph(graph);

      const formatted = jsonGenerator.formatOutput(jsonOutput);

      assert.doesNotThrow(() => {
        JSON.parse(formatted);
      }, 'Formatted output should be valid JSON');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full workflow: generate -> validate -> export', async () => {
      const graph = createSampleGraph();

      // Generate JSON output
      const jsonOutput = jsonGenerator.generateGraph(graph);
      assert.ok(jsonOutput, 'JSON output should be generated');

      // Validate output
      const validation = jsonGenerator.validateOutput(jsonOutput);
      assert.ok(validation.isValid, 'Output should be valid');

      // Export to file
      const filePath = path.join(testOutputDir, 'workflow-test.json');
      await jsonGenerator.exportToFile(jsonOutput, filePath);

      // Verify file exists and is valid
      const fileExists = await fs.pathExists(filePath);
      assert.ok(fileExists, 'File should exist');

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedContent = JSON.parse(fileContent);
      assert.deepEqual(parsedContent, jsonOutput, 'File content should match output');
    });

    it('should handle complete dead code workflow', async () => {
      const deadCode = createSampleDeadCode();

      // Generate report
      const report = jsonGenerator.generateDeadCodeReport(deadCode, 'https://github.com/test/repo');
      assert.ok(report, 'Report should be generated');

      // Validate report
      const validation = jsonGenerator.validateOutput(report);
      assert.ok(validation.isValid, 'Report should be valid');

      // Export to file
      const filePath = path.join(testOutputDir, 'dead-code-workflow-test.json');
      await jsonGenerator.exportToFile(report, filePath);

      // Verify file
      const fileExists = await fs.pathExists(filePath);
      assert.ok(fileExists, 'File should exist');
    });
  });
});

