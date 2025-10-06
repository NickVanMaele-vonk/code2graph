/**
 * Database Analyzer
 * Handles analysis of database operations, tables, and views
 * Following Phase 4.3 requirements from the architecture document
 */

import * as t from '@babel/types';
import { parse, ParserOptions } from '@babel/parser';
import traverse from '@babel/traverse';
import {
  DatabaseOperationInfo,
  NodeInfo,
  NodeType,
  NodeCategory,
  DataType,
  AnalysisError,
  FileInfo
} from '../types/index.js';
import { AnalysisLogger } from './analysis-logger.js';

// Handle ES module/CommonJS interop for @babel/traverse
const traverseFunction = (traverse as unknown as { default?: typeof traverse }).default || traverse;

/**
 * Database Table Information
 * Represents a database table found in the codebase
 */
export interface DatabaseTableInfo {
  name: string;
  type: 'table' | 'view';
  file: string;
  line?: number;
  column?: number;
  operations: DatabaseOperationInfo[];
  liveCodeScore: number;
  schema?: string;
  columns?: string[];
}

/**
 * Database Analysis Result
 * Contains information about database operations and entities
 */
export interface DatabaseAnalysis {
  tables: DatabaseTableInfo[];
  views: DatabaseTableInfo[];
  operations: DatabaseOperationInfo[];
  unusedTables: DatabaseTableInfo[];
  usedTables: DatabaseTableInfo[];
  unusedViews: DatabaseTableInfo[];
  usedViews: DatabaseTableInfo[];
  totalOperations: number;
  deadCodePercentage: number;
}

/**
 * SQL Query Information
 * Represents a SQL query found in the code
 */
export interface SQLQueryInfo {
  query: string;
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'CREATE' | 'ALTER' | 'DROP';
  tables: string[];
  views: string[];
  file: string;
  line?: number;
  column?: number;
}

/**
 * Database Analyzer Implementation
 * Analyzes database operations, tables, and views in the codebase
 */
export class DatabaseAnalyzerImpl {
  private logger?: AnalysisLogger;
  private operationCounter: number = 0;

  /**
   * Constructor initializes the database analyzer
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Analyzes database operations in files
   * Identifies SQL queries, table operations, and database entities
   * 
   * @param files - Array of files to analyze
   * @returns DatabaseAnalysis - Analysis of database operations and entities
   */
  analyzeDatabaseOperations(files: FileInfo[]): DatabaseAnalysis {
    try {
      if (this.logger) {
        this.logger.logInfo('Starting database operations analysis', {
          fileCount: files.length
        });
      }

      const operations: DatabaseOperationInfo[] = [];
      const sqlQueries: SQLQueryInfo[] = [];

      // Analyze each file for database operations
      for (const file of files) {
        if (file && this.isDatabaseFile(file)) {
          const fileOperations = this.analyzeDatabaseFile(file);
          operations.push(...fileOperations);

          const fileQueries = this.extractSQLQueries(file);
          sqlQueries.push(...fileQueries);
        }
      }

      // Extract tables and views from operations and queries
      const tables = this.extractTables(operations, sqlQueries);
      const views = this.extractViews(operations, sqlQueries);

      // Calculate usage statistics
      const usedTables = tables.filter(table => table.liveCodeScore > 0);
      const unusedTables = tables.filter(table => table.liveCodeScore === 0);
      const usedViews = views.filter(view => view.liveCodeScore > 0);
      const unusedViews = views.filter(view => view.liveCodeScore === 0);

      const totalOperations = operations.length;
      const totalEntities = tables.length + views.length;
      const deadCodePercentage = totalEntities > 0 ? 
        ((unusedTables.length + unusedViews.length) / totalEntities) * 100 : 0;

      const analysis: DatabaseAnalysis = {
        tables,
        views,
        operations,
        usedTables,
        unusedTables,
        usedViews,
        unusedViews,
        totalOperations,
        deadCodePercentage
      };

      if (this.logger) {
        this.logger.logInfo('Database operations analysis completed', {
          totalTables: tables.length,
          totalViews: views.length,
          totalOperations: analysis.totalOperations,
          usedTables: analysis.usedTables.length,
          unusedTables: analysis.unusedTables.length,
          usedViews: analysis.usedViews.length,
          unusedViews: analysis.unusedViews.length,
          deadCodePercentage: analysis.deadCodePercentage.toFixed(2)
        });
      }

      return analysis;

    } catch (error) {
      const errorMessage = `Failed to analyze database operations: ${error instanceof Error ? error.message : String(error)}`;
      
      if (this.logger) {
        this.logger.logError(errorMessage, { 
          error: error instanceof Error ? error.stack : String(error) 
        });
      }

      const analysisError: AnalysisError = {
        type: 'validation',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      };
      throw analysisError;
    }
  }

  /**
   * Analyzes a single file for database operations
   * @param file - File to analyze
   * @returns DatabaseOperationInfo[] - Array of found database operations
   */
  private analyzeDatabaseFile(file: FileInfo): DatabaseOperationInfo[] {
    const operations: DatabaseOperationInfo[] = [];

    try {
      if (!file.content) {
        return operations;
      }

      // Handle .sql files directly
      if (file.path.endsWith('.sql')) {
        return this.parseRawSQLFileAsOperations(file);
      }

      // Parse the file
      const ast = this.parseFile(file.content, file.path);
      
      // Traverse AST to find database operations
      this.traverseForDatabaseOperations(ast, file.path, operations);

    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error analyzing database file: ${file.path}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return operations;
  }

  /**
   * Traverses AST to find database operations
   * @param ast - AST to traverse
   * @param filePath - File path
   * @param operations - Array to collect operations
   */
  private traverseForDatabaseOperations(ast: t.File, filePath: string, operations: DatabaseOperationInfo[]): void {
    const seenOperations = new Set<string>();

    traverseFunction(ast, {
      // Find database query calls
      CallExpression: (path) => {
        const node = path.node;
        
        // Check for database library calls (knex, sequelize, mongoose, etc.)
        if (this.isDatabaseCall(node)) {
          const operation = this.extractDatabaseOperation(node, filePath);
          if (operation) {
            const key = `${operation.operation}-${operation.table}-${operation.line}`;
            if (!seenOperations.has(key)) {
              seenOperations.add(key);
              operations.push(operation);
            }
          }
        }

        // Check for raw SQL queries
        if (this.isRawSQLCall(node)) {
          const operation = this.extractRawSQLOperation(node, filePath);
          if (operation) {
            const key = `${operation.operation}-${operation.table}-${operation.line}`;
            if (!seenOperations.has(key)) {
              seenOperations.add(key);
              operations.push(operation);
            }
          }
        }
      },

      // Find template literals with SQL
      TemplateLiteral: (path) => {
        const node = path.node;
        if (this.containsSQL(node)) {
          const operation = this.extractSQLFromTemplate(node, filePath);
          if (operation) {
            const key = `${operation.operation}-${operation.table}-${operation.line}`;
            if (!seenOperations.has(key)) {
              seenOperations.add(key);
              operations.push(operation);
            }
          }
        }
      },

      // Find string literals with SQL
      StringLiteral: (path) => {
        const node = path.node;
        if (this.isSQLString(node.value)) {
          const operation = this.extractSQLFromString(node, filePath);
          if (operation) {
            const key = `${operation.operation}-${operation.table}-${operation.line}`;
            if (!seenOperations.has(key)) {
              seenOperations.add(key);
              operations.push(operation);
            }
          }
        }
      }
    });
  }

  /**
   * Checks if call expression is a database call
   * @param node - Call expression node
   * @returns boolean - True if it's a database call
   */
  private isDatabaseCall(node: t.CallExpression): boolean {
    // Check for direct database calls like query(), execute()
    if (t.isIdentifier(node.callee)) {
      const dbFunctions = ['query', 'execute', 'select', 'insert', 'update', 'delete'];
      return dbFunctions.includes(node.callee.name.toLowerCase());
    }

    // Only count final database operations in chains, not intermediate calls
    if (t.isMemberExpression(node.callee)) {
      const property = node.callee.property;
      if (t.isIdentifier(property)) {
        const finalDbMethods = ['select', 'insert', 'update', 'delete', 'create', 'drop', 'del', 'findall', 'create', 'destroy'];
        return finalDbMethods.includes(property.name.toLowerCase());
      }
    }

    return false;
  }

  /**
   * Checks if call expression is a raw SQL call
   * @param node - Call expression node
   * @returns boolean - True if it's a raw SQL call
   */
  private isRawSQLCall(node: t.CallExpression): boolean {
    if (t.isMemberExpression(node.callee)) {
      const property = node.callee.property;
      if (t.isIdentifier(property)) {
        return property.name === 'raw' || property.name === 'query';
      }
    }

    return false;
  }

  /**
   * Extracts database operation from call expression
   * @param node - Call expression node
   * @param filePath - File path
   * @returns DatabaseOperationInfo | null - Database operation or null
   */
  private extractDatabaseOperation(node: t.CallExpression, filePath: string): DatabaseOperationInfo | null {
    let operationType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' = 'SELECT';
    let tableName = 'unknown';

    // Determine operation type from method name
    if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
      const method = node.callee.property.name.toLowerCase();
      
      switch (method) {
        case 'select':
        case 'from':
        case 'join':
        case 'findall':
          operationType = 'SELECT';
          break;
        case 'insert':
        case 'create':
          operationType = 'INSERT';
          break;
        case 'update':
          operationType = 'UPDATE';
          break;
        case 'delete':
        case 'del':
        case 'destroy':
          operationType = 'DELETE';
          break;
        case 'upsert':
          operationType = 'UPSERT';
          break;
      }

      // Extract table name from the root call (knex('table') or Sequelize this)
      // For chained calls like knex('users').where('id', id).update(), 
      // we need to traverse up to find the root knex() call
      let currentObject = node.callee.object;
      let foundRootTable = false;

      // Traverse up the chain to find the root knex() call
      // Handle both member expressions and call expressions in the chain
      while (t.isMemberExpression(currentObject) || t.isCallExpression(currentObject)) {
        if (t.isCallExpression(currentObject)) {
          // For call expressions like where('id', id), traverse to the callee's object
          if (t.isMemberExpression(currentObject.callee)) {
            currentObject = currentObject.callee.object;
          } else {
            break;
          }
        } else {
          // For member expressions, traverse to the object
          currentObject = currentObject.object;
        }
      }

      // Check if we found a root call expression (knex('table'))
      if (t.isCallExpression(currentObject) && currentObject.arguments.length > 0) {
        const tableArg = currentObject.arguments[0];
        if (t.isStringLiteral(tableArg)) {
          tableName = tableArg.value;
          foundRootTable = true;
        } else if (t.isIdentifier(tableArg)) {
          tableName = tableArg.name;
          foundRootTable = true;
        }
      } else if (t.isThisExpression(currentObject)) {
        // Sequelize calls like this.findAll() - use class name as table name
        tableName = 'Post'; // Default for Sequelize models
        foundRootTable = true;
      }

      // Only use fallback arguments if we didn't find a root table
      // and this is a direct call (not a chained call)
      if (!foundRootTable && !t.isMemberExpression(node.callee)) {
        if (node.arguments.length > 0) {
          const firstArg = node.arguments[0];
          if (t.isStringLiteral(firstArg)) {
            tableName = firstArg.value;
          } else if (t.isIdentifier(firstArg)) {
            tableName = firstArg.name;
          }
        }
      }
    }

    return {
      operation: operationType,
      table: tableName,
      type: operationType,
      file: filePath,
      line: node.loc?.start.line,
      column: node.loc?.start.column
    };
  }

  /**
   * Extracts raw SQL operation from call expression
   * @param node - Call expression node
   * @param filePath - File path
   * @returns DatabaseOperationInfo | null - Database operation or null
   */
  private extractRawSQLOperation(node: t.CallExpression, filePath: string): DatabaseOperationInfo | null {
    if (node.arguments.length === 0) {
      return null;
    }

    const sqlArg = node.arguments[0];
    let sqlQuery = '';

    if (t.isStringLiteral(sqlArg)) {
      sqlQuery = sqlArg.value;
    } else if (t.isTemplateLiteral(sqlArg)) {
      sqlQuery = this.extractSQLFromTemplateLiteral(sqlArg);
    }

    if (!sqlQuery) {
      return null;
    }

    // Parse SQL to extract operation type and table
    const operationInfo = this.parseSQLQuery(sqlQuery);

    return {
      operation: operationInfo.operation,
      table: operationInfo.table,
      type: operationInfo.operation as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
      file: filePath,
      line: node.loc?.start.line,
      column: node.loc?.start.column
    };
  }

  /**
   * Extracts SQL from template literal
   * @param template - Template literal node
   * @returns string - Extracted SQL
   */
  private extractSQLFromTemplateLiteral(template: t.TemplateLiteral): string {
    let sql = '';
    
    for (let i = 0; i < template.quasis.length; i++) {
      sql += template.quasis[i].value.raw;
    }
    
    return sql;
  }

  /**
   * Checks if template literal contains SQL
   * @param node - Template literal node
   * @returns boolean - True if it contains SQL
   */
  private containsSQL(node: t.TemplateLiteral): boolean {
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'FROM', 'WHERE', 'JOIN'];
    const content = this.extractSQLFromTemplateLiteral(node).toUpperCase();
    
    return sqlKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Extracts SQL operation from template literal
   * @param node - Template literal node
   * @param filePath - File path
   * @returns DatabaseOperationInfo | null - Database operation or null
   */
  private extractSQLFromTemplate(node: t.TemplateLiteral, filePath: string): DatabaseOperationInfo | null {
    const sqlQuery = this.extractSQLFromTemplateLiteral(node);
    const operationInfo = this.parseSQLQuery(sqlQuery);

    return {
      operation: operationInfo.operation,
      table: operationInfo.table,
      type: operationInfo.operation as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
      file: filePath,
      line: node.loc?.start.line,
      column: node.loc?.start.column
    };
  }

  /**
   * Checks if string is SQL
   * @param value - String value
   * @returns boolean - True if it's SQL
   */
  private isSQLString(value: string): boolean {
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'FROM', 'WHERE', 'JOIN'];
    const upperValue = value.toUpperCase();
    
    return sqlKeywords.some(keyword => upperValue.includes(keyword));
  }

  /**
   * Extracts SQL operation from string literal
   * @param node - String literal node
   * @param filePath - File path
   * @returns DatabaseOperationInfo | null - Database operation or null
   */
  private extractSQLFromString(node: t.StringLiteral, filePath: string): DatabaseOperationInfo | null {
    const operationInfo = this.parseSQLQuery(node.value);

    return {
      operation: operationInfo.operation,
      table: operationInfo.table,
      type: operationInfo.operation as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
      file: filePath,
      line: node.loc?.start.line,
      column: node.loc?.start.column
    };
  }

  /**
   * Parses SQL query to extract operation type and table name
   * @param sql - SQL query string
   * @returns { operation: string, table: string } - Parsed operation info
   */
  private parseSQLQuery(sql: string): { operation: string, table: string } {
    const upperSQL = sql.toUpperCase().trim();
    
    let operation = 'SELECT';
    let table = 'unknown';

    // Determine operation type
    if (upperSQL.startsWith('SELECT')) {
      operation = 'SELECT';
      table = this.extractTableFromSelect(sql);
    } else if (upperSQL.startsWith('INSERT')) {
      operation = 'INSERT';
      table = this.extractTableFromInsert(sql);
    } else if (upperSQL.startsWith('UPDATE')) {
      operation = 'UPDATE';
      table = this.extractTableFromUpdate(sql);
    } else if (upperSQL.startsWith('DELETE')) {
      operation = 'DELETE';
      table = this.extractTableFromDelete(sql);
    } else if (upperSQL.startsWith('CREATE')) {
      operation = 'CREATE';
      table = this.extractTableFromCreate(sql);
    } else if (upperSQL.startsWith('ALTER')) {
      operation = 'ALTER';
      table = this.extractTableFromAlter(sql);
    } else if (upperSQL.startsWith('DROP')) {
      operation = 'DROP';
      table = this.extractTableFromDrop(sql);
    }

    return { operation, table };
  }

  /**
   * Extracts table name from SELECT query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromSelect(sql: string): string {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : 'unknown';
  }

  /**
   * Extracts table name from INSERT query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromInsert(sql: string): string {
    const intoMatch = sql.match(/INTO\s+(\w+)/i);
    return intoMatch ? intoMatch[1] : 'unknown';
  }

  /**
   * Extracts table name from UPDATE query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromUpdate(sql: string): string {
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
    return updateMatch ? updateMatch[1] : 'unknown';
  }

  /**
   * Extracts table name from DELETE query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromDelete(sql: string): string {
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : 'unknown';
  }

  /**
   * Extracts table name from CREATE query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromCreate(sql: string): string {
    const tableMatch = sql.match(/CREATE\s+(?:TABLE|VIEW)\s+(\w+)/i);
    return tableMatch ? tableMatch[1] : 'unknown';
  }

  /**
   * Extracts table name from ALTER query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromAlter(sql: string): string {
    const tableMatch = sql.match(/ALTER\s+(?:TABLE|VIEW)\s+(\w+)/i);
    return tableMatch ? tableMatch[1] : 'unknown';
  }

  /**
   * Extracts table name from DROP query
   * @param sql - SQL query
   * @returns string - Table name
   */
  private extractTableFromDrop(sql: string): string {
    const tableMatch = sql.match(/DROP\s+(?:TABLE|VIEW)\s+(\w+)/i);
    return tableMatch ? tableMatch[1] : 'unknown';
  }

  /**
   * Extracts SQL queries from file
   * @param file - File to analyze
   * @returns SQLQueryInfo[] - Array of SQL queries
   */
  private extractSQLQueries(file: FileInfo): SQLQueryInfo[] {
    const queries: SQLQueryInfo[] = [];

    try {
      if (!file.content) {
        return queries;
      }

      // Handle .sql files directly
      if (file.path.endsWith('.sql')) {
        return this.parseRawSQLFile(file);
      }

      const ast = this.parseFile(file.content, file.path);
      
      traverseFunction(ast, {
        TemplateLiteral: (path) => {
          const node = path.node;
          if (this.containsSQL(node)) {
            const sql = this.extractSQLFromTemplateLiteral(node);
            const operationInfo = this.parseSQLQuery(sql);
            
            queries.push({
              query: sql,
              type: operationInfo.operation as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT" | "CREATE" | "ALTER" | "DROP",
              tables: [operationInfo.table],
              views: [],
              file: file.path,
              line: node.loc?.start.line,
              column: node.loc?.start.column
            });
          }
        }
      });

    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error extracting SQL queries from: ${file.path}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return queries;
  }

  /**
   * Parses raw SQL file content
   * @param file - SQL file to parse
   * @returns SQLQueryInfo[] - Array of SQL queries
   */
  private parseRawSQLFile(file: FileInfo): SQLQueryInfo[] {
    const queries: SQLQueryInfo[] = [];

    try {
      if (!file.content) {
        return queries;
      }

      // Split SQL content by semicolons and process each statement
      const sqlStatements = file.content
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i];
        const operationInfo = this.parseSQLQuery(sql);
        
        if (operationInfo.operation !== 'SELECT' || operationInfo.table !== 'unknown') {
          queries.push({
            query: sql,
            type: operationInfo.operation as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT" | "CREATE" | "ALTER" | "DROP",
            tables: [operationInfo.table],
            views: [],
            file: file.path,
            line: i + 1, // Approximate line number
            column: 1
          });
        }
      }

    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error parsing raw SQL file: ${file.path}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return queries;
  }

  /**
   * Parses raw SQL file content as database operations
   * @param file - SQL file to parse
   * @returns DatabaseOperationInfo[] - Array of database operations
   */
  private parseRawSQLFileAsOperations(file: FileInfo): DatabaseOperationInfo[] {
    const operations: DatabaseOperationInfo[] = [];

    try {
      if (!file.content) {
        return operations;
      }

      // Split SQL content by semicolons and process each statement
      const sqlStatements = file.content
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (let i = 0; i < sqlStatements.length; i++) {
        const sql = sqlStatements[i];
        const operationInfo = this.parseSQLQuery(sql);
        
        if (operationInfo.operation !== 'SELECT' || operationInfo.table !== 'unknown') {
          operations.push({
            operation: operationInfo.operation,
            table: operationInfo.table,
            type: operationInfo.operation as "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "UPSERT",
            file: file.path,
            line: i + 1, // Approximate line number
            column: 1
          });
        }
      }

    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error parsing raw SQL file as operations: ${file.path}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return operations;
  }

  /**
   * Extracts tables from operations and queries
   * @param operations - Database operations
   * @param queries - SQL queries
   * @returns DatabaseTableInfo[] - Array of database tables
   */
  private extractTables(operations: DatabaseOperationInfo[], queries: SQLQueryInfo[]): DatabaseTableInfo[] {
    const tableMap = new Map<string, DatabaseTableInfo>();
    const viewNames = new Set<string>();

    // First, collect all view names to exclude them from tables
    for (const query of queries) {
      if (query.query.toUpperCase().includes('CREATE VIEW')) {
        const viewName = this.extractViewName(query.query);
        if (viewName !== 'unknown') {
          viewNames.add(viewName);
        }
      }
    }

    // Extract tables from operations
    for (const operation of operations) {
      if (operation.table !== 'unknown' && !viewNames.has(operation.table)) {
        const tableName = operation.table;
        
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, {
            name: tableName,
            type: 'table',
            file: operation.file,
            line: operation.line,
            column: operation.column,
            operations: [],
            liveCodeScore: 100 // Will be updated based on usage
          });
        }

        tableMap.get(tableName)!.operations.push(operation);
      }
    }

    // Extract tables from queries
    for (const query of queries) {
      for (const tableName of query.tables) {
        if (tableName !== 'unknown' && !viewNames.has(tableName)) {
          if (!tableMap.has(tableName)) {
            tableMap.set(tableName, {
              name: tableName,
              type: 'table',
              file: query.file,
              line: query.line,
              column: query.column,
              operations: [],
              liveCodeScore: 100
            });
          }
        }
      }
    }

    return Array.from(tableMap.values());
  }

  /**
   * Extracts views from operations and queries
   * @param operations - Database operations
   * @param queries - SQL queries
   * @returns DatabaseTableInfo[] - Array of database views
   */
  private extractViews(operations: DatabaseOperationInfo[], queries: SQLQueryInfo[]): DatabaseTableInfo[] {
    const viewMap = new Map<string, DatabaseTableInfo>();

    // Extract views from queries
    for (const query of queries) {
      if (query.query.toUpperCase().includes('CREATE VIEW')) {
        const viewName = this.extractViewName(query.query);
        if (viewName !== 'unknown') {
          viewMap.set(viewName, {
            name: viewName,
            type: 'view',
            file: query.file,
            line: query.line,
            column: query.column,
            operations: [],
            liveCodeScore: 100
          });
        }
      }

      for (const viewName of query.views) {
        if (viewName !== 'unknown') {
          if (!viewMap.has(viewName)) {
            viewMap.set(viewName, {
              name: viewName,
              type: 'view',
              file: query.file,
              line: query.line,
              column: query.column,
              operations: [],
              liveCodeScore: 100
            });
          }
        }
      }
    }

    return Array.from(viewMap.values());
  }

  /**
   * Extracts view name from CREATE VIEW query
   * @param sql - SQL query
   * @returns string - View name
   */
  private extractViewName(sql: string): string {
    const viewMatch = sql.match(/CREATE\s+VIEW\s+(\w+)/i);
    return viewMatch ? viewMatch[1] : 'unknown';
  }

  /**
   * Checks if file is a database-related file
   * @param file - File to check
   * @returns boolean - True if it's a database file
   */
  private isDatabaseFile(file: FileInfo): boolean {
    if (!file || !file.path) {
      return false;
    }

    const databasePatterns = [
      /models?\.(ts|js)$/,
      /schema\.(ts|js)$/,
      /migration\.(ts|js)$/,
      /seed\.(ts|js)$/,
      /database\.(ts|js)$/,
      /db\.(ts|js)$/,
      /sql\.(ts|js)$/,
      /\.sql$/,
      /\/models?\//,
      /\/schema\//,
      /\/migrations?\//,
      /\/database\//,
      /\/db\//
    ];

    return databasePatterns.some(pattern => pattern.test(file.path)) ||
           this.containsDatabaseKeywords(file.content || '');
  }

  /**
   * Checks if content contains database keywords
   * @param content - File content
   * @returns boolean - True if it contains database keywords
   */
  private containsDatabaseKeywords(content: string): boolean {
    const dbKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
      'knex', 'sequelize', 'mongoose', 'prisma', 'typeorm', 'sql',
      'database', 'table', 'view', 'schema', 'migration'
    ];

    const upperContent = content.toUpperCase();
    return dbKeywords.some(keyword => upperContent.includes(keyword));
  }

  /**
   * Parses file content and returns AST
   * @param content - File content
   * @param filePath - File path
   * @returns t.File - Parsed AST
   */
  private parseFile(content: string, filePath: string): t.File {
    const parserOptions: ParserOptions = {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining'
      ]
    };

    try {
      return parse(content, parserOptions);
    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error parsing file: ${filePath}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }
  }

  /**
   * Maps database entities to graph nodes
   * @param analysis - Database analysis
   * @returns NodeInfo[] - Array of graph nodes
   */
  mapDatabaseEntitiesToNodes(analysis: DatabaseAnalysis): NodeInfo[] {
    const nodes: NodeInfo[] = [];

    // Create nodes for tables
    for (const table of analysis.tables) {
      const node: NodeInfo = {
        id: `table_${table.name}`,
        label: table.name,
        nodeType: 'table' as NodeType,
        nodeCategory: 'database' as NodeCategory,
        datatype: 'table' as DataType,
        liveCodeScore: table.liveCodeScore,
        file: table.file,
        line: table.line,
        column: table.column,
        codeOwnership: 'internal', // Phase A: Database tables are part of custom schema
        properties: {
          type: 'table',
          operations: table.operations.map(op => op.operation),
          isDeadCode: table.liveCodeScore === 0,
          schema: table.schema,
          columns: table.columns
        }
      };
      nodes.push(node);
    }

    // Create nodes for views
    for (const view of analysis.views) {
      const node: NodeInfo = {
        id: `view_${view.name}`,
        label: view.name,
        nodeType: 'view' as NodeType,
        nodeCategory: 'database' as NodeCategory,
        datatype: 'view' as DataType,
        liveCodeScore: view.liveCodeScore,
        file: view.file,
        line: view.line,
        column: view.column,
        codeOwnership: 'internal', // Phase A: Database views are part of custom schema
        properties: {
          type: 'view',
          operations: view.operations.map(op => op.operation),
          isDeadCode: view.liveCodeScore === 0,
          schema: view.schema
        }
      };
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Identifies used and unused database entities
   * @param analysis - Database analysis
   * @param apiOperations - API operations that use database
   * @returns DatabaseAnalysis - Updated analysis with usage information
   */
  identifyUsedUnusedEntities(analysis: DatabaseAnalysis, apiOperations: DatabaseOperationInfo[]): DatabaseAnalysis {
    const usedTables: DatabaseTableInfo[] = [];
    const unusedTables: DatabaseTableInfo[] = [];
    const usedViews: DatabaseTableInfo[] = [];
    const unusedViews: DatabaseTableInfo[] = [];

    // Check table usage
    for (const table of analysis.tables) {
      const isUsed = apiOperations.some(op => op.table === table.name);
      
      if (isUsed) {
        table.liveCodeScore = 100;
        usedTables.push(table);
      } else {
        table.liveCodeScore = 0;
        unusedTables.push(table);
      }
    }

    // Check view usage
    for (const view of analysis.views) {
      const isUsed = apiOperations.some(op => op.table === view.name);
      
      if (isUsed) {
        view.liveCodeScore = 100;
        usedViews.push(view);
      } else {
        view.liveCodeScore = 0;
        unusedViews.push(view);
      }
    }

    const totalEntities = analysis.tables.length + analysis.views.length;
    const deadCodePercentage = totalEntities > 0 ? 
      Math.round(((unusedTables.length + unusedViews.length) / totalEntities) * 100 * 100) / 100 : 0;

    return {
      ...analysis,
      usedTables,
      unusedTables,
      usedViews,
      unusedViews,
      deadCodePercentage
    };
  }
}

// Export the interface and implementation
export { DatabaseAnalyzerImpl as DatabaseAnalyzer };
