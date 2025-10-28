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
    logger = new AnalysisLogger('testrepo');
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

  describe('Semantic Identifier Extraction', () => {
    it('should extract aria-label as semantic identifier', async () => {
      const testFile = path.join(tempDir, 'aria-label-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <button aria-label="Save changes" onClick={() => {}}>
              Save
            </button>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = informativeElements.find(el => el.name === 'button');
      assert.ok(buttonElement, 'Should find button element');
      assert.strictEqual(buttonElement.semanticIdentifier, 'Save changes', 'Should extract aria-label');
      assert.strictEqual(buttonElement.hasSemanticIdentifier, true, 'Should set hasSemanticIdentifier flag');
    });

    it('should extract data-testid as semantic identifier', async () => {
      const testFile = path.join(tempDir, 'data-testid-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <div data-testid="calendar-day" onClick={() => {}}>
              12
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const divElement = informativeElements.find(el => el.name === 'div');
      assert.ok(divElement, 'Should find div element');
      assert.strictEqual(divElement.semanticIdentifier, 'calendar-day', 'Should extract data-testid');
      assert.strictEqual(divElement.hasSemanticIdentifier, true, 'Should set hasSemanticIdentifier flag');
    });

    it('should extract id attribute as semantic identifier', async () => {
      const testFile = path.join(tempDir, 'id-attr-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <button id="submit-btn" onClick={() => {}}>
              Submit
            </button>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = informativeElements.find(el => el.name === 'button');
      assert.ok(buttonElement, 'Should find button element');
      assert.strictEqual(buttonElement.semanticIdentifier, 'submit-btn', 'Should extract id attribute');
      assert.strictEqual(buttonElement.hasSemanticIdentifier, true, 'Should set hasSemanticIdentifier flag');
    });

    it('should prioritize aria-label over data-testid and id', async () => {
      const testFile = path.join(tempDir, 'priority-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <button 
              aria-label="Primary Label"
              data-testid="test-id"
              id="button-id"
              onClick={() => {}}
            >
              Button Text
            </button>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = informativeElements.find(el => el.name === 'button');
      assert.ok(buttonElement, 'Should find button element');
      assert.strictEqual(buttonElement.semanticIdentifier, 'Primary Label', 'Should prioritize aria-label');
    });

    it('should extract text content as fallback semantic identifier', async () => {
      const testFile = path.join(tempDir, 'text-fallback-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <button onClick={() => {}}>Cancel</button>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = informativeElements.find(el => el.name === 'button');
      assert.ok(buttonElement, 'Should find button element');
      assert.strictEqual(buttonElement.semanticIdentifier, 'Cancel', 'Should extract text content as fallback');
      assert.strictEqual(buttonElement.hasSemanticIdentifier, true, 'Should set hasSemanticIdentifier flag');
    });

    it('should return undefined for JSX element without semantic identifiers', async () => {
      const testFile = path.join(tempDir, 'no-semantic-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          const selectDate = () => {};
          return (
            <div onClick={selectDate}>
              <span>Day</span> 12
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const divElement = informativeElements.find(el => el.name === 'div');
      assert.ok(divElement, 'Should find div element');
      assert.strictEqual(divElement.semanticIdentifier, undefined, 'Should not have semantic identifier');
      assert.strictEqual(divElement.hasSemanticIdentifier, false, 'Should not set hasSemanticIdentifier flag');
    });

    it('should not extract long text content (> 30 characters)', async () => {
      const testFile = path.join(tempDir, 'long-text-test.tsx');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return (
            <button onClick={() => {}}>
              This is a very long button text that exceeds the character limit
            </button>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = informativeElements.find(el => el.name === 'button');
      assert.ok(buttonElement, 'Should find button element');
      assert.strictEqual(buttonElement.semanticIdentifier, undefined, 'Should not extract long text');
      assert.strictEqual(buttonElement.hasSemanticIdentifier, false, 'Should not set hasSemanticIdentifier flag');
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

    it('should capture interactive components without explicit handlers (Component Type Recognition)', async () => {
      const testFile = path.join(tempDir, 'interactive-components.tsx');
      const content = `
        import React from 'react';
        import { Button } from '@/components/ui/button';
        import { Dialog, DialogTrigger } from '@/components/ui/dialog';
        
        export const MyComponent = () => {
          return (
            <div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">Mark Attendance</Button>
                </DialogTrigger>
              </Dialog>
              <a href="/home">Go Home</a>
              <input type="text" placeholder="Enter name" />
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const informativeElements = parser.extractInformativeElements(ast, testFile);

      // Should find Button component even without direct event handler
      const buttonElement = informativeElements.find(el => el.name === 'Button');
      assert.ok(buttonElement, 'Should capture Button component without explicit handler');
      assert.strictEqual(buttonElement.type, 'input', 'Button should be classified as input type');

      // Should find anchor tag
      const linkElement = informativeElements.find(el => el.name === 'a');
      assert.ok(linkElement, 'Should capture anchor tag');

      // Should find input element
      const inputElement = informativeElements.find(el => el.name === 'input');
      assert.ok(inputElement, 'Should capture input element');
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

  describe('extractComponentDefinitions', () => {
    it('should extract functional component from arrow function', async () => {
      const testFile = path.join(tempDir, 'arrow-component.tsx');
      const content = `
        import React from 'react';
        export const MyComponent = () => {
          return <div>Hello</div>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].name, 'MyComponent');
      assert.strictEqual(components[0].type, 'functional');
      assert.strictEqual(components[0].isExported, true);
      assert.ok(components[0].line);
      assert.ok(components[0].column !== undefined);
    });

    it('should extract class component', async () => {
      const testFile = path.join(tempDir, 'class-component.tsx');
      const content = `
        import React from 'react';
        export class MainComponent extends React.Component {
          render() {
            return <div>Hello</div>;
          }
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].name, 'MainComponent');
      assert.strictEqual(components[0].type, 'class');
      assert.strictEqual(components[0].isExported, true);
      assert.strictEqual(components[0].extendsComponent, 'React.Component');
    });

    it('should extract multiple components from single file', async () => {
      const testFile = path.join(tempDir, 'multi-component.tsx');
      const content = `
        import React from 'react';
        
        export const FirstComponent = () => {
          return <div>First</div>;
        };
        
        export class SecondComponent extends React.Component {
          render() {
            return <div>Second</div>;
          }
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 2);
      assert.ok(components.find(c => c.name === 'FirstComponent'));
      assert.ok(components.find(c => c.name === 'SecondComponent'));
    });

    it('should not extract non-component functions', async () => {
      const testFile = path.join(tempDir, 'utility.ts');
      const content = `
        export const myHelper = () => {
          return 'hello';
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 0);
    });

    // Phase B Tests: React File Filtering
    it('should not extract components from webpack.config.js', async () => {
      const testFile = path.join(tempDir, 'webpack.config.js');
      const content = `
        module.exports = {
          entry: './src/index.js',
          output: {
            path: __dirname + '/dist',
            filename: 'bundle.js'
          }
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 0);
    });

    it('should not extract components from .js files without React imports', async () => {
      const testFile = path.join(tempDir, 'utility.js');
      const content = `
        export const formatDate = (date) => {
          return date.toISOString();
        };
        
        export const Helper = () => {
          return { data: 'test' };
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 0);
    });

    it('should extract components from .js files with React imports', async () => {
      const testFile = path.join(tempDir, 'component.js');
      const content = `
        import React from 'react';
        
        export const MyComponent = () => {
          return <div>Hello</div>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const components = parser.extractComponentDefinitions(ast, testFile);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].name, 'MyComponent');
    });
  });

  // Phase B Tests: Parent Component Tracking
  describe('extractInformativeElements - Parent Component Tracking', () => {
    it('should track parent component for JSX elements', async () => {
      const testFile = path.join(tempDir, 'multicomponent.tsx');
      const content = `
        import React from 'react';
        
        function ParentComponent() {
          return <button onClick={handleClick}>Click</button>;
        }
        
        function SiblingComponent() {
          return <input type="text" onChange={handleChange} />;
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      const inputElement = elements.find(e => e.name === 'input');

      assert.ok(buttonElement, 'Button element should be found');
      assert.ok(inputElement, 'Input element should be found');
      assert.strictEqual(buttonElement.parentComponent, 'ParentComponent');
      assert.strictEqual(inputElement.parentComponent, 'SiblingComponent');
    });

    it('should track parent component in files with multiple components', async () => {
      const testFile = path.join(tempDir, 'multi.tsx');
      const content = `
        import React from 'react';
        
        const ComponentA = () => {
          return <div onClick={handlerA}>Component A</div>;
        };
        
        const ComponentB = () => {
          return <div onClick={handlerB}>Component B</div>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      // Should have 2 div elements with different parent components
      const divElements = elements.filter(e => e.name === 'div');
      assert.strictEqual(divElements.length, 2);
      
      const divA = divElements.find(e => e.parentComponent === 'ComponentA');
      const divB = divElements.find(e => e.parentComponent === 'ComponentB');
      
      assert.ok(divA, 'Should have div from ComponentA');
      assert.ok(divB, 'Should have div from ComponentB');
    });

    it('should handle class components with parent tracking', async () => {
      const testFile = path.join(tempDir, 'class-component.tsx');
      const content = `
        import React from 'react';
        
        class MyClassComponent extends React.Component {
          render() {
            return <button onClick={this.handleClick}>Submit</button>;
          }
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      assert.strictEqual(buttonElement.parentComponent, 'MyClassComponent');
    });

    /**
     * Phase G (Solution 2A): Test event handler function name extraction
     * 
     * Validates that the AST parser correctly extracts function names from
     * different event handler patterns (function reference, method reference, arrow function).
     */
    it('should extract function names from event handlers', async () => {
      const testFile = path.join(tempDir, 'event-handlers.tsx');
      const content = `
        import React from 'react';
        
        const MyComponent = () => {
          const handleClick = () => {};
          const handleChange = () => {};
          
          return (
            <div>
              <button onClick={handleClick}>Click Me</button>
              <input onChange={handleChange} />
            </div>
          );
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      // Find button element
      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      assert.ok(buttonElement.eventHandlers.length > 0, 'Button should have event handlers');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.strictEqual(clickHandler.handler, 'handleClick', 'Should extract handleClick function name');
      assert.strictEqual(clickHandler.type, 'function-reference', 'Should detect function-reference type');

      // Find input element
      const inputElement = elements.find(e => e.name === 'input');
      assert.ok(inputElement, 'Input element should be found');
      
      const changeHandler = inputElement.eventHandlers.find(h => h.name === 'onChange');
      assert.ok(changeHandler, 'Should have onChange handler');
      assert.strictEqual(changeHandler.handler, 'handleChange', 'Should extract handleChange function name');
    });

    it('should extract method names from class component handlers', async () => {
      const testFile = path.join(tempDir, 'class-handlers.tsx');
      const content = `
        import React from 'react';
        
        class MyComponent extends React.Component {
          increment = () => {
            this.setState({count: this.state.count + 1});
          };
          
          render() {
            return <button onClick={this.increment}>Increment</button>;
          }
        }
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.strictEqual(clickHandler.handler, 'increment', 'Should extract increment method name');
      assert.strictEqual(clickHandler.type, 'method-reference', 'Should detect method-reference type');
    });
  });

  // Phase H Bug Fix Tests: Complex Event Handler Parsing
  // Tests for the fix of the Babel traversal bug that caused parse errors
  // when analyzing arrow functions and inline functions in event handlers
  describe('extractInformativeElements - Complex Event Handlers (Phase H Bug Fix)', () => {
    it('should handle arrow functions with multiple function calls', async () => {
      const testFile = path.join(tempDir, 'complex-handlers.tsx');
      const content = `
        import React from 'react';
        
        export const Component = () => {
          const func1 = () => {};
          const func2 = () => {};
          return <button onClick={() => { func1(); func2(); }}>Click</button>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      assert.ok(buttonElement.eventHandlers.length > 0, 'Button should have event handlers');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.ok(clickHandler.handler.includes('func1'), 'Should extract func1');
      assert.ok(clickHandler.handler.includes('func2'), 'Should extract func2');
      assert.strictEqual(clickHandler.type, 'arrow-function', 'Should detect arrow-function type');
    });
    
    it('should handle async arrow functions with await', async () => {
      const testFile = path.join(tempDir, 'async-handlers.tsx');
      const content = `
        import React from 'react';
        
        export const Component = () => {
          return <button onClick={async () => { await apiRequest(); }}>Click</button>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.ok(clickHandler.handler.includes('apiRequest'), 'Should extract apiRequest');
      assert.strictEqual(clickHandler.type, 'arrow-function', 'Should detect arrow-function type');
    });
    
    it('should handle nested function calls in event handlers', async () => {
      const testFile = path.join(tempDir, 'nested-handlers.tsx');
      const content = `
        import React from 'react';
        
        export const Component = () => {
          return <button onClick={() => { toast({ title: handleSuccess() }); }}>Click</button>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.ok(clickHandler.handler.includes('toast'), 'Should extract toast');
      assert.ok(clickHandler.handler.includes('handleSuccess'), 'Should extract handleSuccess');
    });
    
    it('should handle inline function expressions', async () => {
      const testFile = path.join(tempDir, 'inline-functions.tsx');
      const content = `
        import React from 'react';
        
        export const Component = () => {
          return <button onClick={function() { doSomething(); }}>Click</button>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.ok(clickHandler.handler.includes('doSomething'), 'Should extract doSomething');
      assert.strictEqual(clickHandler.type, 'function-expression', 'Should detect function-expression type');
    });
    
    it('should handle method calls in event handlers', async () => {
      const testFile = path.join(tempDir, 'method-handlers.tsx');
      const content = `
        import React from 'react';
        
        export const Component = () => {
          return <button onClick={() => { queryClient.invalidateQueries(); toast.success(); }}>Click</button>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.ok(clickHandler.handler.includes('invalidateQueries'), 'Should extract invalidateQueries method');
      assert.ok(clickHandler.handler.includes('success'), 'Should extract success method');
    });
    
    it('should handle arrow function with expression body', async () => {
      const testFile = path.join(tempDir, 'arrow-expression.tsx');
      const content = `
        import React from 'react';
        
        export const Component = () => {
          return <button onClick={() => doSomething()}>Click</button>;
        };
      `;
      await fs.writeFile(testFile, content);

      const ast = await parser.parseFile(testFile);
      const elements = parser.extractInformativeElements(ast, testFile);

      const buttonElement = elements.find(e => e.name === 'button');
      assert.ok(buttonElement, 'Button element should be found');
      
      const clickHandler = buttonElement.eventHandlers.find(h => h.name === 'onClick');
      assert.ok(clickHandler, 'Should have onClick handler');
      assert.ok(clickHandler.handler.includes('doSomething'), 'Should extract doSomething from expression body');
    });
  });
});
