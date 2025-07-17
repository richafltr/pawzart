/**
 * Robustness Benchmark Script
 * Measures performance improvements with adaptive filtering
 */

import { createAdaptiveMotionFilter } from "../examples/utils/adaptiveMotionFilter.js";
import { setupTempoSync } from "../examples/utils/tempoSync.js";

/**
 * Simulate control loop with configurable parameters
 * @param {Object} config - Simulation configuration
 * @returns {Object} Metrics from simulation run
 */
async function runSimulation(config) {
  const {
    filterEnabled = false,
    duration = 30,        // seconds
    dt = 1/500,          // timestep
    impulseInterval = 5,  // seconds between disturbances
    windowSize = 15,
    gain = 0.9
  } = config;
  
  const steps = Math.floor(duration / dt);
  const impulseSteps = Math.floor(impulseInterval / dt);
  
  // Initialize filter if enabled
  const filter = filterEnabled ? 
    createAdaptiveMotionFilter({ windowSize, gain }) : 
    (x) => x;
  
  // Reference trajectory (simple sine wave for testing)
  const reference = Array(steps).fill(0).map((_, i) => {
    const t = i * dt;
    return Array(10).fill(0).map((_, j) => 
      Math.sin(2 * Math.PI * 0.5 * t + j * 0.1)
    );
  });
  
  // Tracking metrics
  const errors = [];
  let totalError = 0;
  
  // Simulation loop
  for (let i = 0; i < steps; i++) {
    let command = reference[i].slice(); // Copy reference
    
    // Add measurement noise
    command = command.map(v => v + (Math.random() - 0.5) * 0.01);
    
    // Apply impulse disturbance
    if (i % impulseSteps === 0 && i > 0) {
      const impulseJoint = Math.floor(Math.random() * command.length);
      command[impulseJoint] += (Math.random() - 0.5) * 0.5;
    }
    
    // Apply filter
    const filtered = filter(command);
    
    // Calculate error
    const error = filtered.map((v, j) => 
      Math.abs(v - reference[i][j])
    ).reduce((sum, e) => sum + e, 0);
    
    errors.push(error);
    totalError += error;
  }
  
  // Calculate RMS error
  const rmsError = Math.sqrt(
    errors.reduce((sum, e) => sum + e * e, 0) / errors.length
  );
  
  return {
    rmsError,
    meanError: totalError / steps,
    maxError: Math.max(...errors),
    errorStdDev: calculateStdDev(errors)
  };
}

/**
 * Run comparative benchmark
 */
async function runBenchmark() {
  console.log("PawzArt Robustness Benchmark v0.2.0");
  console.log("====================================\n");
  
  // Test different configurations
  const configs = [
    { name: "Baseline (no filter)", filterEnabled: false },
    { name: "Filter (window=10)", filterEnabled: true, windowSize: 10 },
    { name: "Filter (window=15)", filterEnabled: true, windowSize: 15 },
    { name: "Filter (window=20)", filterEnabled: true, windowSize: 20 },
    { name: "Filter (window=25)", filterEnabled: true, windowSize: 25 }
  ];
  
  const results = [];
  
  for (const config of configs) {
    process.stdout.write(`Running ${config.name}... `);
    const metrics = await runSimulation(config);
    results.push({ ...config, ...metrics });
    console.log(`✓ RMS Error: ${metrics.rmsError.toFixed(4)}`);
  }
  
  // Calculate improvements
  console.log("\nResults Summary:");
  console.log("================");
  
  const baseline = results[0].rmsError;
  
  for (const result of results) {
    const improvement = baseline > 0 ? 
      ((baseline - result.rmsError) / baseline * 100).toFixed(1) : 0;
    
    console.log(`${result.name.padEnd(25)} | ` +
               `RMS: ${result.rmsError.toFixed(4)} | ` +
               `Improvement: ${improvement}%`);
  }
  
  // Find optimal configuration
  const optimal = results.slice(1).reduce((best, curr) => 
    curr.rmsError < best.rmsError ? curr : best
  );
  
  console.log(`\n✅ Optimal configuration: ${optimal.name}`);
  console.log(`✅ Error reduction: ${((baseline - optimal.rmsError) / baseline * 100).toFixed(1)}%`);
  
  return results;
}

/**
 * Test phase synchronization
 */
async function testPhaseSync() {
  console.log("\n\nPhase Synchronization Test");
  console.log("==========================\n");
  
  const beatTimes = Array(30).fill(0).map((_, i) => i * 0.5); // 120 BPM
  const robotPhases = [];
  
  // Simulate robot with phase-lock loop
  let robotPhase = 0;
  let robotFreq = 2.1; // Slightly off from 2Hz beat
  
  const sync = {
    Kp: 0.5,
    Ki: 0.1,
    errorIntegral: 0
  };
  
  for (let i = 0; i < beatTimes.length; i++) {
    const beatPhase = (beatTimes[i] * 2 * Math.PI) % (2 * Math.PI);
    const phaseError = beatPhase - robotPhase;
    
    // PLL update
    sync.errorIntegral += phaseError * 0.5;
    robotFreq += sync.Kp * phaseError + sync.Ki * sync.errorIntegral;
    
    // Update robot phase
    robotPhase = (robotPhase + robotFreq * 0.5) % (2 * Math.PI);
    robotPhases.push(robotPhase);
  }
  
  // Calculate jitter
  const phaseErrors = robotPhases.map((rp, i) => {
    const bp = (beatTimes[i] * 2 * Math.PI) % (2 * Math.PI);
    return Math.abs(rp - bp);
  });
  
  const jitter = calculateStdDev(phaseErrors) * 1000 / (2 * Math.PI); // Convert to ms
  
  console.log(`Phase jitter: ${jitter.toFixed(1)} ms`);
  console.log(`Target: ≤ 15 ms`);
  console.log(`Result: ${jitter <= 15 ? '✅ PASS' : '❌ FAIL'}`);
  
  return jitter;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Generate simple benchmark plot (ASCII art)
 */
function plotResults(results) {
  console.log("\n\nError Reduction Plot");
  console.log("===================");
  
  const maxError = Math.max(...results.map(r => r.rmsError));
  const scale = 40 / maxError;
  
  for (const result of results) {
    const barLength = Math.floor(result.rmsError * scale);
    const bar = '█'.repeat(barLength);
    const label = result.name.padEnd(20);
    console.log(`${label} |${bar} ${result.rmsError.toFixed(4)}`);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Starting PawzArt Robustness Benchmarks...\n");
  
  runBenchmark()
    .then(results => {
      plotResults(results);
      return testPhaseSync();
    })
    .then(() => {
      console.log("\n✨ Benchmark complete!");
    })
    .catch(err => {
      console.error("Benchmark error:", err);
      process.exit(1);
    });
}

export { runSimulation, runBenchmark, testPhaseSync }; 