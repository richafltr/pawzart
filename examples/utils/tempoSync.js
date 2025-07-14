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
    // Add phase noise for robustness testing
    const noise = config.noiseLevel * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
    const actualPhase = state.robotPhase + noise;
    
    // Phase error (wrapped to [-π, π])
    let phaseError = targetPhase - actualPhase;
    while (phaseError > Math.PI) phaseError -= 2 * Math.PI;
    while (phaseError < -Math.PI) phaseError += 2 * Math.PI;
    
    // PI controller
    state.errorIntegral += phaseError * dt;
    const adjustment = config.Kp * phaseError + config.Ki * state.errorIntegral;
    
    // Limit adjustment to prevent instability
    const clampedAdjustment = Math.max(-config.maxAdjust, Math.min(config.maxAdjust, adjustment));
    
    // Update robot frequency
    state.robotFreq = Math.max(0.5, Math.min(4.0, state.robotFreq + clampedAdjustment));
    
    // Advance robot phase
    state.robotPhase = (state.robotPhase + state.robotFreq * dt * 2 * Math.PI) % (2 * Math.PI);
    
    // Apply frequency adjustment to robot
    robotController.setFrequency(state.robotFreq);
  }
  
  /**
   * Get current synchronization metrics
   * @returns {Object} Sync metrics
   */
  function getMetrics() {
    return {
      phaseError: state.robotPhase,
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
   * @param {boolean} enabled - Enable state
   */
  function setEnabled(enabled) {
    state.enabled = enabled;
    if (!enabled) reset();
  }
  
  // Setup beat event listener
  beatEmitter.on('beat', onBeat);
  
  return {
    getMetrics,
    reset,
    setEnabled,
    updatePhaseSync,
    config,
    state
  };
}

/**
 * Simple phase-lock loop for multi-robot coordination
 * @param {Object} options - Configuration options
 * @returns {Object} Phase sync controller
 */
export function createPhaseSync(options = {}) {
  const config = {
    Kp: options.Kp || 0.5,
    Ki: options.Ki || 0.1,
    maxAdjust: options.maxAdjust || 0.03,
    ...options
  };
  
  let errorIntegral = 0;
  
  return {
    config,
    computeAdjustment(masterPhase, slavePhase, dt) {
      // Phase error (wrapped to [-π, π])
      let phaseError = masterPhase - slavePhase;
      while (phaseError > Math.PI) phaseError -= 2 * Math.PI;
      while (phaseError < -Math.PI) phaseError += 2 * Math.PI;
      
      // PI controller
      errorIntegral += phaseError * dt;
      const adjustment = config.Kp * phaseError + config.Ki * errorIntegral;
      
      // Limit adjustment
      return Math.max(-config.maxAdjust, Math.min(config.maxAdjust, adjustment));
    },
    reset() {
      errorIntegral = 0;
    }
  };
} 