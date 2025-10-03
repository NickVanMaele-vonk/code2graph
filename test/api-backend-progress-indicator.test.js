/**
 * Tests for API & Backend Progress Indicator
 * Tests progress tracking functionality for API and backend analysis
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { APIBackendProgressIndicatorImpl } from '../dist/analyzers/api-backend-progress-indicator.js';

describe('API & Backend Progress Indicator', () => {
  let progressIndicator;

  beforeEach(() => {
    progressIndicator = new APIBackendProgressIndicatorImpl();
  });

  afterEach(() => {
    progressIndicator = null;
  });

  describe('initialization', () => {
    test('should initialize with all steps in pending status', () => {
      const steps = progressIndicator.getAllSteps();

      assert.strictEqual(steps.length, 8);
      assert.ok(steps.every(step => step.status === 'pending'));
      assert.ok(steps.every(step => step.progress === 0));

      // Check specific steps
      const stepIds = steps.map(step => step.id);
      assert.ok(stepIds.includes('api_endpoint_analysis'));
      assert.ok(stepIds.includes('database_operations_analysis'));
      assert.ok(stepIds.includes('frontend_backend_mapping'));
      assert.ok(stepIds.includes('used_unused_identification'));
      assert.ok(stepIds.includes('dead_code_detection'));
      assert.ok(stepIds.includes('connection_quality_analysis'));
      assert.ok(stepIds.includes('graph_node_creation'));
      assert.ok(stepIds.includes('edge_creation'));
    });

    test('should have correct step names and descriptions', () => {
      const steps = progressIndicator.getAllSteps();

      const apiEndpointStep = steps.find(step => step.id === 'api_endpoint_analysis');
      assert.ok(apiEndpointStep);
      assert.strictEqual(apiEndpointStep.name, 'API Endpoint Analysis');
      assert.strictEqual(apiEndpointStep.description, 'Analyzing backend files for API endpoints and routes');

      const databaseStep = steps.find(step => step.id === 'database_operations_analysis');
      assert.ok(databaseStep);
      assert.strictEqual(databaseStep.name, 'Database Operations Analysis');
      assert.strictEqual(databaseStep.description, 'Analyzing database operations, tables, and views');
    });
  });

  describe('step management', () => {
    test('should start a step correctly', () => {
      progressIndicator.startStep('api_endpoint_analysis');

      const step = progressIndicator.getStep('api_endpoint_analysis');
      assert.ok(step);
      assert.strictEqual(step.status, 'running');
      assert.strictEqual(step.progress, 0);
      assert.ok(step.startTime);
    });

    test('should update step progress correctly', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.updateStepProgress('api_endpoint_analysis', 50, 'Processing files...');

      const step = progressIndicator.getStep('api_endpoint_analysis');
      assert.ok(step);
      assert.strictEqual(step.status, 'running');
      assert.strictEqual(step.progress, 50);
    });

    test('should complete a step successfully', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.updateStepProgress('api_endpoint_analysis', 100);
      progressIndicator.completeStep('api_endpoint_analysis', true);

      const step = progressIndicator.getStep('api_endpoint_analysis');
      assert.ok(step);
      assert.strictEqual(step.status, 'completed');
      assert.strictEqual(step.progress, 100);
      assert.ok(step.endTime);
      assert.ok(step.duration);
    });

    test('should complete a step with error', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', false, 'File parsing failed');

      const step = progressIndicator.getStep('api_endpoint_analysis');
      assert.ok(step);
      assert.strictEqual(step.status, 'error');
      assert.strictEqual(step.error, 'File parsing failed');
      assert.ok(step.endTime);
      assert.ok(step.duration);
    });

    test('should handle non-existent step gracefully', () => {
      // Should not throw an error
      progressIndicator.startStep('non_existent_step');
      progressIndicator.updateStepProgress('non_existent_step', 50);
      progressIndicator.completeStep('non_existent_step', true);

      const step = progressIndicator.getStep('non_existent_step');
      assert.strictEqual(step, undefined);
    });
  });

  describe('progress reporting', () => {
    test('should calculate overall progress correctly', () => {
      // Start and complete first step
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', true);

      // Start second step and update progress
      progressIndicator.startStep('database_operations_analysis');
      progressIndicator.updateStepProgress('database_operations_analysis', 50);

      const report = progressIndicator.getProgressReport();

      assert.strictEqual(report.completedSteps, 1);
      assert.strictEqual(report.totalSteps, 8);
      assert.strictEqual(report.currentStep, 'Database Operations Analysis');
      assert.ok(report.overallProgress > 0);
      assert.ok(report.overallProgress < 100);
    });

    test('should show correct current step', () => {
      const report1 = progressIndicator.getProgressReport();
      assert.strictEqual(report1.currentStep, 'API Endpoint Analysis');

      progressIndicator.startStep('api_endpoint_analysis');
      const report2 = progressIndicator.getProgressReport();
      assert.strictEqual(report2.currentStep, 'API Endpoint Analysis');

      progressIndicator.completeStep('api_endpoint_analysis', true);
      const report3 = progressIndicator.getProgressReport();
      assert.strictEqual(report3.currentStep, 'Database Operations Analysis');
    });

    test('should show completion status', () => {
      assert.strictEqual(progressIndicator.isComplete(), false);
      assert.strictEqual(progressIndicator.hasErrors(), false);

      // Complete all steps
      const steps = progressIndicator.getAllSteps();
      for (const step of steps) {
        progressIndicator.startStep(step.id);
        progressIndicator.completeStep(step.id, true);
      }

      assert.strictEqual(progressIndicator.isComplete(), true);
      assert.strictEqual(progressIndicator.hasErrors(), false);
    });

    test('should show error status', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', false, 'Test error');

      assert.strictEqual(progressIndicator.hasErrors(), true);
      assert.strictEqual(progressIndicator.isComplete(), false);

      const errors = progressIndicator.getErrors();
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0].includes('Test error'));
    });
  });

  describe('reset functionality', () => {
    test('should reset progress indicator correctly', () => {
      // Make some progress
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', true);

      // Reset
      progressIndicator.reset();

      // Check that everything is reset
      const steps = progressIndicator.getAllSteps();
      assert.ok(steps.every(step => step.status === 'pending'));
      assert.ok(steps.every(step => step.progress === 0));
      assert.strictEqual(progressIndicator.isComplete(), false);
      assert.strictEqual(progressIndicator.hasErrors(), false);
    });
  });

  describe('step progress tracking', () => {
    test('should track step progress correctly', () => {
      assert.strictEqual(progressIndicator.getStepProgress('api_endpoint_analysis'), 0);
      assert.strictEqual(progressIndicator.getStepStatus('api_endpoint_analysis'), 'pending');

      progressIndicator.startStep('api_endpoint_analysis');
      assert.strictEqual(progressIndicator.getStepStatus('api_endpoint_analysis'), 'running');

      progressIndicator.updateStepProgress('api_endpoint_analysis', 75);
      assert.strictEqual(progressIndicator.getStepProgress('api_endpoint_analysis'), 75);

      progressIndicator.completeStep('api_endpoint_analysis', true);
      assert.strictEqual(progressIndicator.getStepProgress('api_endpoint_analysis'), 100);
      assert.strictEqual(progressIndicator.getStepStatus('api_endpoint_analysis'), 'completed');
    });

    test('should handle non-existent step progress', () => {
      assert.strictEqual(progressIndicator.getStepProgress('non_existent'), 0);
      assert.strictEqual(progressIndicator.getStepStatus('non_existent'), 'unknown');
    });
  });

  describe('progress report formatting', () => {
    test('should format progress report correctly', () => {
      // Make some progress
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.updateStepProgress('api_endpoint_analysis', 50);
      progressIndicator.completeStep('api_endpoint_analysis', true);

      progressIndicator.startStep('database_operations_analysis');
      progressIndicator.updateStepProgress('database_operations_analysis', 25);

      const formattedReport = progressIndicator.formatProgressReport();

      assert.ok(formattedReport.includes('API & Backend Analysis Progress'));
      assert.ok(formattedReport.includes('Current Step: Database Operations Analysis'));
      assert.ok(formattedReport.includes('Completed: 1/8 steps'));
      assert.ok(formattedReport.includes('API Endpoint Analysis'));
      assert.ok(formattedReport.includes('Database Operations Analysis'));
      assert.ok(formattedReport.includes('✅')); // Completed step icon
      assert.ok(formattedReport.includes('🔄')); // Running step icon
      assert.ok(formattedReport.includes('⏳')); // Pending step icon
    });

    test('should include progress bars in formatted report', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.updateStepProgress('api_endpoint_analysis', 75);

      const formattedReport = progressIndicator.formatProgressReport();

      assert.ok(formattedReport.includes('█')); // Progress bar filled
      assert.ok(formattedReport.includes('░')); // Progress bar empty
      assert.ok(formattedReport.includes('75%'));
    });

    test('should include error information in formatted report', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', false, 'Test error message');

      const formattedReport = progressIndicator.formatProgressReport();

      assert.ok(formattedReport.includes('❌')); // Error icon
      assert.ok(formattedReport.includes('Error: Test error message'));
    });
  });

  describe('time tracking', () => {
    test('should track step duration correctly', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      
      // Simulate some time passing
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Wait 10ms
      }
      
      progressIndicator.completeStep('api_endpoint_analysis', true);

      const step = progressIndicator.getStep('api_endpoint_analysis');
      assert.ok(step.duration);
      assert.ok(step.duration >= 10);
    });

    test('should estimate remaining time correctly', () => {
      // Complete first step
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', true);

      // Start second step
      progressIndicator.startStep('database_operations_analysis');

      const report = progressIndicator.getProgressReport();
      assert.ok(report.estimatedTimeRemaining);
      assert.ok(report.estimatedTimeRemaining > 0);
    });
  });

  describe('error handling', () => {
    test('should handle invalid progress values gracefully', () => {
      progressIndicator.startStep('api_endpoint_analysis');

      // Test negative progress
      progressIndicator.updateStepProgress('api_endpoint_analysis', -10);
      let step = progressIndicator.getStep('api_endpoint_analysis');
      assert.strictEqual(step.progress, 0);

      // Test progress over 100
      progressIndicator.updateStepProgress('api_endpoint_analysis', 150);
      step = progressIndicator.getStep('api_endpoint_analysis');
      assert.strictEqual(step.progress, 100);
    });

    test('should handle multiple errors correctly', () => {
      progressIndicator.startStep('api_endpoint_analysis');
      progressIndicator.completeStep('api_endpoint_analysis', false, 'Error 1');

      progressIndicator.startStep('database_operations_analysis');
      progressIndicator.completeStep('database_operations_analysis', false, 'Error 2');

      const errors = progressIndicator.getErrors();
      assert.strictEqual(errors.length, 2);
      assert.ok(errors[0].includes('Error 1'));
      assert.ok(errors[1].includes('Error 2'));
    });
  });
});
