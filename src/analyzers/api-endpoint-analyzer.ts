/**
 * API Endpoint Analyzer
 * Handles analysis of API endpoints in backend code
 * Following Phase 4.3 requirements from the architecture document
 */

import * as t from '@babel/types';
import { parse, ParserOptions } from '@babel/parser';
import traverse from '@babel/traverse';
import {
  APICallInfo,
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
 * API Endpoint Information
 * Represents an API endpoint found in backend code
 */
export interface APIEndpointInfo {
  name: string;
  path: string;
  method: string;
  file: string;
  line?: number;
  column?: number;
  parameters: string[];
  middleware: string[];
  handlers: string[];
  normalizedPath: string;
  liveCodeScore: number;
}


/**
 * Backend Route Analysis Result
 * Contains information about backend routes and their usage
 */
export interface BackendRouteAnalysis {
  routes: APIEndpointInfo[];
  middleware: string[];
  unusedEndpoints: APIEndpointInfo[];
  usedEndpoints: APIEndpointInfo[];
  totalEndpoints: number;
  deadCodePercentage: number;
}

/**
 * API Endpoint Analyzer Implementation
 * Analyzes backend code to identify API endpoints, routes, and their usage
 */
export class APIEndpointAnalyzerImpl {
  private logger?: AnalysisLogger;
  private endpointCounter: number = 0;

  /**
   * Constructor initializes the API endpoint analyzer
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Analyzes backend files for API endpoints
   * Identifies Express.js routes, middleware, and API handlers
   * 
   * @param files - Array of backend files to analyze
   * @returns BackendRouteAnalysis - Analysis of backend routes and endpoints
   */
  analyzeBackendFiles(files: FileInfo[]): BackendRouteAnalysis {
    try {
      if (this.logger) {
        this.logger.logInfo('Starting backend API endpoint analysis', {
          fileCount: files.length
        });
      }

      const routes: APIEndpointInfo[] = [];
      const middleware: string[] = [];

      // Analyze each backend file
      for (const file of files) {
        if (file && this.isBackendFile(file)) {
          const fileRoutes = this.analyzeBackendFile(file);
          routes.push(...fileRoutes);

          // Extract middleware from the file
          const fileMiddleware = this.extractMiddleware(file);
          middleware.push(...fileMiddleware);
        }
      }

      // Calculate usage statistics
      const usedEndpoints = routes.filter(route => route.liveCodeScore > 0);
      const unusedEndpoints = routes.filter(route => route.liveCodeScore === 0);
      const deadCodePercentage = routes.length > 0 ? (unusedEndpoints.length / routes.length) * 100 : 0;

      const analysis: BackendRouteAnalysis = {
        routes,
        middleware: [...new Set(middleware)], // Remove duplicates
        usedEndpoints,
        unusedEndpoints,
        totalEndpoints: routes.length,
        deadCodePercentage
      };

      if (this.logger) {
        this.logger.logInfo('Backend API endpoint analysis completed', {
          totalEndpoints: analysis.totalEndpoints,
          usedEndpoints: analysis.usedEndpoints.length,
          unusedEndpoints: analysis.unusedEndpoints.length,
          deadCodePercentage: analysis.deadCodePercentage.toFixed(2)
        });
      }

      return analysis;

    } catch (error) {
      const errorMessage = `Failed to analyze backend files: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Analyzes a single backend file for API endpoints
   * @param file - File to analyze
   * @returns APIEndpointInfo[] - Array of found API endpoints
   */
  private analyzeBackendFile(file: FileInfo): APIEndpointInfo[] {
    const endpoints: APIEndpointInfo[] = [];

    try {
      if (!file.content) {
        return endpoints;
      }

      // Parse the file
      const ast = this.parseFile(file.content, file.path);
      
      // Traverse AST to find API endpoints
      this.traverseForEndpoints(ast, file.path, endpoints);

    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error analyzing backend file: ${file.path}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return endpoints;
  }

  /**
   * Traverses AST to find API endpoint definitions
   * @param ast - AST to traverse
   * @param filePath - File path
   * @param endpoints - Array to collect endpoints
   */
  private traverseForEndpoints(ast: t.File, filePath: string, endpoints: APIEndpointInfo[]): void {
    traverseFunction(ast, {
      // Find Express.js route definitions
      CallExpression: (path) => {
        const node = path.node;
        
        // Check for app.get, app.post, app.put, app.delete, etc.
        if (t.isMemberExpression(node.callee)) {
          const method = this.extractHTTPMethod(node.callee);
          if (method) {
            const endpoint = this.extractEndpointFromRoute(node, method, filePath);
            if (endpoint) {
              endpoints.push(endpoint);
            }
          }
        }

        // Check for router.route() patterns
        if (this.isRouterPattern(node)) {
          const routerEndpoints = this.extractRouterEndpoints(node, filePath);
          endpoints.push(...routerEndpoints);
        }
      },

      // Find middleware definitions
      VariableDeclaration: (path) => {
        const node = path.node;
        // Look for middleware patterns like const auth = require('auth')
        this.extractMiddlewareFromDeclaration(node, filePath);
      }
    });
  }

  /**
   * Extracts HTTP method from member expression
   * @param callee - Member expression callee
   * @returns string | null - HTTP method or null
   */
  private extractHTTPMethod(callee: t.MemberExpression): string | null {
    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
    
    if (t.isIdentifier(callee.property)) {
      const method = callee.property.name.toLowerCase();
      if (httpMethods.includes(method)) {
        return method.toUpperCase();
      }
    }
    
    return null;
  }

  /**
   * Extracts endpoint information from route definition
   * @param node - Call expression node
   * @param method - HTTP method
   * @param filePath - File path
   * @returns APIEndpointInfo | null - Endpoint info or null
   */
  private extractEndpointFromRoute(node: t.CallExpression, method: string, filePath: string): APIEndpointInfo | null {
    if (!node.arguments || node.arguments.length < 1) {
      return null;
    }

    const pathArg = node.arguments[0];
    let path = '/unknown';

    // Extract path from string literal or template literal
    if (t.isStringLiteral(pathArg)) {
      path = pathArg.value;
    } else if (t.isTemplateLiteral(pathArg)) {
      path = this.extractPathFromTemplate(pathArg);
    }

    // Extract parameters from path
    const parameters = this.extractPathParameters(path);
    
    // Extract middleware and handlers
    const middleware = this.extractMiddlewareFromRoute(node);
    const handlers = this.extractHandlersFromRoute(node);

    // Normalize path
    const normalizedPath = this.normalizePath(path);

    return {
      name: `${method} ${path}`,
      path,
      method,
      file: filePath,
      line: node.loc?.start.line,
      column: node.loc?.start.column,
      parameters,
      middleware,
      handlers,
      normalizedPath,
      liveCodeScore: 100 // Will be calculated later based on usage
    };
  }

  /**
   * Extracts path from template literal
   * @param template - Template literal node
   * @returns string - Extracted path
   */
  private extractPathFromTemplate(template: t.TemplateLiteral): string {
    let path = '';
    
    for (let i = 0; i < template.quasis.length; i++) {
      path += template.quasis[i].value.raw;
      
      if (i < template.expressions.length) {
        // For template expressions, use placeholder
        path += ':param';
      }
    }
    
    return path;
  }

  /**
   * Extracts parameters from path
   * @param path - Path string
   * @returns string[] - Array of parameter names
   */
  private extractPathParameters(path: string): string[] {
    const parameters: string[] = [];
    const paramRegex = /:(\w+)/g;
    let match;
    
    while ((match = paramRegex.exec(path)) !== null) {
      parameters.push(match[1]);
    }
    
    return parameters;
  }

  /**
   * Extracts middleware from route definition
   * @param node - Call expression node
   * @returns string[] - Array of middleware names
   */
  private extractMiddlewareFromRoute(node: t.CallExpression): string[] {
    const middleware: string[] = [];
    
    // Skip the first argument (path) and look for middleware functions
    for (let i = 1; i < node.arguments.length - 1; i++) {
      const arg = node.arguments[i];
      
      if (t.isIdentifier(arg)) {
        middleware.push(`middleware_${arg.name}`);
      } else if (t.isMemberExpression(arg)) {
        const name = this.getMemberExpressionName(arg);
        if (name) {
          middleware.push(`middleware_${name}`);
        }
      }
    }
    
    return middleware;
  }

  /**
   * Extracts handlers from route definition
   * @param node - Call expression node
   * @returns string[] - Array of handler names
   */
  private extractHandlersFromRoute(node: t.CallExpression): string[] {
    const handlers: string[] = [];
    
    // The last argument is typically the main handler
    if (node.arguments.length > 0) {
      const lastArg = node.arguments[node.arguments.length - 1];
      
      if (t.isIdentifier(lastArg)) {
        handlers.push(`handler_${lastArg.name}`);
      } else if (t.isArrowFunctionExpression(lastArg) || t.isFunctionExpression(lastArg)) {
        handlers.push(`anonymous_handler_${this.endpointCounter++}`);
      } else if (t.isMemberExpression(lastArg)) {
        const name = this.getMemberExpressionName(lastArg);
        if (name) {
          handlers.push(`handler_${name}`);
        }
      }
    }
    
    return handlers;
  }

  /**
   * Normalizes path by parameterizing specific values
   * @param path - Original path
   * @returns string - Normalized path
   */
  private normalizePath(path: string): string {
    // Replace numeric IDs with :id
    let normalized = path.replace(/\/\d+/g, '/:id');
    
    // Replace UUIDs with :uuid
    normalized = normalized.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid');
    
    // Replace camelCase with :camelCase
    normalized = normalized.replace(/\/[A-Z][a-zA-Z0-9]*\d+/g, '/:camelCase');
    
    return normalized;
  }

  /**
   * Checks if node is a router pattern
   * @param node - Call expression node
   * @returns boolean - True if it's a router pattern
   */
  private isRouterPattern(node: t.CallExpression): boolean {
    if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
      return node.callee.property.name === 'route';
    }
    return false;
  }

  /**
   * Extracts endpoints from router pattern
   * @param node - Call expression node
   * @param filePath - File path
   * @returns APIEndpointInfo[] - Array of endpoints
   */
  private extractRouterEndpoints(node: t.CallExpression, filePath: string): APIEndpointInfo[] {
    // This is a simplified implementation
    // In a real implementation, you'd need to track the router context
    // and extract all the HTTP methods defined on the router
    void node;
    void filePath;
    
    return [];
  }

  /**
   * Extracts middleware from variable declaration
   * @param node - Variable declaration node
   * @param filePath - File path
   */
  private extractMiddlewareFromDeclaration(node: t.VariableDeclaration, filePath: string): void {
    // Implementation for extracting middleware from variable declarations
    // This would identify patterns like const auth = require('passport')
    // Currently not implemented - parameters kept for future use
    void node;
    void filePath;
  }

  /**
   * Gets member expression name
   * @param node - Member expression node
   * @returns string | null - Member expression name or null
   */
  private getMemberExpressionName(node: t.MemberExpression): string | null {
    if (t.isIdentifier(node.object) && t.isIdentifier(node.property)) {
      return `${node.object.name}.${node.property.name}`;
    }
    return null;
  }

  /**
   * Checks if file is a backend file
   * @param file - File to check
   * @returns boolean - True if it's a backend file
   */
  private isBackendFile(file: FileInfo): boolean {
    if (!file || !file.path) {
      return false;
    }

    const backendPatterns = [
      /server\.(ts|js)$/,
      /routes?\.(ts|js)$/,
      /api\.(ts|js)$/,
      /middleware\.(ts|js)$/,
      /controllers?\.(ts|js)$/,
      /\/routes?\//,
      /\/api\//,
      /\/server\//,
      /\/backend\//,
      /\/middleware\//,
      /^middleware\//
    ];

    return backendPatterns.some(pattern => pattern.test(file.path));
  }

  /**
   * Extracts middleware from file
   * @param file - File to analyze
   * @returns string[] - Array of middleware names
   */
  private extractMiddleware(file: FileInfo): string[] {
    const middleware: string[] = [];
    
    try {
      if (!file.content) {
        return middleware;
      }

      const ast = this.parseFile(file.content, file.path);
      
      traverseFunction(ast, {
        VariableDeclaration: (path) => {
          const node = path.node;
          // Look for middleware patterns
          node.declarations.forEach(decl => {
            if (t.isIdentifier(decl.id) && this.isMiddlewareName(decl.id.name)) {
              middleware.push(decl.id.name);
            }
          });
        },
        
        // Also look for function declarations that might be middleware
        FunctionDeclaration: (path) => {
          const node = path.node;
          if (node.id && this.isMiddlewareName(node.id.name)) {
            middleware.push(node.id.name);
          }
        },
        
        // Look for module.exports patterns
        AssignmentExpression: (path) => {
          const node = path.node;
          if (t.isMemberExpression(node.left) && 
              t.isIdentifier(node.left.object) && 
              node.left.object.name === 'module' &&
              t.isIdentifier(node.left.property) && 
              node.left.property.name === 'exports') {
            
            if (t.isObjectExpression(node.right)) {
              node.right.properties.forEach(prop => {
                if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                  if (this.isMiddlewareName(prop.key.name)) {
                    middleware.push(prop.key.name);
                  }
                }
              });
            }
          }
        }
      });

    } catch (error) {
      if (this.logger) {
        this.logger.logError(`Error extracting middleware from: ${file.path}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return middleware;
  }

  /**
   * Checks if name suggests middleware
   * @param name - Name to check
   * @returns boolean - True if it suggests middleware
   */
  private isMiddlewareName(name: string): boolean {
    const middlewarePatterns = [
      /middleware/i,
      /auth/i,
      /cors/i,
      /helmet/i,
      /logger/i,
      /validate/i,
      /rateLimit/i
    ];

    return middlewarePatterns.some(pattern => pattern.test(name));
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
   * Maps backend routes to graph nodes
   * @param analysis - Backend route analysis
   * @returns NodeInfo[] - Array of graph nodes
   */
  mapRoutesToNodes(analysis: BackendRouteAnalysis): NodeInfo[] {
    const nodes: NodeInfo[] = [];

    // Create nodes for API endpoints
    for (const route of analysis.routes) {
      const node: NodeInfo = {
        id: `api_${route.name.replace(/\s+/g, '_').toLowerCase()}`,
        label: route.name,
        nodeType: 'API' as NodeType,
        nodeCategory: 'middleware' as NodeCategory,
        datatype: 'array' as DataType,
        liveCodeScore: route.liveCodeScore,
        file: route.file,
        line: route.line,
        column: route.column,
        codeOwnership: 'internal', // Phase A: API endpoints are custom code
        properties: {
          method: route.method,
          path: route.path,
          normalizedPath: route.normalizedPath,
          parameters: route.parameters,
          middleware: route.middleware,
          handlers: route.handlers,
          isDeadCode: route.liveCodeScore === 0
        }
      };
      nodes.push(node);
    }

    // Create nodes for middleware
    for (const middlewareName of analysis.middleware) {
      const node: NodeInfo = {
        id: `middleware_${middlewareName}`,
        label: middlewareName,
        nodeType: 'function' as NodeType,
        nodeCategory: 'middleware' as NodeCategory,
        datatype: 'array' as DataType,
        liveCodeScore: 100, // Middleware is assumed to be used
        file: 'unknown',
        codeOwnership: 'internal', // Phase A: Middleware are custom code functions
        properties: {
          type: 'middleware',
          isMiddleware: true
        }
      };
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Identifies used and unused API endpoints
   * @param analysis - Backend route analysis
   * @param frontendCalls - Frontend API calls
   * @returns BackendRouteAnalysis - Updated analysis with usage information
   */
  identifyUsedUnusedEndpoints(analysis: BackendRouteAnalysis, frontendCalls: APICallInfo[]): BackendRouteAnalysis {
    const usedEndpoints: APIEndpointInfo[] = [];
    const unusedEndpoints: APIEndpointInfo[] = [];

    for (const route of analysis.routes) {
      // Check if this endpoint is called from frontend
      const isUsed = frontendCalls.some(call => 
        this.endpointsMatch(call.normalizedEndpoint, route.normalizedPath) ||
        this.endpointsMatch(call.endpoint, route.path)
      );

      if (isUsed) {
        route.liveCodeScore = 100;
        usedEndpoints.push(route);
      } else {
        route.liveCodeScore = 0;
        unusedEndpoints.push(route);
      }
    }

    return {
      ...analysis,
      usedEndpoints,
      unusedEndpoints,
      deadCodePercentage: analysis.routes.length > 0 ? Math.round((unusedEndpoints.length / analysis.routes.length) * 100 * 100) / 100 : 0
    };
  }

  /**
   * Checks if two endpoints match
   * @param endpoint1 - First endpoint
   * @param endpoint2 - Second endpoint
   * @returns boolean - True if endpoints match
   */
  private endpointsMatch(endpoint1: string, endpoint2: string): boolean {
    // Normalize both endpoints for comparison
    const normalized1 = this.normalizePath(endpoint1);
    const normalized2 = this.normalizePath(endpoint2);
    
    return normalized1 === normalized2 || endpoint1 === endpoint2;
  }
}

// Export the interface and implementation
export { APIEndpointAnalyzerImpl as APIEndpointAnalyzer };
