/**
 * Dependency Analyzer
 * Handles dependency analysis and graph building for React/TypeScript codebases
 * Following Phase 3.4 requirements from the architecture document
 */

import {
  DependencyAnalyzer,
  DependencyGraph,
  NodeInfo,
  EdgeInfo,
  ComponentInfo,
  APICallInfo,
  ServiceInfo,
  ServiceGraph,
  DatabaseOperationInfo,
  CycleInfo,
  GraphMetadata,
  NodeType,
  NodeCategory,
  DataType,
  RelationshipType,
  AnalysisError,
  InformativeElement,
  ImportInfo,
  PatternAnalysisResult,
  PatternInfo,
  PatternType,
  UsageInfo,
  UsageStatistics,
  DeadCodeInfo,
  PerformanceWarning,
  FileInfo
} from '../types/index.js';
import { AnalysisLogger } from './analysis-logger.js';
import { UsageTrackerImpl } from './usage-tracker.js';
import { APIEndpointAnalyzerImpl, BackendRouteAnalysis } from './api-endpoint-analyzer.js';
import { DatabaseAnalyzerImpl, DatabaseAnalysis } from './database-analyzer.js';
import { ConnectionMapperImpl } from './connection-mapper.js';
import { APIBackendProgressIndicatorImpl } from './api-backend-progress-indicator.js';
// Note: path-to-regexp imports removed as we're using custom segment-based parsing

/**
 * Dependency Analyzer Implementation
 * Analyzes component dependencies and builds comprehensive dependency graphs
 * Implements all methods from the DependencyAnalyzer interface
 */
export class DependencyAnalyzerImpl implements DependencyAnalyzer {
  private logger?: AnalysisLogger;
  private nodeCounter: number = 0;
  private edgeCounter: number = 0;
  private usageTracker: UsageTrackerImpl;
  private apiEndpointAnalyzer: APIEndpointAnalyzerImpl;
  private databaseAnalyzer: DatabaseAnalyzerImpl;
  private connectionMapper: ConnectionMapperImpl;
  private progressIndicator: APIBackendProgressIndicatorImpl;

  /**
   * Constructor initializes the dependency analyzer
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
    this.usageTracker = new UsageTrackerImpl(logger);
    this.apiEndpointAnalyzer = new APIEndpointAnalyzerImpl(logger);
    this.databaseAnalyzer = new DatabaseAnalyzerImpl(logger);
    this.connectionMapper = new ConnectionMapperImpl(logger);
    this.progressIndicator = new APIBackendProgressIndicatorImpl(logger);
  }

  /**
   * Builds a comprehensive dependency graph from component information
   * Creates nodes for all components, functions, APIs, and database entities
   * 
   * @param components - Array of component information to analyze
   * @returns DependencyGraph - Complete dependency graph with nodes and edges
   */
  buildDependencyGraph(components: ComponentInfo[]): DependencyGraph {
    try {
      if (this.logger) {
        this.logger.logInfo('Starting dependency graph construction', {
          componentCount: components.length
        });
      }

      // Reset counters for new graph
      this.nodeCounter = 0;
      this.edgeCounter = 0;

      // Track component usage for live code score calculation
      const usageInfos = this.usageTracker.trackComponentUsage(components);
      const liveCodeScores = this.usageTracker.calculateLiveCodeScores(usageInfos);

      // Create nodes from components
      const nodes = this.createNodesFromComponents(components, liveCodeScores);

      // Create edges between nodes
      const edges = this.createEdges(nodes);

      // Create metadata
      const metadata = this.createGraphMetadata(components, nodes, edges);

      const graph: DependencyGraph = {
        nodes,
        edges,
        metadata
      };

      if (this.logger) {
        this.logger.logInfo('Dependency graph construction completed', {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          deadCodeNodes: nodes.filter(n => n.liveCodeScore === 0).length,
          liveCodeNodes: nodes.filter(n => n.liveCodeScore === 100).length
        });
      }

      return graph;

    } catch (error) {
      const errorMessage = `Failed to build dependency graph: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Traces API calls from components
   * Identifies all API endpoints called by components
   * 
   * @param components - Array of component information to analyze
   * @returns APICallInfo[] - Array of API call information
   */
  traceAPICalls(components: ComponentInfo[]): APICallInfo[] {
    const apiCalls: APICallInfo[] = [];

    try {
      for (const component of components) {
        // Look for API calls in informative elements
        for (const element of component.informativeElements) {
          if (element.type === 'data-source') {
            const apiCall = this.extractAPICallFromElement(element, component.file);
            if (apiCall) {
              apiCalls.push(apiCall);
            }
          }
        }

        // Look for API calls in imports (external API libraries)
        for (const importInfo of component.imports) {
          if (this.isAPILibrary(importInfo.source)) {
            const apiCall = this.createAPICallFromImport(importInfo, component.file);
            if (apiCall) {
              apiCalls.push(apiCall);
            }
          }
        }
      }

      if (this.logger) {
        this.logger.logInfo('API call tracing completed', {
          totalAPICalls: apiCalls.length,
          uniqueEndpoints: new Set(apiCalls.map(call => call.endpoint)).size
        });
      }

      return apiCalls;

    } catch (error) {
      const errorMessage = `Failed to trace API calls: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Analyzes service dependencies
   * Maps service layer dependencies and operations
   * 
   * @param services - Array of service information to analyze
   * @returns ServiceGraph - Service dependency graph
   */
  analyzeServiceDependencies(services: ServiceInfo[]): ServiceGraph {
    const dependencies: Array<{ from: string; to: string; type: string; operations: string[] }> = [];

    try {
      for (const service of services) {
        // Analyze service dependencies
        for (const dependency of service.dependencies) {
          const serviceDependency = {
            from: service.name,
            to: dependency,
            type: 'service-call',
            operations: service.operations.map(op => op.name)
          };
          dependencies.push(serviceDependency);
        }

        // Analyze operation dependencies within service
        for (const operation of service.operations) {
          for (const dbOp of operation.databaseOperations) {
            const dbDependency = {
              from: `${service.name}.${operation.name}`,
              to: dbOp.table,
              type: 'database-operation',
              operations: [dbOp.operation]
            };
            dependencies.push(dbDependency);
          }
        }
      }

      if (this.logger) {
        this.logger.logInfo('Service dependency analysis completed', {
          totalServices: services.length,
          totalDependencies: dependencies.length
        });
      }

      return {
        services,
        dependencies
      };

    } catch (error) {
      const errorMessage = `Failed to analyze service dependencies: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Maps database operations from services
   * Connects service operations to database tables and views
   * 
   * @param services - Array of service information to analyze
   * @returns DatabaseOperationInfo[] - Array of database operation information
   */
  mapDatabaseOperations(services: ServiceInfo[]): DatabaseOperationInfo[] {
    const dbOperations: DatabaseOperationInfo[] = [];

    try {
      for (const service of services) {
        for (const operation of service.operations) {
          for (const dbOp of operation.databaseOperations) {
            const dbOperationInfo: DatabaseOperationInfo = {
              operation: dbOp.operation,
              table: dbOp.table,
              type: dbOp.type,
              file: service.file,
              line: undefined, // Will be filled from AST analysis
              column: undefined
            };
            dbOperations.push(dbOperationInfo);
          }
        }
      }

      if (this.logger) {
        this.logger.logInfo('Database operation mapping completed', {
          totalOperations: dbOperations.length,
          uniqueTables: new Set(dbOperations.map(op => op.table)).size
        });
      }

      return dbOperations;

    } catch (error) {
      const errorMessage = `Failed to map database operations: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Creates edges between nodes based on their relationships
   * Implements edge creation rules from the architecture document
   * 
   * Phase 2 Enhancement: Added JSX usage edge creation to capture component rendering relationships
   * This is critical for building a complete dependency graph where we can see which components
   * render which other components (e.g., MainComponent renders Hello component).
   * 
   * @param nodes - Array of nodes to create edges for
   * @returns EdgeInfo[] - Array of edge information
   */
  createEdges(nodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    try {
      // Create edges based on node relationships
      for (const node of nodes) {
        // Create edges for component imports
        if (node.nodeType === 'function' && node.nodeCategory === 'front end') {
          const importEdges = this.createImportEdges(node, nodes);
          edges.push(...importEdges);
        }

        // Create edges for API calls
        if (node.nodeType === 'API') {
          const apiEdges = this.createAPIEdges(node, nodes);
          edges.push(...apiEdges);
        }

        // Create edges for database operations
        if (node.nodeType === 'table' || node.nodeType === 'view') {
          const dbEdges = this.createDatabaseEdges();
          edges.push(...dbEdges);
        }
      }

      // Phase 2: Create JSX usage edges (component A renders component B)
      // This detects when a JSX element represents a component being rendered
      // Example: <Hello /> in index.tsx should create an edge from index component to Hello component
      const jsxUsageEdges = this.createJSXUsageEdges(nodes);
      edges.push(...jsxUsageEdges);

      // Remove duplicate edges
      const uniqueEdges = this.removeDuplicateEdges(edges);

      if (this.logger) {
        this.logger.logInfo('Edge creation completed', {
          totalEdges: uniqueEdges.length,
          importEdges: uniqueEdges.filter(e => e.relationship === 'imports').length,
          callEdges: uniqueEdges.filter(e => e.relationship === 'calls').length,
          rendersEdges: uniqueEdges.filter(e => e.relationship === 'renders').length,
          dataEdges: uniqueEdges.filter(e => e.relationship === 'reads' || e.relationship === 'writes to').length
        });
      }

      return uniqueEdges;

    } catch (error) {
      const errorMessage = `Failed to create edges: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Normalizes API endpoints by parameterizing specific values
   * Uses path-to-regexp for robust pattern detection and normalization
   * 
   * @param endpoints - Array of API endpoints to normalize
   * @returns string[] - Array of normalized endpoints
   */
  normalizeAPIEndpoints(endpoints: string[]): string[] {
    try {
      const normalizedEndpoints = endpoints.map(endpoint => this.normalizeEndpoint(endpoint));

      if (this.logger) {
        this.logger.logInfo('API endpoint normalization completed', {
          originalEndpoints: endpoints.length,
          uniqueNormalized: new Set(normalizedEndpoints).size
        });
      }

      return normalizedEndpoints;

    } catch (error) {
      const errorMessage = `Failed to normalize API endpoints: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Normalizes a single endpoint using path-to-regexp parsing
   * @param endpoint The endpoint to normalize
   * @returns Normalized endpoint string
   */
  private normalizeEndpoint(endpoint: string): string {
    try {
      // Split endpoint into path and query/fragment parts
      const [pathPart, queryPart, fragmentPart] = this.splitEndpoint(endpoint);
      
      // Parse the path part
      const normalizedPath = this.normalizePath(pathPart);
      
      // Reconstruct the endpoint
      let normalized = normalizedPath;
      if (queryPart) {
        normalized += '?:query';
      }
      if (fragmentPart) {
        normalized += '#:fragment';
      }
      
      return normalized;
    } catch {
      // If parsing fails, return original endpoint
      return endpoint;
    }
  }

  /**
   * Splits endpoint into path, query, and fragment parts
   * @param endpoint The full endpoint string
   * @returns Array of [path, query, fragment]
   */
  private splitEndpoint(endpoint: string): [string, string?, string?] {
    const fragmentIndex = endpoint.indexOf('#');
    const queryIndex = endpoint.indexOf('?');
    
    let pathPart = endpoint;
    let queryPart: string | undefined;
    let fragmentPart: string | undefined;
    
    if (fragmentIndex !== -1) {
      fragmentPart = endpoint.substring(fragmentIndex + 1);
      pathPart = endpoint.substring(0, fragmentIndex);
    }
    
    if (queryIndex !== -1) {
      const queryEnd = fragmentIndex !== -1 ? fragmentIndex : endpoint.length;
      queryPart = endpoint.substring(queryIndex + 1, queryEnd);
      pathPart = endpoint.substring(0, queryIndex);
    }
    
    return [pathPart, queryPart, fragmentPart];
  }

  /**
   * Normalizes the path part of an endpoint
   * @param path The path to normalize
   * @returns Normalized path string
   */
  private normalizePath(path: string): string {
    // Split path into segments
    const segments = path.split('/').filter(segment => segment.length > 0);
    
    // Normalize each segment
    const normalizedSegments = segments.map(segment => this.normalizeSegment(segment));
    
    // Reconstruct path
    return '/' + normalizedSegments.join('/');
  }

  /**
   * Normalizes a single path segment using improved pattern matching
   * Implements fixed regex patterns to resolve test failures and improve accuracy
   * 
   * Pattern matching order is critical - static segments must be checked first
   * to avoid incorrect normalization of common API path segments
   * 
   * @param segment The segment to normalize
   * @returns Normalized segment with appropriate parameter type
   */
  private normalizeSegment(segment: string): string {
    // Check for static API segments first - these should never be normalized
    if (this.isStaticSegment(segment)) {
      return segment;
    }
    
    // Check for UUID pattern (most specific - 36 character format with hyphens)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return ':uuid';
    }
    
    // Check for version pattern (v1, v2.1, etc.) - but only if not in static segments
    if (/^v\d+(\.\d+)*$/i.test(segment)) {
      return ':version';
    }
    
    // Check for numeric ID (pure numbers only)
    if (/^\d+$/.test(segment)) {
      return ':id';
    }
    
    // Check for camelCase pattern - fixed regex to match User123, Post456, Order789
    // Pattern: starts with uppercase letter, followed by alphanumeric characters
    // This catches mixed-case identifiers like User123, Post456, Order789
    if (/^[A-Z][a-zA-Z0-9]*$/.test(segment)) {
      return ':camelCase';
    }
    
    // Check for dot-separated ID (file paths, namespaces) - before hyphenated
    if (/^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$/.test(segment)) {
      return ':path';
    }
    
    // Check for underscore ID (database keys, snake_case)
    if (/^[a-zA-Z0-9]+(_[a-zA-Z0-9]+)+$/.test(segment)) {
      return ':key';
    }
    
    // Check for hyphenated ID (slugs) - but only true slugs, not mixed alphanumeric
    // Pattern: lowercase letters/numbers separated by hyphens (kebab-case)
    // This prevents ORD-2024-001 from being classified as a slug
    if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(segment)) {
      return ':slug';
    }
    
    // Check for alphanumeric ID (generic) - but exclude common static segments
    // This catches ORD-2024-001 and similar mixed alphanumeric patterns
    if (/^[a-zA-Z0-9-]+$/.test(segment)) {
      return ':identifier';
    }
    
    // Return original segment if no pattern matches
    return segment;
  }

  /**
   * Checks if a segment is a static API path segment that should not be normalized
   * @param segment The segment to check
   * @returns True if the segment is static and should not be normalized
   */
  private isStaticSegment(segment: string): boolean {
    const staticSegments = [
      'api', 'users', 'user', 'posts', 'post', 'comments', 'comment',
      'orders', 'order', 'clubs', 'club', 'persons', 'person', 'health', 'status',
      'auth', 'login', 'logout', 'register', 'profile', 'settings', 'admin',
      'public', 'private', 'internal', 'external', 'data', 'info', 'details',
      'list', 'create', 'update', 'delete', 'get', 'post', 'put', 'patch'
    ];
    
    return staticSegments.includes(segment.toLowerCase());
  }

  /**
   * Analyzes API patterns and returns comprehensive pattern analysis
   * @param endpoints Array of API endpoint strings
   * @returns Pattern analysis result with normalized endpoints
   */
  analyzeAPIPatterns(endpoints: string[]): PatternAnalysisResult {
    try {
      // For now, use the existing normalization logic
      const normalizedEndpoints = this.normalizeAPIEndpoints(endpoints);
      
      // Create a basic pattern analysis result
      const patternDistribution: Record<PatternType, number> = {
        uuid: 0,
        numeric: 0,
        alphanumeric: 0,
        hyphenated: 0,
        underscore: 0,
        'dot-separated': 0,
        'mixed-case': 0,
        'query-param': 0,
        fragment: 0,
        versioned: 0,
        nested: 0,
        unknown: 0
      };

      // Count basic patterns
      for (const endpoint of endpoints) {
        if (endpoint.includes('uuid') || /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi.test(endpoint)) {
          patternDistribution.uuid++;
        } else if (/\d+/.test(endpoint)) {
          patternDistribution.numeric++;
        } else {
          patternDistribution.unknown++;
        }
      }

      const detectedPatterns: PatternInfo[] = [];
      if (patternDistribution.uuid > 0) {
        detectedPatterns.push({
          type: 'uuid',
          regex: /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          parameterName: 'uuid',
          confidence: 0.95,
          examples: endpoints.filter(e => /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi.test(e)).slice(0, 3),
          frequency: patternDistribution.uuid
        });
      }
      if (patternDistribution.numeric > 0) {
        detectedPatterns.push({
          type: 'numeric',
          regex: /\/\d+/g,
          parameterName: 'id',
          confidence: 0.8,
          examples: endpoints.filter(e => /\d+/.test(e)).slice(0, 3),
          frequency: patternDistribution.numeric
        });
      }

      const mostCommonPattern = detectedPatterns.length > 0 
        ? detectedPatterns.reduce((prev, current) => 
            prev.frequency > current.frequency ? prev : current
          )
        : null;

      if (this.logger) {
        this.logger.logInfo('API pattern analysis completed', {
          totalEndpoints: endpoints.length,
          detectedPatterns: detectedPatterns.length,
          mostCommonPattern: mostCommonPattern?.type,
          uniqueNormalized: new Set(normalizedEndpoints).size
        });
      }

      return {
        detectedPatterns,
        mostCommonPattern,
        patternDistribution,
        totalEndpoints: endpoints.length,
        normalizedEndpoints
      };
    } catch (error) {
      if (this.logger) {
        this.logger.logError('Error analyzing API patterns', { error: (error as Error).message, endpoints });
      }
      return {
        detectedPatterns: [],
        mostCommonPattern: null,
        patternDistribution: {} as Record<PatternType, number>,
        totalEndpoints: endpoints.length,
        normalizedEndpoints: endpoints
      };
    }
  }

  /**
   * Detects circular dependencies in the graph
   * Implements cycle detection with stopping after second traversal
   * 
   * @param graph - Dependency graph to analyze for cycles
   * @returns CycleInfo[] - Array of cycle information
   */
  detectCircularDependencies(graph: DependencyGraph): CycleInfo[] {
    const cycles: CycleInfo[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    try {
      // Build adjacency list
      const adjacencyList = this.buildAdjacencyList(graph.edges);

      // Check each node for cycles
      for (const node of graph.nodes) {
        if (!visited.has(node.id)) {
          const nodeCycles = this.detectCyclesFromNode(
            node.id, 
            adjacencyList, 
            visited, 
            recursionStack, 
            []
          );
          cycles.push(...nodeCycles);
        }
      }

      if (this.logger) {
        this.logger.logInfo('Circular dependency detection completed', {
          totalCycles: cycles.length,
          errorCycles: cycles.filter(c => c.severity === 'error').length,
          warningCycles: cycles.filter(c => c.severity === 'warning').length
        });
      }

      return cycles;

    } catch (error) {
      const errorMessage = `Failed to detect circular dependencies: ${error instanceof Error ? error.message : String(error)}`;
      
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

  // Private helper methods

  /**
   * Creates nodes from component information
   * @param components - Array of component information
   * @param liveCodeScores - Map of component IDs to live code scores
   * @returns NodeInfo[] - Array of created nodes
   */
  private createNodesFromComponents(components: ComponentInfo[], liveCodeScores: Map<string, number>): NodeInfo[] {
    const nodes: NodeInfo[] = [];

    for (const component of components) {
      // Create main component node with live code score
      const componentNode = this.createComponentNode(component, liveCodeScores);
      nodes.push(componentNode);

      // Create nodes for informative elements
      for (const element of component.informativeElements) {
        const elementNode = this.createElementNode(element, component.file, liveCodeScores);
        nodes.push(elementNode);
      }

      // Create nodes for imports
      for (const importInfo of component.imports) {
        const importNode = this.createImportNode(importInfo, component.file, liveCodeScores);
        nodes.push(importNode);
      }
    }

    return nodes;
  }

  /**
   * Creates a node for a component
   * Phase 1 Enhancement: Now includes line/column information for component-level tracking
   * @param component - Component information
   * @param liveCodeScores - Map of component IDs to live code scores
   * @returns NodeInfo - Created component node
   */
  private createComponentNode(component: ComponentInfo, liveCodeScores: Map<string, number>): NodeInfo {
    // Find the usage info for this component to get the live code score
    const componentId = `component_${component.name}`;
    const liveCodeScore = liveCodeScores.get(componentId) ?? 100;

    return {
      id: this.generateNodeId(),
      label: component.name,
      nodeType: 'function' as NodeType,
      nodeCategory: 'front end' as NodeCategory,
      datatype: 'array' as DataType,
      liveCodeScore,
      file: component.file,
      line: component.line,
      column: component.column,
      properties: {
        type: component.type,
        props: component.props,
        state: component.state,
        hooks: component.hooks
      }
    };
  }

  /**
   * Creates a node for an informative element
   * @param element - Informative element information
   * @param file - File path
   * @param liveCodeScores - Map of component IDs to live code scores
   * @returns NodeInfo - Created element node
   */
  private createElementNode(element: InformativeElement, file: string, liveCodeScores: Map<string, number>): NodeInfo {
    let nodeType: NodeType = 'function';
    let nodeCategory: NodeCategory = 'front end';
    let datatype: DataType = 'array';

    // Determine node type based on element type
    switch (element.type) {
      case 'data-source':
        nodeType = 'API';
        nodeCategory = 'middleware';
        break;
      case 'state-management':
        nodeType = 'function';
        nodeCategory = 'front end';
        datatype = 'array';
        break;
      case 'display':
      case 'input':
        nodeType = 'function';
        nodeCategory = 'front end';
        break;
    }

    // Find the usage info for this element to get the live code score
    const elementId = `element_${element.name}`;
    const liveCodeScore = liveCodeScores.get(elementId) ?? 100;

    return {
      id: this.generateNodeId(),
      label: element.name,
      nodeType,
      nodeCategory,
      datatype,
      liveCodeScore,
      file,
      properties: {
        elementType: element.type,
        props: element.props,
        eventHandlers: element.eventHandlers.map((h: { name: string }) => h.name),
        dataBindings: element.dataBindings.map((b: { source: string }) => b.source)
      }
    };
  }

  /**
   * Creates a node for an import
   * @param importInfo - Import information
   * @param file - File path
   * @param liveCodeScores - Map of component IDs to live code scores
   * @returns NodeInfo - Created import node
   */
  private createImportNode(importInfo: ImportInfo, file: string, liveCodeScores: Map<string, number>): NodeInfo {
    // Find the usage info for this import to get the live code score
    const importId = `import_${importInfo.source}`;
    const liveCodeScore = liveCodeScores.get(importId) ?? 100;

    return {
      id: this.generateNodeId(),
      label: importInfo.source,
      nodeType: 'function' as NodeType,
      nodeCategory: 'front end' as NodeCategory,
      datatype: 'array' as DataType,
      liveCodeScore,
      file,
      properties: {
        importType: 'external',
        specifiers: importInfo.specifiers.map((s: { name: string; type: string }) => ({ name: s.name, type: s.type }))
      }
    };
  }

  /**
   * Creates import edges for a node
   * @param node - Source node
   * @param allNodes - All available nodes
   * @returns EdgeInfo[] - Array of import edges
   */
  private createImportEdges(node: NodeInfo, allNodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    // Find imported components and create edges
    const imports = (node.properties.specifiers as Array<{ name: string; type: string }>) || [];
    for (const importSpec of imports) {
      const targetNode = allNodes.find(n => n.label === importSpec.name);
      if (targetNode) {
        edges.push({
          id: this.generateEdgeId(),
          source: node.id,
          target: targetNode.id,
          relationship: 'imports' as RelationshipType,
          properties: {
            importType: importSpec.type
          }
        });
      }
    }

    return edges;
  }

  /**
   * Creates JSX usage edges for components that render other components
   * Phase 2 Implementation: Detects when a component renders another component via JSX
   * Phase 1 Enhancement: Now works at component-level granularity instead of file-level
   * 
   * Business Logic:
   * - Identifies JSX element nodes that represent custom React components (capitalized names)
   * - Matches these JSX elements to their component definitions based on name
   * - Creates "renders" edges from the parent component to the rendered component
   * - Handles multiple components per file correctly
   * 
   * Example: If MainComponent in index.tsx contains <Hello />, this creates an edge:
   *   MainComponent --renders--> Hello component
   * 
   * This is crucial for understanding the component hierarchy and rendering flow.
   * 
   * @param allNodes - All available nodes in the graph
   * @returns EdgeInfo[] - Array of JSX usage edges with "renders" relationship
   */
  private createJSXUsageEdges(allNodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    // Separate component definition nodes from JSX element nodes
    const componentNodes = allNodes.filter(node => 
      node.properties.type !== undefined && 
      node.nodeType === 'function' &&
      node.nodeCategory === 'front end' &&
      !node.properties.elementType // Not a JSX element, but a component definition
    );

    const jsxElementNodes = allNodes.filter(node => 
      this.isJSXComponentUsage(node)
    );

    // For each JSX element that represents a component usage
    for (const jsxNode of jsxElementNodes) {
      // Find the component definition that this JSX element references
      const targetComponentNode = componentNodes.find(compNode => 
        compNode.label === jsxNode.label && // Same name (e.g., "Hello")
        compNode.file !== jsxNode.file // Defined in a different file
      );

      if (!targetComponentNode) {
        // JSX element doesn't reference an external component, skip
        continue;
      }

      // Find the parent component(s) in the same file as the JSX element
      // Phase 1: There may be multiple components in the same file
      const parentComponents = componentNodes.filter(compNode => 
        compNode.file === jsxNode.file
      );

      // Create edges from each parent component to the target component
      // Phase 1 Logic: If multiple components in file, they all potentially use the JSX element
      // In a more sophisticated version, we would track which specific component owns which JSX elements
      // For now, we assume all components in the file can use the JSX elements in that file
      for (const parentComponent of parentComponents) {
        edges.push({
          id: this.generateEdgeId(),
          source: parentComponent.id,
          target: targetComponentNode.id,
          relationship: 'renders' as RelationshipType,
          properties: {
            jsxElement: jsxNode.label,
            usageFile: jsxNode.file,
            definitionFile: targetComponentNode.file,
            usageComponent: parentComponent.label
          }
        });
      }
    }

    return edges;
  }

  /**
   * Checks if a node represents a JSX element that is a component usage (not an HTML element)
   * 
   * Business Logic:
   * - React components must start with an uppercase letter (React convention)
   * - HTML elements start with lowercase (div, span, button, etc.)
   * - JSX element nodes have elementType property
   * 
   * Root Cause Fix: Removed HTML element list check that was causing false positives.
   * The capitalization check alone is sufficient and follows React's strict naming convention:
   *   - PascalCase (Button, Input) = React component
   *   - lowercase (button, input) = HTML element
   * 
   * This prevents React components named 'Button' or 'Input' from being incorrectly
   * rejected as HTML elements.
   * 
   * @param node - Node to check
   * @returns boolean - True if this is a JSX component usage, false if HTML element or other
   */
  private isJSXComponentUsage(node: NodeInfo): boolean {
    // Check if node has elementType property (indicates it's a JSX element)
    const elementType = node.properties.elementType as string | undefined;
    if (!elementType) {
      return false;
    }

    // Check if the label (element name) starts with an uppercase letter
    // React convention: Component names start with uppercase, HTML elements with lowercase
    // This check alone is sufficient - React enforces this convention strictly
    const firstChar = node.label.charAt(0);
    const isCapitalized = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase();

    return isCapitalized;
  }

  /**
   * Creates API edges for a node
   * @param node - Source node
   * @param allNodes - All available nodes
   * @returns EdgeInfo[] - Array of API edges
   */
  private createAPIEdges(node: NodeInfo, allNodes: NodeInfo[]): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    // Create edges to database tables for API calls
    const dbNodes = allNodes.filter(n => n.nodeType === 'table' || n.nodeType === 'view');
    for (const dbNode of dbNodes) {
      edges.push({
        id: this.generateEdgeId(),
        source: node.id,
        target: dbNode.id,
        relationship: 'reads' as RelationshipType,
        properties: {
          operation: 'SELECT'
        }
      });
    }

    return edges;
  }

  /**
   * Creates database edges for a node
   * @returns EdgeInfo[] - Array of database edges
   */
  private createDatabaseEdges(): EdgeInfo[] {
    const edges: EdgeInfo[] = [];
    
    // Database nodes are typically end nodes, but can have relationships to other tables
    // This would be implemented based on foreign key relationships in a real system
    
    return edges;
  }

  /**
   * Removes duplicate edges from the array
   * @param edges - Array of edges to deduplicate
   * @returns EdgeInfo[] - Array of unique edges
   */
  private removeDuplicateEdges(edges: EdgeInfo[]): EdgeInfo[] {
    const uniqueEdges = new Map<string, EdgeInfo>();
    
    for (const edge of edges) {
      const key = `${edge.source}-${edge.target}-${edge.relationship}`;
      if (!uniqueEdges.has(key)) {
        uniqueEdges.set(key, edge);
      }
    }
    
    return Array.from(uniqueEdges.values());
  }

  /**
   * Creates graph metadata
   * @param components - Array of components
   * @param nodes - Array of nodes
   * @param edges - Array of edges
   * @returns GraphMetadata - Graph metadata
   */
  private createGraphMetadata(components: ComponentInfo[], nodes: NodeInfo[], edges: EdgeInfo[]): GraphMetadata {
    const deadCodeNodes = nodes.filter(n => n.liveCodeScore === 0).length;
    const liveCodeNodes = nodes.filter(n => n.liveCodeScore === 100).length;

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      repositoryUrl: '', // Will be set by caller
      analysisScope: {
        includedTypes: ['frontend', 'middleware', 'database'],
        excludedTypes: ['test', 'node_modules']
      },
      statistics: {
        linesOfCode: 0, // Will be calculated from file analysis
        totalNodes: nodes.length,
        totalEdges: edges.length,
        deadCodeNodes,
        liveCodeNodes
      }
    };
  }

  /**
   * Extracts API call information from an informative element
   * @param element - Informative element
   * @param file - File path
   * @returns APICallInfo | null - API call information or null
   */
  private extractAPICallFromElement(element: InformativeElement, file: string): APICallInfo | null {
    if (element.type !== 'data-source') {
      return null;
    }

    // Extract endpoint from element properties
    const endpoint = (element.props?.endpoint as string) || '/api/unknown';
    const method = (element.props?.method as string) || 'GET';

    return {
      name: element.name,
      endpoint,
      method,
      file,
      normalizedEndpoint: this.normalizeAPIEndpoints([endpoint])[0]
    };
  }

  /**
   * Creates API call information from import
   * @param importInfo - Import information
   * @param file - File path
   * @returns APICallInfo | null - API call information or null
   */
  private createAPICallFromImport(importInfo: ImportInfo, file: string): APICallInfo | null {
    if (!this.isAPILibrary(importInfo.source)) {
      return null;
    }

    return {
      name: importInfo.source,
      endpoint: '/api/external',
      method: 'GET',
      file,
      normalizedEndpoint: '/api/external'
    };
  }

  /**
   * Checks if a source is an API library
   * @param source - Import source
   * @returns boolean - True if it's an API library
   */
  private isAPILibrary(source: string): boolean {
    const apiLibraries = ['axios', 'fetch', 'http', 'api', 'request'];
    return apiLibraries.some(lib => source.includes(lib));
  }

  /**
   * Builds adjacency list from edges
   * @param edges - Array of edges
   * @returns Map<string, string[]> - Adjacency list
   */
  private buildAdjacencyList(edges: EdgeInfo[]): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();

    for (const edge of edges) {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, []);
      }
      adjacencyList.get(edge.source)!.push(edge.target);
    }

    return adjacencyList;
  }

  /**
   * Detects cycles from a specific node
   * @param nodeId - Node ID to start from
   * @param adjacencyList - Adjacency list
   * @param visited - Set of visited nodes
   * @param recursionStack - Set of nodes in recursion stack
   * @param path - Current path
   * @returns CycleInfo[] - Array of detected cycles
   */
  private detectCyclesFromNode(
    nodeId: string,
    adjacencyList: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): CycleInfo[] {
    const cycles: CycleInfo[] = [];

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const neighborCycles = this.detectCyclesFromNode(
          neighbor,
          adjacencyList,
          visited,
          recursionStack,
          [...path]
        );
        cycles.push(...neighborCycles);
      } else if (recursionStack.has(neighbor)) {
        // Cycle detected
        const cycleStart = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStart);
        cycleNodes.push(neighbor);

        cycles.push({
          nodes: cycleNodes,
          type: 'circular-dependency',
          severity: cycleNodes.length > 3 ? 'error' : 'warning',
          description: `Circular dependency detected: ${cycleNodes.join(' -> ')}`
        });
      }
    }

    recursionStack.delete(nodeId);
    return cycles;
  }

  /**
   * Generates a unique node ID
   * @returns string - Unique node ID
   */
  private generateNodeId(): string {
    return `node_${++this.nodeCounter}`;
  }

  /**
   * Generates a unique edge ID
   * @returns string - Unique edge ID
   */
  private generateEdgeId(): string {
    return `edge_${++this.edgeCounter}`;
  }

  /**
   * Tracks component usage and calculates live code scores
   * Phase 4.1: Usage Tracking implementation
   * 
   * @param components - Array of component information to analyze
   * @returns UsageInfo[] - Array of component usage information
   */
  trackComponentUsage(components: ComponentInfo[]): UsageInfo[] {
    return this.usageTracker.trackComponentUsage(components);
  }

  /**
   * Calculates usage statistics for the codebase
   * Phase 4.1: Usage Tracking implementation
   * 
   * @param usageInfos - Array of usage information to analyze
   * @returns UsageStatistics - Comprehensive usage statistics
   */
  calculateUsageStatistics(usageInfos: UsageInfo[]): UsageStatistics {
    return this.usageTracker.calculateUsageStatistics(usageInfos);
  }

  /**
   * Detects dead code based on usage tracking
   * Phase 4.1: Usage Tracking implementation
   * 
   * @param usageInfos - Array of usage information to analyze
   * @returns DeadCodeInfo[] - Array of dead code information
   */
  detectDeadCode(usageInfos: UsageInfo[]): DeadCodeInfo[] {
    return this.usageTracker.detectDeadCode(usageInfos);
  }

  /**
   * Generates performance warnings for large codebases
   * Phase 4.1: Usage Tracking implementation
   * 
   * @param statistics - Usage statistics to analyze
   * @returns PerformanceWarning[] - Array of performance warnings
   */
  generatePerformanceWarnings(statistics: UsageStatistics): PerformanceWarning[] {
    return this.usageTracker.generatePerformanceWarnings(statistics);
  }

  /**
   * Analyzes API and backend components
   * Phase 4.3: API and Backend Analysis implementation
   * 
   * @param components - Array of component information
   * @param files - Array of files to analyze
   * @returns Promise<DependencyGraph> - Updated dependency graph with API and backend analysis
   */
  async analyzeAPIAndBackend(components: ComponentInfo[], files: FileInfo[]): Promise<DependencyGraph> {
    try {
      if (this.logger) {
        this.logger.logInfo('Starting API and Backend Analysis', {
          componentCount: components.length,
          fileCount: files.length
        });
      }

      // Start progress tracking
      this.progressIndicator.reset();

      // Step 1: Analyze API endpoints in backend files
      this.progressIndicator.startStep('api_endpoint_analysis');
      const backendFiles = files.filter(file => this.isBackendFile(file));
      const backendAnalysis = this.apiEndpointAnalyzer.analyzeBackendFiles(backendFiles);
      this.progressIndicator.completeStep('api_endpoint_analysis');

      // Step 2: Analyze database operations
      this.progressIndicator.startStep('database_operations_analysis');
      const databaseAnalysis = this.databaseAnalyzer.analyzeDatabaseOperations(files);
      this.progressIndicator.completeStep('database_operations_analysis');

      // Step 3: Map frontend-backend connections
      this.progressIndicator.startStep('frontend_backend_mapping');
      const apiCalls = this.traceAPICalls(components);
      const connectionMapping = this.connectionMapper.mapFrontendBackendConnections(
        components,
        backendAnalysis.routes,
        apiCalls,
        databaseAnalysis.operations
      );
      this.progressIndicator.completeStep('frontend_backend_mapping');

      // Step 4: Identify used/unused endpoints
      this.progressIndicator.startStep('used_unused_identification');
      const updatedBackendAnalysis = this.apiEndpointAnalyzer.identifyUsedUnusedEndpoints(
        backendAnalysis,
        apiCalls
      );
      const updatedDatabaseAnalysis = this.databaseAnalyzer.identifyUsedUnusedEntities(
        databaseAnalysis,
        databaseAnalysis.operations
      );
      this.progressIndicator.completeStep('used_unused_identification');

            // Step 5: Detect backend dead code
            this.progressIndicator.startStep('dead_code_detection');
            this.detectBackendDeadCode(
              updatedBackendAnalysis,
              updatedDatabaseAnalysis
            );
            this.progressIndicator.completeStep('dead_code_detection');

            // Step 6: Analyze connection quality
            this.progressIndicator.startStep('connection_quality_analysis');
            this.connectionMapper.analyzeConnectionQuality(connectionMapping);
            this.progressIndicator.completeStep('connection_quality_analysis');

      // Step 7: Create graph nodes
      this.progressIndicator.startStep('graph_node_creation');
      const existingNodes = this.createNodesFromComponents(components, new Map());
      const apiNodes = this.apiEndpointAnalyzer.mapRoutesToNodes(updatedBackendAnalysis);
      const databaseNodes = this.databaseAnalyzer.mapDatabaseEntitiesToNodes(updatedDatabaseAnalysis);
      const allNodes = [...existingNodes, ...apiNodes, ...databaseNodes];
      this.progressIndicator.completeStep('graph_node_creation');

      // Step 8: Create edges
      this.progressIndicator.startStep('edge_creation');
      const existingEdges = this.createEdges(allNodes);
      const connectionEdges = this.connectionMapper.createConnectionEdges(
        connectionMapping.connections,
        allNodes
      );
      const allEdges = [...existingEdges, ...connectionEdges];
      this.progressIndicator.completeStep('edge_creation');

      // Create final graph
      const metadata = this.createGraphMetadata(components, allNodes, allEdges);
      metadata.statistics.deadCodeNodes = allNodes.filter(n => n.liveCodeScore === 0).length;
      metadata.statistics.liveCodeNodes = allNodes.filter(n => n.liveCodeScore === 100).length;

      const graph: DependencyGraph = {
        nodes: allNodes,
        edges: allEdges,
        metadata
      };

      // Log progress summary
      this.progressIndicator.logProgressSummary();

      if (this.logger) {
        this.logger.logInfo('API and Backend Analysis completed', {
          totalNodes: graph.nodes.length,
          totalEdges: graph.edges.length,
          deadCodeNodes: graph.metadata.statistics.deadCodeNodes,
          liveCodeNodes: graph.metadata.statistics.liveCodeNodes,
          apiEndpoints: updatedBackendAnalysis.totalEndpoints,
          databaseEntities: updatedDatabaseAnalysis.tables.length + updatedDatabaseAnalysis.views.length,
          connections: connectionMapping.totalConnections,
          deadCodePercentage: updatedBackendAnalysis.deadCodePercentage.toFixed(2)
        });
      }

      return graph;

    } catch (error) {
      const errorMessage = `Failed to analyze API and backend: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Detects dead code in backend components
   * Phase 4.3: Backend Dead Code Detection
   * 
   * @param backendAnalysis - Backend analysis result
   * @param databaseAnalysis - Database analysis result
   * @returns DeadCodeInfo[] - Array of dead code information
   */
  private detectBackendDeadCode(
    backendAnalysis: BackendRouteAnalysis,
    databaseAnalysis: DatabaseAnalysis
  ): DeadCodeInfo[] {
    const deadCode: DeadCodeInfo[] = [];

    // Add unused API endpoints
    for (const endpoint of backendAnalysis.unusedEndpoints) {
      deadCode.push({
        id: `dead_api_${endpoint.name.replace(/\s+/g, '_').toLowerCase()}`,
        type: 'api',
        name: endpoint.name,
        file: endpoint.file,
        line: endpoint.line,
        column: endpoint.column,
        reason: 'no_incoming_edges',
        confidence: 100,
        suggestions: [
          'Remove unused API endpoint',
          'Check if endpoint should be documented',
          'Verify if endpoint is used by external systems'
        ],
        impact: 'high'
      });
    }

    // Add unused database tables
    for (const table of databaseAnalysis.unusedTables) {
      deadCode.push({
        id: `dead_table_${table.name}`,
        type: 'database',
        name: table.name,
        file: table.file,
        line: table.line,
        column: table.column,
        reason: 'no_incoming_edges',
        confidence: 100,
        suggestions: [
          'Remove unused database table',
          'Check if table is used by external systems',
          'Verify if table contains important data'
        ],
        impact: 'high'
      });
    }

    // Add unused database views
    for (const view of databaseAnalysis.unusedViews) {
      deadCode.push({
        id: `dead_view_${view.name}`,
        type: 'database',
        name: view.name,
        file: view.file,
        line: view.line,
        column: view.column,
        reason: 'no_incoming_edges',
        confidence: 100,
        suggestions: [
          'Remove unused database view',
          'Check if view is used by external systems',
          'Verify if view provides important data'
        ],
        impact: 'medium'
      });
    }

    return deadCode;
  }

  /**
   * Checks if file is a backend file
   * @param file - File to check
   * @returns boolean - True if it's a backend file
   */
  private isBackendFile(file: FileInfo): boolean {
    const backendPatterns = [
      /server\.(ts|js)$/,
      /routes?\.(ts|js)$/,
      /api\.(ts|js)$/,
      /middleware\.(ts|js)$/,
      /controllers?\.(ts|js)$/,
      /\/routes?\//,
      /\/api\//,
      /\/server\//,
      /\/backend\//
    ];

    return backendPatterns.some(pattern => pattern.test(file.path || file.name || ''));
  }
}

// Export the interface and implementation
export { DependencyAnalyzerImpl as DependencyAnalyzer };
