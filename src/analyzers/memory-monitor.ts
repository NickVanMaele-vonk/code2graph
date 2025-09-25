/**
 * Memory Monitor
 * Monitors memory usage during analysis and provides warnings/errors at thresholds
 * Following Phase 2.2 requirements from the project plan
 */

import { MemoryMonitor as IMemoryMonitor, MemoryInfo } from '../types/index.js';

/**
 * Memory Monitor class
 * Implements memory usage monitoring with configurable warning and error thresholds
 * Provides memory information and threshold checking for analysis operations
 */
export class MemoryMonitor implements IMemoryMonitor {
  private readonly warningThreshold: number;
  private readonly errorThreshold: number;

  /**
   * Constructor initializes memory monitoring with configurable thresholds
   * 
   * @param warningThreshold - Memory usage percentage for warnings (default: 0.8 = 80%)
   * @param errorThreshold - Memory usage percentage for errors (default: 1.0 = 100%)
   */
  constructor(warningThreshold: number = 0.8, errorThreshold: number = 1.0) {
    this.warningThreshold = warningThreshold;
    this.errorThreshold = errorThreshold;
  }

  /**
   * Gets current memory usage in bytes
   * 
   * @returns number - Current memory usage in bytes
   */
  getCurrentUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed;
  }

  /**
   * Gets memory usage as a percentage of total available memory
   * 
   * @returns number - Memory usage percentage (0.0 to 1.0)
   */
  getUsagePercentage(): number {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    
    if (totalMemory === 0) {
      return 0;
    }
    
    return memUsage.heapUsed / totalMemory;
  }

  /**
   * Checks if memory usage has reached warning threshold
   * 
   * @returns boolean - True if memory usage is at or above warning threshold
   */
  checkMemoryWarning(): boolean {
    return this.getUsagePercentage() >= this.warningThreshold;
  }

  /**
   * Checks if memory usage has reached error threshold
   * 
   * @returns boolean - True if memory usage is at or above error threshold
   */
  checkMemoryError(): boolean {
    return this.getUsagePercentage() >= this.errorThreshold;
  }

  /**
   * Gets comprehensive memory information
   * 
   * @returns MemoryInfo - Complete memory usage information
   */
  getMemoryInfo(): MemoryInfo {
    const memUsage = process.memoryUsage();
    const percentage = this.getUsagePercentage();
    
    return {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: percentage,
      warningThreshold: this.warningThreshold,
      errorThreshold: this.errorThreshold
    };
  }

  /**
   * Gets formatted memory usage string for logging
   * 
   * @returns string - Formatted memory usage information
   */
  getFormattedMemoryUsage(): string {
    const memInfo = this.getMemoryInfo();
    const usedMB = Math.round(memInfo.used / 1024 / 1024);
    const totalMB = Math.round(memInfo.total / 1024 / 1024);
    const percentage = Math.round(memInfo.percentage * 100);
    
    return `${usedMB}MB / ${totalMB}MB (${percentage}%)`;
  }

  /**
   * Forces garbage collection if available
   * Attempts to free up memory by triggering garbage collection
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Gets memory usage statistics for different memory types
   * 
   * @returns Record<string, number> - Memory usage by type in bytes
   */
  getDetailedMemoryUsage(): Record<string, number> {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers
    };
  }

  /**
   * Checks if system has sufficient memory for analysis
   * 
   * @param requiredMemory - Required memory in bytes
   * @returns boolean - True if sufficient memory is available
   */
  hasSufficientMemory(requiredMemory: number): boolean {
    const memInfo = this.getMemoryInfo();
    const availableMemory = memInfo.total - memInfo.used;
    
    return availableMemory >= requiredMemory;
  }

  /**
   * Gets memory usage trend over time
   * This would require storing historical data - placeholder for future implementation
   * 
   * @returns Record<string, unknown> - Memory usage trend information
   */
  getMemoryTrend(): Record<string, unknown> {
    // Placeholder for future memory trend analysis
    return {
      current: this.getMemoryInfo(),
      trend: 'stable', // Would be calculated from historical data
      recommendation: this.getMemoryRecommendation()
    };
  }

  /**
   * Gets memory usage recommendations based on current usage
   * 
   * @returns string - Memory usage recommendation
   */
  private getMemoryRecommendation(): string {
    const percentage = this.getUsagePercentage();
    
    if (percentage >= this.errorThreshold) {
      return 'CRITICAL: Memory usage at maximum. Consider reducing analysis scope or increasing available memory.';
    } else if (percentage >= this.warningThreshold) {
      return 'WARNING: High memory usage. Monitor closely and consider reducing analysis scope.';
    } else if (percentage >= 0.6) {
      return 'INFO: Moderate memory usage. Analysis should continue normally.';
    } else {
      return 'INFO: Low memory usage. Analysis has plenty of memory available.';
    }
  }
}
