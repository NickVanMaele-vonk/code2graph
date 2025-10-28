/**
 * Connection Mapper
 * Maps connections between frontend components and backend API endpoints
 * Following Phase 4.3 requirements from the architecture document
 */

import {
  ComponentInfo,
  APICallInfo,
  DatabaseOperationInfo,
  NodeInfo,
  EdgeInfo,
  RelationshipType,
  AnalysisError
} from '../types/index.js';
import { APIEndpointInfo } from './api-endpoint-analyzer.js';
import { AnalysisLogger } from './analysis-logger.js';

/**
 * Frontend-Backend Connection Information
 * Represents a connection between frontend and backend
 */
export interface FrontendBackendConnection {
  frontendComponent: string;
  backendEndpoint: string;
  connectionType: 'direct' | 'indirect' | 'proxy';
  confidence: number;
  path: string[];
  apiCalls: APICallInfo[];
  databaseOperations: DatabaseOperationInfo[];
}

/**
 * Connection Mapping Result
 * Contains information about frontend-backend connections
 */
export interface ConnectionMappingResult {
  connections: FrontendBackendConnection[];
  directConnections: FrontendBackendConnection[];
  indirectConnections: FrontendBackendConnection[];
  proxyConnections: FrontendBackendConnection[];
  unmappedFrontend: string[];
  unmappedBackend: string[];
  totalConnections: number;
  mappingCoverage: number;
}

/**
 * Connection Mapper Implementation
 * Maps connections between frontend components and backend API endpoints
 */
export class ConnectionMapperImpl {
  private logger?: AnalysisLogger;
  private edgeCounter: number = 0;

  /**
   * Constructor initializes the connection mapper
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Maps connections between frontend and backend
   * Analyzes API calls from frontend components to backend endpoints
   * 
   * @param frontendComponents - Frontend components
   * @param backendEndpoints - Backend API endpoints
   * @param apiCalls - API calls from frontend
   * @param databaseOperations - Database operations from backend
   * @returns ConnectionMappingResult - Mapping result with connections
   */
  mapFrontendBackendConnections(
    frontendComponents: ComponentInfo[],
    backendEndpoints: APIEndpointInfo[],
    apiCalls: APICallInfo[],
    databaseOperations: DatabaseOperationInfo[]
  ): ConnectionMappingResult {
    try {
      // Handle null/undefined inputs
      const safeFrontendComponents = frontendComponents || [];
      const safeBackendEndpoints = backendEndpoints || [];
      const safeApiCalls = apiCalls || [];
      const safeDatabaseOperations = databaseOperations || [];

      if (this.logger) {
        this.logger.logInfo('Starting frontend-backend connection mapping', {
          frontendComponents: safeFrontendComponents.length,
          backendEndpoints: safeBackendEndpoints.length,
          apiCalls: safeApiCalls.length,
          databaseOperations: safeDatabaseOperations.length
        });
      }

      const connections: FrontendBackendConnection[] = [];
      const directConnections: FrontendBackendConnection[] = [];
      const indirectConnections: FrontendBackendConnection[] = [];
      const proxyConnections: FrontendBackendConnection[] = [];

      // Map direct connections (frontend component -> API call -> backend endpoint)
      const directMappings = this.mapDirectConnections(
        safeFrontendComponents,
        safeBackendEndpoints,
        safeApiCalls
      );
      directConnections.push(...directMappings);

      // Map indirect connections (through service layers, middleware)
      const indirectMappings = this.mapIndirectConnections(
        safeBackendEndpoints,
        safeDatabaseOperations
      );
      indirectConnections.push(...indirectMappings);

      // Map proxy connections (through API gateways, load balancers)
      const proxyMappings = this.mapProxyConnections(
        safeFrontendComponents,
        safeBackendEndpoints,
        safeApiCalls
      );
      proxyConnections.push(...proxyMappings);

      // Combine all connections
      connections.push(...directConnections, ...indirectConnections, ...proxyConnections);

      // Identify unmapped components
      const unmappedFrontend = this.findUnmappedFrontendComponents(
        safeFrontendComponents,
        connections
      );
      const unmappedBackend = this.findUnmappedBackendEndpoints(
        safeBackendEndpoints,
        connections
      );

      // Calculate mapping coverage
      const totalMappable = safeFrontendComponents.length + safeBackendEndpoints.length;
      const mappedCount = connections.length * 2; // Each connection maps 2 entities
      const mappingCoverage = totalMappable > 0 ? (mappedCount / totalMappable) * 100 : 0;

      const result: ConnectionMappingResult = {
        connections,
        directConnections,
        indirectConnections,
        proxyConnections,
        unmappedFrontend,
        unmappedBackend,
        totalConnections: connections.length,
        mappingCoverage
      };

      if (this.logger) {
        this.logger.logInfo('Frontend-backend connection mapping completed', {
          totalConnections: result.totalConnections,
          directConnections: result.directConnections.length,
          indirectConnections: result.indirectConnections.length,
          proxyConnections: result.proxyConnections.length,
          unmappedFrontend: result.unmappedFrontend.length,
          unmappedBackend: result.unmappedBackend.length,
          mappingCoverage: result.mappingCoverage.toFixed(2)
        });
      }

      return result;

    } catch (error) {
      const errorMessage = `Failed to map frontend-backend connections: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Maps direct connections between frontend and backend
   * @param frontendComponents - Frontend components
   * @param backendEndpoints - Backend endpoints
   * @param apiCalls - API calls
   * @returns FrontendBackendConnection[] - Direct connections
   */
  private mapDirectConnections(
    frontendComponents: ComponentInfo[],
    backendEndpoints: APIEndpointInfo[],
    apiCalls: APICallInfo[]
  ): FrontendBackendConnection[] {
    const connections: FrontendBackendConnection[] = [];

    for (const component of frontendComponents) {
      // Find API calls from this component
      const componentApiCalls = apiCalls.filter(call => call.file === component.file);

      for (const apiCall of componentApiCalls) {
        // Find matching backend endpoint
        const matchingEndpoint = this.findMatchingEndpoint(apiCall, backendEndpoints);

        if (matchingEndpoint) {
          const connection: FrontendBackendConnection = {
            frontendComponent: component.name,
            backendEndpoint: matchingEndpoint.name,
            connectionType: 'direct',
            confidence: this.calculateConfidence(apiCall, matchingEndpoint),
            path: [component.name, apiCall.name, matchingEndpoint.name],
            apiCalls: [apiCall],
            databaseOperations: []
          };
          connections.push(connection);
        }
      }
    }

    return connections;
  }

  /**
   * Maps indirect connections through service layers
   * @param backendEndpoints - Backend endpoints
   * @param databaseOperations - Database operations
   * @returns FrontendBackendConnection[] - Indirect connections
   */
  private mapIndirectConnections(
    backendEndpoints: APIEndpointInfo[],
    databaseOperations: DatabaseOperationInfo[]
  ): FrontendBackendConnection[] {
    const connections: FrontendBackendConnection[] = [];

    for (const endpoint of backendEndpoints) {
      // Find database operations for this endpoint
      const endpointDbOps = databaseOperations.filter(op => 
        op.file === endpoint.file || 
        this.areInSameService(op.file, endpoint.file)
      );

      if (endpointDbOps.length > 0) {
        // Create indirect connection through database
        const connection: FrontendBackendConnection = {
          frontendComponent: 'unknown', // Will be mapped later
          backendEndpoint: endpoint.name,
          connectionType: 'indirect',
          confidence: 0.8, // High confidence for service-database connections
          path: [endpoint.name, 'service-layer', 'database'],
          apiCalls: [],
          databaseOperations: endpointDbOps
        };
        connections.push(connection);
      }
    }

    return connections;
  }

  /**
   * Maps proxy connections through API gateways
   * @param frontendComponents - Frontend components
   * @param backendEndpoints - Backend endpoints
   * @param apiCalls - API calls
   * @returns FrontendBackendConnection[] - Proxy connections
   */
  private mapProxyConnections(
    frontendComponents: ComponentInfo[],
    backendEndpoints: APIEndpointInfo[],
    apiCalls: APICallInfo[]
  ): FrontendBackendConnection[] {
    const connections: FrontendBackendConnection[] = [];

    // Look for proxy patterns in API calls
    for (const apiCall of apiCalls) {
      if (this.isProxyCall(apiCall)) {
        // Find the actual backend endpoint behind the proxy
        const actualEndpoint = this.findActualEndpointBehindProxy(apiCall, backendEndpoints);

        if (actualEndpoint) {
          const component = frontendComponents.find(c => c.file === apiCall.file);
          if (component) {
            const connection: FrontendBackendConnection = {
              frontendComponent: component.name,
              backendEndpoint: actualEndpoint.name,
              connectionType: 'proxy',
              confidence: 0.7, // Medium confidence for proxy connections
              path: [component.name, 'proxy', actualEndpoint.name],
              apiCalls: [apiCall],
              databaseOperations: []
            };
            connections.push(connection);
          }
        }
      }
    }

    return connections;
  }

  /**
   * Finds matching backend endpoint for API call
   * @param apiCall - API call
   * @param backendEndpoints - Backend endpoints
   * @returns APIEndpointInfo | null - Matching endpoint or null
   */
  private findMatchingEndpoint(
    apiCall: APICallInfo,
    backendEndpoints: APIEndpointInfo[]
  ): APIEndpointInfo | null {
    // Try exact match first (path and method)
    let matching = backendEndpoints.find(endpoint => 
      endpoint.method === apiCall.method && (
        endpoint.path === apiCall.endpoint ||
        endpoint.normalizedPath === apiCall.normalizedEndpoint
      )
    );

    if (matching) {
      return matching;
    }

    // Try normalized match (path and method)
    matching = backendEndpoints.find(endpoint => 
      endpoint.method === apiCall.method &&
      this.normalizePath(endpoint.path) === this.normalizePath(apiCall.endpoint)
    );

    if (matching) {
      return matching;
    }

    // Try pattern match (path and method)
    matching = backendEndpoints.find(endpoint => 
      endpoint.method === apiCall.method &&
      this.pathsMatchPattern(endpoint.path, apiCall.endpoint)
    );

    return matching || null;
  }

  /**
   * Calculates confidence score for connection
   * @param apiCall - API call
   * @param endpoint - Backend endpoint
   * @returns number - Confidence score (0-1)
   */
  private calculateConfidence(apiCall: APICallInfo, endpoint: APIEndpointInfo): number {
    let confidence = 0.5; // Base confidence

    // Exact path match
    if (apiCall.endpoint === endpoint.path) {
      confidence += 0.4;
    }

    // Method match
    if (apiCall.method === endpoint.method) {
      confidence += 0.2;
    }

    // Normalized path match
    if (apiCall.normalizedEndpoint === endpoint.normalizedPath) {
      confidence += 0.3;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Checks if two files are in the same service
   * @param file1 - First file
   * @param file2 - Second file
   * @returns boolean - True if in same service
   */
  private areInSameService(file1: string, file2: string): boolean {
    // Extract service names from file paths
    const service1 = this.extractServiceName(file1);
    const service2 = this.extractServiceName(file2);
    
    return service1 === service2 && service1 !== 'unknown';
  }

  /**
   * Extracts service name from file path
   * @param filePath - File path
   * @returns string - Service name
   */
  private extractServiceName(filePath: string): string {
    // Look for service patterns in path
    const servicePatterns = [
      /\/services?\/([^/]+)/,
      /\/api\/([^/]+)/,
      /\/controllers?\/([^/]+)/,
      /\/routes?\/([^/]+)/
    ];

    for (const pattern of servicePatterns) {
      const match = filePath.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return 'unknown';
  }

  /**
   * Checks if API call is through a proxy
   * @param apiCall - API call
   * @returns boolean - True if it's a proxy call
   */
  private isProxyCall(apiCall: APICallInfo): boolean {
    const proxyPatterns = [
      /\/api\/gateway/,
      /\/proxy/,
      /\/gateway/,
      /\/api\/v\d+\//,
      /\/api\/public/,
      /\/api\/internal/
    ];

    return proxyPatterns.some(pattern => pattern.test(apiCall.endpoint));
  }

  /**
   * Finds actual endpoint behind proxy
   * @param apiCall - Proxy API call
   * @param backendEndpoints - Backend endpoints
   * @returns APIEndpointInfo | null - Actual endpoint or null
   */
  private findActualEndpointBehindProxy(
    apiCall: APICallInfo,
    backendEndpoints: APIEndpointInfo[]
  ): APIEndpointInfo | null {
    // Remove proxy prefix and find matching endpoint
    let cleanPath = apiCall.endpoint
      .replace(/\/api\/gateway/, '')
      .replace(/\/proxy/, '')
      .replace(/\/gateway/, '')
      .replace(/\/api\/v\d+/, '')
      .replace(/\/api\/public/, '')
      .replace(/\/api\/internal/, '');

    // If clean path doesn't start with /api, add it back for matching
    if (!cleanPath.startsWith('/api')) {
      cleanPath = '/api' + cleanPath;
    }

    return backendEndpoints.find(endpoint => 
      endpoint.path === cleanPath ||
      endpoint.normalizedPath === this.normalizePath(cleanPath)
    ) || null;
  }

  /**
   * Normalizes path for comparison
   * @param path - Path to normalize
   * @returns string - Normalized path
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\/(\d+)/g, '/:id')
      .replace(/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi, '/:uuid')
      .toLowerCase();
  }

  /**
   * Checks if two paths match pattern
   * @param path1 - First path
   * @param path2 - Second path
   * @returns boolean - True if paths match pattern
   */
  private pathsMatchPattern(path1: string, path2: string): boolean {
    const normalized1 = this.normalizePath(path1);
    const normalized2 = this.normalizePath(path2);
    
    // Check if one is a subset of the other
    return normalized1.includes(normalized2) || normalized2.includes(normalized1);
  }

  /**
   * Finds unmapped frontend components
   * @param frontendComponents - Frontend components
   * @param connections - Existing connections
   * @returns string[] - Unmapped component names
   */
  private findUnmappedFrontendComponents(
    frontendComponents: ComponentInfo[],
    connections: FrontendBackendConnection[]
  ): string[] {
    const mappedComponents = new Set(
      connections
        .filter(conn => conn.frontendComponent !== 'unknown')
        .map(conn => conn.frontendComponent)
    );

    return frontendComponents
      .filter(component => !mappedComponents.has(component.name))
      .map(component => component.name);
  }

  /**
   * Finds unmapped backend endpoints
   * @param backendEndpoints - Backend endpoints
   * @param connections - Existing connections
   * @returns string[] - Unmapped endpoint names
   */
  private findUnmappedBackendEndpoints(
    backendEndpoints: APIEndpointInfo[],
    connections: FrontendBackendConnection[]
  ): string[] {
    const mappedEndpoints = new Set(connections.map(conn => conn.backendEndpoint));

    return backendEndpoints
      .filter(endpoint => !mappedEndpoints.has(endpoint.name))
      .map(endpoint => endpoint.name);
  }

  /**
   * Creates edges for frontend-backend connections
   * @param connections - Frontend-backend connections
   * @param nodes - Graph nodes
   * @returns EdgeInfo[] - Array of connection edges
   */
  createConnectionEdges(
    connections: FrontendBackendConnection[],
    nodes: NodeInfo[]
  ): EdgeInfo[] {
    const edges: EdgeInfo[] = [];

    for (const connection of connections) {
      // Find frontend component node
      // Change Request 002: Updated to use "front-end" (hyphenated)
      // Context: Frontend components are UI elements in the front-end layer
      const frontendNode = nodes.find(node => 
        node.label === connection.frontendComponent &&
        node.nodeCategory === 'front-end' // CR-002: Changed from "front end"
      );

      // Find backend endpoint node
      const backendNode = nodes.find(node => 
        node.label === connection.backendEndpoint &&
        node.nodeCategory === 'api'
      );

      if (frontendNode && backendNode) {
        // Create edge from frontend to backend
        const edge: EdgeInfo = {
          id: this.generateEdgeId(),
          source: frontendNode.id,
          target: backendNode.id,
          relationship: 'calls' as RelationshipType,
          properties: {
            connectionType: connection.connectionType,
            confidence: connection.confidence,
            path: connection.path,
            apiCalls: connection.apiCalls.length,
            databaseOperations: connection.databaseOperations.length
          }
        };
        edges.push(edge);
      }

      // Create edges to database operations
      for (const dbOp of connection.databaseOperations) {
        const dbNode = nodes.find(node => 
          node.label === dbOp.table &&
          (node.nodeType === 'table' || node.nodeType === 'view') &&
          node.nodeCategory === 'database'
        );

        if (backendNode && dbNode) {
          const dbEdge: EdgeInfo = {
            id: this.generateEdgeId(),
            source: backendNode.id,
            target: dbNode.id,
            relationship: this.getDatabaseRelationship(dbOp.type),
            properties: {
              operation: dbOp.operation,
              table: dbOp.table,
              file: dbOp.file,
              line: dbOp.line
            }
          };
          edges.push(dbEdge);
        }
      }
    }

    return edges;
  }

  /**
   * Gets relationship type for database operation
   * @param operationType - Database operation type
   * @returns RelationshipType - Relationship type
   */
  private getDatabaseRelationship(operationType: string): RelationshipType {
    switch (operationType.toUpperCase()) {
      case 'SELECT':
        return 'reads';
      case 'INSERT':
      case 'UPDATE':
      case 'DELETE':
      case 'UPSERT':
        return 'writes to';
      default:
        return 'uses';
    }
  }

  /**
   * Generates unique edge ID
   * @returns string - Unique edge ID
   */
  private generateEdgeId(): string {
    return `connection_edge_${++this.edgeCounter}`;
  }

  /**
   * Analyzes connection quality and provides recommendations
   * @param result - Connection mapping result
   * @returns string[] - Array of recommendations
   */
  analyzeConnectionQuality(result: ConnectionMappingResult): string[] {
    const recommendations: string[] = [];

    // Check mapping coverage
    if (result.mappingCoverage < 70) {
      recommendations.push(`Low mapping coverage (${result.mappingCoverage.toFixed(1)}%). Consider improving API documentation or adding more explicit connections.`);
    }

    // Check for unmapped frontend components
    if (result.unmappedFrontend.length > 0) {
      recommendations.push(`Found ${result.unmappedFrontend.length} unmapped frontend components. Consider adding API connections or removing unused components.`);
    }

    // Check for unmapped backend endpoints
    if (result.unmappedBackend.length > 0) {
      recommendations.push(`Found ${result.unmappedBackend.length} unmapped backend endpoints. Consider adding frontend connections or removing unused endpoints.`);
    }

    // Check connection confidence
    const lowConfidenceConnections = result.connections.filter(conn => conn.confidence < 0.6);
    if (lowConfidenceConnections.length > 0) {
      recommendations.push(`${lowConfidenceConnections.length} connections have low confidence scores. Consider reviewing these mappings.`);
    }

    // Check for proxy connections
    if (result.proxyConnections.length > 0) {
      recommendations.push(`${result.proxyConnections.length} connections go through proxies. Consider documenting proxy routing rules.`);
    }

    return recommendations;
  }
}

// Export the interface and implementation
export { ConnectionMapperImpl as ConnectionMapper };
