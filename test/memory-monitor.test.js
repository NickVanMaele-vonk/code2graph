/**
 * Unit tests for MemoryMonitor
 * Tests the memory monitoring functionality for code2graph analysis operations
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MemoryMonitor } from '../dist/analyzers/memory-monitor.js';

describe('MemoryMonitor', () => {
  let memoryMonitor;

  beforeEach(() => {
    memoryMonitor = new MemoryMonitor();
  });

  describe('Memory Usage Tracking', () => {
    test('should get current memory usage', () => {
      const usage = memoryMonitor.getCurrentUsage();
      assert(typeof usage === 'number');
      assert(usage >= 0);
    });

    test('should get memory usage percentage', () => {
      const percentage = memoryMonitor.getUsagePercentage();
      assert(typeof percentage === 'number');
      assert(percentage >= 0);
      assert(percentage <= 1);
    });

    test('should get comprehensive memory information', () => {
      const memInfo = memoryMonitor.getMemoryInfo();
      
      assert(typeof memInfo.used === 'number');
      assert(typeof memInfo.total === 'number');
      assert(typeof memInfo.percentage === 'number');
      assert(typeof memInfo.warningThreshold === 'number');
      assert(typeof memInfo.errorThreshold === 'number');
      
      assert(memInfo.used >= 0);
      assert(memInfo.total >= 0);
      assert(memInfo.percentage >= 0);
      assert(memInfo.percentage <= 1);
      assert(memInfo.warningThreshold >= 0);
      assert(memInfo.warningThreshold <= 1);
      assert(memInfo.errorThreshold >= 0);
      assert(memInfo.errorThreshold <= 1);
    });
  });

  describe('Threshold Checking', () => {
    test('should check memory warning threshold', () => {
      const hasWarning = memoryMonitor.checkMemoryWarning();
      assert(typeof hasWarning === 'boolean');
    });

    test('should check memory error threshold', () => {
      const hasError = memoryMonitor.checkMemoryError();
      assert(typeof hasError === 'boolean');
    });

    test('should use custom thresholds', () => {
      const customMonitor = new MemoryMonitor(0.5, 0.8);
      const memInfo = customMonitor.getMemoryInfo();
      
      assert(memInfo.warningThreshold === 0.5);
      assert(memInfo.errorThreshold === 0.8);
    });
  });

  describe('Memory Information Formatting', () => {
    test('should format memory usage string', () => {
      const formatted = memoryMonitor.getFormattedMemoryUsage();
      assert(typeof formatted === 'string');
      assert(formatted.includes('MB'));
      assert(formatted.includes('/'));
      assert(formatted.includes('%'));
    });

    test('should get detailed memory usage', () => {
      const detailed = memoryMonitor.getDetailedMemoryUsage();
      
      assert(typeof detailed.heapUsed === 'number');
      assert(typeof detailed.heapTotal === 'number');
      assert(typeof detailed.external === 'number');
      assert(typeof detailed.rss === 'number');
      assert(typeof detailed.arrayBuffers === 'number');
      
      assert(detailed.heapUsed >= 0);
      assert(detailed.heapTotal >= 0);
      assert(detailed.external >= 0);
      assert(detailed.rss >= 0);
      assert(detailed.arrayBuffers >= 0);
    });
  });

  describe('Memory Management', () => {
    test('should check sufficient memory', () => {
      const hasSufficient = memoryMonitor.hasSufficientMemory(1024 * 1024); // 1MB
      assert(typeof hasSufficient === 'boolean');
    });

    test('should force garbage collection if available', () => {
      // This test just ensures the method doesn't throw an error
      assert.doesNotThrow(() => {
        memoryMonitor.forceGarbageCollection();
      });
    });

    test('should get memory trend information', () => {
      const trend = memoryMonitor.getMemoryTrend();
      
      assert(typeof trend === 'object');
      assert(typeof trend.current === 'object');
      assert(typeof trend.trend === 'string');
      assert(typeof trend.recommendation === 'string');
      
      assert(trend.trend === 'stable'); // Default value
      assert(trend.recommendation.length > 0);
    });
  });

  describe('Memory Recommendations', () => {
    test('should provide memory recommendations', () => {
      const trend = memoryMonitor.getMemoryTrend();
      const recommendation = trend.recommendation;
      
      assert(typeof recommendation === 'string');
      assert(recommendation.length > 0);
      
      // Should contain one of the expected recommendation types
      const expectedTypes = ['CRITICAL', 'WARNING', 'INFO'];
      const hasExpectedType = expectedTypes.some(type => recommendation.includes(type));
      assert(hasExpectedType);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero total memory gracefully', () => {
      // Mock process.memoryUsage to return zero total memory
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        rss: 0,
        heapTotal: 0,  // This is what getUsagePercentage() uses for totalMemory
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      });
      
      const percentage = memoryMonitor.getUsagePercentage();
      assert(percentage === 0);
      
      // Restore original method
      process.memoryUsage = originalMemoryUsage;
    });

    test('should handle negative memory values', () => {
      const memInfo = memoryMonitor.getMemoryInfo();
      
      // Memory values should never be negative in real scenarios
      assert(memInfo.used >= 0);
      assert(memInfo.total >= 0);
      assert(memInfo.percentage >= 0);
    });
  });
});
