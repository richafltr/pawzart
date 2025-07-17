# PawzArt - Three.js MuJoCo WASM Piano Simulator 🎹🤖

![Pawzart](assets/Pawzart.png)
![Robot Hands with Piano](assets/robothandswithpiano.png)
![Piano Isolation](assets/piano_isolation.png)

A web-based physics simulator that demonstrates robotic piano playing using learned dexterity models with support for multiple robot configurations. Built with Three.js and MuJoCo WASM, featuring bimanual Shadow Hand robots performing classical piano pieces with realistic physics simulation, plus integration with the Unitree Go2 quadruped robot.

## 🎹 Overview

PawzArt combines advanced robotics simulation with musical performance, showcasing:
- **Bimanual dexterous manipulation** with Shadow Hand robots
- **Quadruped locomotion** with Unitree Go2 robot
- **Real-time physics simulation** powered by MuJoCo WASM
- **Interactive 3D visualization** using Three.js
- **Pre-trained piano performance models** with multiple classical pieces
- **Multi-robot scene composition** - combine different robots in single scenes
- **Web-based deployment** requiring no local installations

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en) (which includes npm)
- [pnpm](https://pnpm.io/installation)

### Running the Simulator

1. **Install dependencies** from the project's root directory:
   ```bash
   pnpm install
   ```
2. **Start the development server**:
   ```bash
   pnpm dev
   ```
3. **Open the provided URL** in your browser (usually `http://localhost:5173`).
4. **Select a scene** from the Scene dropdown:
   - **Piano with Hands**: Original bimanual piano playing demo
   - **Unitree Go2 Robot**: Standalone quadruped robot simulation
   - **Piano + Go2 Combined**: Both robots in the same scene!
5. Select a song from the dropdown menu (for piano scenes)
6. Use spacebar to play/pause simulation
7. Press 'P' to pause/resume song playback
8. Drag objects in the scene to apply forces
9. Press F1 for help menu

## 🤖 Available Scenes

### 1. Piano with Shadow Hands
The original RoboPianist demonstration featuring:
- **Bimanual Setup**: Left and right Shadow Hand robots
- **High DOF**: 20+ actuated joints per hand
- **Precise Control**: Position-controlled actuators with realistic dynamics
- **Musical Performance**: Pre-trained control sequences for classical pieces

### 2. Unitree Go2 Robot
Standalone quadruped robot simulation:
- **12-DOF Locomotion**: Hip, thigh, and calf joints for each leg
- **Realistic Dynamics**: Based on official URDF specifications  
- **Physics Interaction**: Drag and apply forces to test stability

### 3. **NEW: Piano + Go2 Combined Scene**
The innovative superposition featuring both robots simultaneously:
- **Multi-robot Physics**: Both systems simulated in the same world
- **Shared Environment**: Piano and quadruped coexist with proper collision detection
- **Independent Control**: Separate actuator systems for each robot type
- **Scalable Architecture**: Demonstrates framework's multi-robot capabilities

## 🎵 Available Compositions

- **Turkish March** - Mozart
- **Für Elise** - Beethoven  
- **Piano Sonata No. 16 K545** - Mozart
- **Nocturne Op. 9 No. 2** - Chopin
- **Twinkle Twinkle Little Star** - Traditional

Each composition includes pre-trained control sequences (.npy files) with learned finger movements.

## 🛠️ Development & Extension

### Adding New Robot Types
1. Create a new robot directory (e.g., `new_robot`) inside `examples/scenes/`.
2. Place your robot's XML definition and all required mesh assets (`.obj`, `.stl`) inside this new directory.
3. Add the file paths for your new assets to the `allFiles` array in the `init()` method of `examples/main.js`.
4. Add a new entry for your scene in the GUI dropdown, also in `examples/main.js`.
5. Implement any robot-specific control logic if needed.

### Creating Custom Multi-Robot Scenes
```xml
<mujoco model="custom_multi_robot">
  <!-- Include multiple robot definitions -->
  <include file="../robot_a/robot_a.xml"/>
  <include file="../robot_b/robot_b.xml"/>
  
  <worldbody>
    <!-- Position robots in shared world -->
    <body name="robot_a_instance" pos="1 0 0">
      <!-- Robot A configuration -->
    </body>
    <body name="robot_b_instance" pos="-1 0 0">
      <!-- Robot B configuration -->
    </body>
  </worldbody>
</mujoco>
```

## 📁 Project Structure

```
pawzart/
├── examples/
│   ├── main.js                    # Main application class
│   ├── mujocoUtils.js            # MuJoCo integration utilities
│   ├── scenes/
│   │   ├── piano_with_shadow_hands/     # Original piano scene
│   │   ├── unitree_go2/                 # Quadruped robot scene
│   │   └── paws_with_piano/              # 🆕 Combined scene
│   └── utils/                     # Utility modules
├── dist/                          # Compiled MuJoCo WASM
└── index.html                     # Entry point
```

## 🤝 Contributing

We welcome contributions! Areas of interest:
- Additional robot models and scenes
- Enhanced control algorithms
- Performance optimizations
- New musical pieces and training data

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments & Credits

This project is an extension and enhancement of the original **RoboPianist** demonstration. We are immensely grateful to the original creators for their foundational work.

- **RoboPianist Project**
  - **Homepage**: [https://kzakka.com/robopianist/](https://kzakka.com/robopianist/)
  - **GitHub Repository**: [https://github.com/kevinzakka/robopianist-demo](https://github.com/kevinzakka/robopianist-demo)

- **Google DeepMind**
  - For developing and maintaining the **MuJoCo** physics engine and for creating the WebAssembly port that makes this project possible.

We also thank the creators of the following libraries and assets:
- **Three.js**: For the powerful 3D graphics rendering framework.
- **Shadow Robot Company**: For the dexterous hand hardware specifications.
- **Unitree Robotics**: For the Go2 quadruped robot model.

---

**Ready to explore multi-robot simulation?** Load the "Piano + Go2 Combined" scene and witness the future of heterogeneous robotic systems in action! 🎹🤖 
