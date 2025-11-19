/**
 * JSON Output Generator
 * Generates structured JSON output from dependency graphs
 * Following Phase 5.1 requirements from the project plan
 * 
 * Business Logic:
 * - Converts dependency graph to structured JSON format
 * - Includes comprehensive metadata (version, timestamp, repository info, statistics)
 * - Validates output format before writing to file
 * - Generates dead code reports with detailed information
 * - Formats output for readability and tool compatibility
 * 
 * Architecture Context:
 * This module is part of the Output Layer (Section 2.3.1 of architecture document)
 * and implements the JSONGenerator interface for generating structured graph data.
 */

import fs from 'fs-extra';
import * as path from 'path';
import {
  DependencyGraph,
  DeadCodeInfo,
  AnalysisError,
  NodeInfo,
  EdgeInfo,
  // Phase 3: Component Mapping (Change Request 002)
  RouteInfo
} from '../types/index.js';
import { AnalysisLogger } from '../analyzers/analysis-logger.js';

/**
 * JSON Output interface
 * Defines the structure of the JSON output file
 */
export interface JSONOutput {
  version: string;
  timestamp: string;
  repositoryUrl: string;
  analysisScope: {
    includedTypes: string[];
    excludedTypes: string[];
  };
  statistics: {
    linesOfCode: number;
    totalNodes: number;
    totalEdges: number;
    deadCodeNodes: number;
    liveCodeNodes: number;
    deadCodePercentage: number;
  };
  graph: {
    nodes: NodeInfo[];
    edges: EdgeInfo[];
  };
}

/**
 * Dead Code Report interface
 * Defines the structure of the dead code report
 */
export interface DeadCodeReport {
  version: string;
  timestamp: string;
  repositoryUrl: string;
  summary: {
    totalDeadCodeItems: number;
    deadCodePercentage: number;
    impactDistribution: {
      high: number;
      medium: number;
      low: number;
    };
  };
  deadCodeItems: DeadCodeInfo[];
  recommendations: string[];
}

/**
 * Validation Result interface
 * Contains validation results for output data
 */
export interface ValidationResult {
  isValid: boolean;
  errors: AnalysisError[];
  warnings: AnalysisError[];
}

/**
 * JSON Generator Implementation
 * Generates structured JSON output from dependency graphs
 * Implements all methods from the architecture specification
 */
export class JSONGeneratorImpl {
  private logger?: AnalysisLogger;
  private version: string = '1.0.0'; // Code2Graph version

  /**
   * Constructor initializes the JSON generator
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Generates structured JSON output from dependency graph
   * Creates complete JSON structure with all required metadata
   * 
   * @param graph - Dependency graph to convert to JSON
   * @returns JSONOutput - Structured JSON output object
   */
  generateGraph(graph: DependencyGraph): JSONOutput {
    try {
      if (this.logger) {
        this.logger.logInfo('Generating JSON output from dependency graph', {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length
        });
      }

      // Calculate dead code percentage
      const deadCodePercentage = graph.nodes.length > 0
        ? Math.round((graph.metadata.statistics.deadCodeNodes / graph.nodes.length) * 100)
        : 0;

      // Create JSON output structure
      const jsonOutput: JSONOutput = {
        version: this.version,
        timestamp: new Date().toISOString(),
        repositoryUrl: graph.metadata.repositoryUrl,
        analysisScope: {
          includedTypes: graph.metadata.analysisScope.includedTypes,
          excludedTypes: graph.metadata.analysisScope.excludedTypes
        },
        statistics: {
          linesOfCode: graph.metadata.statistics.linesOfCode,
          totalNodes: graph.nodes.length,
          totalEdges: graph.edges.length,
          deadCodeNodes: graph.metadata.statistics.deadCodeNodes,
          liveCodeNodes: graph.metadata.statistics.liveCodeNodes,
          deadCodePercentage
        },
        graph: {
          nodes: graph.nodes,
          edges: graph.edges
        }
      };

      if (this.logger) {
        this.logger.logInfo('JSON output generated successfully', {
          outputSize: JSON.stringify(jsonOutput).length,
          deadCodePercentage
        });
      }

      return jsonOutput;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.logger) {
        this.logger.logError('Failed to generate JSON output', {
          error: errorMessage
        });
      }
      throw new Error(`JSON generation failed: ${errorMessage}`);
    }
  }

  /**
   * Generates dead code report from dead code information
   * Creates comprehensive report with summary and recommendations
   * 
   * @param deadCode - Array of dead code information
   * @param repositoryUrl - Repository URL for the report
   * @returns DeadCodeReport - Structured dead code report
   */
  generateDeadCodeReport(deadCode: DeadCodeInfo[], repositoryUrl: string): DeadCodeReport {
    try {
      if (this.logger) {
        this.logger.logInfo('Generating dead code report', {
          deadCodeCount: deadCode.length
        });
      }

      // Calculate impact distribution
      const impactDistribution = {
        high: deadCode.filter(dc => dc.impact === 'high').length,
        medium: deadCode.filter(dc => dc.impact === 'medium').length,
        low: deadCode.filter(dc => dc.impact === 'low').length
      };

      // Generate recommendations based on dead code analysis
      const recommendations = this.generateRecommendations(deadCode, impactDistribution);

      // Calculate total items including dead code
      const totalDeadCodeItems = deadCode.length;
      const deadCodePercentage = totalDeadCodeItems > 0 ? 100 : 0; // This would need total items context

      // Create dead code report structure
      const report: DeadCodeReport = {
        version: this.version,
        timestamp: new Date().toISOString(),
        repositoryUrl,
        summary: {
          totalDeadCodeItems,
          deadCodePercentage,
          impactDistribution
        },
        deadCodeItems: deadCode,
        recommendations
      };

      if (this.logger) {
        this.logger.logInfo('Dead code report generated successfully', {
          totalItems: totalDeadCodeItems,
          highImpact: impactDistribution.high,
          mediumImpact: impactDistribution.medium,
          lowImpact: impactDistribution.low
        });
      }

      return report;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.logger) {
        this.logger.logError('Failed to generate dead code report', {
          error: errorMessage
        });
      }
      throw new Error(`Dead code report generation failed: ${errorMessage}`);
    }
  }

  /**
   * Exports data to file
   * Validates and writes JSON data to the specified file path
   * 
   * @param data - Data object to export (JSONOutput or DeadCodeReport)
   * @param filePath - Target file path for export
   * @returns Promise<void>
   */
  async exportToFile(data: JSONOutput | DeadCodeReport, filePath: string): Promise<void> {
    try {
      if (this.logger) {
        this.logger.logInfo('Exporting JSON to file', {
          filePath,
          dataSize: JSON.stringify(data).length
        });
      }

      // Validate the data before writing
      const validationResult = this.validateOutput(data);
      if (!validationResult.isValid) {
        throw new Error(`Output validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Ensure output directory exists
      const outputDir = path.dirname(filePath);
      await fs.ensureDir(outputDir);

      // Format JSON with proper indentation for readability
      const jsonString = JSON.stringify(data, null, 2);

      // Write to file
      await fs.writeFile(filePath, jsonString, 'utf-8');

      if (this.logger) {
        this.logger.logInfo('JSON exported successfully', {
          filePath,
          fileSize: jsonString.length
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.logger) {
        this.logger.logError('Failed to export JSON to file', {
          error: errorMessage,
          filePath
        });
      }
      throw new Error(`JSON export failed: ${errorMessage}`);
    }
  }

  /**
   * Validates output data structure
   * Checks for required fields and data integrity
   * 
   * @param data - Data to validate (JSONOutput or DeadCodeReport)
   * @returns ValidationResult - Validation result with errors and warnings
   */
  validateOutput(data: JSONOutput | DeadCodeReport): ValidationResult {
    const errors: AnalysisError[] = [];
    const warnings: AnalysisError[] = [];

    try {
      // Check if data exists
      if (!data) {
        errors.push({
          type: 'validation',
          message: 'Output data is null or undefined'
        });
        return { isValid: false, errors, warnings };
      }

      // Validate common fields
      if (!data.version) {
        errors.push({
          type: 'validation',
          message: 'Missing required field: version'
        });
      }

      if (!data.timestamp) {
        errors.push({
          type: 'validation',
          message: 'Missing required field: timestamp'
        });
      }

      if (!data.repositoryUrl) {
        warnings.push({
          type: 'validation',
          message: 'Missing repository URL'
        });
      }

      // Validate JSONOutput-specific fields
      // Check if this is a JSONOutput (has analysisScope or statistics, not deadCodeItems)
      const isJSONOutput = ('analysisScope' in data || 'statistics' in data) && !('deadCodeItems' in data);
      
      if (isJSONOutput) {
        const jsonOutput = data as JSONOutput;

        if (!jsonOutput.graph) {
          errors.push({
            type: 'validation',
            message: 'Missing required field: graph'
          });
        } else {
          if (!Array.isArray(jsonOutput.graph.nodes)) {
            errors.push({
              type: 'validation',
              message: 'Graph nodes must be an array'
            });
          }

          if (!Array.isArray(jsonOutput.graph.edges)) {
            errors.push({
              type: 'validation',
              message: 'Graph edges must be an array'
            });
          }

          // Validate node structure
          if (Array.isArray(jsonOutput.graph.nodes)) {
            jsonOutput.graph.nodes.forEach((node, index) => {
              if (!node.id) {
                errors.push({
                  type: 'validation',
                  message: `Node at index ${index} missing required field: id`
                });
              }
              if (!node.label) {
                warnings.push({
                  type: 'validation',
                  message: `Node ${node.id} missing label`
                });
              }
              if (node.liveCodeScore === undefined || node.liveCodeScore === null) {
                warnings.push({
                  type: 'validation',
                  message: `Node ${node.id} missing liveCodeScore`
                });
              }
            });
          }

          // Validate edge structure
          if (Array.isArray(jsonOutput.graph.edges)) {
            jsonOutput.graph.edges.forEach((edge, index) => {
              if (!edge.id) {
                errors.push({
                  type: 'validation',
                  message: `Edge at index ${index} missing required field: id`
                });
              }
              if (!edge.source) {
                errors.push({
                  type: 'validation',
                  message: `Edge ${edge.id} missing source`
                });
              }
              if (!edge.target) {
                errors.push({
                  type: 'validation',
                  message: `Edge ${edge.id} missing target`
                });
              }
            });
          }
        }

        if (!jsonOutput.statistics) {
          errors.push({
            type: 'validation',
            message: 'Missing required field: statistics'
          });
        }
      }

      // Validate DeadCodeReport-specific fields
      if ('deadCodeItems' in data) {
        const report = data as DeadCodeReport;

        if (!Array.isArray(report.deadCodeItems)) {
          errors.push({
            type: 'validation',
            message: 'Dead code items must be an array'
          });
        }

        if (!report.summary) {
          errors.push({
            type: 'validation',
            message: 'Missing required field: summary'
          });
        }
      }

      if (this.logger && (errors.length > 0 || warnings.length > 0)) {
        this.logger.logWarning('Output validation completed with issues', {
          errorCount: errors.length,
          warningCount: warnings.length
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        type: 'validation',
        message: `Validation error: ${errorMessage}`
      });
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Generates recommendations based on dead code analysis
   * Provides actionable suggestions for code cleanup
   * 
   * @param deadCode - Array of dead code information
   * @param impactDistribution - Distribution of dead code by impact level
   * @returns string[] - Array of recommendation strings
   */
  private generateRecommendations(
    deadCode: DeadCodeInfo[],
    impactDistribution: { high: number; medium: number; low: number }
  ): string[] {
    const recommendations: string[] = [];

    // General recommendation if dead code exists
    if (deadCode.length > 0) {
      recommendations.push(
        `Found ${deadCode.length} dead code item(s) in the repository.`
      );
    }

    // High impact recommendations
    if (impactDistribution.high > 0) {
      recommendations.push(
        `Priority: Remove ${impactDistribution.high} high-impact dead code item(s) first. These likely represent significant unused features or components.`
      );
    }

    // Medium impact recommendations
    if (impactDistribution.medium > 0) {
      recommendations.push(
        `Consider removing ${impactDistribution.medium} medium-impact dead code item(s) to improve code maintainability.`
      );
    }

    // Low impact recommendations
    if (impactDistribution.low > 0) {
      recommendations.push(
        `Review ${impactDistribution.low} low-impact dead code item(s) for potential cleanup opportunities.`
      );
    }

    // Type-specific recommendations
    const componentCount = deadCode.filter(dc => dc.type === 'component').length;
    const functionCount = deadCode.filter(dc => dc.type === 'function').length;
    const apiCount = deadCode.filter(dc => dc.type === 'api').length;
    const databaseCount = deadCode.filter(dc => dc.type === 'database').length;

    if (componentCount > 0) {
      recommendations.push(
        `Found ${componentCount} unused component(s). Consider removing or refactoring these components.`
      );
    }

    if (functionCount > 0) {
      recommendations.push(
        `Found ${functionCount} unused function(s). Review and remove unused utility functions.`
      );
    }

    if (apiCount > 0) {
      recommendations.push(
        `Found ${apiCount} unused API endpoint(s). Consider removing these endpoints or verifying they are not called externally.`
      );
    }

    if (databaseCount > 0) {
      recommendations.push(
        `Found ${databaseCount} unused database entit(ies). Review database schema for potential cleanup.`
      );
    }

    // Add confidence-based recommendations
    const highConfidenceCount = deadCode.filter(dc => dc.confidence >= 90).length;
    if (highConfidenceCount > 0) {
      recommendations.push(
        `${highConfidenceCount} dead code item(s) identified with high confidence (≥90%). These are safe candidates for removal.`
      );
    }

    // If no dead code, provide positive feedback
    if (deadCode.length === 0) {
      recommendations.push(
        'No dead code detected. The codebase appears to be well-maintained with all defined code actively used.'
      );
    }

    return recommendations;
  }

  /**
   * Formats output with custom options
   * Allows for different formatting styles (compact, pretty, minified)
   * 
   * @param data - Data to format
   * @param options - Formatting options (indent, compact, etc.)
   * @returns string - Formatted JSON string
   */
  formatOutput(
    data: JSONOutput | DeadCodeReport,
    options: { indent?: number; compact?: boolean } = {}
  ): string {
    const indent = options.compact ? 0 : (options.indent || 2);
    return JSON.stringify(data, null, indent);
  }

  /**
   * Phase 3: Section Node Creation
   * Change Request 002 - Creates UI section nodes from route information
   */

  /**
   * Creates UI section nodes from route information
   * Phase 3.4: Create Section Nodes
   * 
   * Context: Generates graph nodes for UI sections (tabs, pages, menus)
   * defined by routing configuration. These nodes represent major navigation
   * sections that group related components.
   * 
   * Business Logic:
   * - Each route becomes a UI section node (e.g., "/manage" → "Manage Section")
   * - Section nodes use nodeType: "ui-section" to distinguish from components
   * - Section nodes use nodeCategory: "front-end" (leftmost in hierarchical layout)
   * - Section nodes use datatype: "array" (conceptually contain multiple components)
   * - These nodes will be connected to components via "displays" edges
   * 
   * @param routes - Array of route information from router analysis
   * @returns NodeInfo[] - Array of section nodes ready for graph inclusion
   */
  createSectionNodes(routes: RouteInfo[]): NodeInfo[] {
    try {
      const sectionNodes: NodeInfo[] = [];

      for (const route of routes) {
        // Generate section ID from route path
        const sectionId = this.generateSectionIdFromPath(route.path);

        // Create section node
        const sectionNode: NodeInfo = {
          id: sectionId,
          label: route.label || route.component || this.extractLabelFromPath(route.path),
          nodeType: 'ui-section', // Phase 3: New node type for UI sections
          nodeCategory: 'front-end', // Leftmost in hierarchical layout
          datatype: 'array', // Sections are containers, like arrays holding components
          liveCodeScore: 100, // UI sections are always live (part of navigation)
          file: route.file,
          line: route.line,
          column: route.column,
          codeOwnership: 'internal', // Routes are part of custom application code
          properties: {
            routePath: route.path,
            routeComponent: route.component,
            sectionType: route.sectionType,
            metadata: route.metadata || {}
          }
        };

        sectionNodes.push(sectionNode);
      }

      if (this.logger) {
        this.logger.logInfo('UI section nodes created', {
          totalSections: sectionNodes.length,
          sectionTypes: sectionNodes.reduce((acc, node) => {
            const type = node.properties.sectionType as string;
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });
      }

      return sectionNodes;

    } catch (error) {
      if (this.logger) {
        this.logger.logError('Error creating section nodes', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return [];
    }
  }

  /**
   * Generates a section ID from a route path
   * Business Logic: Creates unique, sanitized IDs for UI sections
   * 
   * @param path - Route path (e.g., "/manage", "/library/:id")
   * @returns string - Sanitized section ID (e.g., "section_manage")
   */
  private generateSectionIdFromPath(path: string): string {
    // Remove leading slash and parameters
    const sanitized = path
      .replace(/^\//, '') // Remove leading slash
      .replace(/:[^/]+/g, 'param') // Replace :id with 'param'
      .replace(/\//g, '_') // Replace remaining slashes with underscores
      .replace(/[^a-zA-Z0-9_]/g, '') // Remove non-alphanumeric except underscore
      .toLowerCase();
    
    return `section_${sanitized || 'root'}`;
  }

  /**
   * Extracts a human-readable label from a route path
   * Business Logic: Converts paths to readable labels for visualization
   * 
   * @param path - Route path (e.g., "/manage", "/club-members")
   * @returns string - Human-readable label (e.g., "Manage", "Club Members")
   */
  private extractLabelFromPath(path: string): string {
    // Remove leading slash and parameters
    let label = path
      .replace(/^\//, '')
      .replace(/:[^/]+/g, '')
      .replace(/\//g, ' ')
      .trim();

    // Convert kebab-case or snake_case to Title Case
    label = label
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return label || 'Root';
  }
}

/**
 * Export the JSON Generator class as default
 */
export default JSONGeneratorImpl;

