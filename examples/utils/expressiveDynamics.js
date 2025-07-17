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
      timeOffset += timingVar * noise * 0.1; // Accumulate drift
    } else {
      // Outside phrase boundaries - maintain original timing
      enhanced.push([t + timeOffset, qpos]);
    }
  }
  
  return enhanced;
}

/**
 * Detect musical phrases based on velocity patterns
 * @param {Array} sequence - Control sequence
 * @param {number} minLength - Minimum phrase length
 * @returns {Array} Detected phrase boundaries
 */
function detectPhrases(sequence, minLength) {
  const phrases = [];
  let phraseStart = 0;
  
  for (let i = 1; i < sequence.length - 1; i++) {
    if (i - phraseStart >= minLength) {
      // Simple velocity-based phrase detection
      const prevVel = calculateVelocity(sequence, i - 1);
      const currVel = calculateVelocity(sequence, i);
      
      // Detect zero crossing or significant change
      if (Math.sign(prevVel) !== Math.sign(currVel) || 
          Math.abs(currVel) < 0.1) {
        phrases.push({ start: phraseStart, end: i });
        phraseStart = i;
      }
    }
  }
  
  // Final phrase
  if (sequence.length - phraseStart >= minLength / 2) {
    phrases.push({ start: phraseStart, end: sequence.length });
  }
  
  return phrases;
}

/**
 * Calculate velocity between control points
 * @param {Array} sequence - Control sequence
 * @param {number} idx - Index
 * @returns {number} Velocity magnitude
 */
function calculateVelocity(sequence, idx) {
  if (idx === 0 || idx >= sequence.length - 1) return 0;
  
  const dt = sequence[idx + 1][0] - sequence[idx][0];
  const dq = sequence[idx + 1][1].map((q, i) => q - sequence[idx][1][i]);
  
  return Math.sqrt(dq.reduce((sum, v) => sum + v * v, 0)) / dt;
}

/**
 * Apply cosine-based velocity envelope
 * @param {Array} qpos - Joint positions
 * @param {number} progress - Phrase progress [0,1]
 * @param {number} scale - Scaling factor
 * @returns {Array} Modulated positions
 */
function applyVelocityEnvelope(qpos, progress, scale) {
  const envelope = 0.8 + 0.2 * Math.cos(progress * Math.PI * 2);
  return qpos.map(q => q * envelope * scale);
}

/**
 * Generate smooth noise (simplified Perlin-like)
 * @param {Function} rng - Random number generator
 * @param {number} x - Input coordinate
 * @returns {number} Smooth noise value [-1, 1]
 */
function smoothNoise(rng, x) {
  const x0 = Math.floor(x * 8) / 8;
  const x1 = x0 + 0.125;
  const fx = (x - x0) * 8;
  
  // Cubic interpolation
  const sx = fx * fx * (3 - 2 * fx);
  
  return (1 - sx) * (rng() * 2 - 1) + sx * (rng() * 2 - 1);
}

/**
 * Batch process multiple performances
 * @param {Object} performances - Map of song names to sequences
 * @param {number} seed - Base seed
 * @returns {Object} Enhanced performances
 */
export function enhanceAllPerformances(performances, seed = 42) {
  const enhanced = {};
  let currentSeed = seed;
  
  for (const [song, sequence] of Object.entries(performances)) {
    enhanced[song] = enhancePerformance(sequence, currentSeed);
    currentSeed += 137; // Prime offset for variety
  }
  
  return enhanced;
} 