/**
 * Tests for Connection Mapper
 * Tests frontend-backend connection mapping functionality
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ConnectionMapperImpl } from '../dist/analyzers/connection-mapper.js';

describe('Connection Mapper', () => {
  let mapper;

  beforeEach(() => {
    mapper = new ConnectionMapperImpl();
  });

  afterEach(() => {
    mapper = null;
  });

  describe('mapFrontendBackendConnections', () => {
    test('should map direct connections correctly', () => {
      const frontendComponents = [
        {
          name: 'UserList',
          type: 'functional',
          file: 'components/UserList.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        },
        {
          name: 'UserForm',
          type: 'functional',
          file: 'components/UserForm.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const backendEndpoints = [
        {
          name: 'GET /api/users',
          path: '/api/users',
          method: 'GET',
          file: 'routes/users.js',
          line: 5,
          column: 10,
          parameters: [],
          middleware: ['authMiddleware'],
          handlers: ['getUsersHandler'],
          normalizedPath: '/api/users',
          liveCodeScore: 100
        },
        {
          name: 'POST /api/users',
          path: '/api/users',
          method: 'POST',
          file: 'routes/users.js',
          line: 9,
          column: 10,
          parameters: [],
          middleware: ['authMiddleware'],
          handlers: ['createUserHandler'],
          normalizedPath: '/api/users',
          liveCodeScore: 100
        }
      ];

      const apiCalls = [
        {
          name: 'getUsers',
          endpoint: '/api/users',
          method: 'GET',
          file: 'components/UserList.tsx',
          normalizedEndpoint: '/api/users'
        },
        {
          name: 'createUser',
          endpoint: '/api/users',
          method: 'POST',
          file: 'components/UserForm.tsx',
          normalizedEndpoint: '/api/users'
        }
      ];

      const databaseOperations = [
        {
          operation: 'SELECT',
          table: 'users',
          type: 'SELECT',
          file: 'models/User.js'
        },
        {
          operation: 'INSERT',
          table: 'users',
          type: 'INSERT',
          file: 'models/User.js'
        }
      ];

      const result = mapper.mapFrontendBackendConnections(
        frontendComponents,
        backendEndpoints,
        apiCalls,
        databaseOperations
      );

      assert.strictEqual(result.totalConnections, 2);
      assert.strictEqual(result.directConnections.length, 2);
      assert.strictEqual(result.indirectConnections.length, 0);
      assert.strictEqual(result.proxyConnections.length, 0);

      // Check direct connections
      const userListConnection = result.directConnections.find(conn => 
        conn.frontendComponent === 'UserList'
      );
      assert.ok(userListConnection);
      assert.strictEqual(userListConnection.backendEndpoint, 'GET /api/users');
      assert.strictEqual(userListConnection.connectionType, 'direct');
      assert.strictEqual(userListConnection.confidence, 1.0);
      assert.deepStrictEqual(userListConnection.path, ['UserList', 'getUsers', 'GET /api/users']);

      const userFormConnection = result.directConnections.find(conn => 
        conn.frontendComponent === 'UserForm'
      );
      assert.ok(userFormConnection);
      assert.strictEqual(userFormConnection.backendEndpoint, 'POST /api/users');
      assert.strictEqual(userFormConnection.connectionType, 'direct');
      assert.strictEqual(userFormConnection.confidence, 1.0);
    });

    test('should map indirect connections through database', () => {
      const frontendComponents = [];
      const backendEndpoints = [
        {
          name: 'GET /api/users',
          path: '/api/users',
          method: 'GET',
          file: 'routes/users.js',
          normalizedPath: '/api/users',
          liveCodeScore: 100
        }
      ];

      const apiCalls = [];
      const databaseOperations = [
        {
          operation: 'SELECT',
          table: 'users',
          type: 'SELECT',
          file: 'routes/users.js'
        }
      ];

      const result = mapper.mapFrontendBackendConnections(
        frontendComponents,
        backendEndpoints,
        apiCalls,
        databaseOperations
      );

      assert.strictEqual(result.totalConnections, 1);
      assert.strictEqual(result.indirectConnections.length, 1);

      const indirectConnection = result.indirectConnections[0];
      assert.strictEqual(indirectConnection.backendEndpoint, 'GET /api/users');
      assert.strictEqual(indirectConnection.connectionType, 'indirect');
      assert.strictEqual(indirectConnection.confidence, 0.8);
      assert.deepStrictEqual(indirectConnection.path, ['GET /api/users', 'service-layer', 'database']);
      assert.strictEqual(indirectConnection.databaseOperations.length, 1);
    });

    test('should map proxy connections correctly', () => {
      const frontendComponents = [
        {
          name: 'UserList',
          type: 'functional',
          file: 'components/UserList.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const backendEndpoints = [
        {
          name: 'GET /api/users',
          path: '/api/users',
          method: 'GET',
          file: 'routes/users.js',
          normalizedPath: '/api/users',
          liveCodeScore: 100
        }
      ];

      const apiCalls = [
        {
          name: 'getUsers',
          endpoint: '/api/gateway/users',
          method: 'GET',
          file: 'components/UserList.tsx',
          normalizedEndpoint: '/api/gateway/users'
        }
      ];

      const databaseOperations = [];

      const result = mapper.mapFrontendBackendConnections(
        frontendComponents,
        backendEndpoints,
        apiCalls,
        databaseOperations
      );

      assert.strictEqual(result.totalConnections, 1);
      assert.strictEqual(result.proxyConnections.length, 1);

      const proxyConnection = result.proxyConnections[0];
      assert.strictEqual(proxyConnection.frontendComponent, 'UserList');
      assert.strictEqual(proxyConnection.backendEndpoint, 'GET /api/users');
      assert.strictEqual(proxyConnection.connectionType, 'proxy');
      assert.strictEqual(proxyConnection.confidence, 0.7);
      assert.deepStrictEqual(proxyConnection.path, ['UserList', 'proxy', 'GET /api/users']);
    });

    test('should identify unmapped components and endpoints', () => {
      const frontendComponents = [
        {
          name: 'UserList',
          type: 'functional',
          file: 'components/UserList.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        },
        {
          name: 'UnmappedComponent',
          type: 'functional',
          file: 'components/Unmapped.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const backendEndpoints = [
        {
          name: 'GET /api/users',
          path: '/api/users',
          method: 'GET',
          file: 'routes/users.js',
          normalizedPath: '/api/users',
          liveCodeScore: 100
        },
        {
          name: 'GET /api/posts',
          path: '/api/posts',
          method: 'GET',
          file: 'routes/posts.js',
          normalizedPath: '/api/posts',
          liveCodeScore: 100
        }
      ];

      const apiCalls = [
        {
          name: 'getUsers',
          endpoint: '/api/users',
          method: 'GET',
          file: 'components/UserList.tsx',
          normalizedEndpoint: '/api/users'
        }
      ];

      const databaseOperations = [];

      const result = mapper.mapFrontendBackendConnections(
        frontendComponents,
        backendEndpoints,
        apiCalls,
        databaseOperations
      );

      assert.strictEqual(result.unmappedFrontend.length, 1);
      assert.strictEqual(result.unmappedBackend.length, 1);
      assert.ok(result.unmappedFrontend.includes('UnmappedComponent'));
      assert.ok(result.unmappedBackend.includes('GET /api/posts'));
    });

    test('should handle empty inputs gracefully', () => {
      const result = mapper.mapFrontendBackendConnections([], [], [], []);

      assert.strictEqual(result.totalConnections, 0);
      assert.strictEqual(result.directConnections.length, 0);
      assert.strictEqual(result.indirectConnections.length, 0);
      assert.strictEqual(result.proxyConnections.length, 0);
      assert.strictEqual(result.unmappedFrontend.length, 0);
      assert.strictEqual(result.unmappedBackend.length, 0);
      assert.strictEqual(result.mappingCoverage, 0);
    });
  });

  describe('createConnectionEdges', () => {
    test('should create edges for frontend-backend connections', () => {
      const connections = [
        {
          frontendComponent: 'UserList',
          backendEndpoint: 'GET /api/users',
          connectionType: 'direct',
          confidence: 1.0,
          path: ['UserList', 'getUsers', 'GET /api/users'],
          apiCalls: [
            {
              name: 'getUsers',
              endpoint: '/api/users',
              method: 'GET',
              file: 'components/UserList.tsx',
              normalizedEndpoint: '/api/users'
            }
          ],
          databaseOperations: []
        }
      ];

      const nodes = [
        {
          id: 'frontend_1',
          label: 'UserList',
          nodeType: 'function',
          nodeCategory: 'front end',
          datatype: 'array',
          liveCodeScore: 100,
          file: 'components/UserList.tsx',
          properties: {}
        },
        {
          id: 'api_1',
          label: 'GET /api/users',
          nodeType: 'API',
          nodeCategory: 'middleware',
          datatype: 'array',
          liveCodeScore: 100,
          file: 'routes/users.js',
          properties: {}
        },
        {
          id: 'table_1',
          label: 'users',
          nodeType: 'table',
          nodeCategory: 'database',
          datatype: 'table',
          liveCodeScore: 100,
          file: 'models/User.js',
          properties: {}
        }
      ];

      const edges = mapper.createConnectionEdges(connections, nodes);

      assert.strictEqual(edges.length, 1);

      const edge = edges[0];
      assert.strictEqual(edge.source, 'frontend_1');
      assert.strictEqual(edge.target, 'api_1');
      assert.strictEqual(edge.relationship, 'calls');
      assert.strictEqual(edge.properties.connectionType, 'direct');
      assert.strictEqual(edge.properties.confidence, 1.0);
      assert.deepStrictEqual(edge.properties.path, ['UserList', 'getUsers', 'GET /api/users']);
    });

    test('should create edges for database operations', () => {
      const connections = [
        {
          frontendComponent: 'UserList',
          backendEndpoint: 'GET /api/users',
          connectionType: 'direct',
          confidence: 1.0,
          path: ['UserList', 'getUsers', 'GET /api/users'],
          apiCalls: [],
          databaseOperations: [
            {
              operation: 'SELECT',
              table: 'users',
              type: 'SELECT',
              file: 'models/User.js'
            }
          ]
        }
      ];

      const nodes = [
        {
          id: 'api_1',
          label: 'GET /api/users',
          nodeType: 'API',
          nodeCategory: 'middleware',
          datatype: 'array',
          liveCodeScore: 100,
          file: 'routes/users.js',
          properties: {}
        },
        {
          id: 'table_1',
          label: 'users',
          nodeType: 'table',
          nodeCategory: 'database',
          datatype: 'table',
          liveCodeScore: 100,
          file: 'models/User.js',
          properties: {}
        }
      ];

      const edges = mapper.createConnectionEdges(connections, nodes);

      assert.strictEqual(edges.length, 1);

      const edge = edges[0];
      assert.strictEqual(edge.source, 'api_1');
      assert.strictEqual(edge.target, 'table_1');
      assert.strictEqual(edge.relationship, 'reads');
      assert.strictEqual(edge.properties.operation, 'SELECT');
      assert.strictEqual(edge.properties.table, 'users');
    });

    test('should handle missing nodes gracefully', () => {
      const connections = [
        {
          frontendComponent: 'UserList',
          backendEndpoint: 'GET /api/users',
          connectionType: 'direct',
          confidence: 1.0,
          path: ['UserList', 'getUsers', 'GET /api/users'],
          apiCalls: [],
          databaseOperations: []
        }
      ];

      const nodes = []; // Empty nodes array

      const edges = mapper.createConnectionEdges(connections, nodes);

      assert.strictEqual(edges.length, 0);
    });
  });

  describe('analyzeConnectionQuality', () => {
    test('should provide quality recommendations', () => {
      const result = {
        connections: [
          {
            frontendComponent: 'UserList',
            backendEndpoint: 'GET /api/users',
            connectionType: 'direct',
            confidence: 0.9
          }
        ],
        directConnections: [],
        indirectConnections: [],
        proxyConnections: [],
        unmappedFrontend: ['UnmappedComponent'],
        unmappedBackend: ['GET /api/posts'],
        totalConnections: 1,
        mappingCoverage: 60
      };

      const recommendations = mapper.analyzeConnectionQuality(result);

      assert.ok(recommendations.length > 0);
      assert.ok(recommendations.some(rec => rec.includes('Low mapping coverage')));
      assert.ok(recommendations.some(rec => rec.includes('unmapped frontend components')));
      assert.ok(recommendations.some(rec => rec.includes('unmapped backend endpoints')));
    });

    test('should handle good quality connections', () => {
      const result = {
        connections: [
          {
            frontendComponent: 'UserList',
            backendEndpoint: 'GET /api/users',
            connectionType: 'direct',
            confidence: 0.95
          }
        ],
        directConnections: [],
        indirectConnections: [],
        proxyConnections: [],
        unmappedFrontend: [],
        unmappedBackend: [],
        totalConnections: 1,
        mappingCoverage: 95
      };

      const recommendations = mapper.analyzeConnectionQuality(result);

      assert.strictEqual(recommendations.length, 0);
    });
  });

  describe('error handling', () => {
    test('should handle null inputs gracefully', () => {
      // Should not throw an error
      const result = mapper.mapFrontendBackendConnections(null, null, null, null);

      assert.strictEqual(result.totalConnections, 0);
      assert.strictEqual(result.directConnections.length, 0);
      assert.strictEqual(result.indirectConnections.length, 0);
      assert.strictEqual(result.proxyConnections.length, 0);
    });

    test('should handle undefined inputs gracefully', () => {
      // Should not throw an error
      const result = mapper.mapFrontendBackendConnections(undefined, undefined, undefined, undefined);

      assert.strictEqual(result.totalConnections, 0);
      assert.strictEqual(result.directConnections.length, 0);
      assert.strictEqual(result.indirectConnections.length, 0);
      assert.strictEqual(result.proxyConnections.length, 0);
    });
  });
});
