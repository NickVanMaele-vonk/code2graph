/**
 * Usage Tracker Tests
 * Tests for the usage tracking functionality (Phase 4.1)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { UsageTrackerImpl } from '../dist/analyzers/usage-tracker.js';
import { AnalysisLogger } from '../dist/analyzers/analysis-logger.js';
import fs from 'fs-extra';

describe('Usage Tracker', () => {
  let usageTracker;
  let logger;
  let tempDir;

  beforeEach(() => {
    // Create temporary directory for test logs
    tempDir = fs.mkdtempSync('usage-tracker-test-');
    logger = new AnalysisLogger('testrepo');
    usageTracker = new UsageTrackerImpl(logger);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.removeSync(tempDir);
    }
  });

  describe('Component Usage Tracking', () => {
    it('should track component usage correctly', () => {
      const components = [
        {
          name: 'Button',
          type: 'functional',
          file: 'src/components/Button.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [
            {
              source: 'react',
              specifiers: [{ name: 'React', type: 'default' }],
              defaultImport: 'React',
              line: 1
            }
          ],
          exports: [
            {
              name: 'Button',
              type: 'default',
              line: 15
            }
          ]
        },
        {
          name: 'App',
          type: 'functional',
          file: 'src/App.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [
            {
              source: './components/Button',
              specifiers: [{ name: 'Button', type: 'named' }],
              line: 2
            }
          ],
          exports: []
        }
      ];

      const usageInfos = usageTracker.trackComponentUsage(components);

      assert.strictEqual(usageInfos.length, 2);
      
      // Button component should be used (imported by App)
      const buttonUsage = usageInfos.find(u => u.name === 'Button');
      assert.ok(buttonUsage);
      assert.strictEqual(buttonUsage.isUsed, true);
      assert.strictEqual(buttonUsage.liveCodeScore, 100);
      assert.ok(buttonUsage.usageLocations.length > 0);

      // App component should be used (has imports/exports)
      const appUsage = usageInfos.find(u => u.name === 'App');
      assert.ok(appUsage);
      assert.strictEqual(appUsage.isUsed, true);
      assert.strictEqual(appUsage.liveCodeScore, 100);
    });

    it('should detect unused components correctly', () => {
      const components = [
        {
          name: 'UnusedComponent',
          type: 'functional',
          file: 'src/components/UnusedComponent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: []
        }
      ];

      const usageInfos = usageTracker.trackComponentUsage(components);

      assert.strictEqual(usageInfos.length, 1);
      
      const unusedUsage = usageInfos[0];
      assert.strictEqual(unusedUsage.name, 'UnusedComponent');
      assert.strictEqual(unusedUsage.isUsed, false);
      assert.strictEqual(unusedUsage.liveCodeScore, 0);
      assert.strictEqual(unusedUsage.usageCount, 0);
    });

    it('should track component usage locations correctly', () => {
      const components = [
        {
          name: 'SharedComponent',
          type: 'functional',
          file: 'src/components/SharedComponent.tsx',
          props: [],
          state: [],
          hooks: [],
          children: [],
          informativeElements: [],
          imports: [],
          exports: [
            {
              name: 'SharedComponent',
              type: 'default',
              line: 10
            }
          ]
        }
      ];

      const usageInfos = usageTracker.trackComponentUsage(components);

      assert.strictEqual(usageInfos.length, 1);
      
      const sharedUsage = usageInfos[0];
      assert.strictEqual(sharedUsage.isUsed, true);
      assert.ok(sharedUsage.usageLocations.some(loc => loc.usageType === 'reference'));
      assert.ok(sharedUsage.usageLocations.some(loc => loc.context === 'Exported as default'));
    });
  });

  describe('Function Usage Tracking', () => {
    it('should track function usage correctly', () => {
      const functions = [
        {
          name: 'utilityFunction',
          type: 'function',
          file: 'src/utils/helpers.ts',
          line: 5,
          column: 10,
          parameters: ['param1', 'param2'],
          returnType: 'string',
          isExported: true,
          isImported: false,
          calls: [],
          calledBy: []
        },
        {
          name: 'callerFunction',
          type: 'function',
          file: 'src/utils/caller.ts',
          line: 10,
          column: 15,
          parameters: [],
          returnType: 'void',
          isExported: false,
          isImported: false,
          calls: ['utilityFunction'],
          calledBy: []
        }
      ];

      const usageInfos = usageTracker.trackFunctionUsage(functions);

      assert.strictEqual(usageInfos.length, 2);
      
      // utilityFunction should be used (called by callerFunction)
      const utilityUsage = usageInfos.find(u => u.name === 'utilityFunction');
      assert.ok(utilityUsage);
      assert.strictEqual(utilityUsage.isUsed, true);
      assert.strictEqual(utilityUsage.liveCodeScore, 100);
      assert.ok(utilityUsage.usageLocations.some(loc => loc.usageType === 'call'));

      // callerFunction should be used (has calls)
      const callerUsage = usageInfos.find(u => u.name === 'callerFunction');
      assert.ok(callerUsage);
      assert.strictEqual(callerUsage.isUsed, true);
      assert.strictEqual(callerUsage.liveCodeScore, 100);
    });

    it('should detect unused functions correctly', () => {
      const functions = [
        {
          name: 'unusedFunction',
          type: 'function',
          file: 'src/utils/unused.ts',
          line: 5,
          column: 10,
          parameters: [],
          returnType: 'void',
          isExported: false,
          isImported: false,
          calls: [],
          calledBy: []
        }
      ];

      const usageInfos = usageTracker.trackFunctionUsage(functions);

      assert.strictEqual(usageInfos.length, 1);
      
      const unusedUsage = usageInfos[0];
      assert.strictEqual(unusedUsage.name, 'unusedFunction');
      assert.strictEqual(unusedUsage.isUsed, false);
      assert.strictEqual(unusedUsage.liveCodeScore, 0);
    });
  });

  describe('Variable Usage Tracking', () => {
    it('should track variable usage correctly', () => {
      const variables = [
        {
          name: 'CONSTANT_VALUE',
          type: 'const',
          file: 'src/constants.ts',
          line: 3,
          column: 5,
          value: 'test',
          isExported: true,
          isImported: false,
          isUsed: true,
          usedIn: ['helper.ts']
        },
        {
          name: 'localVariable',
          type: 'let',
          file: 'src/helper.ts',
          line: 8,
          column: 12,
          value: undefined,
          isExported: false,
          isImported: false,
          isUsed: true,
          usedIn: []
        }
      ];

      const usageInfos = usageTracker.trackVariableUsage(variables);

      assert.strictEqual(usageInfos.length, 2);
      
      // CONSTANT_VALUE should be used (exported)
      const constantUsage = usageInfos.find(u => u.name === 'CONSTANT_VALUE');
      assert.ok(constantUsage);
      assert.strictEqual(constantUsage.isUsed, true);
      assert.strictEqual(constantUsage.liveCodeScore, 100);

      // localVariable should be used (isUsed = true)
      const localUsage = usageInfos.find(u => u.name === 'localVariable');
      assert.ok(localUsage);
      assert.strictEqual(localUsage.isUsed, true);
      assert.strictEqual(localUsage.liveCodeScore, 100);
    });

    it('should detect unused variables correctly', () => {
      const variables = [
        {
          name: 'unusedVariable',
          type: 'const',
          file: 'src/unused.ts',
          line: 5,
          column: 10,
          value: 'unused',
          isExported: false,
          isImported: false,
          isUsed: false,
          usedIn: []
        }
      ];

      const usageInfos = usageTracker.trackVariableUsage(variables);

      assert.strictEqual(usageInfos.length, 1);
      
      const unusedUsage = usageInfos[0];
      assert.strictEqual(unusedUsage.name, 'unusedVariable');
      assert.strictEqual(unusedUsage.isUsed, false);
      assert.strictEqual(unusedUsage.liveCodeScore, 0);
    });
  });

  describe('Usage Statistics Calculation', () => {
    it('should calculate usage statistics correctly', () => {
      const usageInfos = [
        {
          id: '1',
          name: 'Component1',
          type: 'component',
          file: 'src/Component1.tsx',
          definitionLocation: { file: 'src/Component1.tsx' },
          usageLocations: [],
          isUsed: true,
          usageCount: 1,
          liveCodeScore: 100
        },
        {
          id: '2',
          name: 'Component2',
          type: 'component',
          file: 'src/Component2.tsx',
          definitionLocation: { file: 'src/Component2.tsx' },
          usageLocations: [],
          isUsed: false,
          usageCount: 0,
          liveCodeScore: 0
        },
        {
          id: '3',
          name: 'Function1',
          type: 'function',
          file: 'src/Function1.ts',
          definitionLocation: { file: 'src/Function1.ts' },
          usageLocations: [],
          isUsed: true,
          usageCount: 2,
          liveCodeScore: 100
        },
        {
          id: '4',
          name: 'Variable1',
          type: 'variable',
          file: 'src/Variable1.ts',
          definitionLocation: { file: 'src/Variable1.ts' },
          usageLocations: [],
          isUsed: false,
          usageCount: 0,
          liveCodeScore: 0
        }
      ];

      const statistics = usageTracker.calculateUsageStatistics(usageInfos);

      assert.strictEqual(statistics.totalComponents, 2);
      assert.strictEqual(statistics.usedComponents, 1);
      assert.strictEqual(statistics.unusedComponents, 1);
      assert.strictEqual(statistics.totalFunctions, 1);
      assert.strictEqual(statistics.usedFunctions, 1);
      assert.strictEqual(statistics.unusedFunctions, 0);
      assert.strictEqual(statistics.totalVariables, 1);
      assert.strictEqual(statistics.usedVariables, 0);
      assert.strictEqual(statistics.unusedVariables, 1);
      assert.strictEqual(statistics.deadCodePercentage, 50);
      assert.strictEqual(statistics.liveCodePercentage, 50);
    });
  });

  describe('Live Code Score Calculation', () => {
    it('should calculate live code scores correctly', () => {
      const usageInfos = [
        {
          id: '1',
          name: 'UsedComponent',
          type: 'component',
          file: 'src/UsedComponent.tsx',
          definitionLocation: { file: 'src/UsedComponent.tsx' },
          usageLocations: [{ file: 'src/App.tsx', usageType: 'import' }],
          isUsed: true,
          usageCount: 1,
          liveCodeScore: 100
        },
        {
          id: '2',
          name: 'UnusedComponent',
          type: 'component',
          file: 'src/UnusedComponent.tsx',
          definitionLocation: { file: 'src/UnusedComponent.tsx' },
          usageLocations: [],
          isUsed: false,
          usageCount: 0,
          liveCodeScore: 0
        },
        {
          id: '3',
          name: 'PartiallyUsedFunction',
          type: 'function',
          file: 'src/PartiallyUsedFunction.ts',
          definitionLocation: { file: 'src/PartiallyUsedFunction.ts' },
          usageLocations: [{ file: 'src/helper.ts', usageType: 'call' }],
          isUsed: true,
          usageCount: 1,
          liveCodeScore: 100
        }
      ];

      const liveCodeScores = usageTracker.calculateLiveCodeScores(usageInfos);

      assert.strictEqual(liveCodeScores.get('1'), 100); // Used component
      assert.strictEqual(liveCodeScores.get('2'), 0);   // Unused component
      assert.strictEqual(liveCodeScores.get('3'), 100); // Partially used function
    });
  });

  describe('Dead Code Detection', () => {
    it('should detect dead code correctly', () => {
      const usageInfos = [
        {
          id: '1',
          name: 'LiveComponent',
          type: 'component',
          file: 'src/LiveComponent.tsx',
          definitionLocation: { file: 'src/LiveComponent.tsx' },
          usageLocations: [{ file: 'src/App.tsx', usageType: 'import' }],
          isUsed: true,
          usageCount: 1,
          liveCodeScore: 100
        },
        {
          id: '2',
          name: 'DeadComponent',
          type: 'component',
          file: 'src/DeadComponent.tsx',
          definitionLocation: { file: 'src/DeadComponent.tsx' },
          usageLocations: [],
          isUsed: false,
          usageCount: 0,
          liveCodeScore: 0
        },
        {
          id: '3',
          name: 'DeadFunction',
          type: 'function',
          file: 'src/DeadFunction.ts',
          definitionLocation: { file: 'src/DeadFunction.ts' },
          usageLocations: [],
          isUsed: false,
          usageCount: 0,
          liveCodeScore: 0
        }
      ];

      const deadCode = usageTracker.detectDeadCode(usageInfos);

      assert.strictEqual(deadCode.length, 2);
      
      const deadComponent = deadCode.find(d => d.name === 'DeadComponent');
      assert.ok(deadComponent);
      assert.strictEqual(deadComponent.reason, 'no_incoming_edges');
      assert.strictEqual(deadComponent.impact, 'high');
      assert.ok(deadComponent.suggestions.length > 0);

      const deadFunction = deadCode.find(d => d.name === 'DeadFunction');
      assert.ok(deadFunction);
      assert.strictEqual(deadFunction.reason, 'unused');
      assert.strictEqual(deadFunction.impact, 'high');
    });
  });

  describe('Performance Warnings', () => {
    it('should generate performance warnings for large codebases', () => {
      const statistics = {
        totalComponents: 50000,
        usedComponents: 45000,
        unusedComponents: 5000,
        totalFunctions: 30000,
        usedFunctions: 28000,
        unusedFunctions: 2000,
        totalVariables: 20000,
        usedVariables: 18000,
        unusedVariables: 2000,
        totalAPIs: 1000,
        usedAPIs: 900,
        unusedAPIs: 100,
        totalDatabaseEntities: 500,
        usedDatabaseEntities: 450,
        unusedDatabaseEntities: 50,
        deadCodePercentage: 10,
        liveCodePercentage: 90
      };

      const warnings = usageTracker.generatePerformanceWarnings(statistics);

      assert.ok(warnings.length > 0);
      
      const largeCodebaseWarning = warnings.find(w => w.type === 'large_codebase');
      assert.ok(largeCodebaseWarning);
      assert.strictEqual(largeCodebaseWarning.severity, 'warning');
      assert.ok(largeCodebaseWarning.message.includes('Large codebase detected'));
      assert.ok(largeCodebaseWarning.recommendation);
    });

    it('should generate warnings for high dead code percentage', () => {
      const statistics = {
        totalComponents: 100,
        usedComponents: 60,
        unusedComponents: 40,
        totalFunctions: 50,
        usedFunctions: 30,
        unusedFunctions: 20,
        totalVariables: 30,
        usedVariables: 15,
        unusedVariables: 15,
        totalAPIs: 10,
        usedAPIs: 5,
        unusedAPIs: 5,
        totalDatabaseEntities: 5,
        usedDatabaseEntities: 2,
        unusedDatabaseEntities: 3,
        deadCodePercentage: 45,
        liveCodePercentage: 55
      };

      const warnings = usageTracker.generatePerformanceWarnings(statistics);

      assert.ok(warnings.length > 0);
      
      const deadCodeWarning = warnings.find(w => w.message.includes('High dead code percentage'));
      assert.ok(deadCodeWarning);
      assert.strictEqual(deadCodeWarning.severity, 'warning');
      assert.ok(deadCodeWarning.message.includes('45%'));
    });

    it('should not generate warnings for normal-sized codebases', () => {
      const statistics = {
        totalComponents: 100,
        usedComponents: 95,
        unusedComponents: 5,
        totalFunctions: 50,
        usedFunctions: 48,
        unusedFunctions: 2,
        totalVariables: 30,
        usedVariables: 28,
        unusedVariables: 2,
        totalAPIs: 10,
        usedAPIs: 9,
        unusedAPIs: 1,
        totalDatabaseEntities: 5,
        usedDatabaseEntities: 4,
        unusedDatabaseEntities: 1,
        deadCodePercentage: 10,
        liveCodePercentage: 90
      };

      const warnings = usageTracker.generatePerformanceWarnings(statistics);

      // Should have no warnings for normal-sized codebase
      assert.strictEqual(warnings.length, 0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty component arrays gracefully', () => {
      const usageInfos = usageTracker.trackComponentUsage([]);
      assert.strictEqual(usageInfos.length, 0);
    });

    it('should handle malformed component data gracefully', () => {
      const malformedComponents = [
        {
          name: 'MalformedComponent',
          // Missing required fields
          file: 'src/MalformedComponent.tsx'
        }
      ];

      // Should not throw an error
      assert.doesNotThrow(() => {
        usageTracker.trackComponentUsage(malformedComponents);
      });
    });

    it('should handle statistics calculation with empty usage info', () => {
      const statistics = usageTracker.calculateUsageStatistics([]);
      
      assert.strictEqual(statistics.totalComponents, 0);
      assert.strictEqual(statistics.usedComponents, 0);
      assert.strictEqual(statistics.unusedComponents, 0);
      assert.strictEqual(statistics.deadCodePercentage, 0);
      assert.strictEqual(statistics.liveCodePercentage, 100);
    });
  });
});
