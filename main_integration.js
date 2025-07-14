/**
 * Main Application Integration
 * Add this code to the existing main.js file in the pawzart repository
 */

// ========== IMPORTS TO ADD AT THE TOP ==========
import { createAdaptiveMotionFilter } from './utils/adaptiveMotionFilter.js';
import { enhancePerformance } from './utils/expressiveDynamics.js';
import { createPhaseSync } from './utils/tempoSync.js';
import { getRuntimeParam } from './utils/queryParams.js';

// ========== ADD TO CLASS CONSTRUCTOR OR INIT ==========
class App {
  constructor() {
    // ... existing code ...
    
    // Initialize enhancement modules
    this.initEnhancements();
    
    // Add GUI controls
    this.setupEnhancementGUI();
    
    // ... rest of existing code ...
  }
  
  /**
   * Initialize all enhancement modules
   */
  initEnhancements() {
    // Motion filter for each robot
    this.motionFilters = {
      leftHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      rightHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      go2Robot: createAdaptiveMotionFilter({ windowSize: 20 })
    };
    
    // Phase synchronizer for multi-robot coordination
    this.phaseSync = createPhaseSync({
      Kp: getRuntimeParam("Kp", 0.5),
      Ki: getRuntimeParam("Ki", 0.1)
    });
    
    // Enhancement flags
    this.enhancements = {
      filterEnabled: getRuntimeParam("filter", true),
      syncEnabled: getRuntimeParam("sync", true),
      dynamicsEnabled: getRuntimeParam("dynamics", true)
    };
    
    // Performance tracking
    this.performanceMetrics = {
      frameCount: 0,
      errorSum: 0,
      phaseJitter: []
    };
  }
  
  /**
   * Setup GUI controls for enhancements
   */
  setupEnhancementGUI() {
    const gui = this.gui; // Assuming dat.GUI instance exists
    
    // Main enhancement folder
    const enhanceFolder = gui.addFolder('🚀 Enhancements');
    
    // Motion Filter controls
    const filterFolder = enhanceFolder.addFolder('Motion Filter');
    filterFolder.add(this.enhancements, 'filterEnabled').name('Enable Filter');
    
    const filterParams = {
      windowSize: 15,
      gain: 0.9,
      noiseSigma: 0.005
    };
    
    filterFolder.add(filterParams, 'windowSize', 5, 32, 1)
      .name('Window Size')
      .onChange(value => {
        Object.values(this.motionFilters).forEach(filter => {
          filter.opts.windowSize = value;
        });
      });
    
    filterFolder.add(filterParams, 'gain', 0.1, 0.99, 0.01)
      .name('Filter Gain')
      .onChange(value => {
        Object.values(this.motionFilters).forEach(filter => {
          filter.opts.gain = value;
        });
      });
    
    // Tempo Sync controls
    const syncFolder = enhanceFolder.addFolder('Tempo Sync');
    syncFolder.add(this.enhancements, 'syncEnabled').name('Enable Sync');
    syncFolder.add(this.phaseSync.config, 'Kp', 0, 2, 0.01).name('P Gain');
    syncFolder.add(this.phaseSync.config, 'Ki', 0, 1, 0.01).name('I Gain');
    
    // Expressive Dynamics controls
    const dynamicsFolder = enhanceFolder.addFolder('Expressive Dynamics');
    dynamicsFolder.add(this.enhancements, 'dynamicsEnabled').name('Enable Dynamics');
    
    this.dynamicsParams = {
      rubato: getRuntimeParam("rubato", 0.06),
      velocityScale: getRuntimeParam("velscale", 1.0),
      phraseLength: getRuntimeParam("phrase", 16)
    };
    
    dynamicsFolder.add(this.dynamicsParams, 'rubato', 0, 0.15, 0.01)
      .name('Rubato Amount');
    dynamicsFolder.add(this.dynamicsParams, 'velocityScale', 0.5, 1.5, 0.01)
      .name('Velocity Scale');
    
    // Performance metrics display
    const metricsFolder = enhanceFolder.addFolder('📊 Metrics');
    this.metricsDisplay = {
      avgError: 0,
      phaseJitter: 0,
      fps: 0
    };
    
    metricsFolder.add(this.metricsDisplay, 'avgError').name('Avg Error').listen();
    metricsFolder.add(this.metricsDisplay, 'phaseJitter').name('Phase Jitter (ms)').listen();
    metricsFolder.add(this.metricsDisplay, 'fps').name('FPS').listen();
    
    enhanceFolder.open();
  }
  
  /**
   * Load and enhance control sequences
   */
  async loadControlSequences() {
    // Load original sequences (assuming loadNpySequence exists)
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
  
  // ========== UPDATE MAIN ANIMATION LOOP ==========
  animate() {
    requestAnimationFrame(() => this.animate());
    
    const dt = this.clock.getDelta(); // Assuming THREE.Clock exists
    
    // Physics simulation step
    if (this.mujoco && this.mjModel && this.mjData) {
      // Apply enhanced controls before physics step
      this.applyEnhancedControls(dt);
      
      // Step physics
      mujoco.mj_step(this.mjModel, this.mjData);
      
      // Update metrics
      this.updatePerformanceMetrics(dt);
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  /**
   * Apply all enhancements to control signals
   */
  applyEnhancedControls(dt) {
    const currentTime = this.mjData.time;
    
    // Process each robot's controls
    for (const [robotName, sequence] of Object.entries(this.sequences)) {
      // Find current control frame
      const frameData = this.getControlFrame(sequence, currentTime);
      if (!frameData) continue;
      
      let controls = frameData.controls.slice(); // Copy array
      
      // Step 1: Apply motion filtering
      if (this.enhancements.filterEnabled && this.motionFilters[robotName]) {
        controls = this.motionFilters[robotName](controls);
      }
      
      // Step 2: Apply phase synchronization (for multi-robot scenes)
      if (this.enhancements.syncEnabled && this.isMultiRobotScene()) {
        controls = this.applySynchronization(robotName, controls, currentTime, dt);
      }
      
      // Step 3: Set controls in MuJoCo
      this.setRobotControls(robotName, controls);
    }
  }
  
  /**
   * Get control frame at specific time
   * @param {Array} sequence - Control sequence [[time, controls], ...]
   * @param {number} time - Current simulation time
   * @returns {Object|null} Frame data or null
   */
  getControlFrame(sequence, time) {
    // Binary search for efficiency
    let left = 0;
    let right = sequence.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const frameTime = sequence[mid][0];
      
      if (Math.abs(frameTime - time) < 0.001) {
        return {
          time: frameTime,
          controls: sequence[mid][1],
          index: mid
        };
      }
      
      if (frameTime < time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // Return closest frame
    if (left < sequence.length) {
      return {
        time: sequence[left][0],
        controls: sequence[left][1],
        index: left
      };
    }
    
    return null;
  }
  
  /**
   * Apply phase synchronization between robots
   */
  applySynchronization(robotName, controls, time, dt) {
    if (robotName === 'go2Robot') {
      // Sync quadruped to piano hands
      const masterPhase = this.computeRobotPhase('leftHand', time);
      const slavePhase = this.computeRobotPhase(robotName, time);
      
      const adjustment = this.phaseSync.computeAdjustment(
        masterPhase, slavePhase, dt
      );
      
      // Apply adjustment as velocity scaling
      return controls.map(c => c * (1 + adjustment * 0.1));
    }
    
    return controls;
  }
  
  /**
   * Compute phase for a robot based on its cyclic motion
   */
  computeRobotPhase(robotName, time) {
    // Simple phase based on time and characteristic frequency
    const frequencies = {
      leftHand: 2.0,   // 2 Hz base frequency
      rightHand: 2.0,
      go2Robot: 2.5    // Slightly faster for quadruped
    };
    
    const freq = frequencies[robotName] || 2.0;
    return (time * freq * 2 * Math.PI) % (2 * Math.PI);
  }
  
  /**
   * Set control values in MuJoCo
   */
  setRobotControls(robotName, controls) {
    // Map robot names to actuator indices
    const actuatorMap = {
      leftHand: { start: 0, count: 20 },    // 20 DOF
      rightHand: { start: 20, count: 20 },  // 20 DOF
      go2Robot: { start: 40, count: 12 }    // 12 DOF
    };
    
    const mapping = actuatorMap[robotName];
    if (!mapping) return;
    
    // Set control values
    for (let i = 0; i < mapping.count && i < controls.length; i++) {
      this.mjData.ctrl[mapping.start + i] = controls[i];
    }
  }
  
  /**
   * Check if current scene has multiple robots
   */
  isMultiRobotScene() {
    return this.params.scene && 
           (this.params.scene.includes('combined') || 
            this.params.scene.includes('go2'));
  }
  
  /**
   * Update performance metrics for display
   */
  updatePerformanceMetrics(dt) {
    this.performanceMetrics.frameCount++;
    
    // Calculate average error (simplified)
    const errorNorm = this.calculateControlError();
    this.performanceMetrics.errorSum += errorNorm;
    
    // Update display every 30 frames
    if (this.performanceMetrics.frameCount % 30 === 0) {
      this.metricsDisplay.avgError = 
        (this.performanceMetrics.errorSum / 30).toFixed(4);
      this.metricsDisplay.fps = Math.round(1 / dt);
      
      // Reset accumulator
      this.performanceMetrics.errorSum = 0;
    }
    
    // Track phase jitter
    if (this.isMultiRobotScene()) {
      const jitter = this.calculatePhaseJitter();
      this.performanceMetrics.phaseJitter.push(jitter);
      
      // Keep last 100 samples
      if (this.performanceMetrics.phaseJitter.length > 100) {
        this.performanceMetrics.phaseJitter.shift();
      }
      
      // Calculate average jitter
      const avgJitter = this.performanceMetrics.phaseJitter.reduce(
        (sum, j) => sum + j, 0
      ) / this.performanceMetrics.phaseJitter.length;
      
      this.metricsDisplay.phaseJitter = (avgJitter * 1000).toFixed(1);
    }
  }
  
  /**
   * Calculate control error metric
   */
  calculateControlError() {
    // Simple L2 norm of control values
    let sum = 0;
    for (let i = 0; i < this.mjData.ctrl.length; i++) {
      sum += this.mjData.ctrl[i] * this.mjData.ctrl[i];
    }
    return Math.sqrt(sum / this.mjData.ctrl.length);
  }
  
  /**
   * Calculate phase jitter between robots
   */
  calculatePhaseJitter() {
    const time = this.mjData.time;
    const phase1 = this.computeRobotPhase('leftHand', time);
    const phase2 = this.computeRobotPhase('rightHand', time);
    
    let diff = phase1 - phase2;
    // Wrap to [-π, π]
    diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    
    return Math.abs(diff);
  }
}

// ========== EXPORT FOR TESTING ==========
export { App };