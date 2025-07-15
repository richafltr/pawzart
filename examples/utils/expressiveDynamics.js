/**
 * Expressive Dynamics Module
 * Adds human-like musical expression to robotic performance
 */

import { getRuntimeParam } from "./queryParams.js";

/**
 * Enhances control sequences with musical expressivity
 * @param {Array} ctrlSequence - Original control sequence [[t, qpos], ...]
 * @param {number} seed - Random seed for reproducibility
 * @returns {Array} Enhanced control sequence with expressive timing
 */
export function enhancePerformance(ctrlSequence, seed = 42) {
  // Runtime-configurable expression parameters
  const rubatoRange = getRuntimeParam("rubato", 0.06);    // ±6% timing variation
  const velocityScale = getRuntimeParam("velscale", 1.0); // Velocity scaling factor
  const phraseLength = getRuntimeParam("phrase", 16);     // Musical phrase detection window
  
  // Simple deterministic random generator
  let rng = seed;
  const random = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  
  // Detect musical phrases via velocity zero-crossings
  const phrases = detectPhrases(ctrlSequence, phraseLength);
  
  // Apply rubato to each phrase
  const enhanced = [];
  let timeOffset = 0;
  
  for (let i = 0; i < ctrlSequence.length; i++) {
    const [t, qpos] = ctrlSequence[i];
    const phraseIdx = phrases.findIndex(p => i >= p.start && i < p.end);
    
    if (phraseIdx >= 0) {
      // Apply smooth timing variation within phrase
      const phraseProgress = (i - phrases[phraseIdx].start) / 
                           (phrases[phraseIdx].end - phrases[phraseIdx].start);
      const timingVar = Math.sin(phraseProgress * Math.PI) * rubatoRange;
      
      // Pseudo-Perlin-like smooth randomness
      const noise = smoothNoise(random, phraseProgress);
      const finalTiming = t + timeOffset + (timingVar * noise);
      
      // Apply velocity envelope
      const velocityEnv = applyVelocityEnvelope(qpos, phraseProgress, velocityScale);
      
      enhanced.push([finalTiming, velocityEnv]);
      timeOffset += timingVar * 0.1; // Accumulate small timing drift
    } else {
      // No phrase context, pass through unchanged
      enhanced.push([t, qpos]);
    }
  }
  
  return enhanced;
}

/**
 * Detect musical phrases using velocity analysis
 * @param {Array} sequence - Control sequence
 * @param {number} minLength - Minimum phrase length
 * @returns {Array} Phrase boundaries [{start, end}, ...]
 */
function detectPhrases(sequence, minLength) {
  const phrases = [];
  const velocities = [];
  
  // Calculate velocity profile
  for (let i = 1; i < sequence.length - 1; i++) {
    velocities.push(calculateVelocity(sequence, i));
  }
  
  // Find phrase boundaries at velocity minima
  let phraseStart = 0;
  for (let i = minLength; i < velocities.length - minLength; i++) {
    if (velocities[i] < velocities[i-1] && velocities[i] < velocities[i+1]) {
      // Local minimum = phrase boundary
      if (i - phraseStart >= minLength) {
        phrases.push({ start: phraseStart, end: i });
        phraseStart = i;
      }
    }
  }
  
  // Add final phrase
  if (sequence.length - phraseStart >= minLength) {
    phrases.push({ start: phraseStart, end: sequence.length });
  }
  
  return phrases;
}

/**
 * Calculate velocity magnitude at sequence index
 * @param {Array} sequence - Control sequence
 * @param {number} idx - Index to calculate velocity at
 * @returns {number} Velocity magnitude
 */
function calculateVelocity(sequence, idx) {
  const prev = sequence[idx - 1][1];
  const curr = sequence[idx][1];
  const next = sequence[idx + 1][1];
  
  let vel = 0;
  for (let i = 0; i < curr.length; i++) {
    const dx = (next[i] - prev[i]) / 2;
    vel += dx * dx;
  }
  
  return Math.sqrt(vel);
}

/**
 * Apply velocity envelope for expressive dynamics
 * @param {Array} qpos - Joint positions
 * @param {number} progress - Phrase progress [0,1]
 * @param {number} scale - Velocity scaling factor
 * @returns {Array} Modified joint positions
 */
function applyVelocityEnvelope(qpos, progress, scale) {
  // Gaussian envelope for expressive timing
  const envelope = Math.exp(-Math.pow(progress - 0.5, 2) / 0.2) * scale;
  
  return qpos.map(pos => pos * envelope);
}

/**
 * Smooth noise function for natural randomness
 * @param {Function} rng - Random number generator
 * @param {number} x - Input value
 * @returns {number} Smooth noise value
 */
function smoothNoise(rng, x) {
  // Simple 1D Perlin-like noise
  const i = Math.floor(x);
  const f = x - i;
  
  const a = rng();
  const b = rng();
  
  return a * (1 - f) + b * f;
}

/**
 * Enhance multiple performance sequences
 * @param {Object} performances - Named performance sequences
 * @param {number} seed - Random seed
 * @returns {Object} Enhanced performances
 */
export function enhanceAllPerformances(performances, seed = 42) {
  const enhanced = {};
  
  for (const [name, sequence] of Object.entries(performances)) {
    enhanced[name] = enhancePerformance(sequence, seed + name.charCodeAt(0));
  }
  
  return enhanced;
} 