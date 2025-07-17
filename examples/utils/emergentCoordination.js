/**
 * Emergent Coordination System
 * Enables robots to anticipate and adapt to each other's movements
 * Uses phase-locked loop principles for multi-robot synchronization
 */

import { getRuntimeParam } from "./queryParams.js";

/**
 * Create an emergent coordination system for multi-robot interaction
 * @param {Object} options - Configuration options
 * @returns {Object} Coordination system interface
 */
export function createEmergentCoordinator(options = {}) {
  const config = {
    couplingStrength: getRuntimeParam("coupling", 0.7),
    adaptationRate: getRuntimeParam("adapt", 0.05),
    predictionHorizon: getRuntimeParam("horizon", 0.5), // seconds
    energyThreshold: getRuntimeParam("ethresh", 0.1),
    ...options
  };
  
  // Internal state for coordination
  const state = {
    phaseMemory: [],      // Rolling buffer of phase observations
    energyLandscape: new Map(), // Energy at different phase configurations
    stablePoints: [],     // Discovered stable configurations
    couplingMatrix: null, // Inter-robot coupling strengths
    lastUpdate: 0
  };
  
  /**
   * Initialize coupling matrix for N robots
   * @param {number} numRobots - Number of robots in system
   */
  function initialize(numRobots) {
    // Create symmetric coupling matrix with diagonal = 1
    state.couplingMatrix = Array(numRobots).fill(0).map((_, i) => 
      Array(numRobots).fill(0).map((_, j) => i === j ? 1 : config.couplingStrength)
    );
    
    state.phaseMemory = Array(numRobots).fill(0).map(() => []);
  }
  
  /**
   * Update coordination based on observed robot states
   * @param {Array} robotStates - Current states of all robots
   * @param {number} dt - Time step
   * @returns {Array} Predicted optimal states for next timestep
   */
  function update(robotStates, dt) {
    const numRobots = robotStates.length;
    if (!state.couplingMatrix) initialize(numRobots);
    
    // Extract phase information from states
    const phases = robotStates.map(extractPhase);
    
    // Update phase memory
    phases.forEach((phase, i) => {
      state.phaseMemory[i].push(phase);
      if (state.phaseMemory[i].length > 100) {
        state.phaseMemory[i].shift();
      }
    });
    
    // Compute system energy (coordination metric)
    const systemEnergy = computeSystemEnergy(phases);
    
    // Update energy landscape
    const phaseKey = phases.map(p => Math.round(p * 10) / 10).join(',');
    state.energyLandscape.set(phaseKey, systemEnergy);
    
    // Detect stable configurations
    detectStablePoints();
    
    // Predict optimal next states
    const predictions = robotStates.map((currentState, i) => {
      const targetPhase = computeOptimalPhase(i, phases, dt);
      return adaptState(currentState, targetPhase, config.adaptationRate);
    });
    
    // Update coupling strengths based on performance
    updateCouplings(phases, systemEnergy);
    
    state.lastUpdate = Date.now();
    
    return predictions;
  }
  
  /**
   * Extract phase from robot state (position in cycle)
   * @param {Object} state - Robot state
   * @returns {number} Phase in [0, 2π]
   */
  function extractPhase(state) {
    // For quadruped: gait phase from leg positions
    // For hands: position in musical phrase
    if (state.type === 'quadruped') {
      const legPhases = state.legPositions.map((pos, i) => 
        Math.atan2(pos.y, pos.x) + i * Math.PI / 2
      );
      return legPhases.reduce((a, b) => a + b) / legPhases.length;
    } else {
      // Piano hands: finger configuration phase
      const fingerSum = state.fingerPositions.reduce((sum, pos) => sum + pos, 0);
      return (fingerSum % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    }
  }
  
  /**
   * Compute system energy (lower = more synchronized)
   * Based on phase coupling theory
   */
  function computeSystemEnergy(phases) {
    let energy = 0;
    const n = phases.length;
    
    // Pairwise phase differences weighted by coupling
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const phaseDiff = Math.abs(phases[i] - phases[j]);
        const coupling = state.couplingMatrix[i][j];
        
        // Energy increases with phase mismatch
        // Using standard potential function
        energy += coupling * (1 - Math.cos(phaseDiff));
      }
    }
    
    // Add velocity term (rate of phase change)
    if (state.phaseMemory[0].length > 1) {
      for (let i = 0; i < n; i++) {
        const memory = state.phaseMemory[i];
        const velocity = Math.abs(memory[memory.length - 1] - memory[memory.length - 2]);
        energy += 0.1 * velocity * velocity;
      }
    }
    
    return energy / (n * (n - 1) / 2);
  }
  
  /**
   * Detect stable configurations
   */
  function detectStablePoints() {
    // Find local minima in energy landscape
    const entries = Array.from(state.energyLandscape.entries());
    const stableConfigs = [];
    
    for (const [phaseKey, energy] of entries) {
      if (energy < config.energyThreshold) {
        const phases = phaseKey.split(',').map(Number);
        
        // Check if this is a local minimum
        const isMinimum = entries.every(([otherKey, otherEnergy]) => {
          if (otherKey === phaseKey) return true;
          const distance = computePhaseDistance(phaseKey, otherKey);
          return distance > 0.5 || energy <= otherEnergy;
        });
        
        if (isMinimum) {
          stableConfigs.push({ phases, energy });
        }
      }
    }
    
    // Keep only strongest stable points
    state.stablePoints = stableConfigs
      .sort((a, b) => a.energy - b.energy)
      .slice(0, 5);
  }
  
  /**
   * Compute optimal phase for robot to minimize system energy
   */
  function computeOptimalPhase(robotIndex, currentPhases, dt) {
    const phases = [...currentPhases];
    let minEnergy = Infinity;
    let optimalPhase = phases[robotIndex];
    
    // Search nearby phases
    for (let delta = -0.5; delta <= 0.5; delta += 0.1) {
      phases[robotIndex] = currentPhases[robotIndex] + delta;
      const energy = computeSystemEnergy(phases);
      
      if (energy < minEnergy) {
        minEnergy = energy;
        optimalPhase = phases[robotIndex];
      }
    }
    
    // Bias toward nearest stable configuration
    if (state.stablePoints.length > 0) {
      const nearestStable = findNearestStablePoint(phases);
      if (nearestStable) {
        const stablePhase = nearestStable.phases[robotIndex];
        optimalPhase = 0.7 * optimalPhase + 0.3 * stablePhase;
      }
    }
    
    // Add prediction based on phase velocity
    const memory = state.phaseMemory[robotIndex];
    if (memory.length > 2) {
      const velocity = memory[memory.length - 1] - memory[memory.length - 2];
      optimalPhase += velocity * config.predictionHorizon;
    }
    
    return optimalPhase % (2 * Math.PI);
  }
  
  /**
   * Adapt robot state toward target phase
   */
  function adaptState(currentState, targetPhase, rate) {
    const adaptedState = { ...currentState };
    const currentPhase = extractPhase(currentState);
    const phaseDiff = targetPhase - currentPhase;
    
    // Smooth adaptation
    const adaptation = Math.tanh(phaseDiff) * rate;
    
    if (currentState.type === 'quadruped') {
      // Adjust gait timing
      adaptedState.gaitOffset = (adaptedState.gaitOffset || 0) + adaptation;
    } else {
      // Adjust hand timing
      adaptedState.timeOffset = (adaptedState.timeOffset || 0) + adaptation * 0.1;
    }
    
    return adaptedState;
  }
  
  /**
   * Update coupling strengths based on coordination success
   */
  function updateCouplings(phases, energy) {
    const n = phases.length;
    const learningRate = 0.01;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const phaseDiff = Math.abs(phases[i] - phases[j]);
        const synchrony = Math.cos(phaseDiff);
        
        // Strengthen coupling for synchronized pairs
        // Weaken coupling for conflicting pairs
        const update = learningRate * (synchrony - 0.5) * (0.5 - energy);
        
        state.couplingMatrix[i][j] += update;
        state.couplingMatrix[j][i] += update;
        
        // Keep coupling in [0, 1]
        state.couplingMatrix[i][j] = Math.max(0, Math.min(1, state.couplingMatrix[i][j]));
        state.couplingMatrix[j][i] = state.couplingMatrix[i][j];
      }
    }
  }
  
  /**
   * Helper functions
   */
  function computePhaseDistance(key1, key2) {
    const p1 = key1.split(',').map(Number);
    const p2 = key2.split(',').map(Number);
    return Math.sqrt(p1.reduce((sum, v, i) => sum + Math.pow(v - p2[i], 2), 0));
  }
  
  function findNearestStablePoint(phases) {
    if (state.stablePoints.length === 0) return null;
    
    let minDist = Infinity;
    let nearest = null;
    
    for (const stable of state.stablePoints) {
      const dist = Math.sqrt(
        phases.reduce((sum, p, i) => sum + Math.pow(p - stable.phases[i], 2), 0)
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = stable;
      }
    }
    
    return nearest;
  }
  
  /**
   * Get coordination metrics
   */
  function getMetrics() {
    const recentEnergies = Array.from(state.energyLandscape.values()).slice(-10);
    const avgEnergy = recentEnergies.reduce((a, b) => a + b, 0) / recentEnergies.length || 0;
    
    return {
      systemEnergy: avgEnergy,
      stablePointCount: state.stablePoints.length,
      couplingStrength: state.couplingMatrix ? 
        state.couplingMatrix.flat().reduce((a, b) => a + b) / state.couplingMatrix.length : 0,
      convergenceRate: 0 // TODO: Calculate from phase history
    };
  }
  
  return {
    initialize,
    update,
    getMetrics,
    config,
    state
  };
}

/**
 * High-level API for emergent robot choreography
 */
export function createChoreographer() {
  const coordinator = createEmergentCoordinator();
  
  return {
    /**
     * Plan synchronized movement for robot ensemble
     */
    planMovement: (robots, targetPose, constraints = {}) => {
      // Implementation uses coordinator to find optimal paths
      // that maintain synchronization while reaching target
    },
    
    /**
     * Generate anticipatory movements
     */
    anticipate: (observedRobot, observingRobot, lookahead = 0.5) => {
      // Use phase prediction to anticipate movements
    },
    
    coordinator
  };
} 