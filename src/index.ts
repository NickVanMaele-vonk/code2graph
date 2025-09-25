/**
 * Code2Graph CLI Entry Point
 * Main entry point for the code2graph command-line tool
 */

import { Command } from 'commander';
import { RepositoryManager } from './analyzers/repository-manager.js';
import { AnalysisLogger } from './analyzers/analysis-logger.js';
import { MemoryMonitor } from './analyzers/memory-monitor.js';
import { ConfigurationManager } from './analyzers/configuration-manager.js';
import { ProgressInfo, CLIAnalysisOptions, FileScanProgress } from './types/index.js';

/**
 * Main CLI class
 * Handles command-line interface and coordinates analysis workflow
 */
class Code2GraphCLI {
  private repositoryManager: RepositoryManager;
  private logger: AnalysisLogger;
  private memoryMonitor: MemoryMonitor;
  private configManager: ConfigurationManager;
  private program: Command;

  constructor() {
    this.repositoryManager = new RepositoryManager();
    this.logger = new AnalysisLogger(''); // Will be initialized with actual repo URL
    this.memoryMonitor = new MemoryMonitor();
    this.configManager = new ConfigurationManager();
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

      // Initialize repository manager with dependencies
      this.repositoryManager.initialize(this.logger, this.memoryMonitor);

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

      // TODO: Implement dependency analysis (Phase 2.3)
      console.log('\n⚠️  Dependency analysis not yet implemented (Phase 2.3)');
      
      // TODO: Implement output generation (Phase 2.4)
      console.log('⚠️  Output generation not yet implemented (Phase 2.4)');

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
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new Code2GraphCLI();
  cli.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { Code2GraphCLI };
