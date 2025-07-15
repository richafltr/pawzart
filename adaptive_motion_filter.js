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
  return (raw) => {
    // Inject synthetic noise for robustness testing
    const noisy = raw.map(v => 
      v + opts.noiseSigma * (Math.random() * 2 - 1)
    );
    
    // Update history buffer
    hist.push(noisy);
    if (hist.length > opts.windowSize) hist.shift();
    
    // Compute exponential moving average
    const smooth = noisy.map((_, i) => 
      hist.reduce((acc, vec) => acc + vec[i], 0) / hist.length
    );
    
    // Adaptive blending between smooth and noisy
    return noisy.map((v, i) => 
      opts.gain * smooth[i] + (1 - opts.gain) * v
    );
  };
}

/**
 * Factory for creating filter with preset configurations
 * @param {string} preset - Configuration preset name
 * @returns {Function} Configured filter instance
 */
export function createPresetFilter(preset = "default") {
  const presets = {
    default: { windowSize: 15, gain: 0.9, noiseSigma: 0.005 },
    smooth:  { windowSize: 25, gain: 0.95, noiseSigma: 0.002 },
    responsive: { windowSize: 8, gain: 0.7, noiseSigma: 0.008 },
    test: { windowSize: 20, gain: 0.85, noiseSigma: 0.01 }
  };
  
  return createAdaptiveMotionFilter(presets[preset] || presets.default);
}