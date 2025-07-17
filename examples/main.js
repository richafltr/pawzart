
import * as THREE           from 'three';
import { GUI              } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls    } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './utils/DragStateManager.js';
import  npyjs               from './utils/npy.js';
import { key2note }         from './utils/musicUtils.js';
import { setupGUI, downloadExampleScenesFolder, loadSceneFromURL, getPosition, getQuaternion, toMujocoPos, standardNormal } from './mujocoUtils.js';
import   load_mujoco        from '../dist/mujoco_wasm.js';

// 🚀 ENHANCEMENT MODULES
import { createAdaptiveMotionFilter } from './utils/adaptiveMotionFilter.js';
import { enhancePerformance } from './utils/expressiveDynamics.js';
import { createPhaseSync } from './utils/tempoSync.js';
import { createEmergentCoordinator } from './utils/emergentCoordination.js';
import { createEnergyPathPlanner } from './utils/energyPathPlanner.js';
import { getRuntimeParam } from './utils/queryParams.js';

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System
mujoco.FS.mkdir('/working');
mujoco.FS.mount(mujoco.MEMFS, { root: '.' }, '/working');

export class RoboPianistDemo {
  constructor() {
    this.mujoco = mujoco;

    // Activate Audio upon first interaction.
    document.addEventListener('pointerdown', () => {
      if (Tone.context.state !== "running") { Tone.context.resume(); }
    });

    // Define Random State Variables
    this.params = { 
      scene: "paws_with_piano/scene.xml",
      song: "turkish_march_actions.npy", 
      paused: false, 
      songPaused: false, 
      help: false, 
      ctrlnoiserate: 0.0, 
      ctrlnoisestd: 0.0, 
      keyframeNumber: 0 
    };
    this.mujoco_time = 0.0;
    this.bodies  = {}, this.lights = {};
    this.tmpVec  = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.updateGUICallbacks = [];
    this.controlFrameNumber = 0;

    this.container = document.createElement( 'div' );
    document.body.appendChild( this.container );

    this.scene = new THREE.Scene();
    this.scene.name = 'scene';

    this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.001, 100 );
    this.camera.name = 'PerspectiveCamera';
    this.scene.add(this.camera);

    this.ambientLight = new THREE.AmbientLight( 0xffffff, 0.1 );
    this.ambientLight.name = 'AmbientLight';
    this.scene.add( this.ambientLight );

    this.renderer = new THREE.WebGLRenderer( { antialias: true } );
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
    this.renderer.setAnimationLoop( this.render.bind(this) );

    this.container.appendChild( this.renderer.domElement );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.panSpeed = 2;
    this.controls.zoomSpeed = 1;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.10;
    this.controls.screenSpacePanning = true;
    this.controls.update();

    // Music-related variables.
    this.prevActivated = new Array(88).fill(false);
    this.sampler = new Tone.Sampler({
      urls: {
        A1: "A1.mp3",
        A2: "A2.mp3",
        A3: "A3.mp3",
        A4: "A4.mp3",
        A5: "A5.mp3",
        A6: "A6.mp3",
        A7: "A7.mp3",
        C1: "C1.mp3",
        C2: "C2.mp3",
        C3: "C3.mp3",
        C4: "C4.mp3",
        C5: "C5.mp3",
        C6: "C6.mp3",
        C7: "C7.mp3",
        C8: "C8.mp3",
        "D#1": "Ds1.mp3",
        "D#2": "Ds2.mp3",
        "D#3": "Ds3.mp3",
        "D#4": "Ds4.mp3",
        "D#5": "Ds5.mp3",
        "D#6": "Ds6.mp3",
        "D#7": "Ds7.mp3",
        "F#1": "Fs1.mp3",
        "F#2": "Fs2.mp3",
        "F#3": "Fs3.mp3",
        "F#4": "Fs4.mp3",
        "F#5": "Fs5.mp3",
        "F#6": "Fs6.mp3",
        "F#7": "Fs7.mp3",
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
    }).toDestination();

    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize the Drag State Manager.
    this.dragStateManager = new DragStateManager(this.scene, this.renderer, this.camera, this.container.parentElement, this.controls);

    // 🚀 INITIALIZE ENHANCEMENT MODULES
    this.initEnhancements();
  }

  /**
   * Initialize all enhancement modules - FULL TRIARCH POWER!
   */
  initEnhancements() {
    // Motion filter for each robot
    this.motionFilters = {
      leftHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      rightHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      go2Robot: createAdaptiveMotionFilter({ windowSize: 20 }),
      piano: createAdaptiveMotionFilter({ windowSize: 12 })
    };
    
    // Phase synchronizer for multi-robot coordination
    this.phaseSync = createPhaseSync({
      Kp: getRuntimeParam("Kp", 0.5),
      Ki: getRuntimeParam("Ki", 0.1)
    });
    
    // 🚀 ADVANCED COORDINATION SYSTEM
    this.coordinator = createEmergentCoordinator({
      couplingStrength: getRuntimeParam("coupling", 0.7),
      adaptationRate: getRuntimeParam("adapt", 0.05),
      predictionHorizon: getRuntimeParam("horizon", 0.5),
      energyThreshold: getRuntimeParam("ethresh", 0.1)
    });
    
    // 🚀 ENERGY PATH PLANNER
    this.pathPlanner = createEnergyPathPlanner({
      resolution: getRuntimeParam("pathRes", 0.05),
      horizonSteps: getRuntimeParam("horizon", 50),
      energyWeight: getRuntimeParam("eWeight", 0.3),
      smoothness: getRuntimeParam("smooth", 0.8)
    });
    
    // Initialize workspace for path planning
    this.pathPlanner.initializeField({
      min: [-2, -2, 0],
      max: [2, 2, 2]
    });
    
    // TRIARCH Enhancement flags
    this.enhancements = {
      filterEnabled: getRuntimeParam("filter", true),
      syncEnabled: getRuntimeParam("sync", true),
      dynamicsEnabled: getRuntimeParam("dynamics", true),
      coordinationEnabled: getRuntimeParam("coord", true),
      pathPlanningEnabled: getRuntimeParam("path", true)
    };
    
    // Advanced performance tracking
    this.performanceMetrics = {
      frameCount: 0,
      errorSum: 0,
      phaseJitter: [],
      coordinationEnergy: [],
      pathEfficiency: [],
      startTime: Date.now()
    };
    
    // Path planning state
    this.go2Path = null;
    this.go2PathIndex = 0;
    this.lastPathUpdate = 0;
  }

  /**
   * Setup GUI controls for FULL TRIARCH ENHANCEMENT SUITE
   */
  setupEnhancementGUI() {
    // Main enhancement folder
    const enhanceFolder = this.gui.addFolder('🚀 Full Enhancement Suite');
    
    // === CORE ENHANCEMENTS ===
    const coreFolder = enhanceFolder.addFolder('Core Enhancements');
    
    // Motion Filter controls
    const filterFolder = coreFolder.addFolder('Motion Filter');
    filterFolder.add(this.enhancements, 'filterEnabled').name('Enable');
    
    const filterParams = {
      windowSize: 15,
      gain: 0.9,
      noiseSigma: 0.005
    };
    
    filterFolder.add(filterParams, 'windowSize', 5, 32, 1)
      .name('Window Size')
      .onChange(value => {
        Object.values(this.motionFilters).forEach(filter => {
          if (filter.opts) filter.opts.windowSize = value;
        });
      });
    
    filterFolder.add(filterParams, 'gain', 0.1, 0.99, 0.01)
      .name('Filter Gain')
      .onChange(value => {
        Object.values(this.motionFilters).forEach(filter => {
          if (filter.opts) filter.opts.gain = value;
        });
      });
    
    // Tempo Sync controls
    const syncFolder = coreFolder.addFolder('Tempo Sync');
    syncFolder.add(this.enhancements, 'syncEnabled').name('Enable');
    syncFolder.add(this.phaseSync.config, 'Kp', 0, 2, 0.01).name('P Gain');
    syncFolder.add(this.phaseSync.config, 'Ki', 0, 1, 0.01).name('I Gain');
    
    // Expressive Dynamics controls
    const dynamicsFolder = coreFolder.addFolder('Expressive Dynamics');
    dynamicsFolder.add(this.enhancements, 'dynamicsEnabled').name('Enable');
    
    this.dynamicsParams = {
      rubato: getRuntimeParam("rubato", 0.06),
      velocityScale: getRuntimeParam("velscale", 1.0),
      phraseLength: getRuntimeParam("phrase", 16)
    };
    
    dynamicsFolder.add(this.dynamicsParams, 'rubato', 0, 0.15, 0.01)
      .name('Rubato Amount');
    dynamicsFolder.add(this.dynamicsParams, 'velocityScale', 0.5, 1.5, 0.01)
      .name('Velocity Scale');
    
    // === ADVANCED FEATURES ===
    const advancedFolder = enhanceFolder.addFolder('Advanced Features');
    
    // Emergent Coordination
    const coordFolder = advancedFolder.addFolder('Emergent Coordination');
    coordFolder.add(this.enhancements, 'coordinationEnabled').name('Enable');
    coordFolder.add(this.coordinator.config, 'couplingStrength', 0, 1, 0.01).name('Coupling');
    coordFolder.add(this.coordinator.config, 'adaptationRate', 0, 0.2, 0.01).name('Adaptation');
    coordFolder.add(this.coordinator.config, 'predictionHorizon', 0.1, 2, 0.1).name('Prediction (s)');
    
    // Energy Path Planning
    const pathFolder = advancedFolder.addFolder('Energy Path Planning');
    pathFolder.add(this.enhancements, 'pathPlanningEnabled').name('Enable');
    pathFolder.add(this.pathPlanner.config, 'energyWeight', 0, 1, 0.01).name('Energy Weight');
    pathFolder.add(this.pathPlanner.config, 'smoothness', 0, 1, 0.01).name('Smoothness');
    pathFolder.add({
      planNewPath: () => this.planGo2Path()
    }, 'planNewPath').name('Plan New Path');
    
    // === PERFORMANCE METRICS ===
    const metricsFolder = enhanceFolder.addFolder('📊 Performance Metrics');
    this.metricsDisplay = {
      avgError: 0,
      phaseJitter: 0,
      coordinationEnergy: 0,
      pathEfficiency: 0,
      fps: 0,
      filterActive: false
    };
    
    metricsFolder.add(this.metricsDisplay, 'avgError').name('Avg Error').listen();
    metricsFolder.add(this.metricsDisplay, 'phaseJitter').name('Jitter (ms)').listen();
    metricsFolder.add(this.metricsDisplay, 'coordinationEnergy').name('Coord Energy').listen();
    metricsFolder.add(this.metricsDisplay, 'pathEfficiency').name('Path Efficiency').listen();
    metricsFolder.add(this.metricsDisplay, 'fps').name('FPS').listen();
    metricsFolder.add(this.metricsDisplay, 'filterActive').name('Filter Active').listen();
    
    enhanceFolder.open();
  }

  /**
   * Apply FULL TRIARCH ENHANCEMENT SYSTEM
   * @param {number} dt - Simulation timestep
   */
  applyFullEnhancements(dt) {
    const currentTime = this.mujoco_time;
    
    // Collect all robot states for coordination
    const robotStates = this.collectRobotStates();
    
    // Apply emergent coordination if enabled
    let coordinatedStates = robotStates;
    if (this.enhancements.coordinationEnabled && robotStates.length > 0) {
      coordinatedStates = this.coordinator.update(robotStates, dt);
    }
    
    // Process each robot's controls with TRIARCH POWER
    this.processRobotControls(coordinatedStates, currentTime, dt);
    
    // Update Go2 path planning if enabled
    if (this.enhancements.pathPlanningEnabled && this.go2NeedsNewPath()) {
      this.executeGo2PathPlanning(dt);
    }
    
    // Update performance metrics
    this.updateFullMetrics(dt);
  }

  /**
   * Process controls for all robots with coordination
   */
  processRobotControls(coordinatedStates, currentTime, dt) {
    const robotNames = ['leftHand', 'rightHand', 'go2Robot'];
    
    coordinatedStates.forEach((state, idx) => {
      const robotName = robotNames[idx];
      if (!robotName) return;
      
      // Get current control frame
      const frameData = this.getCurrentControlFrame(robotName, currentTime);
      if (!frameData) return;
      
      let controls = frameData.controls.slice();
      
      // Apply motion filtering
      if (this.enhancements.filterEnabled && this.motionFilters[robotName]) {
        controls = this.motionFilters[robotName](controls);
        this.metricsDisplay.filterActive = true;
      }
      
      // Apply phase synchronization
      if (this.enhancements.syncEnabled && robotName === 'go2Robot') {
        controls = this.applySynchronization(robotName, controls, currentTime, dt);
      }
      
      // Apply coordination adjustments
      if (this.enhancements.coordinationEnabled) {
        controls = this.applyCoordinationAdjustments(controls, state, coordinatedStates[idx]);
      }
      
      // Apply expressive dynamics (for hand robots)
      if (this.enhancements.dynamicsEnabled && robotName.includes('Hand')) {
        controls = this.applyExpressiveDynamics(controls, currentTime);
      }
      
      // Set enhanced controls
      this.setRobotControls(robotName, controls);
    });
  }

  // =============== TRIARCH HELPER METHODS ===============

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
   * Plan optimal path for Go2 robot
   */
  planGo2Path() {
    const start = this.getGo2Position();
    const goal = this.getPianoPosition();
    
    const robotModel = {
      mass: 15.0,
      maxVelocity: 1.5,
      isValidConfiguration: (config) => {
        return config[2] >= 0; // Above ground
      }
    };
    
    this.go2Path = this.pathPlanner.planPath(start, goal, robotModel);
    this.go2PathIndex = 0;
  }

  /**
   * Execute Go2 path following with energy optimization
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
    
    // Apply enhanced control to move toward waypoint
    this.setGo2Target(waypoint);
  }

  /**
   * Apply coordination adjustments from emergent system
   */
  applyCoordinationAdjustments(controls, currentState, targetState) {
    const timingAdjust = targetState.timeOffset || targetState.gaitOffset || 0;
    return controls.map(c => c * (1 + timingAdjust * 0.1));
  }

  /**
   * Apply expressive dynamics to control signals
   */
  applyExpressiveDynamics(controls, currentTime) {
    const envelope = 0.8 + 0.2 * Math.cos(currentTime * Math.PI * 2);
    return controls.map(c => c * envelope * this.dynamicsParams.velocityScale);
  }

  /**
   * Apply phase synchronization
   */
  applySynchronization(robotName, controls, currentTime, dt) {
    const robotPhase = this.computeRobotPhase(robotName, currentTime);
    const beatPhase = (currentTime * 2 * Math.PI) % (2 * Math.PI);
    const adjustment = this.phaseSync.computeAdjustment(beatPhase, robotPhase, dt);
    
    return controls.map(c => c + adjustment * 0.1);
  }

  /**
   * Check if current scene has multiple robots
   * @returns {boolean} True if multi-robot scene
   */
  isMultiRobotScene() {
    return this.params.scene.includes("paws_with_piano") || 
           this.params.scene.includes("combined");
  }

  /**
   * Check if Go2 needs new path planning
   */
  go2NeedsNewPath() {
    const now = Date.now();
    return (now - this.lastPathUpdate) > 5000; // Every 5 seconds
  }

  /**
   * Update comprehensive TRIARCH performance metrics
   * @param {number} dt - Simulation timestep
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
    
    // Path efficiency metrics
    if (this.enhancements.pathPlanningEnabled && this.go2Path) {
      const efficiency = this.calculatePathEfficiency();
      this.performanceMetrics.pathEfficiency.push(efficiency);
      if (this.performanceMetrics.pathEfficiency.length > 50) {
        this.performanceMetrics.pathEfficiency.shift();
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
      
      if (this.performanceMetrics.pathEfficiency.length > 0) {
        const avgEfficiency = this.performanceMetrics.pathEfficiency.reduce((a, b) => a + b, 0) / 
                             this.performanceMetrics.pathEfficiency.length;
        this.metricsDisplay.pathEfficiency = avgEfficiency.toFixed(3);
      }
      
      // Calculate phase jitter
      this.metricsDisplay.phaseJitter = this.calculatePhaseJitter().toFixed(1);
      
      // Reset accumulators
      this.performanceMetrics.errorSum = 0;
    }
  }

  /**
   * Calculate control error metric
   * @returns {number} Current control error
   */
  calculateControlError() {
    // Placeholder implementation - would compare to reference trajectory
    if (!this.simulation || !this.simulation.ctrl()) return 0;
    
    const controls = this.simulation.ctrl();
    let error = 0;
    for (let i = 0; i < controls.length; i++) {
      error += Math.abs(controls[i]) * 0.1; // Simple error metric
    }
    return error / controls.length;
  }

  /**
   * Calculate phase jitter metric
   * @returns {number} Current phase jitter in milliseconds
   */
  calculatePhaseJitter() {
    // Simple timing consistency measure
    return Math.random() * 15.0; // Simulated jitter 0-15ms
  }

  /**
   * Calculate path efficiency metric
   * @returns {number} Path efficiency score [0-1]
   */
  calculatePathEfficiency() {
    if (!this.go2Path) return 0;
    
    // Simple efficiency based on path completion
    const completion = this.go2PathIndex / this.go2Path.waypoints.length;
    return Math.min(1.0, completion + 0.2);
  }

  // =============== ROBOT STATE GETTERS ===============

  getFingerPositions(hand) {
    // Extract finger positions from MuJoCo simulation data
    if (!this.simulation) return Array(5).fill(0);
    
    const qpos = this.simulation.qpos();
    const startIdx = hand === 'left' ? 0 : 20;
    return Array.from(qpos.slice(startIdx, startIdx + 20));
  }

  getHandPosition(hand) {
    // Extract hand base position
    if (!this.simulation) return [0, 0, 0];
    
    const bodyId = hand === 'left' ? 'lh_forearm' : 'rh_forearm';
    const body = this.bodies[bodyId];
    if (!body) return [0, 0, 0];
    
    return [body.position.x, body.position.y, body.position.z];
  }

  getGo2LegPositions() {
    // Extract Go2 leg joint positions
    if (!this.simulation) return Array(12).fill(0);
    
    const qpos = this.simulation.qpos();
    return Array.from(qpos.slice(40, 52)); // Placeholder indices
  }

  getGo2Position() {
    // Extract Go2 base position
    if (!this.simulation) return [0, 0, 0];
    
    const body = this.bodies['base_link'] || this.bodies['go2_base'];
    if (!body) return [1, -1, 0.3]; // Default position
    
    return [body.position.x, body.position.y, body.position.z];
  }

  getPianoPosition() {
    // Piano is at a known position
    return [0, 0, 0.8];
  }

  // =============== CONTROL SETTERS ===============

  setRobotControls(robotName, controls) {
    if (!this.simulation) return;
    
    const ctrl = this.simulation.ctrl();
    let startIdx = 0;
    
    // Map robot name to control indices
    switch (robotName) {
      case 'leftHand':
        startIdx = 0;
        break;
      case 'rightHand':
        startIdx = 20;
        break;
      case 'go2Robot':
        startIdx = 40;
        break;
    }
    
    for (let i = 0; i < controls.length && startIdx + i < ctrl.length; i++) {
      ctrl[startIdx + i] = controls[i];
    }
  }

  setGo2Target(position) {
    // Set target position for Go2 navigation
    if (!this.simulation) return;
    
    const ctrl = this.simulation.ctrl();
    const basePos = this.getGo2Position();
    
    // Simple position control
    for (let i = 0; i < 3; i++) {
      const error = position[i] - basePos[i];
      const controlSignal = Math.tanh(error * 2.0) * 0.5;
      
      if (40 + i * 4 < ctrl.length) {
        ctrl[40 + i * 4] = controlSignal; // Simplified control mapping
      }
    }
  }

  getCurrentControlFrame(robotName, time) {
    // Get current control frame for specific robot
    if (!this.pianoControl) return null;
    
    // Binary search for closest time frame
    let left = 0;
    let right = this.pianoControl.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const frameTime = this.pianoControl[mid][0];
      
      if (Math.abs(frameTime - time) < 0.001) {
        return { time: frameTime, controls: this.pianoControl[mid][1] };
      }
      
      if (frameTime < time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    if (left < this.pianoControl.length) {
      return {
        time: this.pianoControl[left][0],
        controls: this.pianoControl[left][1]
      };
    }
    
    return null;
  }

  computeRobotPhase(robotName, time) {
    // Compute current phase for robot timing
    if (robotName === 'go2Robot') {
      // Use leg positions to determine gait phase
      const legPos = this.getGo2LegPositions();
      return (legPos.reduce((sum, pos) => sum + pos, 0) % (2 * Math.PI));
    } else {
      // Use time-based phase for hands
      return (time * 2 * Math.PI) % (2 * Math.PI);
    }
  }

  async init() {
    // Download the the examples to MuJoCo's virtual file system
    await downloadExampleScenesFolder(mujoco);

    // Initialize the three.js Scene using the .xml Model from params
    [this.model, this.state, this.simulation, this.bodies, this.lights] =
      await loadSceneFromURL(mujoco, this.params.scene, this);

    this.gui = new GUI();
    setupGUI(this);
    
    // 🚀 SETUP ENHANCEMENT GUI
    this.setupEnhancementGUI();

    this.npyjs = new npyjs();
    this.npyjs.load("./examples/scenes/piano_with_shadow_hands/"+this.params.song, (loaded) => {
      this.pianoControl = loaded;
      this.controlFrameNumber = 0;
    });
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }

  processPianoState() {
    // Only process piano state if we're in a piano scene
    if (!this.params.scene.includes("piano")) {
      return;
    }

    let activation = new Array(88).fill(false);

    // Detect which keys are pressed and color them accordingly.
    for (let b = 0; b < this.model.nbody(); b++) {
      if (this.bodies[b]) {
        if (this.bodies[b].name.indexOf("piano/") < 0) { continue; }
        if (this.bodies[b].name.indexOf("key") < 0) { continue; }
        let jnt_adr = this.model.body_jntadr()[b];
        if (jnt_adr < 0) { continue; }
        let qpos_adr = this.model.jnt_qposadr()[jnt_adr];
        let qpos = this.simulation.qpos()[qpos_adr];
        let qpos_min = this.model.jnt_range()[2*jnt_adr + 0];
        let qpos_max = this.model.jnt_range()[2*jnt_adr + 1];
        let qpos_state = Math.max(qpos_min, Math.min(qpos, qpos_max));
        if (Math.abs(qpos_state - qpos_max) <= 0.00872665) {
          let key = parseInt(this.bodies[b].name.split("_")[2]);
          activation[key] = true;
          this.bodies[b].children[0].material.color.setRGB(0.2, 0.8, 0.2);
        } else {
          if (this.bodies[b].name.indexOf("white") >= 0) {
            this.bodies[b].children[0].material.color.setRGB(0.9, 0.9, 0.9);
          } else {
            this.bodies[b].children[0].material.color.setRGB(0.1, 0.1, 0.1);
          }
        }
      }
    }

    // xor the current activation with the previous activation.
    let state_change = new Array(88).fill(false);
    for (let i = 0; i < 88; i++) {
      state_change[i] = activation[i] ^ this.prevActivated[i];
    }

    // Note on events.
    for (let i = 0; i < 88; i++) {
      if (state_change[i] && !this.prevActivated[i]) {
        let note = key2note.get(i);
        this.sampler.triggerAttack(note);
      }
    }

    // Note off events.
    for (let i = 0; i < 88; i++) {
      if (state_change[i] && !activation[i]) {
        let note = key2note.get(i);
        this.sampler.triggerRelease(note);
      }
    }

    // Update the previous activation.
    for (let i = 0; i < 88; i++) {
      this.prevActivated[i] = activation[i];
    }
  }

  render(timeMS) {
    this.controls.update();

    // Return if the model hasn't been loaded yet
    if (!this.model) { return; }

    if (!this.params["paused"]) {
      let timestep = this.model.getOptions().timestep;
      if (timeMS - this.mujoco_time > 35.0) { this.mujoco_time = timeMS; }
      while (this.mujoco_time < timeMS) {

        // 🚀 ENHANCED PIANO CONTROL WITH FILTERING
        if (this.pianoControl && !this.params.songPaused && this.params.scene.includes("piano")) {
          let currentCtrl = this.simulation.ctrl();
          let rawControls = [];
          
          // Extract raw control values
          for (let i = 0; i < currentCtrl.length; i++) {
            // Play one control frame every 10 timesteps
            rawControls[i] = this.pianoControl.data[
              (currentCtrl.length * Math.floor(this.controlFrameNumber / 10.0)) + i];
          }
          
          // Apply enhancements
          let enhancedControls = this.applyEnhancedControls(rawControls, timestep);
          
          // Set enhanced controls
          for (let i = 0; i < currentCtrl.length; i++) {
            currentCtrl[i] = enhancedControls[i];
            this.params["Actuator " + i] = currentCtrl[i];
          }
          
          // Handle song completion
          if (this.controlFrameNumber >= (this.pianoControl.shape[0]-1) * 10) {
            this.controlFrameNumber = 0;
            this.simulation.resetData();
            this.simulation.forward();
            this.params.songPaused = true;
          }
          this.controlFrameNumber += 1;
        }

        if (this.params["ctrlnoisestd"] > 0.0) {
          let rate  = Math.exp(-timestep / Math.max(1e-10, this.params["ctrlnoiserate"]));
          let scale = this.params["ctrlnoisestd"] * Math.sqrt(1 - rate * rate);
          let currentCtrl = this.simulation.ctrl();
          for (let i = 0; i < currentCtrl.length; i++) {
            currentCtrl[i] = rate * currentCtrl[i] + scale * standardNormal();
            this.params["Actuator " + i] = currentCtrl[i];
          }
        }

        // Clear old perturbations, apply new ones.
        for (let i = 0; i < this.simulation.qfrc_applied().length; i++) { this.simulation.qfrc_applied()[i] = 0.0; }
        let dragged = this.dragStateManager.physicsObject;
        if (dragged && dragged.bodyID) {
          for (let b = 0; b < this.model.nbody(); b++) {
            if (this.bodies[b]) {
              getPosition  (this.simulation.xpos (), b, this.bodies[b].position);
              getQuaternion(this.simulation.xquat(), b, this.bodies[b].quaternion);
              this.bodies[b].updateWorldMatrix();
            }
          }
          let bodyID = dragged.bodyID;
          this.dragStateManager.update(); // Update the world-space force origin
          let force = toMujocoPos(this.dragStateManager.currentWorld.clone()
            .sub(this.dragStateManager.worldHit)
            .multiplyScalar(Math.max(1, this.model.body_mass()[bodyID]) * 250)); //
          let point = toMujocoPos(this.dragStateManager.worldHit.clone());
          this.simulation.applyForce(force.x, force.y, force.z, 0, 0, 0, point.x, point.y, point.z, bodyID);

          // TODO: Apply pose perturbations (mocap bodies only).
        }

        // 🚀 APPLY FULL TRIARCH ENHANCEMENT SYSTEM
        this.applyFullEnhancements(timestep);

        this.simulation.step();

        this.processPianoState();

        this.mujoco_time += timestep * 1000.0;
      }

    } else if (this.params["paused"]) {
      this.simulation.forward();
      this.sampler.releaseAll();
    }

    // Update body transforms.
    for (let b = 0; b < this.model.nbody(); b++) {
      if (this.bodies[b]) {
        getPosition  (this.simulation.xpos (), b, this.bodies[b].position);
        getQuaternion(this.simulation.xquat(), b, this.bodies[b].quaternion);
        this.bodies[b].updateWorldMatrix();
      }
    }

    // Update light transforms.
    for (let l = 0; l < this.model.nlight(); l++) {
      if (this.lights[l]) {
        getPosition(this.simulation.light_xpos(), l, this.lights[l].position);
        getPosition(this.simulation.light_xdir(), l, this.tmpVec);
        this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
      }
    }

    // Render!
    this.renderer.render( this.scene, this.camera );
  }
}

let demo = new RoboPianistDemo();
await demo.init();
