/**
 * Tests for Database Analyzer
 * Tests database operations analysis functionality
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { DatabaseAnalyzerImpl } from '../dist/analyzers/database-analyzer.js';

describe('Database Analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new DatabaseAnalyzerImpl();
  });

  afterEach(() => {
    analyzer = null;
  });

  describe('analyzeDatabaseOperations', () => {
    test('should analyze SQL queries correctly', () => {
      const files = [
        {
          path: 'models/User.js',
          name: 'User.js',
          extension: '.js',
          size: 1000,
          lastModified: new Date(),
          content: `
            const knex = require('knex');

            class User {
              static async findAll() {
                return knex('users').select('*');
              }

              static async findById(id) {
                return knex('users').select('*').where('id', id);
              }

              static async create(userData) {
                return knex('users').insert(userData);
              }

              static async update(id, userData) {
                return knex('users').where('id', id).update(userData);
              }

              static async delete(id) {
                return knex('users').where('id', id).del();
              }
            }
          `
        }
      ];

      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 5);
      assert.strictEqual(result.tables.length, 1);
      assert.strictEqual(result.views.length, 0);

      // Check table
      const usersTable = result.tables.find(table => table.name === 'users');
      assert.ok(usersTable);
      assert.strictEqual(usersTable.type, 'table');
      assert.strictEqual(usersTable.operations.length, 5);

      // Check operations
      const operations = result.operations;
      const selectOps = operations.filter(op => op.operation === 'SELECT');
      const insertOps = operations.filter(op => op.operation === 'INSERT');
      const updateOps = operations.filter(op => op.operation === 'UPDATE');
      const deleteOps = operations.filter(op => op.operation === 'DELETE');

      assert.strictEqual(selectOps.length, 2);
      assert.strictEqual(insertOps.length, 1);
      assert.strictEqual(updateOps.length, 1);
      assert.strictEqual(deleteOps.length, 1);
    });

    test('should analyze raw SQL queries', () => {
      const files = [
        {
          path: 'queries.sql',
          name: 'queries.sql',
          extension: '.sql',
          size: 500,
          lastModified: new Date(),
          content: `
            SELECT * FROM users WHERE active = 1;
            INSERT INTO posts (title, content) VALUES ('Test', 'Content');
            UPDATE users SET last_login = NOW() WHERE id = 123;
            DELETE FROM sessions WHERE expired_at < NOW();
            CREATE VIEW active_users AS SELECT * FROM users WHERE active = 1;
          `
        }
      ];

      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 5);
      assert.strictEqual(result.tables.length, 3); // users, posts, sessions
      assert.strictEqual(result.views.length, 1); // active_users

      // Check tables
      const tableNames = result.tables.map(table => table.name);
      assert.ok(tableNames.includes('users'));
      assert.ok(tableNames.includes('posts'));
      assert.ok(tableNames.includes('sessions'));

      // Check views
      const viewNames = result.views.map(view => view.name);
      assert.ok(viewNames.includes('active_users'));
    });

    test('should analyze Sequelize queries', () => {
      const files = [
        {
          path: 'models/Post.js',
          name: 'Post.js',
          extension: '.js',
          size: 800,
          lastModified: new Date(),
          content: `
            const { DataTypes, Model } = require('sequelize');

            class Post extends Model {
              static async findAll() {
                return this.findAll({ where: { published: true } });
              }

              static async findByUserId(userId) {
                return this.findAll({ where: { userId: userId } });
              }

              static async createPost(data) {
                return this.create(data);
              }

              static async updatePost(id, data) {
                return this.update(data, { where: { id: id } });
              }

              static async deletePost(id) {
                return this.destroy({ where: { id: id } });
              }
            }
          `
        }
      ];

      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 5);
      assert.strictEqual(result.tables.length, 1);

      // Check table
      const postsTable = result.tables.find(table => table.name === 'Post');
      assert.ok(postsTable);
      assert.strictEqual(postsTable.operations.length, 5);
    });

    test('should handle empty files gracefully', () => {
      const files = [
        {
          path: 'empty.js',
          name: 'empty.js',
          extension: '.js',
          size: 0,
          lastModified: new Date(),
          content: ''
        }
      ];

      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 0);
      assert.strictEqual(result.tables.length, 0);
      assert.strictEqual(result.views.length, 0);
    });

    test('should handle files without content', () => {
      const files = [
        {
          path: 'no-content.js',
          name: 'no-content.js',
          extension: '.js',
          size: 100,
          lastModified: new Date()
          // No content property
        }
      ];

      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 0);
      assert.strictEqual(result.tables.length, 0);
      assert.strictEqual(result.views.length, 0);
    });
  });

  describe('mapDatabaseEntitiesToNodes', () => {
    test('should map tables and views to graph nodes correctly', () => {
      const analysis = {
        tables: [
          {
            name: 'users',
            type: 'table',
            file: 'models/User.js',
            line: 5,
            column: 10,
            operations: [
              { operation: 'SELECT', table: 'users', type: 'SELECT' },
              { operation: 'INSERT', table: 'users', type: 'INSERT' }
            ],
            liveCodeScore: 100,
            schema: 'public',
            columns: ['id', 'name', 'email']
          }
        ],
        views: [
          {
            name: 'active_users',
            type: 'view',
            file: 'views.sql',
            line: 10,
            column: 5,
            operations: [
              { operation: 'SELECT', table: 'active_users', type: 'SELECT' }
            ],
            liveCodeScore: 100,
            schema: 'public'
          }
        ],
        operations: [],
        usedTables: [],
        unusedTables: [],
        usedViews: [],
        unusedViews: [],
        totalOperations: 2,
        deadCodePercentage: 0
      };

      const nodes = analyzer.mapDatabaseEntitiesToNodes(analysis);

      assert.strictEqual(nodes.length, 2); // 1 table + 1 view

      // Check table node
      const tableNode = nodes.find(node => node.nodeType === 'table');
      assert.ok(tableNode);
      assert.strictEqual(tableNode.label, 'users');
      assert.strictEqual(tableNode.nodeType, 'table');
      assert.strictEqual(tableNode.nodeCategory, 'database');
      assert.strictEqual(tableNode.datatype, 'table');
      assert.strictEqual(tableNode.liveCodeScore, 100);
      assert.strictEqual(tableNode.properties.type, 'table');
      assert.deepStrictEqual(tableNode.properties.operations, ['SELECT', 'INSERT']);
      assert.strictEqual(tableNode.properties.schema, 'public');
      assert.deepStrictEqual(tableNode.properties.columns, ['id', 'name', 'email']);

      // Check view node
      const viewNode = nodes.find(node => node.nodeType === 'view');
      assert.ok(viewNode);
      assert.strictEqual(viewNode.label, 'active_users');
      assert.strictEqual(viewNode.nodeType, 'view');
      assert.strictEqual(viewNode.nodeCategory, 'database');
      assert.strictEqual(viewNode.datatype, 'view');
      assert.strictEqual(viewNode.liveCodeScore, 100);
      assert.strictEqual(viewNode.properties.type, 'view');
      assert.deepStrictEqual(viewNode.properties.operations, ['SELECT']);
    });
  });

  describe('identifyUsedUnusedEntities', () => {
    test('should identify used and unused database entities correctly', () => {
      const analysis = {
        tables: [
          {
            name: 'users',
            type: 'table',
            file: 'models/User.js',
            operations: [],
            liveCodeScore: 0
          },
          {
            name: 'posts',
            type: 'table',
            file: 'models/Post.js',
            operations: [],
            liveCodeScore: 0
          }
        ],
        views: [
          {
            name: 'active_users',
            type: 'view',
            file: 'views.sql',
            operations: [],
            liveCodeScore: 0
          }
        ],
        operations: [
          {
            operation: 'SELECT',
            table: 'users',
            type: 'SELECT',
            file: 'api/users.js'
          },
          {
            operation: 'SELECT',
            table: 'active_users',
            type: 'SELECT',
            file: 'api/users.js'
          }
        ],
        usedTables: [],
        unusedTables: [],
        usedViews: [],
        unusedViews: [],
        totalOperations: 2,
        deadCodePercentage: 0
      };

      const result = analyzer.identifyUsedUnusedEntities(analysis, analysis.operations);

      assert.strictEqual(result.usedTables.length, 1);
      assert.strictEqual(result.unusedTables.length, 1);
      assert.strictEqual(result.usedViews.length, 1);
      assert.strictEqual(result.unusedViews.length, 0);
      assert.strictEqual(result.deadCodePercentage, 33.33);

      // Check used entities
      const usedTableNames = result.usedTables.map(table => table.name);
      assert.ok(usedTableNames.includes('users'));

      const usedViewNames = result.usedViews.map(view => view.name);
      assert.ok(usedViewNames.includes('active_users'));

      // Check unused entities
      const unusedTableNames = result.unusedTables.map(table => table.name);
      assert.ok(unusedTableNames.includes('posts'));

      // Check live code scores
      const usedTable = result.usedTables.find(table => table.name === 'users');
      assert.strictEqual(usedTable.liveCodeScore, 100);

      const unusedTable = result.unusedTables.find(table => table.name === 'posts');
      assert.strictEqual(unusedTable.liveCodeScore, 0);
    });

    test('should handle empty operations', () => {
      const analysis = {
        tables: [
          {
            name: 'users',
            type: 'table',
            file: 'models/User.js',
            operations: [],
            liveCodeScore: 0
          }
        ],
        views: [],
        operations: [],
        usedTables: [],
        unusedTables: [],
        usedViews: [],
        unusedViews: [],
        totalOperations: 0,
        deadCodePercentage: 0
      };

      const result = analyzer.identifyUsedUnusedEntities(analysis, []);

      assert.strictEqual(result.usedTables.length, 0);
      assert.strictEqual(result.unusedTables.length, 1);
      assert.strictEqual(result.deadCodePercentage, 100);
    });
  });

  describe('error handling', () => {
    test('should handle malformed files gracefully', () => {
      const files = [
        {
          path: 'malformed.js',
          name: 'malformed.js',
          extension: '.js',
          size: 200,
          lastModified: new Date(),
          content: 'const knex = require("knex"; // Missing closing parenthesis'
        }
      ];

      // Should not throw an error
      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 0);
      assert.strictEqual(result.tables.length, 0);
      assert.strictEqual(result.views.length, 0);
    });

    test('should handle null files', () => {
      const files = [null];

      // Should not throw an error
      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 0);
      assert.strictEqual(result.tables.length, 0);
      assert.strictEqual(result.views.length, 0);
    });

    test('should handle invalid SQL gracefully', () => {
      const files = [
        {
          path: 'invalid.sql',
          name: 'invalid.sql',
          extension: '.sql',
          size: 100,
          lastModified: new Date(),
          content: 'INVALID SQL SYNTAX HERE'
        }
      ];

      // Should not throw an error
      const result = analyzer.analyzeDatabaseOperations(files);

      assert.strictEqual(result.totalOperations, 0);
      assert.strictEqual(result.tables.length, 0);
      assert.strictEqual(result.views.length, 0);
    });
  });
});
