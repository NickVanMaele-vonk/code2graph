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
import { ProgressInfo, CLIAnalysisOptions, FileScanProgress, FileInfo } from './types/index.js';

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
  private program: Command;

  constructor() {
    this.repositoryManager = new RepositoryManager();
    this.logger = new AnalysisLogger(''); // Will be initialized with actual repo URL
    this.memoryMonitor = new MemoryMonitor();
    this.configManager = new ConfigurationManager();
    this.astParser = new ASTParserImpl(); // Will be initialized with logger later
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
      .option('-o, --output <path>', 'Output file path', './graph-output.json')
      .option('-f, --format <format>', 'Output format (json|graphml|dot)', 'json')
      .option('-b, --branch <branch>', 'Git branch to analyze')
      .option('--depth <depth>', 'Git clone depth', '1')
      .option('--timeout <ms>', 'Clone timeout in milliseconds', '300000')
      .action(async (repoUrl: string, options: CLIAnalysisOptions) => {
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

      // Initialize repository manager and AST parser with dependencies
      this.repositoryManager.initialize(this.logger, this.memoryMonitor);
      this.astParser = new ASTParserImpl(this.logger);

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
      await this.performASTAnalysis(scanResult.files);
      
      // TODO: Implement dependency analysis (Phase 2.4)
      console.log('\n⚠️  Dependency analysis not yet implemented (Phase 2.4)');
      
      // TODO: Implement output generation (Phase 2.5)
      console.log('⚠️  Output generation not yet implemented (Phase 2.5)');

      console.log('\n🎉 Analysis completed successfully!');
      console.log(`📄 Results will be saved to: ${options.output}`);
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
  -o, --output <path>    Output file path (default: ./graph-output.json)
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
   */
  private async performASTAnalysis(files: FileInfo[]): Promise<void> {
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

        totalImports += imports.length;
        totalExports += exports.length;
        totalJSXElements += jsxElements.length;
        totalInformativeElements += informativeElements.length;

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
    console.log(`   📥 Total imports: ${totalImports}`);
    console.log(`   📤 Total exports: ${totalExports}`);
    console.log(`   🎨 Total JSX elements: ${totalJSXElements}`);
    console.log(`   💡 Total informative elements: ${totalInformativeElements}`);
    console.log(`   ❌ Parse errors: ${parseErrors}`);

    await this.logger.logInfo('AST analysis summary', {
      filesAnalyzed: typescriptFiles.length,
      totalImports,
      totalExports,
      totalJSXElements,
      totalInformativeElements,
      parseErrors
    });
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
