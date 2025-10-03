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
      assert.strictEqual(graph.nodes.length, 3); // Component + element + import
      assert.strictEqual(graph.metadata.statistics.totalNodes, 3);
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
      assert.strictEqual(componentNode.nodeCategory, 'front end');
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
          nodeCategory: 'front end',
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
          nodeCategory: 'front end',
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
          nodeCategory: 'front end',
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
          { id: 'node1', label: 'Component1', nodeType: 'function', nodeCategory: 'front end', datatype: 'array', liveCodeScore: 100, file: '/src/Component1.tsx', properties: {} },
          { id: 'node2', label: 'Component2', nodeType: 'function', nodeCategory: 'front end', datatype: 'array', liveCodeScore: 100, file: '/src/Component2.tsx', properties: {} },
          { id: 'node3', label: 'Component3', nodeType: 'function', nodeCategory: 'front end', datatype: 'array', liveCodeScore: 100, file: '/src/Component3.tsx', properties: {} }
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
          { id: 'node1', label: 'Component1', nodeType: 'function', nodeCategory: 'front end', datatype: 'array', liveCodeScore: 100, file: '/src/Component1.tsx', properties: {} },
          { id: 'node2', label: 'Component2', nodeType: 'function', nodeCategory: 'front end', datatype: 'array', liveCodeScore: 100, file: '/src/Component2.tsx', properties: {} }
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
            props: { data: 'data' },
            eventHandlers: [],
            dataBindings: [{ source: 'state.data', target: 'list', type: 'array' }]
          },
          {
            type: 'input',
            name: 'submit-button',
            props: { onClick: 'onSubmit' },
            eventHandlers: [{ name: 'onClick', type: 'click', handler: 'onSubmit' }],
            dataBindings: []
          },
          {
            type: 'data-source',
            name: 'fetchData',
            props: { endpoint: '/api/data', method: 'GET' },
            eventHandlers: [],
            dataBindings: []
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
      assert.strictEqual(graph.nodes.length, 6); // Component + 3 elements + 2 imports
      assert.strictEqual(apiCalls.length, 2); // fetchData + axios import
    });
  });
});
