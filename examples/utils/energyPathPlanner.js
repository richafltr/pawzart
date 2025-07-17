/**
 * Energy-Efficient Path Planning
 * Finds optimal paths using energy minimization principles
 * Based on gradient descent and potential field methods
 */

import { getRuntimeParam } from "./queryParams.js";

/**
 * Create an energy-efficient path planner
 * @param {Object} options - Configuration options
 * @returns {Object} Path planner interface
 */
export function createEnergyPathPlanner(options = {}) {
  const config = {
    resolution: getRuntimeParam("pathRes", 0.05),    // Spatial resolution
    horizonSteps: getRuntimeParam("horizon", 50),    // Planning horizon
    energyWeight: getRuntimeParam("eWeight", 0.3),   // Energy vs time tradeoff
    smoothness: getRuntimeParam("smooth", 0.8),      // Path smoothness
    fieldDecay: 0.95,      // Potential field decay rate
    fieldStrength: 2.0,    // Field coupling strength
    ...options
  };
  
  // Internal state
  const state = {
    potentialField: null,   // 3D field representing energy landscape
    flowLines: [],          // Precomputed optimal flow paths
    obstacles: [],          // Environmental constraints
    targets: [],            // Goal configurations
    lastFieldUpdate: 0
  };
  
  /**
   * Initialize potential field for workspace
   * @param {Object} workspace - {min: [x,y,z], max: [x,y,z]}
   */
  function initializeField(workspace) {
    const dims = [
      Math.ceil((workspace.max[0] - workspace.min[0]) / config.resolution),
      Math.ceil((workspace.max[1] - workspace.min[1]) / config.resolution),
      Math.ceil((workspace.max[2] - workspace.min[2]) / config.resolution)
    ];
    
    // Create 3D potential field
    state.potentialField = {
      data: new Float32Array(dims[0] * dims[1] * dims[2]),
      dims,
      origin: workspace.min,
      resolution: config.resolution
    };
    
    // Initialize with uniform potential
    state.potentialField.data.fill(1.0);
  }
  
  /**
   * Plan optimal path from start to goal
   * @param {Array} start - Start configuration [x, y, z, ...]
   * @param {Array} goal - Goal configuration
   * @param {Object} robotModel - Robot kinematic model
   * @returns {Object} Path plan with waypoints and timing
   */
  function planPath(start, goal, robotModel) {
    if (!state.potentialField) {
      throw new Error("Field not initialized. Call initializeField first.");
    }
    
    // Update field based on current configuration
    updatePotentialField(start, goal, robotModel);
    
    // Find path through potential gradient
    const path = findGradientPath(start, goal, robotModel);
    
    // Optimize timing along path
    const trajectory = optimizeTiming(path, robotModel);
    
    // Add anticipatory adjustments
    const enhanced = addAnticipation(trajectory, robotModel);
    
    return {
      waypoints: enhanced.waypoints,
      timestamps: enhanced.timestamps,
      energy: enhanced.totalEnergy,
      avgPotential: enhanced.avgPotential
    };
  }
  
  /**
   * Update potential field based on current state
   * Uses standard potential field methods
   */
  function updatePotentialField(start, goal, robotModel) {
    const field = state.potentialField;
    const dt = 0.1;
    
    // Add goal as attractive potential
    addTarget(goal, 10.0);
    
    // Add repulsive potentials for obstacles
    state.obstacles.forEach(obs => addRepulsor(obs.position, obs.radius, 5.0));
    
    // Propagate potential using diffusion equation
    for (let iter = 0; iter < 10; iter++) {
      const newData = new Float32Array(field.data.length);
      
      for (let i = 1; i < field.dims[0] - 1; i++) {
        for (let j = 1; j < field.dims[1] - 1; j++) {
          for (let k = 1; k < field.dims[2] - 1; k++) {
            const idx = i + j * field.dims[0] + k * field.dims[0] * field.dims[1];
            
            // Laplacian (diffusion)
            const laplacian = 
              (getFieldValue(i+1, j, k) + getFieldValue(i-1, j, k) - 2 * field.data[idx]) +
              (getFieldValue(i, j+1, k) + getFieldValue(i, j-1, k) - 2 * field.data[idx]) +
              (getFieldValue(i, j, k+1) + getFieldValue(i, j, k-1) - 2 * field.data[idx]);
            
            // Update dynamics with decay and coupling
            const decay = config.fieldDecay;
            const coupling = config.fieldStrength;
            
            newData[idx] = field.data[idx] * decay + 
                          dt * coupling * laplacian +
                          dt * computeLocalPotential(i, j, k, robotModel);
          }
        }
      }
      
      field.data = newData;
    }
    
    state.lastFieldUpdate = Date.now();
  }
  
  /**
   * Find path following potential gradient
   */
  function findGradientPath(start, goal, robotModel) {
    const path = [start];
    let current = [...start];
    const stepSize = config.resolution * 2;
    const maxSteps = config.horizonSteps;
    
    for (let step = 0; step < maxSteps; step++) {
      // Compute gradient at current position
      const gradient = computePotentialGradient(current);
      
      // Move along gradient with momentum
      const momentum = path.length > 1 ? 
        current.map((c, i) => c - path[path.length - 2][i]) : 
        [0, 0, 0];
      
      const next = current.map((c, i) => {
        const gradStep = gradient[i] * stepSize;
        const momStep = momentum[i] * config.smoothness;
        return c + gradStep + momStep;
      });
      
      // Check constraints
      if (robotModel.isValidConfiguration(next)) {
        path.push(next);
        current = next;
        
        // Check if goal reached
        const dist = Math.sqrt(
          goal.slice(0, 3).reduce((sum, g, i) => sum + Math.pow(g - next[i], 2), 0)
        );
        if (dist < config.resolution * 3) break;
      } else {
        // Find nearest valid configuration
        const valid = findNearestValid(next, robotModel);
        if (valid) {
          path.push(valid);
          current = valid;
        } else {
          break; // Stuck
        }
      }
    }
    
    // Smooth path using weighted averaging
    return smoothPath(path);
  }
  
  /**
   * Optimize timing along path for minimal energy
   */
  function optimizeTiming(path, robotModel) {
    const n = path.length;
    const timestamps = [0];
    let totalEnergy = 0;
    
    for (let i = 1; i < n; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      
      // Compute configuration change
      const configDist = Math.sqrt(
        curr.reduce((sum, c, j) => sum + Math.pow(c - prev[j], 2), 0)
      );
      
      // Get potential at this point
      const potential = interpolateFieldValue(curr.slice(0, 3));
      
      // Time based on potential (high potential = slow movement)
      const baseTime = configDist / robotModel.maxVelocity;
      const timeScale = 2 - potential; // potential in [0, 1]
      const segmentTime = baseTime * timeScale;
      
      timestamps.push(timestamps[i - 1] + segmentTime);
      
      // Energy calculation
      const velocity = configDist / segmentTime;
      const acceleration = i > 1 ? 
        (velocity - (path[i-1].reduce((s, p, j) => s + Math.pow(p - path[i-2][j], 2), 0) ** 0.5) / 
         (timestamps[i-1] - timestamps[i-2])) / segmentTime : 0;
      
      totalEnergy += robotModel.mass * (velocity * velocity + 
                    config.energyWeight * acceleration * acceleration) * segmentTime;
    }
    
    return {
      waypoints: path,
      timestamps,
      totalEnergy,
      avgPotential: path.reduce((sum, p) => sum + interpolateFieldValue(p.slice(0, 3)), 0) / n
    };
  }
  
  /**
   * Add anticipatory adjustments based on future potential
   */
  function addAnticipation(trajectory, robotModel) {
    const enhanced = {
      waypoints: [],
      timestamps: [],
      totalEnergy: trajectory.totalEnergy,
      avgPotential: trajectory.avgPotential
    };
    
    for (let i = 0; i < trajectory.waypoints.length; i++) {
      const current = trajectory.waypoints[i];
      const lookahead = Math.min(i + 5, trajectory.waypoints.length - 1);
      
      if (lookahead > i) {
        // Compute future potential gradient
        const futureGradient = computePotentialGradient(trajectory.waypoints[lookahead]);
        
        // Anticipatory adjustment
        const adjustment = futureGradient.map(g => g * 0.1 * (lookahead - i) / 5);
        const adjusted = current.map((c, j) => c + adjustment[j % 3]);
        
        // Validate adjustment
        if (robotModel.isValidConfiguration(adjusted)) {
          enhanced.waypoints.push(adjusted);
        } else {
          enhanced.waypoints.push(current);
        }
      } else {
        enhanced.waypoints.push(current);
      }
      
      enhanced.timestamps.push(trajectory.timestamps[i]);
    }
    
    return enhanced;
  }
  
  /**
   * Helper functions
   */
  function getFieldValue(i, j, k) {
    const field = state.potentialField;
    if (i < 0 || i >= field.dims[0] || 
        j < 0 || j >= field.dims[1] || 
        k < 0 || k >= field.dims[2]) {
      return 0;
    }
    const idx = i + j * field.dims[0] + k * field.dims[0] * field.dims[1];
    return field.data[idx];
  }
  
  function interpolateFieldValue(pos) {
    const field = state.potentialField;
    const i = (pos[0] - field.origin[0]) / field.resolution;
    const j = (pos[1] - field.origin[1]) / field.resolution;
    const k = (pos[2] - field.origin[2]) / field.resolution;
    
    // Trilinear interpolation
    const i0 = Math.floor(i), i1 = i0 + 1;
    const j0 = Math.floor(j), j1 = j0 + 1;
    const k0 = Math.floor(k), k1 = k0 + 1;
    
    const fx = i - i0, fy = j - j0, fz = k - k0;
    
    const v000 = getFieldValue(i0, j0, k0);
    const v100 = getFieldValue(i1, j0, k0);
    const v010 = getFieldValue(i0, j1, k0);
    const v110 = getFieldValue(i1, j1, k0);
    const v001 = getFieldValue(i0, j0, k1);
    const v101 = getFieldValue(i1, j0, k1);
    const v011 = getFieldValue(i0, j1, k1);
    const v111 = getFieldValue(i1, j1, k1);
    
    return (1-fx) * (1-fy) * (1-fz) * v000 +
           fx * (1-fy) * (1-fz) * v100 +
           (1-fx) * fy * (1-fz) * v010 +
           fx * fy * (1-fz) * v110 +
           (1-fx) * (1-fy) * fz * v001 +
           fx * (1-fy) * fz * v101 +
           (1-fx) * fy * fz * v011 +
           fx * fy * fz * v111;
  }
  
  function computePotentialGradient(pos) {
    const eps = config.resolution;
    const gradient = [];
    
    for (let dim = 0; dim < 3; dim++) {
      const posPlus = [...pos];
      const posMinus = [...pos];
      posPlus[dim] += eps;
      posMinus[dim] -= eps;
      
      const valuePlus = interpolateFieldValue(posPlus.slice(0, 3));
      const valueMinus = interpolateFieldValue(posMinus.slice(0, 3));
      
      gradient[dim] = (valuePlus - valueMinus) / (2 * eps);
    }
    
    // Normalize gradient
    const mag = Math.sqrt(gradient.reduce((sum, g) => sum + g * g, 0));
    return mag > 0 ? gradient.map(g => g / mag) : [0, 0, 0];
  }
  
  function computeLocalPotential(i, j, k, robotModel) {
    // Local potential based on configuration space
    const field = state.potentialField;
    const pos = [
      field.origin[0] + i * field.resolution,
      field.origin[1] + j * field.resolution,
      field.origin[2] + k * field.resolution
    ];
    
    // Distance to nearest obstacle
    let minObsDist = Infinity;
    state.obstacles.forEach(obs => {
      const dist = Math.sqrt(
        pos.reduce((sum, p, idx) => sum + Math.pow(p - obs.position[idx], 2), 0)
      ) - obs.radius;
      minObsDist = Math.min(minObsDist, dist);
    });
    
    // Potential increases near obstacles
    const obsPotential = minObsDist > 0 ? 1 / (1 + minObsDist) : 10;
    
    // Potential decreases near targets
    let targetPotential = 0;
    state.targets.forEach(target => {
      const dist = Math.sqrt(
        pos.reduce((sum, p, idx) => sum + Math.pow(p - target.position[idx], 2), 0)
      );
      targetPotential -= target.strength / (1 + dist * dist);
    });
    
    return obsPotential + targetPotential;
  }
  
  function addTarget(position, strength) {
    state.targets.push({ position, strength });
  }
  
  function addRepulsor(position, radius, strength) {
    state.obstacles.push({ position, radius, strength });
  }
  
  function smoothPath(path) {
    if (path.length < 3) return path;
    
    const smoothed = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      // Weighted average based on local potential
      const potentialPrev = interpolateFieldValue(prev.slice(0, 3));
      const potentialCurr = interpolateFieldValue(curr.slice(0, 3));
      const potentialNext = interpolateFieldValue(next.slice(0, 3));
      
      const totalPotential = potentialPrev + potentialCurr + potentialNext;
      
      const smooth = curr.map((c, j) => 
        (prev[j] * potentialPrev + 
         c * potentialCurr * 2 + 
         next[j] * potentialNext) / (totalPotential + potentialCurr)
      );
      
      smoothed.push(smooth);
    }
    
    smoothed.push(path[path.length - 1]);
    return smoothed;
  }
  
  function findNearestValid(config, robotModel) {
    // Search in expanding spheres
    const searchRadius = config.resolution * 5;
    const samples = 20;
    
    for (let r = config.resolution; r <= searchRadius; r += config.resolution) {
      for (let i = 0; i < samples; i++) {
        // Fibonacci sphere sampling
        const y = 1 - (i / (samples - 1)) * 2;
        const radius = Math.sqrt(1 - y * y);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        
        const offset = [
          radius * Math.cos(theta) * r,
          y * r,
          radius * Math.sin(theta) * r
        ];
        
        const candidate = config.map((c, j) => c + (offset[j % 3] || 0));
        
        if (robotModel.isValidConfiguration(candidate)) {
          return candidate;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Public API
   */
  return {
    initializeField,
    planPath,
    setObstacles: (obstacles) => { state.obstacles = obstacles; },
    clearField: () => { state.targets = []; state.obstacles = []; },
    getFieldVisualization: () => state.potentialField,
    config
  };
} 