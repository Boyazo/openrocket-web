/**
 * Three.js 3D Rocket Visualizer & Launch World
 * Renders high-fidelity 3D rocket geometry (nosecone, body tubes, fins, rail buttons, motor),
 * launch rail pad, desert launch terrain, sky atmosphere, camera modes,
 * particle exhaust plume, and animated parachute deployment.
 */

class Rocket3DVisualizer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.rocketGroup = new THREE.Group();
    this.parachuteMesh = null;
    this.flameParticles = null;
    this.smokeParticles = null;

    this.cameraMode = "pad"; // "pad", "follow", "rocket", "top"
    this.activeSimPoint = null;
    this.isPlaying = false;
    this.playbackIndex = 0;
    this.playbackSpeed = 1.0;
    this.trajectoryData = [];

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1128); // Deep desert twilight blue
    this.scene.fog = new THREE.FogExp2(0x0a1128, 0.0004);

    // 2. Camera & Orbit Controls
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    this.camera.position.set(4, 3, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.01; // don't go below ground

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    sunLight.position.set(50, 100, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    const d = 20;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);

    // 4. Ground Environment (Desert Launch Playa)
    this.createGround();

    // 5. Launch Rail Pad
    this.createLaunchPad();

    // 6. Build Rocket Geometry
    this.scene.add(this.rocketGroup);
    this.buildRocketModel();

    // 7. Exhaust & Smoke Particles
    this.createExhaustEffects();

    // 8. Event Listeners
    window.addEventListener("resize", () => this.onWindowResize());

    // 9. Start Render Loop
    this.animate();
  }

  createGround() {
    // Large desert playa floor
    const groundGeo = new THREE.PlaneGeometry(8000, 8000, 64, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x8b7d6b, // Tan desert dirt
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Grid lines for scale
    const grid = new THREE.GridHelper(200, 50, 0x38bdf8, 0x334155);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  createLaunchPad() {
    this.padGroup = new THREE.Group();

    // 3-Legged Tripod Pad Stand
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(Math.cos(angle) * 0.7, 0.4, Math.sin(angle) * 0.7);
      leg.rotation.z = Math.PI / 4;
      leg.rotation.y = -angle;
      this.padGroup.add(leg);
    }

    // Blast Deflector
    const deflectorGeo = new THREE.ConeGeometry(0.5, 0.4, 16);
    const deflectorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const deflector = new THREE.Mesh(deflectorGeo, deflectorMat);
    deflector.position.y = 0.2;
    this.padGroup.add(deflector);

    // 8 ft 1010 Extruded Aluminum Rail
    const railHeight = 2.44; // 8 ft
    const railGeo = new THREE.BoxGeometry(0.05, railHeight, 0.05);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0.07, railHeight / 2 + 0.3, 0);
    this.padGroup.add(rail);

    this.scene.add(this.padGroup);
  }

  buildRocketModel(rocketConfig) {
    // Clear existing rocket parts
    while (this.rocketGroup.children.length > 0) {
      this.rocketGroup.remove(this.rocketGroup.children[0]);
    }

    const radius = 0.051; // 4" diameter Zephyr (0.102m diameter / 2)
    const upperLen = 0.457;
    const lowerLen = 0.457;
    const noseLen = 0.503;

    // Materials
    const bodyMatWhite = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.3,
      metalness: 0.1
    });
    const noseMatRed = new THREE.MeshStandardMaterial({
      color: 0xef4444, // High-vis rocket red
      roughness: 0.25,
      metalness: 0.1
    });
    const finMatBlack = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.2
    });
    const motorMatGold = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.2,
      metalness: 0.8
    });

    let currentY = 0.35; // base of rocket above pad

    // 1. Motor Casing (AeroTech 38mm)
    const motorGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.356, 32);
    const motorMesh = new THREE.Mesh(motorGeo, motorMatGold);
    motorMesh.position.y = currentY + 0.356 / 2;
    this.rocketGroup.add(motorMesh);

    // 2. Lower Body Tube (Booster)
    const lowerGeo = new THREE.CylinderGeometry(radius, radius, lowerLen, 32);
    const lowerMesh = new THREE.Mesh(lowerGeo, bodyMatWhite);
    lowerMesh.position.y = currentY + lowerLen / 2;
    lowerMesh.castShadow = true;
    this.rocketGroup.add(lowerMesh);

    // 3. Plywood Fins (3 Fins TTW)
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(0.125, 0.11);
      finShape.lineTo(0.125, 0.20);
      finShape.lineTo(0, 0.22);
      finShape.closePath();

      const extrudeSettings = { depth: 0.005, bevelEnabled: false };
      const finGeo = new THREE.ExtrudeGeometry(finShape, extrudeSettings);
      const finMesh = new THREE.Mesh(finGeo, finMatBlack);

      finMesh.rotation.y = angle;
      finMesh.position.y = currentY + 0.02;
      this.rocketGroup.add(finMesh);
    }

    currentY += lowerLen;

    // 4. Upper Body Tube (Payload)
    const upperGeo = new THREE.CylinderGeometry(radius, radius, upperLen, 32);
    const upperMesh = new THREE.Mesh(upperGeo, bodyMatWhite);
    upperMesh.position.y = currentY + upperLen / 2;
    upperMesh.castShadow = true;
    this.rocketGroup.add(upperMesh);

    currentY += upperLen;

    // 5. Ogive Nose Cone
    const noseGeo = new THREE.ConeGeometry(radius, noseLen, 32);
    const noseMesh = new THREE.Mesh(noseGeo, noseMatRed);
    noseMesh.position.y = currentY + noseLen / 2;
    noseMesh.castShadow = true;
    this.rocketGroup.add(noseMesh);

    currentY += noseLen;

    // 6. 48" Hemispherical Parachute (Initially hidden, deployed at apogee)
    const chuteGeo = new THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const chuteMat = new THREE.MeshStandardMaterial({
      color: 0xf97316, // High-vis safety orange
      side: THREE.DoubleSide,
      roughness: 0.8
    });
    this.parachuteMesh = new THREE.Mesh(chuteGeo, chuteMat);
    this.parachuteMesh.position.y = currentY + 0.8;
    this.parachuteMesh.scale.set(0.001, 0.001, 0.001); // invisible at pad
    this.rocketGroup.add(this.parachuteMesh);

    // Initial position on the pad
    this.rocketGroup.position.set(0, 0, 0);
  }

  createExhaustEffects() {
    // Fiery Sparky Exhaust Cone (Dark Matter propellant)
    const flameGeo = new THREE.ConeGeometry(0.06, 0.5, 16);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.9
    });
    this.flameMesh = new THREE.Mesh(flameGeo, flameMat);
    this.flameMesh.rotation.x = Math.PI; // point down
    this.flameMesh.position.y = 0.1;
    this.flameMesh.visible = false;
    this.rocketGroup.add(this.flameMesh);

    // Sparks & Smoke Particle System
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 0.1;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const pMaterial = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.08,
      transparent: true,
      opacity: 0.8
    });
    this.particleSystem = new THREE.Points(geometry, pMaterial);
    this.particleSystem.visible = false;
    this.rocketGroup.add(this.particleSystem);
  }

  loadSimulationTrajectory(trajData) {
    this.trajectoryData = trajData;
    this.playbackIndex = 0;
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  reset() {
    this.isPlaying = false;
    this.playbackIndex = 0;
    this.updateFlightFrame(0);
  }

  setSpeed(speedMultiplier) {
    this.playbackSpeed = speedMultiplier;
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  updateFlightFrame(index) {
    if (!this.trajectoryData || this.trajectoryData.length === 0) return;
    if (index >= this.trajectoryData.length) {
      this.isPlaying = false;
      return;
    }

    const point = this.trajectoryData[index];
    this.activeSimPoint = point;

    // Position rocket based on 6-DOF simulation
    this.rocketGroup.position.set(point.posX, point.posY, point.posZ);

    // Motor Exhaust visibility
    if (point.thrust > 10) {
      this.flameMesh.visible = true;
      this.particleSystem.visible = true;
      const flicker = 0.8 + Math.random() * 0.4;
      this.flameMesh.scale.set(flicker, flicker * 1.5, flicker);
    } else {
      this.flameMesh.visible = false;
      this.particleSystem.visible = false;
    }

    // Parachute Deployment animation
    if (point.phase === "descent") {
      this.parachuteMesh.visible = true;
      // inflate parachute
      const scale = Math.min(1.0, (this.parachuteMesh.scale.x + 0.1));
      this.parachuteMesh.scale.set(scale, scale, scale);
      // Gentle swing under parachute
      this.rocketGroup.rotation.z = Math.sin(point.time * 2) * 0.05;
      this.rocketGroup.rotation.x = Math.cos(point.time * 2) * 0.05;
    } else {
      this.parachuteMesh.visible = false;
      this.parachuteMesh.scale.set(0.001, 0.001, 0.001);
      this.rocketGroup.rotation.set(0, 0, 0);
    }

    // Camera Modes
    this.updateCamera(point);

    // Dispatch telemetry event for HUD and charts
    window.dispatchEvent(new CustomEvent("telemetry-update", { detail: point }));
  }

  updateCamera(point) {
    const rY = point.posY;
    const rX = point.posX;
    const rZ = point.posZ;

    if (this.cameraMode === "pad") {
      // Stationary launch pad spectator view
      this.controls.enabled = true;
      this.controls.target.set(rX, Math.min(rY, 400), rZ);
    } else if (this.cameraMode === "follow") {
      // Chase camera floating 15 meters behind and above rocket
      this.controls.enabled = false;
      this.camera.position.set(rX + 8, rY + 6, rZ + 12);
      this.camera.lookAt(rX, rY + 1, rZ);
    } else if (this.cameraMode === "rocket") {
      // On-board fin / payload GoPro looking down
      this.controls.enabled = false;
      this.camera.position.set(rX, rY + 0.8, rZ + 0.15);
      this.camera.lookAt(rX, rY - 20, rZ);
    } else if (this.cameraMode === "top") {
      // Satellite / drone bird's eye view
      this.controls.enabled = false;
      this.camera.position.set(rX, rY + 50, rZ + 1);
      this.camera.lookAt(rX, rY, rZ);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

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
