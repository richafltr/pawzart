/**
 * COMPLETE main.js integration
 * Includes ALL enhancements: filtering, sync, dynamics, coordination, path planning
 */

// ========== ADD THESE IMPORTS AT THE TOP ==========
import { createAdaptiveMotionFilter } from './utils/adaptiveMotionFilter.js';
import { enhancePerformance } from './utils/expressiveDynamics.js';
import { createPhaseSync } from './utils/tempoSync.js';
import { createEmergentCoordinator } from './utils/emergentCoordination.js';
import { createEnergyPathPlanner } from './utils/energyPathPlanner.js';
import { getRuntimeParam } from './utils/queryParams.js';

// ========== ADD TO CLASS CONSTRUCTOR ==========
class App {
  constructor() {
    // ... existing code ...
    
    // Initialize ALL enhancement modules
    this.initAllEnhancements();
    
    // Setup comprehensive GUI
    this.setupFullEnhancementGUI();
    
    // ... rest of existing code ...
  }
  
  /**
   * Initialize all enhancement systems
   */
  initAllEnhancements() {
    // Core enhancements
    this.motionFilters = {
      leftHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      rightHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      go2Robot: createAdaptiveMotionFilter({ windowSize: 20 })
    };
    
    // Phase synchronization
    this.phaseSync = createPhaseSync({
      Kp: getRuntimeParam("Kp", 0.5),
      Ki: getRuntimeParam("Ki", 0.1)
    });
    
    // Advanced coordination
    this.coordinator = createEmergentCoordinator({
      couplingStrength: getRuntimeParam("coupling", 0.7),
      adaptationRate: getRuntimeParam("adapt", 0.05)
    });
    
    // Path planning for Go2
    this.pathPlanner = createEnergyPathPlanner({
      resolution: getRuntimeParam("pathRes", 0.05),
      energyWeight: getRuntimeParam("eWeight", 0.3)
    });
    
    // Initialize workspace for path planning
    this.pathPlanner.initializeField({
      min: [-2, -2, 0],
      max: [2, 2, 2]
    });
    
    // Enhancement flags
    this.enhancements = {
      filterEnabled: getRuntimeParam("filter", true),
      syncEnabled: getRuntimeParam("sync", true),
      dynamicsEnabled: getRuntimeParam("dynamics", true),
      coordinationEnabled: getRuntimeParam("coord", true),
      pathPlanningEnabled: getRuntimeParam("path", true)
    };
    
    // Performance tracking
    this.performanceMetrics = {
      frameCount: 0,
      errorSum: 0,
      phaseJitter: [],
      coordinationEnergy: [],
      pathEfficiency: []
    };
  }
  
  /**
   * Setup comprehensive GUI controls
   */
  setupFullEnhancementGUI() {
    const gui = this.gui;
    
    // Main enhancement folder
    const enhanceFolder = gui.addFolder('🚀 Full Enhancement Suite');
    
    // === CORE ENHANCEMENTS ===
    const coreFolder = enhanceFolder.addFolder('Core Enhancements');
    
    // Motion Filter
    const filterFolder = coreFolder.addFolder('Motion Filter');
    filterFolder.add(this.enhancements, 'filterEnabled').name('Enable');
    const filterParams = { windowSize: 15, gain: 0.9, noiseSigma: 0.005 };
    filterFolder.add(filterParams, 'windowSize', 5, 32, 1).onChange(v => {
      Object.values(this.motionFilters).forEach(f => f.opts.windowSize = v);
    });
    filterFolder.add(filterParams, 'gain', 0.1, 0.99, 0.01).onChange(v => {
      Object.values(this.motionFilters).forEach(f => f.opts.gain = v);
    });
    
    // Tempo Sync
    const syncFolder = coreFolder.addFolder('Tempo Sync');
    syncFolder.add(this.enhancements, 'syncEnabled').name('Enable');
    syncFolder.add(this.phaseSync.config, 'Kp', 0, 2, 0.01).name('P Gain');
    syncFolder.add(this.phaseSync.config, 'Ki', 0, 1, 0.01).name('I Gain');
    
    // Expressive Dynamics
    const dynamicsFolder = coreFolder.addFolder('Expressive Dynamics');
    dynamicsFolder.add(this.enhancements, 'dynamicsEnabled').name('Enable');
    this.dynamicsParams = {
      rubato: getRuntimeParam("rubato", 0.06),
      velocityScale: getRuntimeParam("velscale", 1.0)
    };
    dynamicsFolder.add(this.dynamicsParams, 'rubato', 0, 0.15, 0.01);
    dynamicsFolder.add(this.dynamicsParams, 'velocityScale', 0.5, 1.5, 0.01);
    
    // === ADVANCED FEATURES ===
    const advancedFolder = enhanceFolder.addFolder('Advanced Features');
    
    // Emergent Coordination
    const coordFolder = advancedFolder.addFolder('Emergent Coordination');
    coordFolder.add(this.enhancements, 'coordinationEnabled').name('Enable');
    coordFolder.add(this.coordinator.config, 'couplingStrength', 0, 1, 0.01);
    coordFolder.add(this.coordinator.config, 'adaptationRate', 0, 0.2, 0.01);
    coordFolder.add(this.coordinator.config, 'predictionHorizon', 0.1, 2, 0.1);
    
    // Path Planning
    const pathFolder = advancedFolder.addFolder('Energy Path Planning');
    pathFolder.add(this.enhancements, 'pathPlanningEnabled').name('Enable');
    pathFolder.add(this.pathPlanner.config, 'energyWeight', 0, 1, 0.01);
    pathFolder.add(this.pathPlanner.config, 'smoothness', 0, 1, 0.01);
    pathFolder.add({
      planNewPath: () => this.planGo2Path()
    }, 'planNewPath').name('Plan New Path');
    
    // === METRICS DISPLAY ===
    const metricsFolder = enhanceFolder.addFolder('📊 Performance Metrics');
    this.metricsDisplay = {
      avgError: 0,
      phaseJitter: 0,
      coordinationEnergy: 0,
      pathEfficiency: 0,
      fps: 0
    };
    
    metricsFolder.add(this.metricsDisplay, 'avgError').name('Avg Error').listen();
    metricsFolder.add(this.metricsDisplay, 'phaseJitter').name('Jitter (ms)').listen();
    metricsFolder.add(this.metricsDisplay, 'coordinationEnergy').name('Coord Energy').listen();
    metricsFolder.add(this.metricsDisplay, 'pathEfficiency').name('Path Efficiency').listen();
    metricsFolder.add(this.metricsDisplay, 'fps').name('FPS').listen();
    
    enhanceFolder.open();
  }
  
  /**
   * Load and enhance control sequences
   */
  async loadControlSequences() {
    // Load original sequences
    this.sequences = {
      leftHand: await loadNpySequence('scenes/piano_with_shadow_hands/left_hand.npy'),
      rightHand: await loadNpySequence('scenes/piano_with_shadow_hands/right_hand.npy')
    };
    
    // Apply expressive dynamics if enabled
    if (this.enhancements.dynamicsEnabled) {
      for (const [name, sequence] of Object.entries(this.sequences)) {
        this.sequences[name] = enhancePerformance(sequence, 42 + name.charCodeAt(0));
      }
    }
  }
  
  // ========== ENHANCED ANIMATION LOOP ==========
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const dt = this.clock.getDelta();
    
    if (this.mujoco && this.mjModel && this.mjData) {
      // Apply ALL enhancements
      this.applyFullEnhancements(dt);
      
      // Step physics
      mujoco.mj_step(this.mjModel, this.mjData);
      
      // Update metrics
      this.updateFullMetrics(dt);
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Apply all enhancement systems
   */
  applyFullEnhancements(dt) {
    const currentTime = this.mjData.time;
    
    // Collect all robot states
    const robotStates = this.collectRobotStates();
    
    // Apply emergent coordination if enabled
    let coordinatedStates = robotStates;
    if (this.enhancements.coordinationEnabled) {
      coordinatedStates = this.coordinator.update(robotStates, dt);
    }
    
    // Process each robot's controls
    coordinatedStates.forEach((state, idx) => {
      const robotName = ['leftHand', 'rightHand', 'go2Robot'][idx];
      if (!robotName) return;
      
      // Get control sequence
      const sequence = this.sequences[robotName];
      if (!sequence) return;
      
      const frameData = this.getControlFrame(sequence, currentTime);
      if (!frameData) return;
      
      let controls = frameData.controls.slice();
      
      // Apply motion filtering
      if (this.enhancements.filterEnabled && this.motionFilters[robotName]) {
        controls = this.motionFilters[robotName](controls);
      }
      
      // Apply phase synchronization
      if (this.enhancements.syncEnabled && robotName === 'go2Robot') {
        controls = this.applySynchronization(robotName, controls, currentTime, dt);
      }
      
      // Apply coordination adjustments
      if (this.enhancements.coordinationEnabled) {
        controls = this.applyCoordinationAdjustments(controls, state, coordinatedStates[idx]);
      }
      
      // Set controls
      this.setRobotControls(robotName, controls);
    });
    
    // Update Go2 path if planning enabled
    if (this.enhancements.pathPlanningEnabled && this.go2NeedsNewPath()) {
      this.executeGo2PathPlanning(dt);
    }
  }
  
  /**
   * Collect current robot states for coordination
   */
  collectRobotStates() {
    const states = [];
    
    // Left hand state
    states.push({
      type: 'hand',
      fingerPositions: this.getFingerPositions('left'),
      position: this.getHandPosition('left')
    });
    
    // Right hand state
    states.push({
      type: 'hand',
      fingerPositions: this.getFingerPositions('right'),
      position: this.getHandPosition('right')
    });
    
    // Go2 state
    states.push({
      type: 'quadruped',
      legPositions: this.getGo2LegPositions(),
      position: this.getGo2Position()
    });
    
    return states;
  }
  
  /**
   * Plan path for Go2 robot
   */
  planGo2Path() {
    const start = this.getGo2Position();
    const goal = this.getPianoPosition();
    
    const robotModel = {
      mass: 15.0,
      maxVelocity: 1.5,
      isValidConfiguration: (config) => {
        // Simple collision check
        return config[2] >= 0; // Above ground
      }
    };
    
    this.go2Path = this.pathPlanner.planPath(start, goal, robotModel);
    this.go2PathIndex = 0;
  }
  
  /**
   * Execute Go2 path following
   */
  executeGo2PathPlanning(dt) {
    if (!this.go2Path || this.go2PathIndex >= this.go2Path.waypoints.length) {
      return;
    }
    
    const waypoint = this.go2Path.waypoints[this.go2PathIndex];
    const currentPos = this.getGo2Position();
    
    // Check if reached waypoint
    const dist = Math.sqrt(
      waypoint.slice(0, 3).reduce((sum, w, i) => sum + Math.pow(w - currentPos[i], 2), 0)
    );
    
    if (dist < 0.1) {
      this.go2PathIndex++;
    }
    
    // Apply control to move toward waypoint
    this.setGo2Target(waypoint);
  }
  
  /**
   * Apply coordination adjustments to controls
   */
  applyCoordinationAdjustments(controls, currentState, targetState) {
    // Extract timing adjustment from state difference
    const timingAdjust = targetState.timeOffset || targetState.gaitOffset || 0;
    
    // Apply as velocity scaling
    return controls.map(c => c * (1 + timingAdjust * 0.1));
  }
  
  /**
   * Update all performance metrics
   */
  updateFullMetrics(dt) {
    this.performanceMetrics.frameCount++;
    
    // Basic metrics
    const errorNorm = this.calculateControlError();
    this.performanceMetrics.errorSum += errorNorm;
    
    // Coordination metrics
    if (this.enhancements.coordinationEnabled) {
      const coordMetrics = this.coordinator.getMetrics();
      this.performanceMetrics.coordinationEnergy.push(coordMetrics.systemEnergy);
      if (this.performanceMetrics.coordinationEnergy.length > 100) {
        this.performanceMetrics.coordinationEnergy.shift();
      }
    }
    
    // Update display every 30 frames
    if (this.performanceMetrics.frameCount % 30 === 0) {
      this.metricsDisplay.avgError = (this.performanceMetrics.errorSum / 30).toFixed(4);
      this.metricsDisplay.fps = Math.round(1 / dt);
      
      if (this.performanceMetrics.coordinationEnergy.length > 0) {
        const avgEnergy = this.performanceMetrics.coordinationEnergy.reduce((a, b) => a + b, 0) / 
                         this.performanceMetrics.coordinationEnergy.length;
        this.metricsDisplay.coordinationEnergy = avgEnergy.toFixed(3);
      }
      
      // Reset accumulators
      this.performanceMetrics.errorSum = 0;
    }
  }
  
  // ========== HELPER FUNCTIONS ==========
  
  getControlFrame(sequence, time) {
    // Binary search implementation (same as before)
    let left = 0;
    let right = sequence.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const frameTime = sequence[mid][0];
      
      if (Math.abs(frameTime - time) < 0.001) {
        return { time: frameTime, controls: sequence[mid][1], index: mid };
      }
      
      if (frameTime < time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    if (left < sequence.length) {
      return {
        time: sequence[left][0],
        controls: sequence[left][1],
        index: left
      };
    }
    
    return null;
  }
  
  // Implement remaining helper functions based on your MuJoCo setup
  getFingerPositions(hand) { /* Extract from mjData */ }
  getHandPosition(hand) { /* Extract from mjData */ }
  getGo2LegPositions() { /* Extract from mjData */ }
  getGo2Position() { /* Extract from mjData */ }
  getPianoPosition() { /* Known position */ }
  go2NeedsNewPath() { /* Logic to determine */ }
  setGo2Target(position) { /* Set in mjData */ }
  calculateControlError() { /* Same as before */ }
  computeRobotPhase(robotName, time) { /* Same as before */ }
  setRobotControls(robotName, controls) { /* Same as before */ }
  applySynchronization(robotName, controls, time, dt) { /* Same as before */ }
}