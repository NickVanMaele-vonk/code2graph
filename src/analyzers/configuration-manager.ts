/**
 * Configuration Manager
 * Handles loading and validation of global and repository-specific configurations
 * Following Phase 2.2 requirements from the project plan
 */

import * as fs from 'fs-extra';
import * as fsBuiltin from 'node:fs/promises';
import * as path from 'path';
import { 
  AnalysisConfig, 
  FileScanConfig, 
  ValidationResult, 
  AnalysisError,
  IncludeExcludeConfig 
} from '../types/index.js';

/**
 * Configuration Manager class
 * Implements configuration loading, validation, and management for code2graph
 * Supports global and repository-specific configuration files
 */
export class ConfigurationManager {
  private readonly globalConfigPath: string;
  private globalConfig: Record<string, unknown> | null;
  private repoConfig: Record<string, unknown> | null;

  /**
   * Constructor initializes configuration manager with default paths
   * 
   * @param globalConfigPath - Path to global configuration file
   */
  constructor(globalConfigPath?: string) {
    this.globalConfigPath = globalConfigPath || path.join(process.cwd(), 'src', 'config', 'global-config.json');
    this.globalConfig = null;
    this.repoConfig = null;
  }

  /**
   * Loads global configuration from the specified path
   * 
   * @returns Promise<ValidationResult> - Configuration loading result
   */
  async loadGlobalConfig(): Promise<ValidationResult> {
    try {
      if (!await fs.pathExists(this.globalConfigPath)) {
        const error: AnalysisError = {
          type: 'system',
          message: `Global configuration file not found: ${this.globalConfigPath}`
        };
        return {
          isValid: false,
          errors: [error],
          warnings: []
        };
      }

      const configContent = await fsBuiltin.readFile(this.globalConfigPath, 'utf-8');
      this.globalConfig = JSON.parse(configContent);

      // Validate global configuration
      const validation = this.validateGlobalConfig(this.globalConfig as Record<string, unknown>);
      
      if (validation.isValid) {
        console.log('✅ Global configuration loaded successfully');
      }

      return validation;

    } catch (error) {
      const analysisError: AnalysisError = {
        type: 'system',
        message: `Error loading global configuration: ${error}`,
        stack: error instanceof Error ? error.stack : undefined
      };
      return {
        isValid: false,
        errors: [analysisError],
        warnings: []
      };
    }
  }

  /**
   * Loads repository-specific configuration
   * 
   * @param repoConfigPath - Path to repository-specific configuration file
   * @returns Promise<ValidationResult> - Configuration loading result
   */
  async loadRepoConfig(repoConfigPath: string): Promise<ValidationResult> {
    try {
      if (!await fs.pathExists(repoConfigPath)) {
        // Repository config is optional, use defaults
        this.repoConfig = {};
        return {
          isValid: true,
          errors: [],
          warnings: [{
            type: 'system',
            message: `Repository configuration file not found: ${repoConfigPath}. Using defaults.`
          }]
        };
      }

      const configContent = await fsBuiltin.readFile(repoConfigPath, 'utf-8');
      this.repoConfig = JSON.parse(configContent);

      // Validate repository configuration
      const validation = this.validateRepoConfig(this.repoConfig as Record<string, unknown>);
      
      if (validation.isValid) {
        console.log('✅ Repository configuration loaded successfully');
      }

      return validation;

    } catch (error) {
      const analysisError: AnalysisError = {
        type: 'system',
        message: `Error loading repository configuration: ${error}`,
        stack: error instanceof Error ? error.stack : undefined
      };
      return {
        isValid: false,
        errors: [analysisError],
        warnings: []
      };
    }
  }

  /**
   * Gets merged configuration combining global and repository-specific settings
   * Repository settings override global settings
   * 
   * @returns AnalysisConfig - Merged configuration
   */
  getMergedConfig(): AnalysisConfig {
    if (!this.globalConfig) {
      throw new Error('Global configuration not loaded. Call loadGlobalConfig() first.');
    }

    // Start with global configuration as base
    const globalConfig = this.globalConfig as Record<string, unknown>;
    const merged: AnalysisConfig = {
      includePatterns: [...(Array.isArray(globalConfig.includePatterns) ? globalConfig.includePatterns as string[] : [])],
      excludePatterns: [...(Array.isArray(globalConfig.excludePatterns) ? globalConfig.excludePatterns as string[] : [])],
      maxFileSize: typeof globalConfig.maxFileSize === 'number' ? globalConfig.maxFileSize : 10485760, // 10MB default
      maxFiles: typeof globalConfig.maxFiles === 'number' ? globalConfig.maxFiles : 500,
      timeout: typeof globalConfig.timeout === 'number' ? globalConfig.timeout : 300000, // 5 minutes default
      outputFormat: (typeof globalConfig.defaultOutputFormat === 'string' && ['json', 'graphml', 'dot'].includes(globalConfig.defaultOutputFormat)) 
        ? globalConfig.defaultOutputFormat as 'json' | 'graphml' | 'dot' 
        : 'json',
      outputPath: './graph-output.json'
    };

    // Override with repository-specific settings if available
    if (this.repoConfig) {
      const repoConfig = this.repoConfig as Record<string, unknown>;
      
      if (typeof repoConfig.outputFormat === 'string' && ['json', 'graphml', 'dot'].includes(repoConfig.outputFormat)) {
        merged.outputFormat = repoConfig.outputFormat as 'json' | 'graphml' | 'dot';
      }
      if (typeof repoConfig.outputPath === 'string') {
        merged.outputPath = repoConfig.outputPath;
      }
      
      const customPatterns = repoConfig.customPatterns as Record<string, unknown> | undefined;
      if (customPatterns && Array.isArray(customPatterns.include) && customPatterns.include.length > 0) {
        merged.includePatterns.push(...(customPatterns.include as string[]));
      }
      if (customPatterns && Array.isArray(customPatterns.exclude) && customPatterns.exclude.length > 0) {
        merged.excludePatterns.push(...(customPatterns.exclude as string[]));
      }
    }

    return merged;
  }

  /**
   * Gets file scanning configuration from merged settings
   * 
   * @returns FileScanConfig - File scanning configuration
   */
  getFileScanConfig(): FileScanConfig {
    const merged = this.getMergedConfig();
    
    const customExclusions = this.repoConfig 
      ? (Array.isArray((this.repoConfig as Record<string, unknown>).excludeFiles) 
          ? (this.repoConfig as Record<string, unknown>).excludeFiles as string[] 
          : [])
      : [];
    
    return {
      includePatterns: merged.includePatterns,
      excludePatterns: merged.excludePatterns,
      maxFileSize: merged.maxFileSize,
      maxFiles: merged.maxFiles,
      excludeTestFiles: true, // Always exclude test files by default
      customExclusions: customExclusions
    };
  }

  /**
   * Gets include/exclude dialog configuration
   * 
   * @param currentLinesOfCode - Current lines of code in the repository
   * @returns IncludeExcludeConfig - Include/exclude dialog configuration
   */
  getIncludeExcludeConfig(currentLinesOfCode: number): IncludeExcludeConfig {
    const merged = this.getMergedConfig();
    
    return {
      recommendedLimit: merged.maxFiles * 200, // Estimate 200 lines per file
      currentLinesOfCode: currentLinesOfCode,
      fileTypes: {
        gitignore: false, // Default: exclude gitignore files
        frontend: true,   // Default: include frontend files
        middleware: true, // Default: include middleware files
        database: true    // Default: include database files
      }
    };
  }

  /**
   * Validates global configuration structure and values
   * 
   * @param config - Global configuration object
   * @returns ValidationResult - Validation result
   */
  private validateGlobalConfig(config: Record<string, unknown>): ValidationResult {
    const errors: AnalysisError[] = [];
    const warnings: AnalysisError[] = [];

    // Check required fields
    if (!config.includePatterns || !Array.isArray(config.includePatterns)) {
      errors.push({
        type: 'validation',
        message: 'Global configuration must include includePatterns array'
      });
    }

    if (!config.excludePatterns || !Array.isArray(config.excludePatterns)) {
      errors.push({
        type: 'validation',
        message: 'Global configuration must include excludePatterns array'
      });
    }

    // Validate numeric values
    if (config.maxFileSize !== undefined && (typeof config.maxFileSize !== 'number' || (config.maxFileSize as number) <= 0)) {
      errors.push({
        type: 'validation',
        message: 'maxFileSize must be a positive number'
      });
    }

    if (config.maxFiles !== undefined && (typeof config.maxFiles !== 'number' || (config.maxFiles as number) <= 0)) {
      errors.push({
        type: 'validation',
        message: 'maxFiles must be a positive number'
      });
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || (config.timeout as number) <= 0)) {
      errors.push({
        type: 'validation',
        message: 'timeout must be a positive number'
      });
    }

    // Validate output format
    if (config.defaultOutputFormat && typeof config.defaultOutputFormat === 'string' && !['json', 'graphml', 'dot'].includes(config.defaultOutputFormat)) {
      errors.push({
        type: 'validation',
        message: 'defaultOutputFormat must be one of: json, graphml, dot'
      });
    }

    // Check memory thresholds
    if (config.memoryWarningThreshold && typeof config.memoryWarningThreshold === 'number' && (config.memoryWarningThreshold < 0 || config.memoryWarningThreshold > 1)) {
      errors.push({
        type: 'validation',
        message: 'memoryWarningThreshold must be between 0 and 1'
      });
    }

    if (config.memoryErrorThreshold && typeof config.memoryErrorThreshold === 'number' && (config.memoryErrorThreshold < 0 || config.memoryErrorThreshold > 1)) {
      errors.push({
        type: 'validation',
        message: 'memoryErrorThreshold must be between 0 and 1'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates repository-specific configuration structure and values
   * 
   * @param config - Repository configuration object
   * @returns ValidationResult - Validation result
   */
  private validateRepoConfig(config: Record<string, unknown>): ValidationResult {
    const errors: AnalysisError[] = [];
    const warnings: AnalysisError[] = [];

    // Validate output format if specified
    if (config.outputFormat && typeof config.outputFormat === 'string' && !['json', 'graphml', 'dot'].includes(config.outputFormat)) {
      errors.push({
        type: 'validation',
        message: 'outputFormat must be one of: json, graphml, dot'
      });
    }

    // Validate analysis depth if specified
    if (config.analysisDepth && typeof config.analysisDepth !== 'object') {
      errors.push({
        type: 'validation',
        message: 'analysisDepth must be an object with boolean properties'
      });
    }

    // Validate custom patterns if specified
    if (config.customPatterns && typeof config.customPatterns === 'object') {
      const customPatterns = config.customPatterns as Record<string, unknown>;
      if (customPatterns.include && !Array.isArray(customPatterns.include)) {
        errors.push({
          type: 'validation',
          message: 'customPatterns.include must be an array'
        });
      }
      if (customPatterns.exclude && !Array.isArray(customPatterns.exclude)) {
        errors.push({
          type: 'validation',
          message: 'customPatterns.exclude must be an array'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Creates a repository-specific configuration template
   * 
   * @param repoUrl - Repository URL
   * @param outputPath - Output path for the template file
   * @returns Promise<void>
   */
  async createRepoConfigTemplate(repoUrl: string, outputPath: string): Promise<void> {
    const template = {
      repositoryUrl: repoUrl,
      excludeFiles: [],
      excludeFolders: [],
      outputFormat: "",
      analysisDepth: {
        frontend: true,
        middleware: true,
        database: true
      },
      customPatterns: {
        include: [],
        exclude: []
      },
      branch: "",
      commit: "",
      outputPath: "./graph-output.json"
    };

    await fsBuiltin.writeFile(outputPath, JSON.stringify(template, null, 2));
    console.log(`✅ Repository configuration template created: ${outputPath}`);
  }

  /**
   * Gets memory monitoring configuration
   * 
   * @returns Record<string, number> - Memory monitoring configuration
   */
  getMemoryConfig(): Record<string, number> {
    if (!this.globalConfig) {
      return {
        warningThreshold: 0.8,
        errorThreshold: 1.0
      };
    }

    const globalConfig = this.globalConfig as Record<string, unknown>;
    return {
      warningThreshold: (typeof globalConfig.memoryWarningThreshold === 'number' ? globalConfig.memoryWarningThreshold : 0.8),
      errorThreshold: (typeof globalConfig.memoryErrorThreshold === 'number' ? globalConfig.memoryErrorThreshold : 1.0)
    };
  }
}
