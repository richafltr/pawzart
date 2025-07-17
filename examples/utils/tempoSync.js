/**
 * Tempo Synchronization Module
 * Implements phase-lock loop for multi-robot coordination
 */

import { getRuntimeParam } from "./queryParams.js";

/**
 * Setup tempo synchronization between robots
 * @param {Object} robotController - Robot control interface
 * @param {Object} beatEmitter - Beat event emitter
 * @param {Object} params - Configuration parameters
 * @returns {Object} Sync controller with update methods
 */
export function setupTempoSync(robotController, beatEmitter, params = {}) {
  // Runtime-configurable PLL gains
  const config = {
    Kp: getRuntimeParam("Kp", params.Kp ?? 0.5),    // Proportional gain
    Ki: getRuntimeParam("Ki", params.Ki ?? 0.1),    // Integral gain
    maxAdjust: getRuntimeParam("maxAdj", 0.03),     // Max 3% frequency change
    noiseLevel: getRuntimeParam("noise", 0.0),      // Phase noise for testing
    ...params
  };
  
  // Internal state
  const state = {
    errorIntegral: 0,
    lastBeatTime: 0,
    robotPhase: 0,
    robotFreq: 2.0,  // Default 2Hz
    enabled: true
  };
  
  /**
   * Handle beat event from music player
   * @param {number} timestamp - Beat timestamp
   */
  function onBeat(timestamp) {
    if (!state.enabled) return;
    
    const beatPhase = (timestamp * 2 * Math.PI) % (2 * Math.PI);
    updatePhaseSync(beatPhase, timestamp - state.lastBeatTime);
    state.lastBeatTime = timestamp;
  }
  
  /**
   * Update phase synchronization
   * @param {number} targetPhase - Target phase to sync to
   * @param {number} dt - Time delta
   */
  function updatePhaseSync(targetPhase, dt) {
    // Calculate phase error
    let phaseError = targetPhase - state.robotPhase;
    
    // Wrap to [-π, π]
    phaseError = ((phaseError + Math.PI) % (2 * Math.PI)) - Math.PI;
    
    // Add optional noise for robustness testing
    if (config.noiseLevel > 0) {
      phaseError += (Math.random() - 0.5) * 2 * config.noiseLevel;
    }
    
    // Update integral
    state.errorIntegral += phaseError * dt;
    state.errorIntegral = Math.max(-1, Math.min(1, state.errorIntegral)); // Prevent windup
    
    // Calculate frequency adjustment (PLL)
    const freqAdjust = config.Kp * phaseError + config.Ki * state.errorIntegral;
    
    // Apply adjustment with limiting
    const maxChange = state.robotFreq * config.maxAdjust;
    const clampedAdjust = Math.max(-maxChange, Math.min(maxChange, freqAdjust));
    
    state.robotFreq += clampedAdjust;
    
    // Update robot phase
    state.robotPhase = (state.robotPhase + state.robotFreq * dt) % (2 * Math.PI);
    
    // Apply to robot controller
    if (robotController && robotController.setFrequency) {
      robotController.setFrequency(state.robotFreq);
    }
  }
  
  /**
   * Get current synchronization metrics
   * @returns {Object} Sync metrics
   */
  function getMetrics() {
    return {
      phaseError: 0, // Calculate on demand
      frequency: state.robotFreq,
      integral: state.errorIntegral,
      enabled: state.enabled
    };
  }
  
  /**
   * Reset synchronization state
   */
  function reset() {
    state.errorIntegral = 0;
    state.robotPhase = 0;
    state.robotFreq = 2.0;
  }
  
  /**
   * Enable/disable synchronization
   * @param {boolean} enabled - Enable flag
   */
  function setEnabled(enabled) {
    state.enabled = enabled;
    if (!enabled) reset();
  }
  
  // Register beat listener if emitter provided
  if (beatEmitter && beatEmitter.on) {
    beatEmitter.on('beat', onBeat);
  }
  
  // Return control interface
  return {
    onBeat,
    updatePhaseSync,
    getMetrics,
    reset,
    setEnabled,
    config,
    state
  };
}

/**
 * Create a simple phase synchronizer for testing
 * @param {Object} options - Configuration options
 * @returns {Object} Phase sync instance
 */
export function createPhaseSync(options = {}) {
  const sync = setupTempoSync(null, null, options);
  
  /**
   * Compute phase adjustment between two phases
   * @param {number} masterPhase - Master phase (radians)
   * @param {number} slavePhase - Slave phase (radians)
   * @param {number} dt - Time step
   * @returns {number} Phase adjustment value
   */
  sync.computeAdjustment = function(masterPhase, slavePhase, dt) {
    sync.state.robotPhase = slavePhase;
    sync.updatePhaseSync(masterPhase, dt);
    return sync.state.robotFreq - 2.0; // Return frequency offset
  };
  
  return sync;
} 