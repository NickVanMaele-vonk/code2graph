/**
 * Unit tests for Dependency Analyzer
 * Tests the dependency analysis functionality and graph building
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DependencyAnalyzerImpl } from '../dist/analyzers/dependency-analyser.js';
import { AnalysisLogger } from '../dist/analyzers/analysis-logger.js';

describe('Dependency Analyzer', () => {
  let analyzer;
  let logger;

  beforeEach(() => {
    // Initialize logger and analyzer
    logger = new AnalysisLogger('testrepo');
    analyzer = new DependencyAnalyzerImpl(logger);
  });

  describe('buildDependencyGraph', () => {
    it('should build a dependency graph from components', () => {
      const components = [
        {
          name: 'MyComponent',
          type: 'functional',
          file: '/src/components/MyComponent.tsx',
          props: [{ name: 'title', type: 'string', required: true }],
          state: [{ name: 'count', type: 'number', initialValue: 0 }],
          hooks: [{ name: 'useState', type: 'state', dependencies: [] }],
          children: [],
          informativeElements: [
            {
              type: 'display',
              name: 'title-display',
              props: { title: 'Hello' },
              eventHandlers: [],
              dataBindings: [{ source: 'props.title', target: 'display', type: 'text' }]
            }
          ],
          imports: [
            {
              source: 'react',
              specifiers: [{ name: 'React', type: 'default' }]
            }
          ],
          exports: [
            { name: 'MyComponent', type: 'default' }
          ]
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);

      assert.ok(graph);
      assert.ok(graph.nodes);
      assert.ok(graph.edges);
      assert.ok(graph.metadata);
      // Phase C: Now creates component + element + consolidated external package (react)
      assert.strictEqual(graph.nodes.length, 3); // Component + element + external package
      assert.strictEqual(graph.metadata.statistics.totalNodes, 3);
      
      // Phase C: Verify external package node exists
      const reactNode = graph.nodes.find(n => n.label === 'react' && n.nodeType === 'external-dependency');
      assert.ok(reactNode, 'Should have consolidated react package node');
      assert.strictEqual(reactNode.codeOwnership, 'external');
      assert.strictEqual(reactNode.isInfrastructure, true);
    });

    it('should handle empty component array', () => {
      const graph = analyzer.buildDependencyGraph([]);

      assert.ok(graph);
      assert.strictEqual(graph.nodes.length, 0);
      assert.strictEqual(graph.edges.length, 0);
      assert.strictEqual(graph.metadata.statistics.totalNodes, 0);
    });

    it('should create nodes with correct properties', () => {
      const components = [
        {
          name: 'TestComponent',
          type: 'functional',
          file: '/src/TestComponent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      const componentNode = graph.nodes.find(n => n.label === 'TestComponent');

      assert.ok(componentNode);
      assert.strictEqual(componentNode.nodeType, 'function');
      assert.strictEqual(componentNode.nodeCategory, 'front-end');
      assert.strictEqual(componentNode.datatype, 'array');
      assert.strictEqual(componentNode.liveCodeScore, 100);
      assert.strictEqual(componentNode.file, '/src/TestComponent.tsx');
    });
  });

  describe('traceAPICalls', () => {
    it('should trace API calls from data source elements', () => {
      const components = [
        {
          name: 'DataComponent',
          type: 'functional',
          file: '/src/DataComponent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              type: 'data-source',
              name: 'fetchUsers',
              props: { endpoint: '/api/users', method: 'GET' },
              eventHandlers: [],
              dataBindings: []
            }
          ],
          imports: [],
          exports: []
        }
      ];

      const apiCalls = analyzer.traceAPICalls(components);

      assert.strictEqual(apiCalls.length, 1);
      assert.strictEqual(apiCalls[0].name, 'fetchUsers');
      assert.strictEqual(apiCalls[0].endpoint, '/api/users');
      assert.strictEqual(apiCalls[0].method, 'GET');
      assert.strictEqual(apiCalls[0].file, '/src/DataComponent.tsx');
    });

    it('should trace API calls from API library imports', () => {
      const components = [
        {
          name: 'APIComponent',
          type: 'functional',
          file: '/src/APIComponent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [
            {
              source: 'axios',
              specifiers: [{ name: 'axios', type: 'default' }]
            }
          ],
          exports: []
        }
      ];

      const apiCalls = analyzer.traceAPICalls(components);

      assert.strictEqual(apiCalls.length, 1);
      assert.strictEqual(apiCalls[0].name, 'axios');
      assert.strictEqual(apiCalls[0].endpoint, '/api/external');
    });

    it('should handle components with no API calls', () => {
      const components = [
        {
          name: 'SimpleComponent',
          type: 'functional',
          file: '/src/SimpleComponent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const apiCalls = analyzer.traceAPICalls(components);

      assert.strictEqual(apiCalls.length, 0);
    });
  });

  describe('analyzeServiceDependencies', () => {
    it('should analyze service dependencies', () => {
      const services = [
        {
          name: 'UserService',
          type: 'service',
          file: '/src/services/UserService.ts',
          dependencies: ['DatabaseService'],
          operations: [
            {
              name: 'getUser',
              type: 'query',
              parameters: ['id'],
              returnType: 'User',
              databaseOperations: [
                {
                  operation: 'SELECT * FROM users WHERE id = ?',
                  table: 'users',
                  type: 'SELECT'
                }
              ]
            }
          ]
        }
      ];

      const serviceGraph = analyzer.analyzeServiceDependencies(services);

      assert.ok(serviceGraph);
      assert.strictEqual(serviceGraph.services.length, 1);
      assert.strictEqual(serviceGraph.dependencies.length, 2); // Service dependency + DB operation
      
      const serviceDependency = serviceGraph.dependencies.find(d => d.type === 'service-call');
      assert.ok(serviceDependency);
      assert.strictEqual(serviceDependency.from, 'UserService');
      assert.strictEqual(serviceDependency.to, 'DatabaseService');
    });

    it('should handle services with no dependencies', () => {
      const services = [
        {
          name: 'SimpleService',
          type: 'service',
          file: '/src/SimpleService.ts',
          dependencies: [],
          operations: []
        }
      ];

      const serviceGraph = analyzer.analyzeServiceDependencies(services);

      assert.ok(serviceGraph);
      assert.strictEqual(serviceGraph.services.length, 1);
      assert.strictEqual(serviceGraph.dependencies.length, 0);
    });
  });

  describe('mapDatabaseOperations', () => {
    it('should map database operations from services', () => {
      const services = [
        {
          name: 'UserService',
          type: 'service',
          file: '/src/services/UserService.ts',
          dependencies: [],
          operations: [
            {
              name: 'createUser',
              type: 'mutation',
              parameters: ['userData'],
              returnType: 'User',
              databaseOperations: [
                {
                  operation: 'INSERT INTO users (name, email) VALUES (?, ?)',
                  table: 'users',
                  type: 'INSERT'
                }
              ]
            },
            {
              name: 'updateUser',
              type: 'mutation',
              parameters: ['id', 'userData'],
              returnType: 'User',
              databaseOperations: [
                {
                  operation: 'UPDATE users SET name = ?, email = ? WHERE id = ?',
                  table: 'users',
                  type: 'UPDATE'
                }
              ]
            }
          ]
        }
      ];

      const dbOperations = analyzer.mapDatabaseOperations(services);

      assert.strictEqual(dbOperations.length, 2);
      assert.strictEqual(dbOperations[0].table, 'users');
      assert.strictEqual(dbOperations[0].type, 'INSERT');
      assert.strictEqual(dbOperations[1].table, 'users');
      assert.strictEqual(dbOperations[1].type, 'UPDATE');
    });

    it('should handle services with no database operations', () => {
      const services = [
        {
          name: 'SimpleService',
          type: 'service',
          file: '/src/SimpleService.ts',
          dependencies: [],
          operations: [
            {
              name: 'simpleOperation',
              type: 'query',
              parameters: [],
              returnType: 'string',
              databaseOperations: []
            }
          ]
        }
      ];

      const dbOperations = analyzer.mapDatabaseOperations(services);

      assert.strictEqual(dbOperations.length, 0);
    });
  });

  describe('createEdges', () => {
    it('should create edges between nodes', () => {
      const nodes = [
        {
          id: 'node1',
          label: 'Component1',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/Component1.tsx',
          properties: {
            specifiers: [{ name: 'Component2', type: 'default' }]
          }
        },
        {
          id: 'node2',
          label: 'Component2',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/Component2.tsx',
          properties: {}
        }
      ];

      const edges = analyzer.createEdges(nodes);

      assert.ok(edges);
      assert.ok(Array.isArray(edges));
    });

    it('should handle nodes with no relationships', () => {
      const nodes = [
        {
          id: 'node1',
          label: 'IsolatedComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/IsolatedComponent.tsx',
          properties: {}
        }
      ];

      const edges = analyzer.createEdges(nodes);

      assert.ok(edges);
      assert.strictEqual(edges.length, 0);
    });

    // Phase 2 tests: JSX usage edge creation
    it('should create JSX usage edges when a component renders another component', () => {
      const nodes = [
        // Hello component definition in Hello.tsx
        {
          id: 'node1',
          label: 'Hello',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/components/Hello.tsx',
          properties: {
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // index component definition in index.tsx
        {
          id: 'node2',
          label: 'index',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/index.tsx',
          properties: {
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // Hello JSX element usage in index.tsx
        {
          id: 'node3',
          label: 'Hello',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/index.tsx',
          properties: {
            elementType: 'display',
            props: { compiler: 'expression', framework: 'React' }
          }
        }
      ];

      const edges = analyzer.createEdges(nodes);

      // Should have at least one "renders" edge
      const rendersEdges = edges.filter(e => e.relationship === 'renders');
      assert.ok(rendersEdges.length > 0, 'Should create at least one renders edge');
      
      // The edge should be from index component to Hello component
      const indexToHelloEdge = rendersEdges.find(e => 
        e.source === 'node2' && e.target === 'node1'
      );
      assert.ok(indexToHelloEdge, 'Should create edge from index to Hello component');
      assert.strictEqual(indexToHelloEdge.relationship, 'renders');
    });

    it('should not create JSX usage edges for HTML elements', () => {
      const nodes = [
        // Component definition
        {
          id: 'node1',
          label: 'MyComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/MyComponent.tsx',
          properties: {
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // HTML button element (lowercase, should be ignored)
        {
          id: 'node2',
          label: 'button',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/MyComponent.tsx',
          properties: {
            elementType: 'input',
            props: { onClick: 'expression' }
          }
        },
        // HTML div element (lowercase, should be ignored)
        {
          id: 'node3',
          label: 'div',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/MyComponent.tsx',
          properties: {
            elementType: 'display',
            props: {}
          }
        }
      ];

      const edges = analyzer.createEdges(nodes);

      // Should not create any "renders" edges for HTML elements
      const rendersEdges = edges.filter(e => e.relationship === 'renders');
      assert.strictEqual(rendersEdges.length, 0, 'Should not create renders edges for HTML elements');
    });

    it('should create multiple JSX usage edges when multiple components are used', () => {
      const nodes = [
        // Button component
        {
          id: 'node1',
          label: 'Button',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/components/Button.tsx',
          properties: {
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // Input component
        {
          id: 'node2',
          label: 'Input',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/components/Input.tsx',
          properties: {
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // Form component that uses both Button and Input
        {
          id: 'node3',
          label: 'Form',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/components/Form.tsx',
          properties: {
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // Button usage in Form
        {
          id: 'node4',
          label: 'Button',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/components/Form.tsx',
          properties: {
            elementType: 'display',
            props: { text: 'Submit' }
          }
        },
        // Input usage in Form
        {
          id: 'node5',
          label: 'Input',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/src/components/Form.tsx',
          properties: {
            elementType: 'input',
            props: { type: 'text' }
          }
        }
      ];

      const edges = analyzer.createEdges(nodes);

      const rendersEdges = edges.filter(e => e.relationship === 'renders');
      assert.strictEqual(rendersEdges.length, 2, 'Should create two renders edges');
      
      // Form should render Button
      const formToButton = rendersEdges.find(e => 
        e.source === 'node3' && e.target === 'node1'
      );
      assert.ok(formToButton, 'Form should render Button');
      
      // Form should render Input
      const formToInput = rendersEdges.find(e => 
        e.source === 'node3' && e.target === 'node2'
      );
      assert.ok(formToInput, 'Form should render Input');
    });

    // Phase D tests: Same-file component usage support
    it('should create JSX usage edges for components in the same file', () => {
      const nodes = [
        // ParentComponent definition in components.tsx
        {
          id: 'comp1',
          label: 'ParentComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/components.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // ChildComponent definition in components.tsx
        {
          id: 'comp2',
          label: 'ChildComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/components.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // ChildComponent JSX element usage in components.tsx
        {
          id: 'jsx1',
          label: 'ChildComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/components.tsx',
          codeOwnership: 'internal',
          properties: { elementType: 'display' }
        }
      ];

      const edges = analyzer.createEdges(nodes);
      const renderEdges = edges.filter(e => e.relationship === 'renders');

      // Phase D: Should detect same-file component usage
      assert.strictEqual(renderEdges.length, 1, 'Should create one render edge for same-file usage');
      assert.strictEqual(renderEdges[0].source, 'comp1', 'ParentComponent should be the source');
      assert.strictEqual(renderEdges[0].target, 'comp2', 'ChildComponent should be the target');
      assert.strictEqual(renderEdges[0].properties.usageFile, '/app/components.tsx');
      assert.strictEqual(renderEdges[0].properties.definitionFile, '/app/components.tsx');
    });

    it('should not create self-referencing render edges', () => {
      const nodes = [
        // RecursiveComponent definition
        {
          id: 'comp1',
          label: 'RecursiveComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/component.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        // RecursiveComponent JSX element (component rendering itself)
        {
          id: 'jsx1',
          label: 'RecursiveComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/component.tsx',
          codeOwnership: 'internal',
          properties: { elementType: 'display' }
        }
      ];

      const edges = analyzer.createEdges(nodes);
      const renderEdges = edges.filter(e => e.relationship === 'renders');

      // Phase D: Should prevent self-referencing edges
      assert.strictEqual(renderEdges.length, 0, 'Should not create self-referencing render edges');
    });

    // Phase E tests: Component → JSX Element "Contains" Edges
    it('should create contains edges only for JSX elements with matching parentComponent', () => {
      const nodes = [
        {
          id: 'comp1',
          label: 'MyComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/component.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        {
          id: 'comp2',
          label: 'OtherComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/component.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        {
          id: 'jsx1',
          label: 'button',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/component.tsx',
          codeOwnership: 'internal',
          properties: { 
            elementType: 'input',
            parentComponent: 'MyComponent' // Belongs to MyComponent
          }
        },
        {
          id: 'jsx2',
          label: 'div',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/component.tsx',
          codeOwnership: 'internal',
          properties: { 
            elementType: 'display',
            parentComponent: 'OtherComponent' // Belongs to OtherComponent
          }
        }
      ];

      const edges = analyzer.createEdges(nodes);
      const containsEdges = edges.filter(e => e.relationship === 'contains');

      // Phase E: Should have 2 edges: MyComponent→button and OtherComponent→div
      assert.strictEqual(containsEdges.length, 2, 'Should create two contains edges');

      // Verify correct parent-child relationships
      const myComponentEdge = containsEdges.find(e => e.source === 'comp1');
      const otherComponentEdge = containsEdges.find(e => e.source === 'comp2');

      assert.ok(myComponentEdge, 'MyComponent should have a contains edge');
      assert.strictEqual(myComponentEdge.target, 'jsx1', 'MyComponent should contain button');
      assert.strictEqual(myComponentEdge.properties.parentComponent, 'MyComponent');

      assert.ok(otherComponentEdge, 'OtherComponent should have a contains edge');
      assert.strictEqual(otherComponentEdge.target, 'jsx2', 'OtherComponent should contain div');
      assert.strictEqual(otherComponentEdge.properties.parentComponent, 'OtherComponent');
    });

    it('should not create contains edges between unrelated components in same file', () => {
      const nodes = [
        {
          id: 'comp1',
          label: 'ParentComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/multi.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        {
          id: 'comp2',
          label: 'SiblingComponent',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/multi.tsx',
          codeOwnership: 'internal',
          properties: { 
            type: 'functional',
            props: [],
            state: [],
            hooks: []
          }
        },
        {
          id: 'jsx1',
          label: 'button',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/multi.tsx',
          codeOwnership: 'internal',
          properties: { 
            elementType: 'input',
            parentComponent: 'ParentComponent'
          }
        },
        {
          id: 'jsx2',
          label: 'input',
          nodeType: 'function',
          nodeCategory: 'front-end', // Change Request 002: Updated to hyphenated format
          datatype: 'array',
          liveCodeScore: 100,
          file: '/app/multi.tsx',
          codeOwnership: 'internal',
          properties: { 
            elementType: 'input',
            parentComponent: 'SiblingComponent'
          }
        }
      ];

      const edges = analyzer.createEdges(nodes);
      const containsEdges = edges.filter(e => e.relationship === 'contains');

      // Phase E: Should NOT have ParentComponent→input or SiblingComponent→button
      const wrongEdges = containsEdges.filter(e => 
        (e.source === 'comp1' && e.target === 'jsx2') || // ParentComponent→input (WRONG)
        (e.source === 'comp2' && e.target === 'jsx1')    // SiblingComponent→button (WRONG)
      );

      assert.strictEqual(wrongEdges.length, 0, 'Should not create cross-component edges');
      
      // Verify correct edges exist
      const correctEdges = containsEdges.filter(e => 
        (e.source === 'comp1' && e.target === 'jsx1') || // ParentComponent→button (CORRECT)
        (e.source === 'comp2' && e.target === 'jsx2')    // SiblingComponent→input (CORRECT)
      );
      
      assert.strictEqual(correctEdges.length, 2, 'Should create correct parent-child edges only');
    });

    // Phase F tests: JSX Instance Metadata (No Duplicate Nodes)
    it('should not create duplicate nodes for component JSX usage (local)', () => {
      const components = [
        {
          name: 'MainComponent',
          type: 'class',
          file: '/app/index.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            { 
              name: 'ChildComponent', 
              type: 'display',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [],
              dataBindings: [],
              line: 15,
              file: '/app/index.tsx'
            } // Component usage (capitalized)
          ],
          imports: [],
          exports: []
        },
        {
          name: 'ChildComponent',
          type: 'functional',
          file: '/app/child.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      const childComponentNodes = graph.nodes.filter(n => n.label === 'ChildComponent');

      // Phase F: Should only have 1 node (definition), not 2 (definition + JSX instance)
      assert.strictEqual(childComponentNodes.length, 1, 'Should only have component definition node, not JSX instance node');
      
      // Verify it's a component node, not a JSX element node
      const childNode = childComponentNodes[0];
      assert.ok(childNode.properties.type, 'Should have component type property');
      assert.ok(!childNode.properties.elementType, 'Should not have elementType (not a JSX element node)');
    });

    it('should populate renderLocations metadata for component JSX usage', () => {
      const components = [
        {
          name: 'MainComponent',
          type: 'class',
          file: '/app/index.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            { 
              name: 'ChildComponent', 
              type: 'display',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [],
              dataBindings: [],
              line: 15,
              file: '/app/index.tsx'
            }
          ],
          imports: [],
          exports: []
        },
        {
          name: 'ChildComponent',
          type: 'functional',
          file: '/app/child.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      // Call buildDependencyGraph to trigger renderLocations population
      // We don't need the returned graph, just the side effect of populating metadata
      analyzer.buildDependencyGraph(components);

      // Phase F: ChildComponent should have renderLocations metadata
      const childComponent = components.find(c => c.name === 'ChildComponent');
      assert.ok(childComponent.renderLocations, 'Should have renderLocations array');
      assert.strictEqual(childComponent.renderLocations.length, 1, 'Should have one render location');
      
      const renderLocation = childComponent.renderLocations[0];
      assert.strictEqual(renderLocation.file, '/app/index.tsx', 'Should record correct usage file');
      assert.strictEqual(renderLocation.line, 15, 'Should record correct line number');
      assert.ok(renderLocation.context.includes('MainComponent'), 'Should record parent component name in context');
    });

    /**
     * Phase H: Test filtering of non-interactive HTML formatting elements
     * 
     * Business Logic:
     * Phase H filters out passive HTML formatting elements (div, h1, p, span, etc.) 
     * that have no event handlers. Only interactive elements with handlers become nodes.
     * This reduces graph noise and focuses on business logic and user interactions.
     * 
     * Test validates:
     * - Interactive HTML elements (with handlers) DO create nodes (button with onClick)
     * - Passive HTML formatting elements (without handlers) do NOT create nodes (div with only data binding)
     * - Handler functions create separate nodes
     * - Components create nodes
     * - Enables complete interaction flow visualization without visual clutter
     */
    it('should create nodes for informative HTML elements and handler functions', () => {
      const components = [
        {
          name: 'MyComponent',
          type: 'functional',
          file: '/app/component.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            { 
              name: 'button', // HTML element with handler → CREATE node (Semantic Filtering: needs semantic ID)
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'handleClick' }],
              dataBindings: [],
              line: 10,
              file: '/app/component.tsx',
              semanticIdentifier: 'Click', // Semantic Filtering: button has semantic identifier
              hasSemanticIdentifier: true
            },
            { 
              name: 'div', // HTML formatting element without handler → SKIP node (Phase H)
              type: 'display',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [],
              dataBindings: ['data'],
              line: 8,
              file: '/app/component.tsx'
            }
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      // Semantic Filtering: Button node uses semantic identifier as label
      const buttonNode = graph.nodes.find(n => n.label === 'Click');
      const divNode = graph.nodes.find(n => n.label === 'div');
      const componentNode = graph.nodes.find(n => n.label === 'MyComponent');
      const handleClickNode = graph.nodes.find(n => n.label === 'handleClick');
      
      assert.ok(buttonNode, 'Should create node for button (has onClick handler and semantic identifier)');
      assert.ok(!divNode, 'Should NOT create node for div (passive display without handlers - Phase H filtering)');
      assert.ok(componentNode, 'Should create node for MyComponent');
      assert.ok(handleClickNode, 'Should create node for handleClick (handler function)');
      
      // Check handler function node properties
      assert.strictEqual(handleClickNode.properties.isEventHandler, true, 'Handler node should be marked as event handler');
      assert.strictEqual(handleClickNode.properties.parentComponent, 'MyComponent', 'Handler should belong to MyComponent');
      
      // Semantic Filtering: Internal nodes = component + 1 interactive element (button with semantic ID) + 1 handler function = 3
      // The div is filtered out because it's a passive formatting element
      const internalNodes = graph.nodes.filter(n => n.codeOwnership === 'internal');
      assert.strictEqual(internalNodes.length, 3, 'Should have component + button + handler (div filtered out)');
    });

    it('should handle mixed HTML elements and component usage in same file', () => {
      const components = [
        {
          name: 'ParentComponent',
          type: 'functional',
          file: '/app/parent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            { 
              name: 'button', // HTML element with handler → CREATE node (Phase H)
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'handleClick' }],
              dataBindings: [],
              line: 10,
              file: '/app/parent.tsx',
              semanticIdentifier: 'Cancel', // Has semantic identifier
              hasSemanticIdentifier: true
            },
            { 
              name: 'ChildComponent', // Component usage → metadata only (Phase F)
              type: 'display',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [],
              dataBindings: [],
              line: 12,
              file: '/app/parent.tsx'
            },
            { 
              name: 'div', // HTML formatting element without handler → SKIP node (Phase H)
              type: 'display',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [],
              dataBindings: ['text'],
              line: 15,
              file: '/app/parent.tsx'
            }
          ],
          imports: [],
          exports: []
        },
        {
          name: 'ChildComponent',
          type: 'functional',
          file: '/app/child.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      // Phase H: Only interactive HTML elements with handlers create nodes
      const buttonNode = graph.nodes.find(n => n.label === 'Cancel'); // Now uses semantic identifier
      const divNode = graph.nodes.find(n => n.label === 'div');
      assert.ok(buttonNode, 'Should create node for button (has event handler and semantic ID)');
      assert.ok(!divNode, 'Should NOT create node for div (passive formatting without handlers - Phase H filtering)');
      
      // Phase F: Component usage should NOT create duplicate node
      const childComponentNodes = graph.nodes.filter(n => n.label === 'ChildComponent');
      assert.strictEqual(childComponentNodes.length, 1, 'Should only have one ChildComponent node (definition only)');
      
      // Phase F: ChildComponent should have renderLocations metadata
      const childComponent = components.find(c => c.name === 'ChildComponent');
      assert.ok(childComponent.renderLocations, 'ChildComponent should have renderLocations');
      assert.strictEqual(childComponent.renderLocations.length, 1, 'Should record one usage location');
      assert.strictEqual(childComponent.renderLocations[0].file, '/app/parent.tsx', 'Should record correct usage file');
    });
  });

  describe('Semantic Filtering and Direct Handler Edges', () => {
    it('should create node for JSX element WITH semantic identifier', () => {
      const components = [
        {
          name: 'MyComponent',
          type: 'functional',
          file: '/app/component.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              name: 'button',
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'handleSave' }],
              dataBindings: [],
              line: 10,
              file: '/app/component.tsx',
              semanticIdentifier: 'Save changes',  // Has semantic identifier
              hasSemanticIdentifier: true
            }
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      const buttonNode = graph.nodes.find(n => n.label === 'Save changes');
      assert.ok(buttonNode, 'Should create node for button with semantic identifier');
      assert.strictEqual(buttonNode.properties.semanticIdentifier, 'Save changes', 'Should store semantic identifier in properties');
      assert.strictEqual(buttonNode.properties.hasSemanticIdentifier, true, 'Should set hasSemanticIdentifier flag');
    });

    it('should NOT create node for JSX element WITHOUT semantic identifier', () => {
      const components = [
        {
          name: 'MyComponent',
          type: 'functional',
          file: '/app/component.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              name: 'div',
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'selectDate' }],
              dataBindings: [],
              line: 10,
              file: '/app/component.tsx',
              semanticIdentifier: undefined,  // No semantic identifier
              hasSemanticIdentifier: false
            }
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      const divNode = graph.nodes.find(n => n.label === 'div');
      assert.ok(!divNode, 'Should NOT create node for JSX element without semantic identifier');
    });

    it('should create direct Component → Handler edge for non-semantic JSX element', () => {
      const components = [
        {
          name: 'ClubCalendarDialog',
          type: 'functional',
          file: '/app/calendar.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              name: 'div',
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'selectDate' }],
              dataBindings: [],
              line: 10,
              file: '/app/calendar.tsx',
              parentComponent: 'ClubCalendarDialog',
              semanticIdentifier: undefined,  // No semantic identifier
              hasSemanticIdentifier: false
            }
            // Handler function node 'selectDate' will be created automatically from eventHandlers
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      // Component node should exist
      const componentNode = graph.nodes.find(n => n.label === 'ClubCalendarDialog');
      assert.ok(componentNode, 'Should create node for component');
      
      // Handler function node should exist (created automatically from eventHandlers)
      const handlerNode = graph.nodes.find(n => n.label === 'selectDate' && n.properties.isEventHandler === true);
      assert.ok(handlerNode, 'Should create node for handler function');
      
      // Direct edge Component → Handler should exist
      const directEdge = graph.edges.find(e => 
        e.source === componentNode.id && 
        e.target === handlerNode.id &&
        e.relationship === 'calls'
      );
      assert.ok(directEdge, 'Should create direct edge from Component to Handler');
      assert.strictEqual(directEdge.properties.isDirect, true, 'Edge should be marked as direct');
      assert.strictEqual(directEdge.properties.triggerElement, 'div', 'Edge should store trigger element');
      assert.strictEqual(directEdge.properties.eventType, 'onClick', 'Edge should store event type');
    });

    it('should create multiple direct edges for handler with multiple function calls', () => {
      const components = [
        {
          name: 'FormComponent',
          type: 'functional',
          file: '/app/form.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              name: 'button',
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'arrow-function', handler: 'validate, submit' }], // Multiple calls
              dataBindings: [],
              line: 10,
              file: '/app/form.tsx',
              parentComponent: 'FormComponent',
              semanticIdentifier: undefined,
              hasSemanticIdentifier: false
            }
            // Handler function nodes 'validate' and 'submit' will be created automatically from eventHandlers
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      const componentNode = graph.nodes.find(n => n.label === 'FormComponent');
      const validateNode = graph.nodes.find(n => n.label === 'validate' && n.properties.isEventHandler === true);
      const submitNode = graph.nodes.find(n => n.label === 'submit' && n.properties.isEventHandler === true);
      
      // Should create direct edge to both functions
      const validateEdge = graph.edges.find(e => 
        e.source === componentNode.id && e.target === validateNode.id
      );
      const submitEdge = graph.edges.find(e => 
        e.source === componentNode.id && e.target === submitNode.id
      );
      
      assert.ok(validateEdge, 'Should create direct edge to validate function');
      assert.ok(submitEdge, 'Should create direct edge to submit function');
    });

    it('should NOT create edge for inline arrow function with no function calls', () => {
      const components = [
        {
          name: 'MyComponent',
          type: 'functional',
          file: '/app/component.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              name: 'div',
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'arrow-function', handler: '' }], // No function calls
              dataBindings: [],
              line: 10,
              file: '/app/component.tsx',
              parentComponent: 'MyComponent',
              semanticIdentifier: undefined,
              hasSemanticIdentifier: false
            }
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      const componentNode = graph.nodes.find(n => n.label === 'MyComponent');
      
      // Should NOT create any edges from component (handler function is empty)
      const callsEdges = graph.edges.filter(e => 
        e.source === componentNode.id && e.relationship === 'calls'
      );
      assert.strictEqual(callsEdges.length, 0, 'Should not create edge for empty handler');
    });

    it('should use semantic identifier as node label', () => {
      const components = [
        {
          name: 'MyComponent',
          type: 'functional',
          file: '/app/component.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [
            {
              name: 'button',
              type: 'input',
              elementType: 'JSXElement',
              props: {},
              eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'handleSave' }],
              dataBindings: [],
              line: 10,
              file: '/app/component.tsx',
              semanticIdentifier: 'Save changes',
              hasSemanticIdentifier: true
            }
          ],
          imports: [],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);
      
      // Node should use semantic identifier as label, not HTML tag name
      const buttonNode = graph.nodes.find(n => n.properties.semanticIdentifier === 'Save changes');
      assert.ok(buttonNode, 'Should create node with semantic identifier');
      assert.strictEqual(buttonNode.label, 'Save changes', 'Should use semantic identifier as label, not "button"');
    });

    // Phase C tests: External dependency consolidation
    it('should consolidate multiple imports from same external package', () => {
      const components = [
        {
          name: 'ComponentA',
          type: 'functional',
          file: '/src/ComponentA.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [
            { source: 'react', specifiers: [{ name: 'useState', type: 'named' }] },
            { source: 'react-dom', specifiers: [{ name: 'render', type: 'named' }] }
          ],
          exports: []
        },
        {
          name: 'ComponentB',
          type: 'functional',
          file: '/src/ComponentB.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [
            { source: 'react', specifiers: [{ name: 'useEffect', type: 'named' }] },
            { source: 'react-dom/client', specifiers: [{ name: 'createRoot', type: 'named' }] }
          ],
          exports: []
        }
      ];

      const graph = analyzer.buildDependencyGraph(components);

      // Should have 2 components + 2 consolidated external packages (react, react-dom)
      assert.strictEqual(graph.nodes.length, 4);

      // Check for consolidated react package node
      const reactNode = graph.nodes.find(n => n.label === 'react' && n.nodeType === 'external-dependency');
      assert.ok(reactNode, 'Should have one consolidated react node');
      assert.strictEqual(reactNode.codeOwnership, 'external');
      assert.strictEqual(reactNode.isInfrastructure, true);
      assert.strictEqual(reactNode.nodeCategory, 'library');

      // Check for consolidated react-dom package node
      const reactDomNode = graph.nodes.find(n => n.label === 'react-dom' && n.nodeType === 'external-dependency');
      assert.ok(reactDomNode, 'Should have one consolidated react-dom node');
      assert.strictEqual(reactDomNode.codeOwnership, 'external');

      // Should have edges from both components to react package
      const reactImportEdges = graph.edges.filter(e => 
        e.relationship === 'imports' && e.target === reactNode.id
      );
      assert.strictEqual(reactImportEdges.length, 2, 'Both components should import from react');
    });
  });

  describe('normalizeAPIEndpoints', () => {
    it('should normalize API endpoints with numeric IDs', () => {
      const endpoints = [
        '/api/users/123',
        '/api/posts/456',
        '/api/comments/789'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:id');
      assert.strictEqual(normalized[1], '/api/posts/:id');
      assert.strictEqual(normalized[2], '/api/comments/:id');
    });

    it('should normalize API endpoints with UUIDs', () => {
      const endpoints = [
        '/api/users/123e4567-e89b-12d3-a456-426614174000',
        '/api/posts/987fcdeb-51a2-43d1-b789-123456789abc'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 2);
      assert.strictEqual(normalized[0], '/api/users/:uuid');
      assert.strictEqual(normalized[1], '/api/posts/:uuid');
    });

    it('should normalize API endpoints with nested paths', () => {
      const endpoints = [
        '/api/clubs/123/persons',
        '/api/users/456/posts',
        '/api/posts/789/comments'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/clubs/:id/persons');
      assert.strictEqual(normalized[1], '/api/users/:id/posts');
      assert.strictEqual(normalized[2], '/api/posts/:id/comments');
    });

    it('should normalize API endpoints with version patterns', () => {
      const endpoints = [
        '/api/v1/users/123',
        '/api/v2.1/posts/456',
        '/api/v3/users/789/posts'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/:version/users/:id');
      assert.strictEqual(normalized[1], '/api/:version/posts/:id');
      assert.strictEqual(normalized[2], '/api/:version/users/:id/posts');
    });

    it('should normalize API endpoints with alphanumeric IDs', () => {
      const endpoints = [
        '/api/users/abc123',
        '/api/posts/def456',
        '/api/orders/ORD-2024-001'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:identifier');
      assert.strictEqual(normalized[1], '/api/posts/:identifier');
      assert.strictEqual(normalized[2], '/api/orders/:identifier');
    });

    it('should normalize API endpoints with hyphenated IDs', () => {
      const endpoints = [
        '/api/users/user-123',
        '/api/posts/post-456',
        '/api/orders/order-789'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:slug');
      assert.strictEqual(normalized[1], '/api/posts/:slug');
      assert.strictEqual(normalized[2], '/api/orders/:slug');
    });

    it('should normalize API endpoints with underscore IDs', () => {
      const endpoints = [
        '/api/users/user_123',
        '/api/posts/post_456',
        '/api/orders/order_789'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:key');
      assert.strictEqual(normalized[1], '/api/posts/:key');
      assert.strictEqual(normalized[2], '/api/orders/:key');
    });

    it('should normalize API endpoints with dot-separated IDs', () => {
      const endpoints = [
        '/api/users/user.123',
        '/api/posts/post.456',
        '/api/orders/order.789'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:path');
      assert.strictEqual(normalized[1], '/api/posts/:path');
      assert.strictEqual(normalized[2], '/api/orders/:path');
    });

    it('should normalize API endpoints with mixed-case IDs', () => {
      const endpoints = [
        '/api/users/User123',
        '/api/posts/Post456',
        '/api/orders/Order789'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:camelCase');
      assert.strictEqual(normalized[1], '/api/posts/:camelCase');
      assert.strictEqual(normalized[2], '/api/orders/:camelCase');
    });

    it('should normalize API endpoints with query parameters', () => {
      const endpoints = [
        '/api/users/123?include=posts',
        '/api/posts/456?filter=active',
        '/api/orders/789?sort=date&limit=10'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:id?:query');
      assert.strictEqual(normalized[1], '/api/posts/:id?:query');
      assert.strictEqual(normalized[2], '/api/orders/:id?:query');
    });

    it('should normalize API endpoints with fragments', () => {
      const endpoints = [
        '/api/users/123#profile',
        '/api/posts/456#comments',
        '/api/orders/789#details'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:id#:fragment');
      assert.strictEqual(normalized[1], '/api/posts/:id#:fragment');
      assert.strictEqual(normalized[2], '/api/orders/:id#:fragment');
    });

    it('should normalize API endpoints with query parameters and fragments', () => {
      const endpoints = [
        '/api/users/123?include=posts#profile',
        '/api/posts/456?filter=active#comments',
        '/api/orders/789?sort=date&limit=10#details'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:id?:query#:fragment');
      assert.strictEqual(normalized[1], '/api/posts/:id?:query#:fragment');
      assert.strictEqual(normalized[2], '/api/orders/:id?:query#:fragment');
    });

    it('should handle endpoints with no IDs', () => {
      const endpoints = [
        '/api/users',
        '/api/posts',
        '/api/health'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users');
      assert.strictEqual(normalized[1], '/api/posts');
      assert.strictEqual(normalized[2], '/api/health');
    });

    it('should handle complex mixed-case patterns correctly', () => {
      const endpoints = [
        '/api/users/UserProfile123',
        '/api/posts/BlogPost456',
        '/api/orders/OrderItem789'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:camelCase');
      assert.strictEqual(normalized[1], '/api/posts/:camelCase');
      assert.strictEqual(normalized[2], '/api/orders/:camelCase');
    });

    it('should distinguish between slugs and mixed alphanumeric patterns', () => {
      const endpoints = [
        '/api/users/user-profile-123',      // true slug (lowercase)
        '/api/posts/ORD-2024-001',          // mixed alphanumeric (not slug)
        '/api/orders/ORDER-ITEM-456'        // mixed alphanumeric (not slug)
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 3);
      assert.strictEqual(normalized[0], '/api/users/:slug');
      assert.strictEqual(normalized[1], '/api/posts/:identifier');
      assert.strictEqual(normalized[2], '/api/orders/:identifier');
    });

    it('should handle edge cases with special characters', () => {
      const endpoints = [
        '/api/users/user.name',             // dot-separated
        '/api/posts/user_name',             // underscore-separated
        '/api/orders/user-name',            // hyphen-separated (slug)
        '/api/clubs/ClubName123'            // camelCase
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 4);
      assert.strictEqual(normalized[0], '/api/users/:path');
      assert.strictEqual(normalized[1], '/api/posts/:key');
      assert.strictEqual(normalized[2], '/api/orders/:slug');
      assert.strictEqual(normalized[3], '/api/clubs/:camelCase');
    });

    it('should preserve static API segments while normalizing parameters', () => {
      const endpoints = [
        '/api/users/abc123',
        '/api/posts/def456',
        '/api/health',
        '/api/status'
      ];

      const normalized = analyzer.normalizeAPIEndpoints(endpoints);

      assert.strictEqual(normalized.length, 4);
      assert.strictEqual(normalized[0], '/api/users/:identifier');
      assert.strictEqual(normalized[1], '/api/posts/:identifier');
      assert.strictEqual(normalized[2], '/api/health');
      assert.strictEqual(normalized[3], '/api/status');
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect circular dependencies', () => {
      const graph = {
        nodes: [
          { id: 'node1', label: 'Component1', nodeType: 'function', nodeCategory: 'front-end', datatype: 'array', liveCodeScore: 100, file: '/src/Component1.tsx', properties: {} },
          { id: 'node2', label: 'Component2', nodeType: 'function', nodeCategory: 'front-end', datatype: 'array', liveCodeScore: 100, file: '/src/Component2.tsx', properties: {} },
          { id: 'node3', label: 'Component3', nodeType: 'function', nodeCategory: 'front-end', datatype: 'array', liveCodeScore: 100, file: '/src/Component3.tsx', properties: {} }
        ],
        edges: [
          { id: 'edge1', source: 'node1', target: 'node2', relationship: 'imports', properties: {} },
          { id: 'edge2', source: 'node2', target: 'node3', relationship: 'imports', properties: {} },
          { id: 'edge3', source: 'node3', target: 'node1', relationship: 'imports', properties: {} }
        ],
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          repositoryUrl: '',
          analysisScope: { includedTypes: [], excludedTypes: [] },
          statistics: { linesOfCode: 0, totalNodes: 3, totalEdges: 3, deadCodeNodes: 0, liveCodeNodes: 3 }
        }
      };

      const cycles = analyzer.detectCircularDependencies(graph);

      assert.ok(cycles);
      assert.ok(Array.isArray(cycles));
      assert.ok(cycles.length > 0);
      
      const cycle = cycles[0];
      assert.ok(cycle.nodes);
      assert.strictEqual(cycle.type, 'circular-dependency');
      assert.ok(cycle.severity === 'warning' || cycle.severity === 'error');
    });

    it('should handle graphs with no circular dependencies', () => {
      const graph = {
        nodes: [
          { id: 'node1', label: 'Component1', nodeType: 'function', nodeCategory: 'front-end', datatype: 'array', liveCodeScore: 100, file: '/src/Component1.tsx', properties: {} },
          { id: 'node2', label: 'Component2', nodeType: 'function', nodeCategory: 'front-end', datatype: 'array', liveCodeScore: 100, file: '/src/Component2.tsx', properties: {} }
        ],
        edges: [
          { id: 'edge1', source: 'node1', target: 'node2', relationship: 'imports', properties: {} }
        ],
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          repositoryUrl: '',
          analysisScope: { includedTypes: [], excludedTypes: [] },
          statistics: { linesOfCode: 0, totalNodes: 2, totalEdges: 1, deadCodeNodes: 0, liveCodeNodes: 2 }
        }
      };

      const cycles = analyzer.detectCircularDependencies(graph);

      assert.ok(cycles);
      assert.strictEqual(cycles.length, 0);
    });

    it('should handle empty graphs', () => {
      const graph = {
        nodes: [],
        edges: [],
        metadata: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          repositoryUrl: '',
          analysisScope: { includedTypes: [], excludedTypes: [] },
          statistics: { linesOfCode: 0, totalNodes: 0, totalEdges: 0, deadCodeNodes: 0, liveCodeNodes: 0 }
        }
      };

      const cycles = analyzer.detectCircularDependencies(graph);

      assert.ok(cycles);
      assert.strictEqual(cycles.length, 0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid component data gracefully', () => {
      const invalidComponents = [
        {
          // Missing required fields
          name: 'InvalidComponent'
        }
      ];

      try {
        analyzer.buildDependencyGraph(invalidComponents);
        // Should not throw, but handle gracefully
        assert.ok(true);
      } catch (error) {
        // If it does throw, it should be a proper AnalysisError
        assert.ok(error.type === 'validation');
      }
    });

    it('should handle null or undefined inputs', () => {
      try {
        analyzer.buildDependencyGraph(null);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.type === 'validation');
      }

      try {
        analyzer.traceAPICalls(undefined);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error.type === 'validation');
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex component with multiple dependencies', () => {
      const complexComponent = {
        name: 'ComplexComponent',
        type: 'functional',
        file: '/src/ComplexComponent.tsx',
        props: [
          { name: 'title', type: 'string', required: true },
          { name: 'onSubmit', type: 'function', required: false }
        ],
        state: [
          { name: 'data', type: 'array', initialValue: [] },
          { name: 'loading', type: 'boolean', initialValue: false }
        ],
        hooks: [
          { name: 'useState', type: 'state', dependencies: [] },
          { name: 'useEffect', type: 'effect', dependencies: ['data'] }
        ],
        children: [],
        informativeElements: [
          {
            type: 'display',
            name: 'data-list',
            elementType: 'div', // Phase G: Added required property for InformativeElementInfo
            file: '/src/ComplexComponent.tsx', // Phase G: Added required property for InformativeElementInfo
            props: { data: 'data' },
            eventHandlers: [],
            dataBindings: ['state.data'] // Phase G: Changed from DataBinding[] to string[] format
          },
          {
            type: 'input',
            name: 'submit-button',
            elementType: 'button', // Phase G: Added required property for InformativeElementInfo
            file: '/src/ComplexComponent.tsx', // Phase G: Added required property for InformativeElementInfo
            props: { onClick: 'onSubmit' },
            eventHandlers: [{ name: 'onClick', type: 'function-reference', handler: 'onSubmit' }],
            dataBindings: [], // Phase G: Already string[] format
            semanticIdentifier: 'Submit', // Semantic Filtering: button needs semantic ID to create node
            hasSemanticIdentifier: true
          },
          {
            type: 'data-source',
            name: 'fetchData',
            elementType: 'fetch', // Phase G: Added required property for InformativeElementInfo
            file: '/src/ComplexComponent.tsx', // Phase G: Added required property for InformativeElementInfo
            props: { endpoint: '/api/data', method: 'GET' },
            eventHandlers: [],
            dataBindings: [] // Phase G: Already string[] format
          }
        ],
        imports: [
          {
            source: 'react',
            specifiers: [
              { name: 'React', type: 'default' },
              { name: 'useState', type: 'named' },
              { name: 'useEffect', type: 'named' }
            ]
          },
          {
            source: 'axios',
            specifiers: [{ name: 'axios', type: 'default' }]
          }
        ],
        exports: [
          { name: 'ComplexComponent', type: 'default' }
        ]
      };

      const graph = analyzer.buildDependencyGraph([complexComponent]);
      const apiCalls = analyzer.traceAPICalls([complexComponent]);

      assert.ok(graph);
      // Semantic Filtering: Updated node count calculation
      // 7 nodes = Component (1) + submit-button with semantic ID (1) + fetchData data-source (1) + 
      //           react external (1) + axios external (1) + onSubmit handler function (1) + 
      //           data-list display filtered out (0, no handler)
      // Note: submit-button creates node because it has semantic identifier
      assert.strictEqual(graph.nodes.length, 7);
      assert.strictEqual(apiCalls.length, 2); // fetchData + axios import
    });
  });
});
