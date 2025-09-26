/**
 * Unit tests for AST Parser
 * Tests the AST parsing functionality and informative element detection
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ASTParserImpl } from '../dist/analyzers/ast-parser.js';
import { AnalysisLogger } from '../dist/analyzers/analysis-logger.js';

describe('AST Parser', () => {
  let parser;
  let tempDir;
  let logger;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(os.tmpdir(), 'code2graph-ast-test');
    await fs.ensureDir(tempDir);
    
    // Initialize logger and parser
    logger = new AnalysisLogger('test-repo');
    parser = new ASTParserImpl(logger);
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('parseFile', () => {
    it('should parse a simple TypeScript file', async () => {
      const testFile = path.join(tempDir, 'test.ts');
      const content = `
        import React from 'react';
        export const MyComponent = () => {
          return <div>Hello World</div>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      
      assert.ok(ast);
      assert.strictEqual(ast.type, 'File');
      assert.ok(ast.program);
    });

    it('should parse a JSX file', async () => {
      const testFile = path.join(tempDir, 'test.tsx');
      const content = `
        import React, { useState } from 'react';
        
        interface Props {
          name: string;
        }
        
        export const MyComponent: React.FC<Props> = ({ name }) => {
          const [count, setCount] = useState(0);
          
          return (
            <div>
              <h1>Hello {name}</h1>
              <button onClick={() => setCount(count + 1)}>
                Count: {count}
              </button>
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      
      assert.ok(ast);
      assert.strictEqual(ast.type, 'File');
    });

    it('should handle parsing errors gracefully', async () => {
      const testFile = path.join(tempDir, 'invalid.ts');
      const content = `
        import React from 'react';
        export const MyComponent = () => {
          return <div>Hello World</div>; // Missing closing brace
        ;
      `;
      await fs.writeFile(testFile, content);

      try {
        await parser.parseFile(testFile);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to parse file'));
        assert.strictEqual(error.type, 'syntax');
      }
    });
  });

  describe('extractImports', () => {
    it('should extract default imports', async () => {
      const testFile = path.join(tempDir, 'imports.ts');
      const content = `
        import React from 'react';
        import Component from './Component';
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const imports = parser.extractImports(ast);

      assert.strictEqual(imports.length, 2);
      assert.strictEqual(imports[0].source, 'react');
      assert.strictEqual(imports[0].defaultImport, 'React');
      assert.strictEqual(imports[1].source, './Component');
      assert.strictEqual(imports[1].defaultImport, 'Component');
    });

    it('should extract named imports', async () => {
      const testFile = path.join(tempDir, 'named-imports.ts');
      const content = `
        import { useState, useEffect } from 'react';
        import { Component, Button } from './components';
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const imports = parser.extractImports(ast);

      assert.strictEqual(imports.length, 2);
      assert.strictEqual(imports[0].source, 'react');
      assert.strictEqual(imports[0].specifiers.length, 2);
      assert.strictEqual(imports[0].specifiers[0].name, 'useState');
      assert.strictEqual(imports[0].specifiers[0].type, 'named');
    });

    it('should extract namespace imports', async () => {
      const testFile = path.join(tempDir, 'namespace-imports.ts');
      const content = `
        import * as React from 'react';
        import * as Utils from './utils';
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const imports = parser.extractImports(ast);

      assert.strictEqual(imports.length, 2);
      assert.strictEqual(imports[0].source, 'react');
      assert.strictEqual(imports[0].namespaceImport, 'React');
    });
  });

  describe('extractExports', () => {
    it('should extract default exports', async () => {
      const testFile = path.join(tempDir, 'default-export.ts');
      const content = `
        export default function MyComponent() {
          return <div>Hello</div>;
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const exports = parser.extractExports(ast);

      assert.strictEqual(exports.length, 1);
      assert.strictEqual(exports[0].type, 'default');
      assert.strictEqual(exports[0].name, 'MyComponent');
    });

    it('should extract named exports', async () => {
      const testFile = path.join(tempDir, 'named-export.ts');
      const content = `
        export const MyComponent = () => <div>Hello</div>;
        export function AnotherComponent() {
          return <span>World</span>;
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const exports = parser.extractExports(ast);

      assert.strictEqual(exports.length, 2);
      assert.strictEqual(exports[0].type, 'named');
      assert.strictEqual(exports[1].type, 'named');
    });
  });

  describe('extractJSXElements', () => {
    it('should extract JSX elements', async () => {
      const testFile = path.join(tempDir, 'jsx-elements.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <div className="container">
              <h1>Title</h1>
              <button onClick={() => {}}>Click me</button>
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const jsxElements = parser.extractJSXElements(ast);

      assert.ok(jsxElements.length > 0);
      
      const divElement = jsxElements.find(el => el.name === 'div');
      assert.ok(divElement);
      assert.strictEqual(divElement.type, 'element');
      assert.ok(divElement.hasEventHandlers || divElement.hasDataBinding);
    });

    it('should detect event handlers in JSX elements', async () => {
      const testFile = path.join(tempDir, 'event-handlers.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <div>
              <button onClick={() => {}}>Click</button>
              <input onChange={() => {}} />
              <form onSubmit={() => {}} />
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const jsxElements = parser.extractJSXElements(ast);

      const buttonElement = jsxElements.find(el => el.name === 'button');
      assert.ok(buttonElement);
      assert.strictEqual(buttonElement.hasEventHandlers, true);
    });
  });

  describe('extractInformativeElements', () => {
    it('should detect display elements with data binding', async () => {
      const testFile = path.join(tempDir, 'display-elements.tsx');
      const content = `
        import React, { useState } from 'react';
        
        export const MyComponent = () => {
          const [name, setName] = useState('John');
          
          return (
            <div>
              <h1>Hello {name}</h1>
              <p>Count: {count}</p>
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const displayElements = informativeElements.filter(el => el.type === 'display');
      assert.ok(displayElements.length > 0);
    });

    it('should detect input elements with event handlers', async () => {
      const testFile = path.join(tempDir, 'input-elements.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          const handleClick = () => {};
          const handleChange = () => {};
          
          return (
            <div>
              <button onClick={handleClick}>Click me</button>
              <input onChange={handleChange} />
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const inputElements = informativeElements.filter(el => el.type === 'input');
      assert.ok(inputElements.length > 0);
    });

    it('should detect data sources (API calls)', async () => {
      const testFile = path.join(tempDir, 'data-sources.ts');
      const content = `
        export const fetchData = async () => {
          const response = await fetch('/api/data');
          return response.json();
        };
        
        export const getUsers = () => {
          return axios.get('/api/users');
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const dataSources = informativeElements.filter(el => el.type === 'data-source');
      assert.ok(dataSources.length > 0);
    });

    it('should detect state management (useState)', async () => {
      const testFile = path.join(tempDir, 'state-management.tsx');
      const content = `
        import React, { useState, useReducer } from 'react';
        
        export const MyComponent = () => {
          const [count, setCount] = useState(0);
          const [state, dispatch] = useReducer(reducer, initialState);
          
          return <div>Count: {count}</div>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const stateElements = informativeElements.filter(el => el.type === 'state-management');
      assert.ok(stateElements.length > 0);
    });
  });

  describe('findASTNodeTypes', () => {
    it('should find specific node types', async () => {
      const testFile = path.join(tempDir, 'node-types.tsx');
      const content = `
        import React, { useState } from 'react';
        
        export const MyComponent = () => {
          const [count, setCount] = useState(0);
          
          return (
            <div>
              <button onClick={() => setCount(count + 1)}>
                Count: {count}
              </button>
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const jsxElements = parser.findASTNodeTypes(ast, ['JSXElement']);
      const callExpressions = parser.findASTNodeTypes(ast, ['CallExpression']);

      assert.ok(jsxElements.length > 0);
      assert.ok(callExpressions.length > 0);
    });
  });

  describe('isInformativeElement', () => {
    it('should identify informative JSX elements', async () => {
      const testFile = path.join(tempDir, 'informative-check.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <div>
              <button onClick={() => {}}>Click me</button>
              <span>Static text</span>
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const jsxElements = parser.findASTNodeTypes(ast, ['JSXElement']);

      const buttonElement = jsxElements.find(el => el.openingElement?.name?.name === 'button');
      const spanElement = jsxElements.find(el => el.openingElement?.name?.name === 'span');

      assert.strictEqual(parser.isInformativeElement(buttonElement), true);
      assert.strictEqual(parser.isInformativeElement(spanElement), false);
    });
  });

  describe('error handling', () => {
    it('should handle non-existent files', async () => {
      const nonExistentFile = path.join(tempDir, 'non-existent.ts');

      try {
        await parser.parseFile(nonExistentFile);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to parse file'));
      }
    });

    it('should handle empty files', async () => {
      const emptyFile = path.join(tempDir, 'empty.ts');
      await fs.writeFile(emptyFile, '');

      try {
        await parser.parseFile(emptyFile);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.message.includes('Failed to parse file'));
      }
    });
  });
});
