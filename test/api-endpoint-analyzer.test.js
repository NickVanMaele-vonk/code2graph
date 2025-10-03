/**
 * Tests for API Endpoint Analyzer
 * Tests API endpoint analysis functionality
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { APIEndpointAnalyzerImpl } from '../dist/analyzers/api-endpoint-analyzer.js';

describe('API Endpoint Analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new APIEndpointAnalyzerImpl();
  });

  afterEach(() => {
    analyzer = null;
  });

  describe('analyzeBackendFiles', () => {
    test('should analyze Express.js routes correctly', () => {
      const backendFiles = [
        {
          path: 'server.js',
          name: 'server.js',
          extension: '.js',
          size: 1000,
          lastModified: new Date(),
          content: `
            const express = require('express');
            const app = express();

            app.get('/api/users', (req, res) => {
              res.json({ users: [] });
            });

            app.post('/api/users', (req, res) => {
              res.json({ message: 'User created' });
            });

            app.put('/api/users/:id', (req, res) => {
              res.json({ message: 'User updated' });
            });

            app.delete('/api/users/:id', (req, res) => {
              res.json({ message: 'User deleted' });
            });
          `
        }
      ];

      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.totalEndpoints, 4);
      assert.strictEqual(result.routes.length, 4);
      assert.strictEqual(result.middleware.length, 0);

      // Check specific endpoints
      const getEndpoint = result.routes.find(route => route.method === 'GET');
      assert.ok(getEndpoint);
      assert.strictEqual(getEndpoint.path, '/api/users');
      assert.strictEqual(getEndpoint.method, 'GET');

      const postEndpoint = result.routes.find(route => route.method === 'POST');
      assert.ok(postEndpoint);
      assert.strictEqual(postEndpoint.path, '/api/users');
      assert.strictEqual(postEndpoint.method, 'POST');

      const putEndpoint = result.routes.find(route => route.method === 'PUT');
      assert.ok(putEndpoint);
      assert.strictEqual(putEndpoint.path, '/api/users/:id');
      assert.strictEqual(putEndpoint.method, 'PUT');

      const deleteEndpoint = result.routes.find(route => route.method === 'DELETE');
      assert.ok(deleteEndpoint);
      assert.strictEqual(deleteEndpoint.path, '/api/users/:id');
      assert.strictEqual(deleteEndpoint.method, 'DELETE');
    });

    test('should identify middleware correctly', () => {
      const backendFiles = [
        {
          path: 'middleware/auth.js',
          name: 'auth.js',
          extension: '.js',
          size: 500,
          lastModified: new Date(),
          content: `
            const authMiddleware = (req, res, next) => {
              // Authentication logic
              next();
            };

            const corsMiddleware = (req, res, next) => {
              // CORS logic
              next();
            };

            module.exports = { authMiddleware, corsMiddleware };
          `
        }
      ];

      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.middleware.length, 2);
      assert.ok(result.middleware.includes('authMiddleware'));
      assert.ok(result.middleware.includes('corsMiddleware'));
    });

    test('should handle empty files gracefully', () => {
      const backendFiles = [
        {
          path: 'empty.js',
          name: 'empty.js',
          extension: '.js',
          size: 0,
          lastModified: new Date(),
          content: ''
        }
      ];

      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.totalEndpoints, 0);
      assert.strictEqual(result.routes.length, 0);
      assert.strictEqual(result.middleware.length, 0);
    });

    test('should handle files without content', () => {
      const backendFiles = [
        {
          path: 'no-content.js',
          name: 'no-content.js',
          extension: '.js',
          size: 100,
          lastModified: new Date()
          // No content property
        }
      ];

      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.totalEndpoints, 0);
      assert.strictEqual(result.routes.length, 0);
    });

    test('should normalize API endpoints correctly', () => {
      const backendFiles = [
        {
          path: 'routes.js',
          name: 'routes.js',
          extension: '.js',
          size: 800,
          lastModified: new Date(),
          content: `
            app.get('/api/users/123', (req, res) => {});
            app.get('/api/users/456', (req, res) => {});
            app.get('/api/posts/789', (req, res) => {});
            app.get('/api/clubs/abc-def-ghi', (req, res) => {});
          `
        }
      ];

      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.totalEndpoints, 4);

      // Check normalization
      const userRoutes = result.routes.filter(route => route.path.includes('users'));
      assert.strictEqual(userRoutes.length, 2);
      
      // Both user routes should have the same normalized path
      assert.strictEqual(userRoutes[0].normalizedPath, userRoutes[1].normalizedPath);
      assert.ok(userRoutes[0].normalizedPath.includes(':id'));
    });
  });

  describe('mapRoutesToNodes', () => {
    test('should map routes to graph nodes correctly', () => {
      const analysis = {
        routes: [
          {
            name: 'GET /api/users',
            path: '/api/users',
            method: 'GET',
            file: 'server.js',
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
            file: 'server.js',
            line: 9,
            column: 10,
            parameters: [],
            middleware: ['authMiddleware'],
            handlers: ['createUserHandler'],
            normalizedPath: '/api/users',
            liveCodeScore: 100
          }
        ],
        middleware: ['authMiddleware'],
        usedEndpoints: [],
        unusedEndpoints: [],
        totalEndpoints: 2,
        deadCodePercentage: 0
      };

      const nodes = analyzer.mapRoutesToNodes(analysis);

      assert.strictEqual(nodes.length, 3); // 2 routes + 1 middleware

      // Check route nodes
      const routeNodes = nodes.filter(node => node.nodeType === 'API');
      assert.strictEqual(routeNodes.length, 2);

      const getNode = routeNodes.find(node => node.label === 'GET /api/users');
      assert.ok(getNode);
      assert.strictEqual(getNode.nodeType, 'API');
      assert.strictEqual(getNode.nodeCategory, 'middleware');
      assert.strictEqual(getNode.datatype, 'array');
      assert.strictEqual(getNode.liveCodeScore, 100);
      assert.strictEqual(getNode.properties.method, 'GET');
      assert.strictEqual(getNode.properties.path, '/api/users');

      // Check middleware node
      const middlewareNodes = nodes.filter(node => node.nodeType === 'function');
      assert.strictEqual(middlewareNodes.length, 1);
      assert.strictEqual(middlewareNodes[0].label, 'authMiddleware');
    });
  });

  describe('identifyUsedUnusedEndpoints', () => {
    test('should identify used and unused endpoints correctly', () => {
      const backendAnalysis = {
        routes: [
          {
            name: 'GET /api/users',
            path: '/api/users',
            method: 'GET',
            file: 'server.js',
            normalizedPath: '/api/users',
            liveCodeScore: 0
          },
          {
            name: 'POST /api/users',
            path: '/api/users',
            method: 'POST',
            file: 'server.js',
            normalizedPath: '/api/users',
            liveCodeScore: 0
          },
          {
            name: 'GET /api/posts',
            path: '/api/posts',
            method: 'GET',
            file: 'server.js',
            normalizedPath: '/api/posts',
            liveCodeScore: 0
          }
        ],
        middleware: [],
        usedEndpoints: [],
        unusedEndpoints: [],
        totalEndpoints: 3,
        deadCodePercentage: 0
      };

      const frontendCalls = [
        {
          name: 'getUsers',
          endpoint: '/api/users',
          method: 'GET',
          file: 'UserService.js',
          normalizedEndpoint: '/api/users'
        },
        {
          name: 'createUser',
          endpoint: '/api/users',
          method: 'POST',
          file: 'UserService.js',
          normalizedEndpoint: '/api/users'
        }
      ];

      const result = analyzer.identifyUsedUnusedEndpoints(backendAnalysis, frontendCalls);

      assert.strictEqual(result.usedEndpoints.length, 2);
      assert.strictEqual(result.unusedEndpoints.length, 1);
      assert.strictEqual(result.deadCodePercentage, 33.33);

      // Check used endpoints
      const usedEndpoints = result.usedEndpoints.map(ep => ep.name);
      assert.ok(usedEndpoints.includes('GET /api/users'));
      assert.ok(usedEndpoints.includes('POST /api/users'));

      // Check unused endpoints
      const unusedEndpoints = result.unusedEndpoints.map(ep => ep.name);
      assert.ok(unusedEndpoints.includes('GET /api/posts'));

      // Check live code scores
      const usedGetEndpoint = result.usedEndpoints.find(ep => ep.name === 'GET /api/users');
      assert.strictEqual(usedGetEndpoint.liveCodeScore, 100);

      const unusedEndpoint = result.unusedEndpoints.find(ep => ep.name === 'GET /api/posts');
      assert.strictEqual(unusedEndpoint.liveCodeScore, 0);
    });

    test('should handle empty frontend calls', () => {
      const backendAnalysis = {
        routes: [
          {
            name: 'GET /api/users',
            path: '/api/users',
            method: 'GET',
            file: 'server.js',
            normalizedPath: '/api/users',
            liveCodeScore: 0
          }
        ],
        middleware: [],
        usedEndpoints: [],
        unusedEndpoints: [],
        totalEndpoints: 1,
        deadCodePercentage: 0
      };

      const frontendCalls = [];

      const result = analyzer.identifyUsedUnusedEndpoints(backendAnalysis, frontendCalls);

      assert.strictEqual(result.usedEndpoints.length, 0);
      assert.strictEqual(result.unusedEndpoints.length, 1);
      assert.strictEqual(result.deadCodePercentage, 100);
    });
  });

  describe('error handling', () => {
    test('should handle malformed files gracefully', () => {
      const backendFiles = [
        {
          path: 'malformed.js',
          name: 'malformed.js',
          extension: '.js',
          size: 200,
          lastModified: new Date(),
          content: 'const express = require("express"; // Missing closing parenthesis'
        }
      ];

      // Should not throw an error
      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.totalEndpoints, 0);
      assert.strictEqual(result.routes.length, 0);
    });

    test('should handle null files', () => {
      const backendFiles = [null];

      // Should not throw an error
      const result = analyzer.analyzeBackendFiles(backendFiles);

      assert.strictEqual(result.totalEndpoints, 0);
      assert.strictEqual(result.routes.length, 0);
    });
  });
});
