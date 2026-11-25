/**
 * Enhanced Three.js 3D Visualizer & Studio
 * Dual Mode:
 *   - Studio Design Mode (Orbit inspection with CG/CP indicators)
 *   - Launch Simulation Mode (Pad, Chase, On-board, Top-down views with dynamic exhaust & smoke)
 */

class Rocket3DVisualizer {
  constructor(containerId, isDesignStudio = false) {
    this.container = document.getElementById(containerId);
    this.isDesignStudio = isDesignStudio;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.rocketGroup = new THREE.Group();
    this.indicatorsGroup = new THREE.Group();
    this.parachuteMesh = null;

    // Propellant Particle System (Sparks & Smoke)
    this.exhaustGroup = new THREE.Group();
    this.flameMesh = null;
    this.sparksSystem = null;
    this.smokeSystem = null;
    this.sparkPositions = [];
    this.sparkVelocities = [];
    this.smokePositions = [];
    this.smokeVelocities = [];

    this.cameraMode = "pad";
    this.isPlaying = false;
    this.playbackIndex = 0;
    this.playbackSpeed = 1.0;
    this.trajectoryData = [];

    this.activeRocket = null;
    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene
    this.scene = new THREE.Scene();
    if (this.isDesignStudio) {
      this.scene.background = new THREE.Color(0x090d16); // Clean CAD studio dark slate
      this.camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 500);
      this.camera.position.set(2.2, 1.2, 2.8);
    } else {
      this.scene.background = new THREE.Color(0x0a1128); // Desert twilight
      this.scene.fog = new THREE.FogExp2(0x0a1128, 0.0004);
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      this.camera.position.set(4, 3, 6);
    }

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    if (!this.isDesignStudio) {
      this.controls.maxPolarAngle = Math.PI / 2 - 0.01;
    }

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, this.isDesignStudio ? 0.8 : 0.4);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(20, 40, 20);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-20, -10, -20);
    this.scene.add(fillLight);

    // 5. Environment
    if (this.isDesignStudio) {
      this.createStudioGrid();
    } else {
      this.createFlightGround();
      this.createLaunchPad();
    }

    // 6. Rocket & Indicators
    this.scene.add(this.rocketGroup);
    this.scene.add(this.indicatorsGroup);

    if (!this.isDesignStudio) {
      this.createPropellantEffects();
    }

    window.addEventListener("resize", () => this.onWindowResize());
    this.animate();
  }

  createStudioGrid() {
    const grid = new THREE.GridHelper(4, 20, 0x0ea5e9, 0x1e293b);
    grid.position.y = 0;
    this.scene.add(grid);

    const axes = new THREE.AxesHelper(0.5);
    axes.position.set(-1.2, 0.01, -1.2);
    this.scene.add(axes);
  }

  createFlightGround() {
    const groundGeo = new THREE.PlaneGeometry(8000, 8000, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8b7d6b,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(200, 40, 0x38bdf8, 0x334155);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  createLaunchPad() {
    const padGroup = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(Math.cos(angle) * 0.7, 0.4, Math.sin(angle) * 0.7);
      leg.rotation.z = Math.PI / 4;
      leg.rotation.y = -angle;
      padGroup.add(leg);
    }

    const deflectorGeo = new THREE.ConeGeometry(0.5, 0.4, 16);
    const deflectorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const deflector = new THREE.Mesh(deflectorGeo, deflectorMat);
    deflector.position.y = 0.2;
    padGroup.add(deflector);

    const railGeo = new THREE.BoxGeometry(0.05, 2.44, 0.05);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0.07, 2.44 / 2 + 0.3, 0);
    padGroup.add(rail);

    this.scene.add(padGroup);
  }

  /**
   * High-Tech Exhaust & Propellant FX (Dark Matter Sparks, Flame & Smoke)
   */
  createPropellantEffects() {
    this.rocketGroup.add(this.exhaustGroup);

    // 1. Fiery Mach Shock Flame Cone
    const flameGeo = new THREE.ConeGeometry(0.07, 0.65, 16);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.9
    });
    this.flameMesh = new THREE.Mesh(flameGeo, flameMat);
    this.flameMesh.rotation.x = Math.PI;
    this.flameMesh.position.y = 0.0;
    this.flameMesh.visible = false;
    this.exhaustGroup.add(this.flameMesh);

    // 2. Dark Matter Sparks Particle System (Bright golden crackling embers)
    const sparkCount = 300;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    this.sparkVelocities = [];

    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = 0;
      sparkPos[i * 3 + 1] = 0;
      sparkPos[i * 3 + 2] = 0;
      this.sparkVelocities.push({
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(Math.random() * 8 + 4), // shooting down
        vz: (Math.random() - 0.5) * 1.5,
        life: Math.random()
      });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.07,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    this.sparksSystem = new THREE.Points(sparkGeo, sparkMat);
    this.sparksSystem.visible = false;
    this.exhaustGroup.add(this.sparksSystem);

    // 3. Dense Black & Grey Smoke Plume
    const smokeCount = 200;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    this.smokeVelocities = [];

    for (let i = 0; i < smokeCount; i++) {
      smokePos[i * 3] = 0;
      smokePos[i * 3 + 1] = 0;
      smokePos[i * 3 + 2] = 0;
      this.smokeVelocities.push({
        vx: (Math.random() - 0.5) * 2.0,
        vy: -(Math.random() * 4 + 1),
        vz: (Math.random() - 0.5) * 2.0,
        life: Math.random()
      });
    }
    smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));

    const smokeMat = new THREE.PointsMaterial({
      color: 0x333333,
      size: 0.25,
      transparent: true,
      opacity: 0.6
    });
    this.smokeSystem = new THREE.Points(smokeGeo, smokeMat);
    this.smokeSystem.visible = false;
    this.exhaustGroup.add(this.smokeSystem);
  }

  updatePropellant(thrustLevel, propellantType = "Dark Matter") {
    if (!this.flameMesh) return;

    if (thrustLevel > 5) {
      this.flameMesh.visible = true;
      this.sparksSystem.visible = true;
      this.smokeSystem.visible = true;

      // Pulse flame with thrust
      const pulse = 0.8 + Math.random() * 0.4;
      const intensity = Math.min(thrustLevel / 280, 1.4);
      this.flameMesh.scale.set(pulse * intensity, pulse * 1.6 * intensity, pulse * intensity);

      // Color based on propellant
      if (propellantType.includes("White")) {
        this.flameMesh.material.color.setHex(0xe0f2fe); // White Lightning
      } else {
        this.flameMesh.material.color.setHex(0xff3700); // Dark Matter orange
      }

      // Animate Sparks
      const positions = this.sparksSystem.geometry.attributes.position.array;
      for (let i = 0; i < this.sparkVelocities.length; i++) {
        const v = this.sparkVelocities[i];
        positions[i * 3] += v.vx * 0.03;
        positions[i * 3 + 1] += v.vy * 0.03;
        positions[i * 3 + 2] += v.vz * 0.03;

        v.life -= 0.04;
        if (v.life <= 0) {
          positions[i * 3] = (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 1] = 0;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
          v.life = 1.0;
        }
      }
      this.sparksSystem.geometry.attributes.position.needsUpdate = true;

      // Animate Smoke
      const smokePos = this.smokeSystem.geometry.attributes.position.array;
      for (let i = 0; i < this.smokeVelocities.length; i++) {
        const v = this.smokeVelocities[i];
        smokePos[i * 3] += v.vx * 0.02;
        smokePos[i * 3 + 1] += v.vy * 0.02;
        smokePos[i * 3 + 2] += v.vz * 0.02;
        v.life -= 0.02;
        if (v.life <= 0) {
          smokePos[i * 3] = 0;
          smokePos[i * 3 + 1] = -0.2;
          smokePos[i * 3 + 2] = 0;
          v.life = 1.0;
        }
      }
      this.smokeSystem.geometry.attributes.position.needsUpdate = true;

    } else {
      this.flameMesh.visible = false;
      this.sparksSystem.visible = false;
      this.smokeSystem.visible = false;
    }
  }

  /**
   * Builds 3D rocket model dynamically from components list
   */
  buildRocketModel(rocketConfig) {
    this.activeRocket = rocketConfig;

    // Clear old geometry
    while (this.rocketGroup.children.length > 0) {
      const child = this.rocketGroup.children[0];
      if (child === this.exhaustGroup) {
        this.rocketGroup.remove(child);
        break;
      }
      this.rocketGroup.remove(child);
    }
    if (!this.isDesignStudio && this.exhaustGroup) {
      this.rocketGroup.add(this.exhaustGroup);
    }

    const comps = rocketConfig?.components || [
      { type: "nosecone", name: "Ogive Nose Cone", length: 0.503, radius: 0.051, color: "red" },
      { type: "bodytube", name: "Upper Body Tube", length: 0.457, radius: 0.051, color: "white" },
      { type: "bodytube", name: "Lower Body Tube", length: 0.457, radius: 0.051, color: "white" },
      { type: "fins", name: "Plywood TTW Fins", count: 3, rootChord: 0.22, span: 0.125, tipChord: 0.09, sweepLength: 0.13, color: "black" }
    ];

    let currentY = this.isDesignStudio ? 0 : 0.35; // base altitude
    const baseOffset = currentY;

    // Build parts from tail to nose
    const bodyTubes = comps.filter(c => c.type === "bodytube");
    const nose = comps.find(c => c.type === "nosecone");
    const fins = comps.find(c => c.type === "fins");

    // Colors
    const getColorMat = (colorStr, defColor = 0xf8fafc) => {
      let hex = defColor;
      if (colorStr === "red") hex = 0xef4444;
      else if (colorStr === "orange") hex = 0xf97316;
      else if (colorStr === "black") hex = 0x1e293b;
      else if (colorStr === "yellow") hex = 0xeab308;
      else if (colorStr === "white") hex = 0xf8fafc;
      return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35, metalness: 0.15 });
    };

    // 1. Motor Casing
    const motorGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.356, 32);
    const motorMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.2, metalness: 0.8 });
    const motorMesh = new THREE.Mesh(motorGeo, motorMat);
    motorMesh.position.y = currentY + 0.356 / 2;
    this.rocketGroup.add(motorMesh);

    // 2. Body Tubes
    bodyTubes.forEach((tube, idx) => {
      const radius = tube.radius || 0.051;
      const len = tube.length || 0.457;
      const tubeGeo = new THREE.CylinderGeometry(radius, radius, len, 32);
      const tubeMesh = new THREE.Mesh(tubeGeo, getColorMat(tube.color || "white"));
      tubeMesh.position.y = currentY + len / 2;
      tubeMesh.castShadow = true;
      tubeMesh.userData = { component: tube, index: idx };
      this.rocketGroup.add(tubeMesh);
      currentY += len;
    });

    // 3. Fins (Mounted on lowest body tube)
    if (fins) {
      const finCount = fins.count || 3;
      const span = fins.span || 0.125;
      const rootChord = fins.rootChord || 0.22;
      const tipChord = fins.tipChord || 0.09;
      const sweep = fins.sweepLength || 0.13;
      const finMat = getColorMat(fins.color || "black", 0x1e293b);

      for (let i = 0; i < finCount; i++) {
        const angle = (i * 2 * Math.PI) / finCount;
        const finShape = new THREE.Shape();
        finShape.moveTo(0, 0);
        finShape.lineTo(span, sweep);
        finShape.lineTo(span, sweep + tipChord);
        finShape.lineTo(0, rootChord);
        finShape.closePath();

        const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.005, bevelEnabled: false });
        const finMesh = new THREE.Mesh(finGeo, finMat);
        finMesh.rotation.y = angle;
        finMesh.position.y = baseOffset + 0.02;
        finMesh.castShadow = true;
        this.rocketGroup.add(finMesh);
      }
    }

    // 4. Nose Cone
    if (nose) {
      const nLen = nose.length || 0.503;
      const nRad = nose.radius || 0.051;
      const noseGeo = new THREE.ConeGeometry(nRad, nLen, 32);
      const noseMesh = new THREE.Mesh(noseGeo, getColorMat(nose.color || "red", 0xef4444));
      noseMesh.position.y = currentY + nLen / 2;
      noseMesh.castShadow = true;
      this.rocketGroup.add(noseMesh);
      currentY += nLen;
    }

    // 5. Parachute (for flight sim)
    if (!this.isDesignStudio) {
      const chuteGeo = new THREE.SphereGeometry(0.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const chuteMat = new THREE.MeshStandardMaterial({ color: 0xf97316, side: THREE.DoubleSide });
      this.parachuteMesh = new THREE.Mesh(chuteGeo, chuteMat);
      this.parachuteMesh.position.y = currentY + 0.8;
      this.parachuteMesh.scale.set(0.001, 0.001, 0.001);
      this.rocketGroup.add(this.parachuteMesh);
    }

    // 6. Stability Indicators in Design Studio (CG / CP)
    if (this.isDesignStudio) {
      this.renderStabilityIndicators(rocketConfig, currentY);
    }
  }

  renderStabilityIndicators(rocketConfig, totalLength) {
    while (this.indicatorsGroup.children.length > 0) {
      this.indicatorsGroup.remove(this.indicatorsGroup.children[0]);
    }

    const cgPos = totalLength - (rocketConfig.cg || (totalLength * 0.72));
    const cpPos = totalLength - (rocketConfig.cp || (totalLength * 0.85));

    // CG Blue Sphere & Ring
    const cgGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const cgMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const cgMesh = new THREE.Mesh(cgGeo, cgMat);
    cgMesh.position.set(0, cgPos, 0.065);
    this.indicatorsGroup.add(cgMesh);

    // CP Red Sphere & Ring
    const cpGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const cpMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const cpMesh = new THREE.Mesh(cpGeo, cpMat);
    cpMesh.position.set(0, cpPos, 0.065);
    this.indicatorsGroup.add(cpMesh);

    // Connecting Stems
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, cgPos, 0),
      new THREE.Vector3(0, cgPos, 0.065)
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6 });
    this.indicatorsGroup.add(new THREE.Line(lineGeo, lineMat));

    const cpLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, cpPos, 0),
      new THREE.Vector3(0, cpPos, 0.065)
    ]);
    const cpLineMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
    this.indicatorsGroup.add(new THREE.Line(cpLineGeo, cpLineMat));
  }

  loadSimulationTrajectory(trajData) {
    this.trajectoryData = trajData;
    this.playbackIndex = 0;
  }

  play() { this.isPlaying = true; }
  pause() { this.isPlaying = false; }
  reset() {
    this.isPlaying = false;
    this.playbackIndex = 0;
    this.updateFlightFrame(0);
  }

  setSpeed(s) { this.playbackSpeed = s; }
  setCameraMode(mode) { this.cameraMode = mode; }

  updateFlightFrame(index) {
    if (!this.trajectoryData || this.trajectoryData.length === 0) return;
    if (index >= this.trajectoryData.length) {
      this.isPlaying = false;
      return;
    }

    const point = this.trajectoryData[index];
    this.rocketGroup.position.set(point.posX, point.posY, point.posZ);

    // Exhaust & sparks
    this.updatePropellant(point.thrust, "Dark Matter");

    // Parachute
    if (point.phase === "descent" && this.parachuteMesh) {
      this.parachuteMesh.visible = true;
      const scale = Math.min(1.0, this.parachuteMesh.scale.x + 0.1);
      this.parachuteMesh.scale.set(scale, scale, scale);
      this.rocketGroup.rotation.z = Math.sin(point.time * 2) * 0.05;
      this.rocketGroup.rotation.x = Math.cos(point.time * 2) * 0.05;
    } else if (this.parachuteMesh) {
      this.parachuteMesh.visible = false;
      this.parachuteMesh.scale.set(0.001, 0.001, 0.001);
      this.rocketGroup.rotation.set(0, 0, 0);
    }

    this.updateCamera(point);
    window.dispatchEvent(new CustomEvent("telemetry-update", { detail: point }));
  }

  updateCamera(point) {
    const { posX: rX, posY: rY, posZ: rZ } = point;
    if (this.cameraMode === "pad") {
      this.controls.enabled = true;
      this.controls.target.set(rX, Math.min(rY, 400), rZ);
    } else if (this.cameraMode === "follow") {
      this.controls.enabled = false;
      this.camera.position.set(rX + 8, rY + 6, rZ + 12);
      this.camera.lookAt(rX, rY + 1, rZ);
    } else if (this.cameraMode === "rocket") {
      this.controls.enabled = false;
      this.camera.position.set(rX, rY + 0.8, rZ + 0.15);
      this.camera.lookAt(rX, rY - 20, rZ);
    } else if (this.cameraMode === "top") {
      this.controls.enabled = false;
      this.camera.position.set(rX, rY + 50, rZ + 1);
      this.camera.lookAt(rX, rY, rZ);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.isDesignStudio) {
      // Gentle rotation when idle in design studio
      this.controls.update();
    } else {
      if (this.isPlaying && this.trajectoryData.length > 0) {
        this.playbackIndex += Math.round(1 * this.playbackSpeed);
        if (this.playbackIndex < this.trajectoryData.length) {
          this.updateFlightFrame(this.playbackIndex);
        } else {
          this.isPlaying = false;
        }
      }
      if (this.controls.enabled) {
        this.controls.update();
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

window.Rocket3DVisualizer = Rocket3DVisualizer;
