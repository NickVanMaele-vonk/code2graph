/**
 * Usage Tracker
 * Handles usage tracking and dead code detection for React/TypeScript codebases
 * Following Phase 4.1 requirements from the project plan
 */

import {
  UsageTracker,
  UsageInfo,
  UsageStatistics,
  UsageLocation,
  PerformanceWarning,
  ComponentInfo,
  FunctionInfo,
  VariableInfo,
  DeadCodeInfo,
  AnalysisError
} from '../types/index.js';
import { AnalysisLogger } from './analysis-logger.js';

/**
 * Usage Tracker Implementation
 * Tracks component, function, and variable usage across the codebase
 * Implements all methods from the UsageTracker interface
 */
export class UsageTrackerImpl implements UsageTracker {
  private logger?: AnalysisLogger;
  private usageCounter: number = 0;
  private performanceThresholds = {
    largeCodebase: 100000, // lines of code
    memoryWarning: 80, // percentage
    memoryError: 100, // percentage
    analysisTimeWarning: 300000 // 5 minutes in milliseconds
  };

  /**
   * Constructor initializes the usage tracker
   * @param logger - Optional analysis logger for error reporting
   */
  constructor(logger?: AnalysisLogger) {
    this.logger = logger;
  }

  /**
   * Tracks component usage across the codebase
   * Identifies where components are imported, used, and exported
   * 
   * @param components - Array of component information to analyze
   * @returns UsageInfo[] - Array of component usage information
   */
  trackComponentUsage(components: ComponentInfo[]): UsageInfo[] {
    const usageInfos: UsageInfo[] = [];

    try {
      if (this.logger) {
        this.logger.logInfo('Starting component usage tracking', {
          componentCount: components.length
        });
      }

      // Build a map of all components for cross-referencing
      const componentMap = new Map<string, ComponentInfo>();
      for (const component of components) {
        componentMap.set(component.name, component);
      }

      // Track usage for each component
      for (const component of components) {
        const usageInfo = this.trackComponentUsageInternal(component, componentMap);
        usageInfos.push(usageInfo);
      }

      if (this.logger) {
        this.logger.logInfo('Component usage tracking completed', {
          totalComponents: usageInfos.length,
          usedComponents: usageInfos.filter(u => u.isUsed).length,
          unusedComponents: usageInfos.filter(u => !u.isUsed).length
        });
      }

      return usageInfos;

    } catch (error) {
      const errorMessage = `Failed to track component usage: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Tracks function usage across the codebase
   * Identifies where functions are called and referenced
   * 
   * @param functions - Array of function information to analyze
   * @returns UsageInfo[] - Array of function usage information
   */
  trackFunctionUsage(functions: FunctionInfo[]): UsageInfo[] {
    const usageInfos: UsageInfo[] = [];

    try {
      if (this.logger) {
        this.logger.logInfo('Starting function usage tracking', {
          functionCount: functions.length
        });
      }

      // Build a map of all functions for cross-referencing
      const functionMap = new Map<string, FunctionInfo>();
      for (const func of functions) {
        functionMap.set(func.name, func);
      }

      // Track usage for each function
      for (const func of functions) {
        const usageInfo = this.trackFunctionUsageInternal(func, functionMap);
        usageInfos.push(usageInfo);
      }

      if (this.logger) {
        this.logger.logInfo('Function usage tracking completed', {
          totalFunctions: usageInfos.length,
          usedFunctions: usageInfos.filter(u => u.isUsed).length,
          unusedFunctions: usageInfos.filter(u => !u.isUsed).length
        });
      }

      return usageInfos;

    } catch (error) {
      const errorMessage = `Failed to track function usage: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Tracks variable usage across the codebase
   * Identifies where variables are referenced and assigned
   * 
   * @param variables - Array of variable information to analyze
   * @returns UsageInfo[] - Array of variable usage information
   */
  trackVariableUsage(variables: VariableInfo[]): UsageInfo[] {
    const usageInfos: UsageInfo[] = [];

    try {
      if (this.logger) {
        this.logger.logInfo('Starting variable usage tracking', {
          variableCount: variables.length
        });
      }

      // Build a map of all variables for cross-referencing
      const variableMap = new Map<string, VariableInfo>();
      for (const variable of variables) {
        variableMap.set(variable.name, variable);
      }

      // Track usage for each variable
      for (const variable of variables) {
        const usageInfo = this.trackVariableUsageInternal(variable, variableMap);
        usageInfos.push(usageInfo);
      }

      if (this.logger) {
        this.logger.logInfo('Variable usage tracking completed', {
          totalVariables: usageInfos.length,
          usedVariables: usageInfos.filter(u => u.isUsed).length,
          unusedVariables: usageInfos.filter(u => !u.isUsed).length
        });
      }

      return usageInfos;

    } catch (error) {
      const errorMessage = `Failed to track variable usage: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Calculates comprehensive usage statistics
   * Provides detailed statistics about code usage across the codebase
   * 
   * @param usageInfos - Array of usage information to analyze
   * @returns UsageStatistics - Comprehensive usage statistics
   */
  calculateUsageStatistics(usageInfos: UsageInfo[]): UsageStatistics {
    try {
      const components = usageInfos.filter(u => u.type === 'component');
      const functions = usageInfos.filter(u => u.type === 'function');
      const variables = usageInfos.filter(u => u.type === 'variable');
      const apis = usageInfos.filter(u => u.type === 'api');
      const databases = usageInfos.filter(u => u.type === 'database');

      const usedComponents = components.filter(u => u.isUsed).length;
      const usedFunctions = functions.filter(u => u.isUsed).length;
      const usedVariables = variables.filter(u => u.isUsed).length;
      const usedAPIs = apis.filter(u => u.isUsed).length;
      const usedDatabaseEntities = databases.filter(u => u.isUsed).length;

      const totalItems = usageInfos.length;
      const usedItems = usageInfos.filter(u => u.isUsed).length;
      const unusedItems = totalItems - usedItems;

      const deadCodePercentage = totalItems > 0 ? (unusedItems / totalItems) * 100 : 0;
      const liveCodePercentage = 100 - deadCodePercentage;

      const statistics: UsageStatistics = {
        totalComponents: components.length,
        usedComponents,
        unusedComponents: components.length - usedComponents,
        totalFunctions: functions.length,
        usedFunctions,
        unusedFunctions: functions.length - usedFunctions,
        totalVariables: variables.length,
        usedVariables,
        unusedVariables: variables.length - usedVariables,
        totalAPIs: apis.length,
        usedAPIs,
        unusedAPIs: apis.length - usedAPIs,
        totalDatabaseEntities: databases.length,
        usedDatabaseEntities,
        unusedDatabaseEntities: databases.length - usedDatabaseEntities,
        deadCodePercentage: Math.round(deadCodePercentage * 100) / 100,
        liveCodePercentage: Math.round(liveCodePercentage * 100) / 100
      };

      if (this.logger) {
        this.logger.logInfo('Usage statistics calculated', {
          totalItems,
          usedItems,
          unusedItems,
          deadCodePercentage: statistics.deadCodePercentage,
          liveCodePercentage: statistics.liveCodePercentage
        });
      }

      return statistics;

    } catch (error) {
      const errorMessage = `Failed to calculate usage statistics: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Calculates live code scores for all usage information
   * Implements the liveCodeScore calculation (0-100) as per PRD requirements
   * 
   * @param usageInfos - Array of usage information to analyze
   * @returns Map<string, number> - Map of usage IDs to live code scores
   */
  calculateLiveCodeScores(usageInfos: UsageInfo[]): Map<string, number> {
    const scores = new Map<string, number>();

    try {
      for (const usageInfo of usageInfos) {
        let score = 0;

        // Base score calculation based on usage
        if (usageInfo.isUsed) {
          score = 100; // Confirmed incoming edge - live code
        } else {
          score = 0; // No incoming edge - dead code
        }

        // Adjust score based on usage count and context
        if (usageInfo.usageCount > 0) {
          score = Math.min(100, score + (usageInfo.usageCount * 5)); // Bonus for multiple uses
        }

        // Adjust score based on export status
        if (usageInfo.usageLocations.some(loc => loc.usageType === 'import')) {
          score = Math.max(score, 50); // At least partially live if imported
        }

        scores.set(usageInfo.id, Math.max(0, Math.min(100, score)));
      }

      if (this.logger) {
        this.logger.logInfo('Live code scores calculated', {
          totalItems: scores.size,
          liveItems: Array.from(scores.values()).filter(s => s === 100).length,
          deadItems: Array.from(scores.values()).filter(s => s === 0).length
        });
      }

      return scores;

    } catch (error) {
      const errorMessage = `Failed to calculate live code scores: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Detects dead code based on usage tracking
   * Identifies unused components, functions, and variables
   * 
   * @param usageInfos - Array of usage information to analyze
   * @returns DeadCodeInfo[] - Array of dead code information
   */
  detectDeadCode(usageInfos: UsageInfo[]): DeadCodeInfo[] {
    const deadCode: DeadCodeInfo[] = [];

    try {
      for (const usageInfo of usageInfos) {
        if (!usageInfo.isUsed || usageInfo.liveCodeScore === 0) {
          const deadCodeInfo = this.createDeadCodeInfo(usageInfo);
          deadCode.push(deadCodeInfo);
        }
      }

      if (this.logger) {
        this.logger.logInfo('Dead code detection completed', {
          totalDeadCode: deadCode.length,
          highImpact: deadCode.filter(d => d.impact === 'high').length,
          mediumImpact: deadCode.filter(d => d.impact === 'medium').length,
          lowImpact: deadCode.filter(d => d.impact === 'low').length
        });
      }

      return deadCode;

    } catch (error) {
      const errorMessage = `Failed to detect dead code: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Generates performance warnings for large codebases
   * Provides warnings when codebase size might impact performance
   * 
   * @param statistics - Usage statistics to analyze
   * @returns PerformanceWarning[] - Array of performance warnings
   */
  generatePerformanceWarnings(statistics: UsageStatistics): PerformanceWarning[] {
    const warnings: PerformanceWarning[] = [];

    try {
      const totalItems = statistics.totalComponents + 
                        statistics.totalFunctions + 
                        statistics.totalVariables + 
                        statistics.totalAPIs + 
                        statistics.totalDatabaseEntities;

      // Large codebase warning
      if (totalItems > this.performanceThresholds.largeCodebase) {
        warnings.push({
          type: 'large_codebase',
          severity: 'warning',
          message: `Large codebase detected: ${totalItems} items. Analysis may take longer than expected.`,
          recommendation: 'Consider using the Include/Exclude dialog to limit analysis scope.',
          threshold: this.performanceThresholds.largeCodebase,
          actualValue: totalItems
        });
      }

      // High dead code percentage warning
      if (statistics.deadCodePercentage > 30) {
        warnings.push({
          type: 'large_codebase',
          severity: 'warning',
          message: `High dead code percentage detected: ${statistics.deadCodePercentage}%. Consider cleaning up unused code.`,
          recommendation: 'Review and remove unused components, functions, and variables.',
          threshold: 30,
          actualValue: statistics.deadCodePercentage
        });
      }

      if (this.logger) {
        this.logger.logInfo('Performance warnings generated', {
          totalWarnings: warnings.length,
          warningCount: warnings.filter(w => w.severity === 'warning').length,
          errorCount: warnings.filter(w => w.severity === 'error').length
        });
      }

      return warnings;

    } catch (error) {
      const errorMessage = `Failed to generate performance warnings: ${error instanceof Error ? error.message : String(error)}`;
      
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
   * Tracks usage for a single component
   * @param component - Component to track usage for
   * @param componentMap - Map of all components for cross-referencing
   * @returns UsageInfo - Component usage information
   */
  private trackComponentUsageInternal(component: ComponentInfo, componentMap: Map<string, ComponentInfo>): UsageInfo {
    const usageLocations: UsageLocation[] = [];
    let isUsed = false;

    // Track import usage (if component has imports, it's being used)
    if (component.imports && component.imports.length > 0) {
      isUsed = true;
      for (const importInfo of component.imports) {
        usageLocations.push({
          file: component.file,
          line: importInfo.line,
          column: importInfo.column,
          usageType: 'import',
          context: `Imported from ${importInfo.source}`
        });
      }
    }

    // Track export usage
    if (component.exports) {
      for (const exportInfo of component.exports) {
        if (exportInfo.name === component.name) {
          usageLocations.push({
            file: component.file,
            line: exportInfo.line,
            column: exportInfo.column,
            usageType: 'reference',
            context: `Exported as ${exportInfo.type}`
          });
          isUsed = true;
        }
      }
    }

    // Track usage in informative elements
    if (component.informativeElements) {
      for (const element of component.informativeElements) {
        if (element.name.includes(component.name)) {
          usageLocations.push({
            file: component.file,
            line: element.line,
            column: element.column,
            usageType: 'call',
            context: `Used in ${element.type} element`
          });
          isUsed = true;
        }
      }
    }

    // Check if component is used by other components
    for (const [otherName, otherComponent] of componentMap) {
      if (otherName !== component.name) {
        // Check if this component is imported by another component
        const isImportedByOther = otherComponent.imports && otherComponent.imports.some(imp => 
          imp.defaultImport === component.name || 
          imp.specifiers.some(s => s.name === component.name)
        );

        if (isImportedByOther) {
          usageLocations.push({
            file: otherComponent.file,
            line: undefined,
            column: undefined,
            usageType: 'import',
            context: `Imported by ${otherName}`
          });
          isUsed = true;
        }
      }
    }

    return {
      id: this.generateUsageId(),
      name: component.name,
      type: 'component',
      file: component.file,
      definitionLocation: {
        file: component.file
      },
      usageLocations,
      isUsed,
      usageCount: usageLocations.length,
      liveCodeScore: isUsed ? 100 : 0
    };
  }

  /**
   * Tracks usage for a single function
   * @param func - Function to track usage for
   * @param functionMap - Map of all functions for cross-referencing
   * @returns UsageInfo - Function usage information
   */
  private trackFunctionUsageInternal(func: FunctionInfo, functionMap: Map<string, FunctionInfo>): UsageInfo {
    const usageLocations: UsageLocation[] = [];
    let isUsed = false;

    // Track calls from other functions
    for (const [otherName, otherFunc] of functionMap) {
      if (otherName !== func.name && otherFunc.calls && otherFunc.calls.includes(func.name)) {
        usageLocations.push({
          file: otherFunc.file,
          line: otherFunc.line,
          column: otherFunc.column,
          usageType: 'call',
          context: `Called by ${otherName}`
        });
        isUsed = true;
      }
    }

    // Track if this function calls other functions (making it active/used)
    if (func.calls && func.calls.length > 0) {
      for (const calledFunction of func.calls) {
        usageLocations.push({
          file: func.file,
          line: func.line,
          column: func.column,
          usageType: 'call',
          context: `Calls ${calledFunction}`
        });
        isUsed = true;
      }
    }

    // Track export usage
    if (func.isExported) {
      usageLocations.push({
        file: func.file,
        line: func.line,
        column: func.column,
        usageType: 'reference',
        context: 'Exported function'
      });
      isUsed = true;
    }

    // Track import usage
    if (func.isImported) {
      usageLocations.push({
        file: func.file,
        line: func.line,
        column: func.column,
        usageType: 'import',
        context: 'Imported function'
      });
      isUsed = true;
    }

    return {
      id: this.generateUsageId(),
      name: func.name,
      type: 'function',
      file: func.file,
      line: func.line,
      column: func.column,
      definitionLocation: {
        file: func.file,
        line: func.line,
        column: func.column
      },
      usageLocations,
      isUsed,
      usageCount: usageLocations.length,
      liveCodeScore: isUsed ? 100 : 0
    };
  }

  /**
   * Tracks usage for a single variable
   * @param variable - Variable to track usage for
   * @param variableMap - Map of all variables for cross-referencing
   * @returns UsageInfo - Variable usage information
   */
  private trackVariableUsageInternal(variable: VariableInfo, variableMap: Map<string, VariableInfo>): UsageInfo {
    const usageLocations: UsageLocation[] = [];
    let isUsed = variable.isUsed;

    // Track usage in other variables
    for (const [otherName, otherVariable] of variableMap) {
      if (otherName !== variable.name && otherVariable.usedIn && otherVariable.usedIn.includes(variable.name)) {
        usageLocations.push({
          file: otherVariable.file,
          line: otherVariable.line,
          column: otherVariable.column,
          usageType: 'reference',
          context: `Used by ${otherName}`
        });
        isUsed = true;
      }
    }

    // Track export usage
    if (variable.isExported) {
      usageLocations.push({
        file: variable.file,
        line: variable.line,
        column: variable.column,
        usageType: 'reference',
        context: 'Exported variable'
      });
      isUsed = true;
    }

    // Track import usage
    if (variable.isImported) {
      usageLocations.push({
        file: variable.file,
        line: variable.line,
        column: variable.column,
        usageType: 'import',
        context: 'Imported variable'
      });
      isUsed = true;
    }

    return {
      id: this.generateUsageId(),
      name: variable.name,
      type: 'variable',
      file: variable.file,
      line: variable.line,
      column: variable.column,
      definitionLocation: {
        file: variable.file,
        line: variable.line,
        column: variable.column
      },
      usageLocations,
      isUsed,
      usageCount: usageLocations.length,
      liveCodeScore: isUsed ? 100 : 0
    };
  }

  /**
   * Creates dead code information from usage info
   * @param usageInfo - Usage information to convert
   * @returns DeadCodeInfo - Dead code information
   */
  private createDeadCodeInfo(usageInfo: UsageInfo): DeadCodeInfo {
    let reason: 'unused' | 'unreachable' | 'no_incoming_edges' = 'unused';
    let confidence = 0.9;
    let impact: 'low' | 'medium' | 'high' = 'medium';
    const suggestions: string[] = [];

    // Determine reason and impact based on type and context
    switch (usageInfo.type) {
      case 'component':
        reason = 'no_incoming_edges';
        impact = 'high';
        suggestions.push('Remove unused component', 'Check if component should be exported');
        break;
      case 'function':
        reason = 'unused';
        impact = usageInfo.usageLocations.length === 0 ? 'high' : 'medium';
        suggestions.push('Remove unused function', 'Check if function should be exported');
        break;
      case 'variable':
        reason = 'unused';
        impact = 'low';
        suggestions.push('Remove unused variable', 'Check if variable should be exported');
        break;
      case 'api':
        reason = 'no_incoming_edges';
        impact = 'high';
        suggestions.push('Remove unused API endpoint', 'Check if endpoint should be documented');
        break;
      case 'database':
        reason = 'no_incoming_edges';
        impact = 'high';
        suggestions.push('Remove unused database entity', 'Check if entity should be referenced');
        break;
    }

    // Adjust confidence based on usage count
    if (usageInfo.usageCount === 0) {
      confidence = 0.95;
    } else if (usageInfo.usageCount < 3) {
      confidence = 0.8;
    } else {
      confidence = 0.6;
    }

    return {
      id: usageInfo.id,
      name: usageInfo.name,
      type: usageInfo.type,
      file: usageInfo.file,
      line: usageInfo.line,
      column: usageInfo.column,
      reason,
      confidence,
      suggestions,
      impact
    };
  }

  /**
   * Generates a unique usage ID
   * @returns string - Unique usage ID
   */
  private generateUsageId(): string {
    return `usage_${++this.usageCounter}`;
  }
}

// Export the interface and implementation
export { UsageTrackerImpl as UsageTracker };
