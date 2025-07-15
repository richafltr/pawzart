/**
 * Adaptive Motion Filter for robust joint control
 * Implements EMA smoothing with runtime-configurable parameters
 */

import { getRuntimeParam } from "./queryParams.js";

/**
 * Creates an adaptive motion filter with disturbance rejection
 * @param {Object} optsUser - User configuration options
 * @returns {Function} Filter function that processes joint commands
 */
export function createAdaptiveMotionFilter(optsUser = {}) {
  // Runtime-configurable parameters for belt-and-suspenders security
  const opts = {
    dt:         1/500,                                   // Simulation timestep
    windowSize: getRuntimeParam("window", 15),          // EMA window (runtime override)
    noiseSigma: getRuntimeParam("sigma", 0.005),        // Noise injection std dev
    gain:       getRuntimeParam("gain", 0.9),           // Blend factor
    ...optsUser                                          // User overrides
  };
  
  // Rolling history buffer for exponential moving average
  const hist = [];
  
  /**
   * Filter function - processes raw joint commands
   * @param {Array<number>} raw - Raw joint command vector
   * @returns {Array<number>} Filtered command vector
   */
  return function filter(raw) {
    if (!raw || raw.length === 0) return raw;
    
    // Initialize on first call
    if (hist.length === 0) {
      hist.push(raw.slice());
      return raw.slice();
    }
    
    // Exponential moving average
    const alpha = 2.0 / (opts.windowSize + 1);
    const prev = hist[hist.length - 1];
    const filtered = [];
    
    for (let i = 0; i < raw.length; i++) {
      // Add controlled noise for robustness testing
      const noise = opts.noiseSigma * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      const noisy = raw[i] + noise;
      
      // EMA filtering
      filtered[i] = alpha * noisy + (1 - alpha) * prev[i];
      
      // Apply gain blending
      filtered[i] = opts.gain * filtered[i] + (1 - opts.gain) * raw[i];
    }
    
    // Update history
    hist.push(filtered.slice());
    if (hist.length > opts.windowSize) hist.shift();
    
    return filtered;
  };
}

/**
 * Creates a preset filter configuration
 * @param {string} preset - Preset name ("smooth", "responsive", "robust")
 * @returns {Function} Configured filter function
 */
export function createPresetFilter(preset = "default") {
  const presets = {
    smooth: { windowSize: 25, gain: 0.95, noiseSigma: 0.001 },
    responsive: { windowSize: 8, gain: 0.8, noiseSigma: 0.01 },
    robust: { windowSize: 15, gain: 0.9, noiseSigma: 0.005 },
    default: { windowSize: 15, gain: 0.9, noiseSigma: 0.005 }
  };
  
  return createAdaptiveMotionFilter(presets[preset] || presets.default);
} 