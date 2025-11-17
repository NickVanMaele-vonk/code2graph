/**
 * Integration Tests for code2graph
 * Tests the complete analysis pipeline from React components to dependency graphs
 * Verifies key functionality works end-to-end
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ASTParserImpl } from '../dist/analyzers/ast-parser.js';
import { DependencyAnalyzerImpl } from '../dist/analyzers/dependency-analyser.js';
import { AnalysisLogger } from '../dist/analyzers/analysis-logger.js';

describe('Integration Tests - Full Stack Analysis', () => {
  let tempDir;
  let parser;
  let analyzer;
  let logger;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'code2graph-integration-test');
    await fs.ensureDir(tempDir);

    logger = new AnalysisLogger('integration-test');
    parser = new ASTParserImpl(logger);
    analyzer = new DependencyAnalyzerImpl(logger);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Basic Component Analysis', () => {
    it('should parse and analyze a simple React component', async () => {
      const componentCode = `
import React, { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={increment} aria-label="Increment">
        Increment
      </button>
    </div>
  );
}
`;

      const filePath = path.join(tempDir, 'Counter.tsx');
      await fs.writeFile(filePath, componentCode);

      // Parse the file
      const ast = await parser.parseFile(filePath);
      assert.ok(ast, 'AST should be parsed');

      // Extract component definitions
      const componentDefs = parser.extractComponentDefinitions(ast, filePath);
      assert.strictEqual(componentDefs.length, 1, 'Should find 1 component');
      assert.strictEqual(componentDefs[0].name, 'Counter');
      assert.strictEqual(componentDefs[0].type, 'functional');
      assert.strictEqual(componentDefs[0].isExported, true);

      // Extract informative elements
      const informativeElements = parser.extractInformativeElements(ast, filePath);
      assert.ok(informativeElements.length > 0, 'Should find informative elements');

      //Find button with event handler
      const buttonElement = informativeElements.find(el =>
        el.eventHandlers && el.eventHandlers.length > 0 &&
        el.eventHandlers.some(h => h.name === 'onClick')
      );
      assert.ok(buttonElement, 'Should find button with onClick handler');
      assert.strictEqual(buttonElement.hasSemanticIdentifier, true, 'Button should have semantic identifier');
      assert.strictEqual(buttonElement.semanticIdentifier, 'Increment');

      console.log('\n✅ Basic component analysis verified');
      console.log(`   Component: ${componentDefs[0].name}`);
      console.log(`   Informative elements: ${informativeElements.length}`);
      console.log(`   Button semantic ID: ${buttonElement.semanticIdentifier}`);
    });
  });

  describe('Semantic Identifier Filtering', () => {
    it('should correctly identify elements with and without semantic identifiers', async () => {
      const componentCode = `
import React from 'react';

export function TestComponent() {
  const handleClick = () => console.log('clicked');

  return (
    <div>
      <button onClick={handleClick} aria-label="Save">Save</button>
      <div onClick={handleClick}>Click me</div>
      <button onClick={handleClick}>Submit</button>
    </div>
  );
}
`;

      const filePath = path.join(tempDir, 'TestComponent.tsx');
      await fs.writeFile(filePath, componentCode);

      const ast = await parser.parseFile(filePath);
      const informativeElements = parser.extractInformativeElements(ast, filePath);

      // Count elements with semantic identifiers
      const withSemanticID = informativeElements.filter(el => el.hasSemanticIdentifier === true);
      const withoutSemanticID = informativeElements.filter(el => el.hasSemanticIdentifier === false);

      assert.ok(withSemanticID.length >= 2, 'Should have at least 2 elements with semantic IDs (aria-label and text content)');
      assert.ok(withoutSemanticID.length >= 1, 'Should have at least 1 element without semantic ID (plain div)');

      console.log('\n✅ Semantic filtering verified');
      console.log(`   With semantic IDs: ${withSemanticID.length}`);
      console.log(`   Without semantic IDs: ${withoutSemanticID.length}`);
    });
  });

  describe('Import Extraction', () => {
    it('should extract imports from components', async () => {
      const componentCode = `
import React, { useState, useEffect } from 'react';
import { Button } from './components/Button';
import styles from './styles.module.css';

export function App() {
  return <div>App</div>;
}
`;

      const filePath = path.join(tempDir, 'App.tsx');
      await fs.writeFile(filePath, componentCode);

      const ast = await parser.parseFile(filePath);
      const imports = parser.extractImports(ast);

      assert.ok(imports.length >= 3, 'Should extract at least 3 imports');

      const reactImport = imports.find(imp => imp.source === 'react');
      assert.ok(reactImport, 'Should find React import');
      assert.ok(reactImport.specifiers.length >= 3, 'React import should have multiple specifiers');

      console.log('\n✅ Import extraction verified');
      console.log(`   Total imports: ${imports.length}`);
      console.log(`   React specifiers: ${reactImport.specifiers.length}`);
    });
  });

  describe('Dependency Graph Building', () => {
    it('should build a dependency graph from component info', async () => {
      const componentCode = `
import React from 'react';

export function SimpleApp() {
  const handleClick = () => {};

  return (
    <div>
      <button onClick={handleClick} aria-label="Click">Click</button>
    </div>
  );
}
`;

      const filePath = path.join(tempDir, 'SimpleApp.tsx');
      await fs.writeFile(filePath, componentCode);

      const ast = await parser.parseFile(filePath);
      const componentDefs = parser.extractComponentDefinitions(ast, filePath);
      const informativeElements = parser.extractInformativeElements(ast, filePath);
      const imports = parser.extractImports(ast);
      const exports = parser.extractExports(ast);

      const components = componentDefs.map(comp => ({
        ...comp,
        props: [],
        state: [],
        hooks: [],
        children: [],
        informativeElements: informativeElements.filter(
          el => el.parentComponent === comp.name
        ),
        imports,
        exports
      }));

      const graph = analyzer.buildDependencyGraph(components);

      // Basic graph structure verification
      assert.ok(graph, 'Graph should be created');
      assert.ok(graph.nodes, 'Graph should have nodes array');
      assert.ok(graph.edges, 'Graph should have edges array');
      assert.ok(graph.metadata, 'Graph should have metadata');

      assert.ok(graph.nodes.length > 0, 'Graph should have at least one node');

      // Find component node
      const componentNode = graph.nodes.find(n => n.label === 'SimpleApp');
      assert.ok(componentNode, 'Should find SimpleApp component node');
      assert.strictEqual(componentNode.nodeType, 'function');

      console.log('\n✅ Dependency graph building verified');
      console.log(`   Nodes: ${graph.nodes.length}`);
      console.log(`   Edges: ${graph.edges.length}`);
      console.log(`   Component node: ${componentNode.label}`);
    });
  });

  describe('Live Code Score Calculation', () => {
    it('should calculate live code scores for components', async () => {
      const mainCode = `
import React from 'react';
import { UsedComponent } from './UsedComponent';

export function Main() {
  return <UsedComponent />;
}
`;

      const usedCode = `
import React from 'react';

export function UsedComponent() {
  return <div>Used</div>;
}
`;

      const unusedCode = `
import React from 'react';

export function UnusedComponent() {
  return <div>Never used</div>;
}
`;

      await fs.writeFile(path.join(tempDir, 'Main.tsx'), mainCode);
      await fs.writeFile(path.join(tempDir, 'UsedComponent.tsx'), usedCode);
      await fs.writeFile(path.join(tempDir, 'UnusedComponent.tsx'), unusedCode);

      const components = [];
      for (const file of ['Main.tsx', 'UsedComponent.tsx', 'UnusedComponent.tsx']) {
        const filePath = path.join(tempDir, file);
        const ast = await parser.parseFile(filePath);
        const defs = parser.extractComponentDefinitions(ast, filePath);
        const informativeElements = parser.extractInformativeElements(ast, filePath);
        const imports = parser.extractImports(ast);
        const exports = parser.extractExports(ast);

        components.push(...defs.map(comp => ({
          ...comp,
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: informativeElements.filter(
            el => el.parentComponent === comp.name
          ),
          imports,
          exports
        })));
      }

      const graph = analyzer.buildDependencyGraph(components);

      const usedNode = graph.nodes.find(n => n.label === 'UsedComponent');
      const unusedNode = graph.nodes.find(n => n.label === 'UnusedComponent');

      assert.ok(usedNode, 'Should find UsedComponent node');
      assert.ok(unusedNode, 'Should find UnusedComponent node');

      // Verify scores exist and are numbers
      assert.strictEqual(typeof usedNode.liveCodeScore, 'number');
      assert.strictEqual(typeof unusedNode.liveCodeScore, 'number');

      console.log('\n✅ Live code scores verified');
      console.log(`   UsedComponent score: ${usedNode.liveCodeScore}`);
      console.log(`   UnusedComponent score: ${unusedNode.liveCodeScore}`);
    });
  });
});
