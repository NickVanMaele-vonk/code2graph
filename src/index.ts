/**
 * Code2Graph CLI Entry Point
 * Main entry point for the code2graph command-line tool
 */

import { Command } from 'commander';
import { RepositoryManager } from './analyzers/repository-manager.js';
import { AnalysisLogger } from './analyzers/analysis-logger.js';
import { MemoryMonitor } from './analyzers/memory-monitor.js';
import { ConfigurationManager } from './analyzers/configuration-manager.js';
import { ASTParserImpl } from './analyzers/ast-parser.js';
import { DependencyAnalyzerImpl } from './analyzers/dependency-analyser.js';
import { JSONGeneratorImpl } from './generators/json-generator.js';
import { ProgressInfo, CLIAnalysisOptions, FileScanProgress, FileInfo, ComponentInfo, DependencyGraph } from './types/index.js';
import { generateOutputPath, generateDeadCodeReportPath } from './utils/url-utils.js';

/**
 * Main CLI class
 * Handles command-line interface and coordinates analysis workflow
 */
class Code2GraphCLI {
  private repositoryManager: RepositoryManager;
  private logger: AnalysisLogger;
  private memoryMonitor: MemoryMonitor;
  private configManager: ConfigurationManager;
  private astParser: ASTParserImpl;
  private dependencyAnalyzer: DependencyAnalyzerImpl;
  private jsonGenerator: JSONGeneratorImpl;
  private program: Command;

  constructor() {
    this.repositoryManager = new RepositoryManager();
    this.logger = new AnalysisLogger(''); // Will be initialized with actual repo URL
    this.memoryMonitor = new MemoryMonitor();
    this.configManager = new ConfigurationManager();
    this.astParser = new ASTParserImpl(); // Will be initialized with logger later
    this.dependencyAnalyzer = new DependencyAnalyzerImpl(); // Will be initialized with logger later
    this.jsonGenerator = new JSONGeneratorImpl(); // Will be initialized with logger later
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Sets up CLI commands and options
   * Configures the command-line interface following the architecture specifications
   */
  private setupCommands(): void {
    this.program
      .name('code2graph')
      .description('Analyze React/TypeScript codebases to generate dependency graphs and identify dead code')
      .version('1.0.0');

    // Analyze command
    this.program
      .command('analyze')
      .description('Analyze a repository for code dependencies and dead code')
      .argument('<repo-url>', 'GitHub repository URL to analyze')
      .option('-o, --output <path>', 'Output file path (default: ./graph-data-files/code2graph_<repo-name>.json)')
      .option('-f, --format <format>', 'Output format (json|graphml|dot)', 'json')
      .option('-b, --branch <branch>', 'Git branch to analyze')
      .option('--depth <depth>', 'Git clone depth', '1')
      .option('--timeout <ms>', 'Clone timeout in milliseconds', '300000')
      .action(async (repoUrl: string, options: CLIAnalysisOptions) => {
        // Generate default output path based on repository URL if not provided
        // This ensures the output file has a meaningful name based on the repo
        if (!options.output) {
          options.output = generateOutputPath(repoUrl);
        }
        await this.analyzeRepository(repoUrl, options);
      });

    // Help command
    this.program
      .command('help')
      .description('Show help information')
      .action(() => {
        this.showHelp();
      });

    // Version command
    this.program
      .command('version')
      .description('Show version information')
      .action(() => {
        console.log('Code2Graph v1.0.0');
      });
  }

  /**
   * Analyzes a repository
   * Main analysis workflow following Phase 2.2 requirements
   * 
   * @param repoUrl - Repository URL to analyze
   * @param options - Analysis options from CLI command
   */
  private async analyzeRepository(repoUrl: string, options: CLIAnalysisOptions): Promise<void> {
    try {
      console.log('🚀 Starting Code2Graph analysis...');
      console.log(`📁 Repository: ${repoUrl}`);
      console.log(`📊 Output format: ${options.format}`);
      console.log(`📄 Output file: ${options.output}`);

      // Initialize logger with repository URL
      this.logger = new AnalysisLogger(repoUrl);
      await this.logger.logAnalysisStart(repoUrl, '');

      // Load configurations
      console.log('\n⚙️  Loading configuration...');
      const globalConfigResult = await this.configManager.loadGlobalConfig();
      if (!globalConfigResult.isValid) {
        console.error('❌ Failed to load global configuration:', globalConfigResult.errors);
        process.exit(1);
      }

      // Initialize repository manager, AST parser, dependency analyzer, and JSON generator with dependencies
      this.repositoryManager.initialize(this.logger, this.memoryMonitor);
      this.astParser = new ASTParserImpl(this.logger);
      this.dependencyAnalyzer = new DependencyAnalyzerImpl(this.logger);
      this.jsonGenerator = new JSONGeneratorImpl(this.logger);

      // Create progress callback for repository cloning
      const progressCallback = (progress: ProgressInfo) => {
        console.log(`⏳ ${progress.message} (${progress.percentage}%)`);
      };

      // Clone repository with progress reporting
      console.log('\n📥 Cloning repository...');
      const repoInfo = await this.repositoryManager.cloneRepository(
        repoUrl,
        undefined,
        {
          branch: options.branch,
          depth: parseInt(options.depth),
          timeout: parseInt(options.timeout),
          progressCallback
        }
      );

      console.log(`✅ Repository cloned successfully: ${repoInfo.name}`);
      console.log(`📍 Path: ${repoInfo.path}`);
      if (repoInfo.branch) {
        console.log(`🌿 Branch: ${repoInfo.branch}`);
      }
      if (repoInfo.commit) {
        console.log(`🔗 Commit: ${repoInfo.commit}`);
      }

      // Get file scanning configuration
      const fileScanConfig = this.configManager.getFileScanConfig();
      await this.logger.logConfiguration(fileScanConfig as unknown as Record<string, unknown>);

      // Enhanced file scanning with progress reporting
      console.log('\n🔍 Scanning files with enhanced filtering...');
      const fileScanProgressCallback = (progress: FileScanProgress) => {
        console.log(`⏳ ${progress.message} (${progress.percentage}%)`);
        if (progress.currentFile) {
          console.log(`   📄 Processing: ${progress.currentFile}`);
        }
      };

      const scanResult = await this.repositoryManager.scanFilesEnhanced(
        repoInfo.path,
        fileScanConfig,
        fileScanProgressCallback
      );

      console.log(`✅ File scanning completed:`);
      console.log(`   📁 Files found: ${scanResult.files.length}`);
      console.log(`   📊 Total size: ${Math.round(scanResult.totalSize / 1024)} KB`);
      console.log(`   🚫 Excluded files: ${scanResult.excludedFiles}`);
      
      if (scanResult.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${scanResult.errors.length}`);
        scanResult.errors.forEach(error => {
          console.log(`      - ${error.message}`);
        });
      }

      if (scanResult.warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${scanResult.warnings.length}`);
        scanResult.warnings.forEach(warning => {
          console.log(`      - ${warning.message}`);
        });
      }

      // Log analysis completion
      await this.logger.logAnalysisComplete({
        filesFound: scanResult.files.length,
        totalSize: scanResult.totalSize,
        excludedFiles: scanResult.excludedFiles,
        errors: scanResult.errors.length,
        warnings: scanResult.warnings.length
      });

      // Phase 3.3: Basic AST Parser - Parse files and extract informative elements
      console.log('\n🔍 Phase 3.3: Basic AST Parser - Analyzing code structure...');
      const components = await this.performASTAnalysis(scanResult.files);
      
      // Phase 3.4: Dependency Analyzer - Build dependency graph
      console.log('\n🔗 Phase 3.4: Dependency Analyzer - Building dependency graph...');
      const dependencyGraph = await this.performDependencyAnalysis(components);
      
      // Phase 5.1: JSON Output Generator - Generate and export JSON output
      console.log('\n📊 Phase 5.1: JSON Output Generator - Generating output...');
      await this.performOutputGeneration(dependencyGraph, options.output, options.format, repoUrl);

      console.log('\n🎉 Analysis completed successfully!');
      console.log(`📄 Results saved to: ${options.output}`);
      console.log(`📋 Analysis log: ${this.logger.getLogPath()}`);

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      if (this.logger) {
        await this.logger.logError('Analysis failed', { error: error instanceof Error ? error.message : String(error) });
      }
      process.exit(1);
    } finally {
      // Clean up temporary files
      await this.cleanup();
    }
  }

  /**
   * Shows help information
   * Displays usage instructions and examples
   */
  private showHelp(): void {
    console.log(`
Code2Graph - Code Dependency Visualization Tool

USAGE:
  code2graph analyze <repo-url> [options]

COMMANDS:
  analyze    Analyze a repository for code dependencies and dead code
  help       Show help information
  version    Show version information

OPTIONS:
  -o, --output <path>    Output file path (default: ./graph-data-files/code2graph_<repo-name>.json)
  -f, --format <format>  Output format: json, graphml, dot (default: json)
  -b, --branch <branch>  Git branch to analyze
  --depth <depth>        Git clone depth (default: 1)
  --timeout <ms>         Clone timeout in milliseconds (default: 300000)

EXAMPLES:
  code2graph analyze https://github.com/user/repo
  code2graph analyze https://github.com/user/repo -f json -o ./my-analysis.json
  code2graph analyze https://github.com/user/repo -b develop --depth 5

For more information, visit: https://github.com/NickVanMaele-vonk/code2graph
    `);
  }

  /**
   * Performs AST analysis on scanned files
   * Phase 3.3: Basic AST Parser implementation
   * 
   * @param files - Array of files to analyze
   * @returns Promise<ComponentInfo[]> - Array of component information
   */
  private async performASTAnalysis(files: FileInfo[]): Promise<ComponentInfo[]> {
    const typescriptFiles = files.filter(file => 
      file.extension === '.ts' || 
      file.extension === '.tsx' || 
      file.extension === '.js' || 
      file.extension === '.jsx'
    );

    console.log(`📊 Analyzing ${typescriptFiles.length} TypeScript/JavaScript files...`);

    let totalImports = 0;
    let totalExports = 0;
    let totalJSXElements = 0;
    let totalInformativeElements = 0;
    let parseErrors = 0;
    const components: ComponentInfo[] = [];

    for (let i = 0; i < typescriptFiles.length; i++) {
      const file = typescriptFiles[i];
      const progress = Math.round(((i + 1) / typescriptFiles.length) * 100);
      
      console.log(`⏳ Parsing ${file.name} (${progress}%)`);

      try {
        // Parse the file
        const ast = await this.astParser.parseFile(file.path);
        
        // Extract various elements
        const imports = this.astParser.extractImports(ast);
        const exports = this.astParser.extractExports(ast);
        const jsxElements = this.astParser.extractJSXElements(ast);
        const informativeElements = this.astParser.extractInformativeElements(ast, file.path);
        
        // Phase 1: Extract individual component definitions from the file
        const componentDefinitions = this.astParser.extractComponentDefinitions(ast, file.path);

        totalImports += imports.length;
        totalExports += exports.length;
        totalJSXElements += jsxElements.length;
        totalInformativeElements += informativeElements.length;

        // Phase 1 Refactor: Create ComponentInfo for each actual component definition found in file
        // This replaces the old approach of creating one ComponentInfo per file
        if (componentDefinitions.length > 0) {
          // File contains component definitions - create ComponentInfo for each
          for (const componentDef of componentDefinitions) {
            const componentInfo: ComponentInfo = {
              name: componentDef.name,
              type: componentDef.type,
              file: file.path,
              line: componentDef.line,
              column: componentDef.column,
              props: [],
              state: [],
              hooks: [],
              children: [],
              informativeElements: informativeElements.map(el => ({
                type: el.type as 'display' | 'input' | 'data-source' | 'state-management',
                name: el.name,
                props: el.props,
                // UPDATED (Phase A): eventHandlers is already EventHandler[], no need to map
                eventHandlers: el.eventHandlers,
                dataBindings: el.dataBindings.map(binding => ({
                  source: binding,
                  target: 'element',
                  type: 'data'
                }))
              })),
              imports,
              exports
            };
            components.push(componentInfo);
          }
        } else {
          // File has no component definitions but may have JSX or logic
          // Create a fallback ComponentInfo representing the file itself
          // This handles utility files, config files, etc.
          const componentInfo: ComponentInfo = {
            name: file.name.replace(/\.(tsx?|jsx?)$/, ''),
            type: 'functional',
            file: file.path,
            props: [],
            state: [],
            hooks: [],
            children: [],
            informativeElements: informativeElements.map(el => ({
              type: el.type as 'display' | 'input' | 'data-source' | 'state-management',
              name: el.name,
              props: el.props,
              // UPDATED (Phase A): eventHandlers is already EventHandler[], no need to map
              eventHandlers: el.eventHandlers,
              dataBindings: el.dataBindings.map(binding => ({
                source: binding,
                target: 'element',
                type: 'data'
              }))
            })),
            imports,
            exports
          };
          components.push(componentInfo);
        }

        // Log detailed information for this file
        await this.logger.logInfo(`AST analysis completed for ${file.name}`, {
          imports: imports.length,
          exports: exports.length,
          jsxElements: jsxElements.length,
          informativeElements: informativeElements.length,
          displayElements: informativeElements.filter(el => el.type === 'display').length,
          inputElements: informativeElements.filter(el => el.type === 'input').length,
          dataSources: informativeElements.filter(el => el.type === 'data-source').length,
          stateManagement: informativeElements.filter(el => el.type === 'state-management').length
        });

      } catch (error) {
        parseErrors++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Failed to parse ${file.name}: ${errorMessage}`);
        await this.logger.logWarning(`Failed to parse file: ${file.name}`, {
          error: errorMessage,
          file: file.path
        });
      }

      // Check memory usage
      if (this.memoryMonitor.checkMemoryWarning()) {
        console.warn('⚠️  Memory usage warning: Consider reducing analysis scope');
        await this.logger.logWarning('Memory usage warning during AST analysis', {
          memoryUsage: this.memoryMonitor.getUsagePercentage()
        });
      }

      if (this.memoryMonitor.checkMemoryError()) {
        throw new Error('Fatal error: memory capacity exceeded during AST analysis');
      }
    }

    // Log summary
    console.log(`✅ AST Analysis completed:`);
    console.log(`   Total imports: ${totalImports}`);
    console.log(`   Total exports: ${totalExports}`);
    console.log(`   Total JSX elements: ${totalJSXElements}`);
    console.log(`   Total informative elements: ${totalInformativeElements}`);
    console.log(`   Parse errors: ${parseErrors}`);

    await this.logger.logInfo('AST analysis summary', {
      filesAnalyzed: typescriptFiles.length,
      totalImports,
      totalExports,
      totalJSXElements,
      totalInformativeElements,
      parseErrors,
      componentsCreated: components.length
    });

    return components;
  }

  /**
   * Performs dependency analysis on components
   * Phase 3.4: Dependency Analyzer implementation
   * 
   * @param components - Array of component information to analyze
   * @returns Promise<DependencyGraph> - Complete dependency graph
   */
  private async performDependencyAnalysis(components: ComponentInfo[]): Promise<DependencyGraph> {
    try {
      console.log(`📊 Analyzing dependencies for ${components.length} components...`);

      // Build dependency graph
      const dependencyGraph = this.dependencyAnalyzer.buildDependencyGraph(components);
      
      console.log(`✅ Dependency graph created:`);
      console.log(`   📊 Total nodes: ${dependencyGraph.nodes.length}`);
      console.log(`   🔗 Total edges: ${dependencyGraph.edges.length}`);
      console.log(`   💀 Dead code nodes: ${dependencyGraph.metadata.statistics.deadCodeNodes}`);
      console.log(`   ✅ Live code nodes: ${dependencyGraph.metadata.statistics.liveCodeNodes}`);

      // Trace API calls
      const apiCalls = this.dependencyAnalyzer.traceAPICalls(components);
      console.log(`   🌐 API calls found: ${apiCalls.length}`);

      // Detect circular dependencies
      const cycles = this.dependencyAnalyzer.detectCircularDependencies(dependencyGraph);
      if (cycles.length > 0) {
        console.log(`   ⚠️  Circular dependencies detected: ${cycles.length}`);
        cycles.forEach(cycle => {
          console.log(`      - ${cycle.description}`);
        });
      } else {
        console.log(`   ✅ No circular dependencies detected`);
      }

      // Log analysis results
      await this.logger.logInfo('Dependency analysis completed', {
        totalNodes: dependencyGraph.nodes.length,
        totalEdges: dependencyGraph.edges.length,
        deadCodeNodes: dependencyGraph.metadata.statistics.deadCodeNodes,
        liveCodeNodes: dependencyGraph.metadata.statistics.liveCodeNodes,
        apiCalls: apiCalls.length,
        circularDependencies: cycles.length
      });

      return dependencyGraph;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Dependency analysis failed: ${errorMessage}`);
      await this.logger.logError('Dependency analysis failed', {
        error: errorMessage,
        components: components.length
      });
      throw error;
    }
  }

  /**
   * Performs output generation from dependency graph
   * Phase 5.1: JSON Output Generator implementation
   * 
   * @param dependencyGraph - Complete dependency graph to export
   * @param outputPath - Path where the output file should be saved
   * @param format - Output format (json, graphml, dot)
   * @param repositoryUrl - Repository URL for metadata
   */
  private async performOutputGeneration(
    dependencyGraph: DependencyGraph,
    outputPath: string,
    format: string,
    repositoryUrl: string
  ): Promise<void> {
    try {
      console.log(`📝 Generating ${format.toUpperCase()} output...`);

      // Currently only JSON format is supported (Phase 5.1)
      if (format !== 'json') {
        console.warn(`⚠️  Format '${format}' not yet supported. Falling back to JSON.`);
        await this.logger.logWarning(`Unsupported output format: ${format}. Using JSON.`, {
          requestedFormat: format,
          usedFormat: 'json'
        });
      }

      // Generate JSON output
      const jsonOutput = this.jsonGenerator.generateGraph(dependencyGraph);
      
      console.log(`✅ JSON output generated:`);
      console.log(`   📊 Total nodes: ${jsonOutput.statistics.totalNodes}`);
      console.log(`   🔗 Total edges: ${jsonOutput.statistics.totalEdges}`);
      console.log(`   💀 Dead code: ${jsonOutput.statistics.deadCodeNodes} (${jsonOutput.statistics.deadCodePercentage}%)`);
      console.log(`   ✅ Live code: ${jsonOutput.statistics.liveCodeNodes}`);

      // Validate output
      const validation = this.jsonGenerator.validateOutput(jsonOutput);
      if (!validation.isValid) {
        console.error(`❌ Output validation failed:`);
        validation.errors.forEach(error => {
          console.error(`   - ${error.message}`);
        });
        throw new Error('Output validation failed');
      }

      if (validation.warnings.length > 0) {
        console.warn(`⚠️  Output validation warnings:`);
        validation.warnings.forEach(warning => {
          console.warn(`   - ${warning.message}`);
        });
      }

      // Export to file
      await this.jsonGenerator.exportToFile(jsonOutput, outputPath);

      // Generate dead code report if dead code exists
      const deadCodeItems = dependencyGraph.nodes
        .filter(node => node.liveCodeScore === 0)
        .map(node => ({
          id: node.id,
          name: node.label,
          type: this.mapNodeTypeToDeadCodeType(node.nodeType),
          file: node.file,
          line: node.line,
          column: node.column,
          reason: 'no_incoming_edges' as const,
          confidence: 95,
          suggestions: [`Remove unused ${node.nodeType}: ${node.label}`],
          impact: this.calculateImpact(node)
        }));

      if (deadCodeItems.length > 0) {
        // Generate dead code report path based on repository URL
        // This ensures consistent naming convention for both main output and dead code report
        const deadCodeReportPath = generateDeadCodeReportPath(repositoryUrl);
        const deadCodeReport = this.jsonGenerator.generateDeadCodeReport(deadCodeItems, repositoryUrl);
        await this.jsonGenerator.exportToFile(deadCodeReport, deadCodeReportPath);
        
        console.log(`\n📄 Dead code report generated:`);
        console.log(`   💀 Total dead code items: ${deadCodeReport.summary.totalDeadCodeItems}`);
        console.log(`   🔴 High impact: ${deadCodeReport.summary.impactDistribution.high}`);
        console.log(`   🟡 Medium impact: ${deadCodeReport.summary.impactDistribution.medium}`);
        console.log(`   🟢 Low impact: ${deadCodeReport.summary.impactDistribution.low}`);
        console.log(`   📁 Report saved to: ${deadCodeReportPath}`);
      }

      // Log output generation completion
      await this.logger.logInfo('Output generation completed', {
        outputPath,
        format,
        nodeCount: jsonOutput.statistics.totalNodes,
        edgeCount: jsonOutput.statistics.totalEdges,
        deadCodeCount: jsonOutput.statistics.deadCodeNodes
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Output generation failed: ${errorMessage}`);
      await this.logger.logError('Output generation failed', {
        error: errorMessage,
        outputPath,
        format
      });
      throw error;
    }
  }

  /**
   * Maps node type to dead code type
   * Helper method for dead code report generation
   * 
   * @param nodeType - Node type from graph
   * @returns Dead code type
   */
  private mapNodeTypeToDeadCodeType(nodeType: string): 'component' | 'function' | 'variable' | 'api' | 'database' {
    const lowerType = nodeType.toLowerCase();
    if (lowerType === 'api' || lowerType === 'route') return 'api';
    if (lowerType === 'table' || lowerType === 'view') return 'database';
    if (lowerType === 'function') return 'function';
    return 'component'; // Default to component
  }

  /**
   * Calculates impact level for dead code
   * Helper method for dead code report generation
   * 
   * @param node - Node information
   * @returns Impact level
   */
  private calculateImpact(node: { nodeType: string; nodeCategory: string }): 'low' | 'medium' | 'high' {
    // Database entities have high impact
    if (node.nodeType === 'table' || node.nodeType === 'view') return 'high';
    
    // APIs have high impact
    if (node.nodeType === 'API' || node.nodeType === 'route') return 'high';
    
    // Middleware has medium impact
    if (node.nodeCategory === 'middleware') return 'medium';
    
    // Frontend has low impact
    return 'low';
  }

  /**
   * Cleans up resources
   * Ensures temporary files are properly cleaned up
   */
  private async cleanup(): Promise<void> {
    try {
      await this.repositoryManager.cleanup();
    } catch (error) {
      console.warn('⚠️  Warning: Failed to clean up temporary files:', error);
    }
  }

  /**
   * Runs the CLI
   * Parses command-line arguments and executes appropriate commands
   */
  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error('❌ CLI execution failed:', error);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
// Check if this file is being executed directly (not imported)
// This ensures the CLI only runs when the file is executed directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule) {
  const cli = new Code2GraphCLI();
  cli.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { Code2GraphCLI };
