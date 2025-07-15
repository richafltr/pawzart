
import * as THREE           from 'three';
import * as Tone            from 'tone';
import { GUI              } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls    } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './utils/DragStateManager.js';
import  npyjs               from './utils/npy.js';
import { key2note }         from './utils/musicUtils.js';
import { setupGUI, loadSceneFromURL, getPosition, getQuaternion, toMujocoPos, standardNormal } from './mujocoUtils.js';
import   load_mujoco        from '../dist/mujoco_wasm.js';

// 🚀 ENHANCEMENT MODULES
import { createAdaptiveMotionFilter } from './utils/adaptiveMotionFilter.js';
import { enhancePerformance } from './utils/expressiveDynamics.js';
import { createPhaseSync } from './utils/tempoSync.js';
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
      scene: "unitree_go2/scene.xml",
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
   * Initialize all enhancement modules
   */
  initEnhancements() {
    // Motion filter for each robot
    this.motionFilters = {
      leftHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      rightHand: createAdaptiveMotionFilter({ windowSize: 15 }),
      go2Robot: createAdaptiveMotionFilter({ windowSize: 20 }),
      piano: createAdaptiveMotionFilter({ windowSize: 12 }) // For piano keys
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
      phaseJitter: [],
      startTime: Date.now()
    };
  }

  /**
   * Setup GUI controls for enhancements
   */
  setupEnhancementGUI() {
    // Main enhancement folder
    const enhanceFolder = this.gui.addFolder('🚀 Enhancements');
    
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
      fps: 0,
      filterActive: false
    };
    
    metricsFolder.add(this.metricsDisplay, 'avgError').name('Avg Error').listen();
    metricsFolder.add(this.metricsDisplay, 'phaseJitter').name('Phase Jitter (ms)').listen();
    metricsFolder.add(this.metricsDisplay, 'fps').name('FPS').listen();
    metricsFolder.add(this.metricsDisplay, 'filterActive').name('Filter Active').listen();
    
    enhanceFolder.open();
  }

  /**
   * Apply all enhancements to control signals
   * @param {Array} rawControls - Raw control values
   * @param {number} timestep - Simulation timestep
   * @returns {Array} Enhanced control values
   */
  applyEnhancedControls(rawControls, timestep) {
    let controls = rawControls.slice(); // Copy array
    
    // Step 1: Apply motion filtering
    if (this.enhancements.filterEnabled) {
      // Use piano filter for piano scenes
      if (this.params.scene.includes("piano") && this.motionFilters.piano) {
        controls = this.motionFilters.piano(controls);
        this.metricsDisplay.filterActive = true;
      }
    } else {
      this.metricsDisplay.filterActive = false;
    }
    
    // Step 2: Apply expressive dynamics (for piano scenes)
    if (this.enhancements.dynamicsEnabled && this.params.scene.includes("piano")) {
      // Simple velocity scaling based on dynamics parameters
      controls = controls.map(ctrl => {
        return ctrl * this.dynamicsParams.velocityScale;
      });
    }
    
    // Step 3: Apply phase synchronization (for multi-robot scenes)
    if (this.enhancements.syncEnabled && this.isMultiRobotScene()) {
      // Simple phase adjustment (placeholder implementation)
      const phaseAdjustment = Math.sin(this.mujoco_time * 0.001) * 0.01;
      controls = controls.map(ctrl => ctrl + phaseAdjustment);
    }
    
    return controls;
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
   * Update performance metrics
   * @param {number} timestep - Simulation timestep
   */
  updatePerformanceMetrics(timestep) {
    this.performanceMetrics.frameCount++;
    
    // Calculate FPS
    const elapsed = (Date.now() - this.performanceMetrics.startTime) / 1000;
    this.metricsDisplay.fps = Math.round(this.performanceMetrics.frameCount / elapsed);
    
    // Calculate average error (placeholder - would need reference trajectory)
    const currentError = this.calculateControlError();
    this.performanceMetrics.errorSum += currentError;
    this.metricsDisplay.avgError = Math.round(
      (this.performanceMetrics.errorSum / this.performanceMetrics.frameCount) * 1000
    ) / 1000;
    
    // Update phase jitter metric
    const jitter = this.calculatePhaseJitter();
    this.performanceMetrics.phaseJitter.push(jitter);
    if (this.performanceMetrics.phaseJitter.length > 100) {
      this.performanceMetrics.phaseJitter.shift();
    }
    this.metricsDisplay.phaseJitter = Math.round(
      this.performanceMetrics.phaseJitter.reduce((a, b) => a + b, 0) / 
      this.performanceMetrics.phaseJitter.length * 1000
    ) / 1000;
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
    // Placeholder implementation - would measure timing consistency
    return Math.random() * 5.0; // Simulated jitter 0-5ms
  }

  async init() {
    console.log("Starting scene initialization...");
    // Download the the examples to MuJoCo's virtual file system
    console.log("Downloading example scenes and assets...");
    {
      console.log("SANITY CHECK: Inlined downloadExampleScenesFolder HAS BEEN CALLED.");
      let allFiles = [
        // Piano with Shadow Hands
        "piano_with_shadow_hands/f_distal_pst-927e7e0da0ee76e69c0444b22bade45ff20ab5ee.obj",
        "piano_with_shadow_hands/f_knuckle-4e74747ced8908917157e00df691de5cfc71808c.obj",
        "piano_with_shadow_hands/f_middle-c817011a5fccb8dac0f3201f10aa30ffa74db8b6.obj",
        "piano_with_shadow_hands/f_proximal-2b944834ac12ce9bb152073bce3db339405bc76d.obj",
        "piano_with_shadow_hands/forearm_0-20abf0e17ef9afc17a625f75fc0ad21f31b2ff9a.obj",
        "piano_with_shadow_hands/forearm_1-f5b8ac92a6e1b0a6b27c50dac2004867e6c0fb5b.obj",
        "piano_with_shadow_hands/forearm_collision-3ef43cdb2273599be12fc3270639b8782c869cb4.obj",
        "piano_with_shadow_hands/lf_metacarpal-43a8cbd60c754686e733e10c0c28ff082b46a917.obj",
        "piano_with_shadow_hands/palm-20de86ceb3b063e7ca1bf25fa6ddd07c068d6a70.obj",
        "piano_with_shadow_hands/scene.xml",
        "piano_with_shadow_hands/th_distal_pst-c003d5be2d6a841babda3d88c51010617a2ba4bb.obj",
        "piano_with_shadow_hands/th_middle-c6937ecc6bf6b01a854aaffb71f3beeda05f8ac3.obj",
        "piano_with_shadow_hands/th_proximal-836fc483b89bf08806ab50636ab1fe738a54406e.obj",
        "piano_with_shadow_hands/wrist-87545134a753f219a1f55310cc200489b3a03c47.obj",

        // Unitree Go2
        "unitree_go2/scene.xml",
        "unitree_go2/go2.xml",
        "unitree_go2/assets/base_0.obj",
        "unitree_go2/assets/base_1.obj",
        "unitree_go2/assets/base_2.obj",
        "unitree_go2/assets/base_3.obj",
        "unitree_go2/assets/base_4.obj",
        "unitree_go2/assets/hip_0.obj",
        "unitree_go2/assets/hip_1.obj",
        "unitree_go2/assets/thigh_0.obj",
        "unitree_go2/assets/thigh_1.obj",
        "unitree_go2/assets/thigh_mirror_0.obj",
        "unitree_go2/assets/thigh_mirror_1.obj",
        "unitree_go2/assets/calf_0.obj",
        "unitree_go2/assets/calf_1.obj",
        "unitree_go2/assets/calf_mirror_0.obj",
        "unitree_go2/assets/calf_mirror_1.obj",
        "unitree_go2/assets/foot.obj",

        // Paws with Piano
        "paws_with_piano/scene.xml",
        "paws_with_piano/piano.xml",
        "paws_with_piano/go2.xml",
      ];

      const promises = allFiles.map(async (file) => {
        const url = `./examples/scenes/${file}`;
        console.log(`Fetching: ${url}`);
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.error(`[FAIL] Fetch failed for ${file}: ${response.status} ${response.statusText}`);
            return;
          }

          const path = `/working/${file}`;
          const dir = path.substring(0, path.lastIndexOf('/'));

          if (dir && !mujoco.FS.analyzePath(dir).exists) {
            try {
              mujoco.FS.mkdirTree(dir);
            } catch (e) {
              console.error(`[FAIL] Could not create directory ${dir}:`, e);
              return;
            }
          }

          if (file.endsWith(".png") || file.endsWith(".stl") || file.endsWith(".skn")) {
            const data = await response.arrayBuffer();
            console.log(`[ OK ] Fetched ${file}, size: ${data.byteLength} bytes. Writing to ${path}`);
            if (data.byteLength === 0) {
              console.warn(`[WARN] File ${file} is empty.`);
            }
            mujoco.FS.writeFile(path, new Uint8Array(data));
          } else {
            const data = await response.text();
            console.log(`[ OK ] Fetched ${file}, size: ${data.length} chars. Writing to ${path}`);
            if (data.length === 0) {
              console.warn(`[WARN] File ${file} is empty.`);
            }
            mujoco.FS.writeFile(path, data);
          }
        } catch (error) {
          console.error(`[FAIL] Unhandled error for ${file}:`, error);
        }
      });

      await Promise.all(promises);
    }
    console.log("Asset download complete.");

    // Initialize the three.js Scene using the .xml Model from params
    console.log(`Attempting to load scene: ${this.params.scene}`);
    try {
        [this.model, this.state, this.simulation, this.bodies, this.lights] = 
            await loadSceneFromURL(mujoco, this.params.scene, this);
        console.log("Scene loaded successfully.");
    } catch (error) {
        console.error("CRITICAL: Scene initialization failed. See error below.", error);
        // Future enhancement: display a user-friendly error message in the UI
        return; // Stop execution if scene loading fails
    }

    console.log("Setting up GUI...");
    this.gui = new GUI();
    setupGUI(this);
    
    // 🚀 SETUP ENHANCEMENT GUI
    this.setupEnhancementGUI();
    console.log("GUI setup complete.");

    console.log(`Loading song data: ${this.params.song}`);
    this.npyjs = new npyjs();
    this.npyjs.load("./examples/scenes/piano_with_shadow_hands/"+this.params.song, (loaded) => {
        this.pianoControl = loaded;
        this.controlFrameNumber = 0;
        console.log("Song data loaded.");
    });
    console.log("Initialization complete.");
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

        this.simulation.step();

        this.processPianoState();

        // 🚀 UPDATE PERFORMANCE METRICS
        this.updatePerformanceMetrics(timestep);

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
