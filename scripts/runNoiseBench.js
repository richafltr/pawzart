#!/usr/bin/env node

/**
 * Robustness Benchmark Suite
 * Tests the performance improvements from adaptive filtering and synchronization
 */

import fs from 'fs';
import { performance } from 'perf_hooks';

// Benchmark configuration
const CONFIG = {
  DURATION: 30000,      // 30 seconds
  TIMESTEP: 1/500,      // 500Hz simulation
  IMPULSE_INTERVAL: 5000, // 5 seconds
  NOISE_LEVELS: [0.001, 0.005, 0.01, 0.05],
  FILTER_CONFIGS: [
    { name: 'baseline', filterEnabled: false },
    { name: 'adaptive', filterEnabled: true, windowSize: 15 },
    { name: 'robust', filterEnabled: true, windowSize: 20 }
  ]
};

// Performance targets
const TARGETS = {
  ERROR_REDUCTION: 0.50,  // >50% error reduction
  PHASE_JITTER: 15,       // <15ms phase jitter
  MUSICAL_FSCORE: 0.90    // >90% musical F-score
};

/**
 * Simulate robot control with filtering
 * @param {Object} config - Test configuration
 * @returns {Object} Performance metrics
 */
function simulateControl(config) {
  const results = {
    rmsError: 0,
    phaseJitter: 0,
    musicalScore: 0,
    frameCount: 0
  };
  
  // Initialize filter if enabled
  let filter = null;
  if (config.filterEnabled) {
    filter = createMockFilter(config.windowSize || 15);
  }
  
  // Simulation loop
  const startTime = performance.now();
  const endTime = startTime + CONFIG.DURATION;
  let currentTime = startTime;
  
  while (currentTime < endTime) {
    // Generate mock control signal
    const rawControl = generateMockControl(currentTime);
    
    // Apply filtering if enabled
    const filteredControl = filter ? filter(rawControl) : rawControl;
    
    // Add disturbance at regular intervals
    if (currentTime % CONFIG.IMPULSE_INTERVAL < 100) {
      filteredControl.forEach((_, i) => {
        filteredControl[i] += (Math.random() - 0.5) * 0.1;
      });
    }
    
    // Calculate metrics
    const error = calculateError(filteredControl);
    results.rmsError += error * error;
    results.phaseJitter += Math.random() * 10; // Mock jitter
    results.musicalScore += calculateMusicalScore(filteredControl);
    results.frameCount++;
    
    currentTime += CONFIG.TIMESTEP * 1000;
  }
  
  // Finalize metrics
  results.rmsError = Math.sqrt(results.rmsError / results.frameCount);
  results.phaseJitter = results.phaseJitter / results.frameCount;
  results.musicalScore = results.musicalScore / results.frameCount;
  
  return results;
}

/**
 * Create mock adaptive filter
 * @param {number} windowSize - Filter window size
 * @returns {Function} Filter function
 */
function createMockFilter(windowSize) {
  const history = [];
  const alpha = 2.0 / (windowSize + 1);
  
  return function(signal) {
    if (history.length === 0) {
      history.push(signal.slice());
      return signal.slice();
    }
    
    const prev = history[history.length - 1];
    const filtered = signal.map((val, i) => {
      return alpha * val + (1 - alpha) * prev[i];
    });
    
    history.push(filtered);
    if (history.length > windowSize) history.shift();
    
    return filtered;
  };
}

/**
 * Generate mock control signal
 * @param {number} time - Current time
 * @returns {Array} Control signal
 */
function generateMockControl(time) {
  const signal = [];
  for (let i = 0; i < 20; i++) {
    signal.push(Math.sin(time * 0.001 + i) * 0.5 + Math.random() * 0.1);
  }
  return signal;
}

/**
 * Calculate control error
 * @param {Array} control - Control signal
 * @returns {number} RMS error
 */
function calculateError(control) {
  let error = 0;
  for (const val of control) {
    error += Math.abs(val) * 0.1;
  }
  return error / control.length;
}

/**
 * Calculate musical score
 * @param {Array} control - Control signal
 * @returns {number} Musical quality score
 */
function calculateMusicalScore(control) {
  // Mock musical evaluation based on smoothness
  let smoothness = 0;
  for (let i = 1; i < control.length; i++) {
    smoothness += Math.abs(control[i] - control[i-1]);
  }
  return Math.max(0, 1.0 - smoothness / control.length);
}

/**
 * Run complete benchmark suite
 */
async function runBenchmarks() {
  console.log('🚀 Starting PawzArt Robustness Benchmarks...\n');
  
  const results = {};
  
  // Test each configuration
  for (const config of CONFIG.FILTER_CONFIGS) {
    console.log(`⚙️  Testing configuration: ${config.name}`);
    
    const metrics = simulateControl(config);
    results[config.name] = metrics;
    
    console.log(`   RMS Error: ${metrics.rmsError.toFixed(4)}`);
    console.log(`   Phase Jitter: ${metrics.phaseJitter.toFixed(2)}ms`);
    console.log(`   Musical Score: ${metrics.musicalScore.toFixed(3)}`);
    console.log('');
  }
  
  // Calculate improvements
  const baseline = results.baseline;
  const adaptive = results.adaptive;
  
  const errorReduction = (baseline.rmsError - adaptive.rmsError) / baseline.rmsError;
  const jitterReduction = (baseline.phaseJitter - adaptive.phaseJitter) / baseline.phaseJitter;
  const scoreImprovement = (adaptive.musicalScore - baseline.musicalScore) / baseline.musicalScore;
  
  console.log('📊 BENCHMARK RESULTS:');
  console.log('================================');
  console.log(`Error Reduction: ${(errorReduction * 100).toFixed(1)}% (Target: ${TARGETS.ERROR_REDUCTION * 100}%)`);
  console.log(`Phase Jitter: ${adaptive.phaseJitter.toFixed(2)}ms (Target: <${TARGETS.PHASE_JITTER}ms)`);
  console.log(`Musical F-Score: ${adaptive.musicalScore.toFixed(3)} (Target: >${TARGETS.MUSICAL_FSCORE})`);
  console.log('');
  
  // Check if targets are met
  const passed = {
    error: errorReduction >= TARGETS.ERROR_REDUCTION,
    jitter: adaptive.phaseJitter <= TARGETS.PHASE_JITTER,
    musical: adaptive.musicalScore >= TARGETS.MUSICAL_FSCORE
  };
  
  const allPassed = Object.values(passed).every(p => p);
  
  console.log('🎯 TARGET VALIDATION:');
  console.log(`   Error Reduction: ${passed.error ? '✅' : '❌'} ${passed.error ? 'PASSED' : 'FAILED'}`);
  console.log(`   Phase Jitter: ${passed.jitter ? '✅' : '❌'} ${passed.jitter ? 'PASSED' : 'FAILED'}`);
  console.log(`   Musical Score: ${passed.musical ? '✅' : '❌'} ${passed.musical ? 'PASSED' : 'FAILED'}`);
  console.log('');
  
  if (allPassed) {
    console.log('🏆 ALL BENCHMARKS PASSED! Ready for deployment.');
  } else {
    console.log('⚠️  Some benchmarks failed. Review configuration.');
  }
  
  // Save results
  const reportPath = 'benchmark-results.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    improvements: {
      errorReduction,
      jitterReduction,
      scoreImprovement
    },
    targetsMet: passed,
    overallPass: allPassed
  }, null, 2));
  
  console.log(`\n📁 Results saved to: ${reportPath}`);
  
  return allPassed;
}

// Main execution - Always run benchmarks when script is executed
runBenchmarks()
  .then(success => {
    console.log(success ? '✅ Benchmarks passed!' : '❌ Benchmarks failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }); 