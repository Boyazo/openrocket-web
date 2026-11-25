/**
 * Main Application Orchestrator:
 * Manages 3-Step Sequential Workflow:
 *  Step 1: 3D Rocket Designer & Component Config (Add/Edit parts, live Barrowman CG/CP)
 *  Step 2: Launch Site, Rail Standoff & Live Satellite Weather Setup
 *  Step 3: 3D Flight Simulation, Camera Modes, Propellant FX & Telemetry Graphs
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Initialize Services
  const parser = new OpenRocketParser();
  const weatherService = new WeatherService();
  
  // Dual 3D Renderers: Studio for CAD/Design, World for 3D Launch Flight
  const designVisualizer = new Rocket3DVisualizer("design-canvas-container", true);
  const flightVisualizer = new Rocket3DVisualizer("canvas-container", false);

  let currentSimulation = null;
  let chartAltitude = null;
  let chartVelocity = null;
  let selectedComponentIndex = 0;

  // Active Rocket State
  let activeRocket = {
    name: "Apogee Zephyr (L1 Build)",
    components: [
      { id: "nose-1", type: "nosecone", name: "Ogive Nose Cone", length: 0.503, radius: 0.051, color: "red" },
      { id: "tube-1", type: "bodytube", name: "Upper Body Tube (Payload)", length: 0.457, radius: 0.051, color: "white" },
      { id: "tube-2", type: "bodytube", name: "Lower Body Tube (Booster)", length: 0.457, radius: 0.051, color: "white" },
      { id: "fins-1", type: "fins", name: "Zephyr TTW Plywood Fins", count: 3, rootChord: 0.22, span: 0.125, tipChord: 0.09, sweepLength: 0.13, color: "black" }
    ],
    motor: {
      designation: "I280DM",
      delay: 10.0
    },
    diameter: 0.102,
    length: 1.417,
    dryMass: 1.50,
    totalMass: 1.854
  };

  // Workflow Stage Views
  const viewDesigner = document.getElementById("view-designer");
  const viewEnvironment = document.getElementById("view-environment");
  const viewSimulation = document.getElementById("view-simulation");

  const stepBtn1 = document.getElementById("workflow-step-1");
  const stepBtn2 = document.getElementById("workflow-step-2");
  const stepBtn3 = document.getElementById("workflow-step-3");

  const btnProceedToEnv = document.getElementById("btn-proceed-to-env");
  const btnBackToDesign = document.getElementById("btn-back-to-design");
  const btnProceedToSim = document.getElementById("btn-proceed-to-sim");

  // Parts List & Properties
  const designerPartsList = document.getElementById("designer-parts-list");
  const partPropertiesCard = document.getElementById("part-properties-card");
  const propPartName = document.getElementById("prop-part-name");
  const propPartType = document.getElementById("prop-part-type");
  const propLenIn = document.getElementById("prop-len-in");
  const propDiaIn = document.getElementById("prop-dia-in");
  const propColor = document.getElementById("prop-color");
  const btnSavePart = document.getElementById("btn-save-part");

  // Add Part Buttons
  const btnAddNose = document.getElementById("btn-add-nose");
  const btnAddTube = document.getElementById("btn-add-tube");
  const btnAddFins = document.getElementById("btn-add-fins");

  // Environmental inputs
  const launchSiteSelect = document.getElementById("launch-site-select");
  const siteCoords = document.getElementById("site-coords");
  const customCoordsRow = document.getElementById("custom-coords-row");
  const btnFetchWeather = document.getElementById("btn-fetch-live-weather");
  const weatherWindSpeed = document.getElementById("weather-wind-speed");
  const weatherWindDir = document.getElementById("weather-wind-dir");
  const weatherTemp = document.getElementById("weather-temp");
  const weatherPressure = document.getElementById("weather-pressure");

  const railLength = document.getElementById("rail-length");
  const railAngle = document.getElementById("rail-angle");
  const railHeading = document.getElementById("rail-heading");
  const railHeadingVal = document.getElementById("rail-heading-val");
  const simMotorSelect = document.getElementById("sim-motor-select");
  const simDelay = document.getElementById("sim-delay");

  // Flight Controls
  const btnSimPlay = document.getElementById("btn-sim-play");
  const btnSimReset = document.getElementById("btn-sim-reset");
  const btnSpeed1x = document.getElementById("btn-speed-1x");
  const btnSpeed2x = document.getElementById("btn-speed-2x");
  const btnSpeed5x = document.getElementById("btn-speed-5x");

  // Camera angles
  const camPad = document.getElementById("cam-pad");
  const camFollow = document.getElementById("cam-follow");
  const camRocket = document.getElementById("cam-rocket");
  const camTop = document.getElementById("cam-top");

  // Scorecard stats
  const statApogee = document.getElementById("stat-apogee");
  const statApogeeM = document.getElementById("stat-apogee-m");
  const statMaxVel = document.getElementById("stat-max-vel");
  const statMach = document.getElementById("stat-mach");
  const statOptDelay = document.getElementById("stat-opt-delay");
  const statDeployVel = document.getElementById("stat-deploy-vel");

  // HUD
  const hudAlt = document.getElementById("hud-alt");
  const hudVel = document.getElementById("hud-vel");
  const hudAcc = document.getElementById("hud-acc");
  const hudTime = document.getElementById("hud-time");
  const hudFlightPhase = document.getElementById("hud-flight-phase");
  const phasePulse = document.getElementById("phase-pulse");
  const hudWarningsBox = document.getElementById("hud-warnings-box");
  const hudWarningsList = document.getElementById("hud-warnings-list");

  // Navigation & Export
  const orkFileInput = document.getElementById("ork-file-input");
  const btnExportOrk = document.getElementById("btn-export-ork");
  const btnQuickSample = document.getElementById("btn-quick-sample");
  const activeRocketName = document.getElementById("active-rocket-name");

  // Set today's date
  document.getElementById("sim-date").value = new Date().toISOString().split("T")[0];

  // -------------------------------------------------------------
  // 1. WORKFLOW STEP SWITCHING LOGIC (DESIGN -> PAD -> LAUNCH)
  // -------------------------------------------------------------
  function switchWorkflowStep(stepNumber) {
    [viewDesigner, viewEnvironment, viewSimulation].forEach(v => v.classList.add("hidden"));
    [stepBtn1, stepBtn2, stepBtn3].forEach(b => {
      b.classList.remove("bg-brand-600", "text-white", "shadow");
      b.classList.add("text-slate-400");
    });

    if (stepNumber === 1) {
      viewDesigner.classList.remove("hidden");
      stepBtn1.classList.add("bg-brand-600", "text-white", "shadow");
      stepBtn1.classList.remove("text-slate-400");
      setTimeout(() => designVisualizer.onWindowResize(), 50);
    } else if (stepNumber === 2) {
      viewEnvironment.classList.remove("hidden");
      stepBtn2.classList.add("bg-brand-600", "text-white", "shadow");
      stepBtn2.classList.remove("text-slate-400");
    } else if (stepNumber === 3) {
      viewSimulation.classList.remove("hidden");
      stepBtn3.classList.add("bg-brand-600", "text-white", "shadow");
      stepBtn3.classList.remove("text-slate-400");
      setTimeout(() => flightVisualizer.onWindowResize(), 50);
      runSimulation(); // auto-simulate flight
    }
  }

  stepBtn1.addEventListener("click", () => switchWorkflowStep(1));
  stepBtn2.addEventListener("click", () => switchWorkflowStep(2));
  stepBtn3.addEventListener("click", () => switchWorkflowStep(3));

  btnProceedToEnv.addEventListener("click", () => switchWorkflowStep(2));
  btnBackToDesign.addEventListener("click", () => switchWorkflowStep(1));
  btnProceedToSim.addEventListener("click", () => switchWorkflowStep(3));

  // -------------------------------------------------------------
  // 2. COMPONENT LIST & DESIGNER LOGIC
  // -------------------------------------------------------------
  function renderComponentTree() {
    designerPartsList.innerHTML = "";
    activeRocket.components.forEach((comp, idx) => {
      const card = document.createElement("div");
      card.className = `p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
        idx === selectedComponentIndex
          ? "bg-sky-950/60 border-sky-500 shadow-sm"
          : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
      }`;

      const icon = comp.type === "nosecone" ? "cone" : (comp.type === "fins" ? "triangle" : "cylinder");
      const lenIn = ((comp.length || 0.457) * 39.3701).toFixed(1);
      const diaIn = ((comp.radius || 0.051) * 2 * 39.3701).toFixed(1);

      card.innerHTML = `
        <div class="flex items-center gap-2">
          <i data-lucide="${icon}" class="w-4 h-4 text-sky-400"></i>
          <div>
            <div class="font-bold text-xs text-slate-200">${comp.name}</div>
            <div class="text-[10px] text-slate-400 font-mono">Len: ${lenIn}" | Dia: ${diaIn}"</div>
          </div>
        </div>
        <button class="text-rose-400 hover:text-rose-300 p-1 text-xs" data-delete="${idx}" title="Delete component">✕</button>
      `;

      card.addEventListener("click", (e) => {
        if (e.target.dataset.delete !== undefined) return;
        selectedComponentIndex = idx;
        renderComponentTree();
        populatePartProperties(comp);
      });

      const delBtn = card.querySelector(`[data-delete="${idx}"]`);
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (activeRocket.components.length <= 1) {
          alert("A rocket must have at least one component!");
          return;
        }
        activeRocket.components.splice(idx, 1);
        selectedComponentIndex = Math.max(0, idx - 1);
        recalculateAndRender();
      });

      designerPartsList.appendChild(card);
    });

    lucide.createIcons();
    if (activeRocket.components[selectedComponentIndex]) {
      populatePartProperties(activeRocket.components[selectedComponentIndex]);
    }
  }

  function populatePartProperties(comp) {
    propPartName.textContent = comp.name;
    propPartType.textContent = comp.type;
    propLenIn.value = ((comp.length || 0.457) * 39.3701).toFixed(1);
    propDiaIn.value = ((comp.radius || 0.051) * 2 * 39.3701).toFixed(1);
    propColor.value = comp.color || "white";
  }

  btnSavePart.addEventListener("click", () => {
    const comp = activeRocket.components[selectedComponentIndex];
    if (!comp) return;

    comp.length = parseFloat(propLenIn.value) / 39.3701;
    comp.radius = (parseFloat(propDiaIn.value) / 2) / 39.3701;
    comp.color = propColor.value;

    recalculateAndRender();
  });

  // Adding Parts
  btnAddNose.addEventListener("click", () => {
    activeRocket.components.unshift({
      id: "nose-" + Date.now(),
      type: "nosecone",
      name: "New Nose Cone",
      length: 0.4,
      radius: 0.051,
      color: "red"
    });
    selectedComponentIndex = 0;
    recalculateAndRender();
  });

  btnAddTube.addEventListener("click", () => {
    activeRocket.components.push({
      id: "tube-" + Date.now(),
      type: "bodytube",
      name: `Body Tube Section`,
      length: 0.4,
      radius: 0.051,
      color: "white"
    });
    selectedComponentIndex = activeRocket.components.length - 1;
    recalculateAndRender();
  });

  btnAddFins.addEventListener("click", () => {
    activeRocket.components.push({
      id: "fins-" + Date.now(),
      type: "fins",
      name: `Trapezoid Fin Set`,
      count: 3,
      rootChord: 0.20,
      span: 0.12,
      tipChord: 0.08,
      sweepLength: 0.12,
      color: "black"
    });
    selectedComponentIndex = activeRocket.components.length - 1;
    recalculateAndRender();
  });

  function recalculateAndRender() {
    parser.rocket = activeRocket;
    parser.calculateBarrowmanStability();

    // Total length
    let totalLen = 0;
    activeRocket.components.forEach(c => {
      if (c.type === "nosecone" || c.type === "bodytube") totalLen += c.length;
    });
    activeRocket.length = totalLen;

    // Update Designer Metrics
    document.getElementById("designer-stability").textContent = `${activeRocket.stabilityCalibers || 1.82} cal (Stable)`;
    document.getElementById("designer-cg").textContent = `${(activeRocket.cg || 1.02).toFixed(2)} m`;
    document.getElementById("designer-cp").textContent = `${(activeRocket.cp || 1.21).toFixed(2)} m`;
    document.getElementById("designer-len").textContent = `${(totalLen * 39.3701).toFixed(1)} in (${totalLen.toFixed(2)}m)`;

    renderComponentTree();
    designVisualizer.buildRocketModel(activeRocket);
    flightVisualizer.buildRocketModel(activeRocket);
  }

  // -------------------------------------------------------------
  // 3. LAUNCH SITE & LIVE SATELLITE WEATHER LOGIC
  // -------------------------------------------------------------
  launchSiteSelect.addEventListener("change", async () => {
    const siteKey = launchSiteSelect.value;
    if (siteKey === "custom") {
      customCoordsRow.classList.remove("hidden");
      customCoordsRow.classList.add("grid");
    } else {
      customCoordsRow.classList.add("hidden");
      customCoordsRow.classList.remove("grid");
      const site = weatherService.getSite(siteKey);
      siteCoords.textContent = `${site.lat.toFixed(2)}° N, ${Math.abs(site.lon).toFixed(2)}° W`;
    }
    await syncWeather();
  });

  btnFetchWeather.addEventListener("click", () => syncWeather());

  async function syncWeather() {
    btnFetchWeather.innerHTML = `<i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> Syncing...`;
    lucide.createIcons();

    const siteKey = launchSiteSelect.value;
    const customLat = document.getElementById("custom-lat")?.value;
    const customLon = document.getElementById("custom-lon")?.value;

    const weather = await weatherService.fetchLiveWeather(siteKey, customLat, customLon);
    weatherWindSpeed.value = weather.windSpeedMph;
    weatherWindDir.value = weather.windDirDeg;
    weatherTemp.value = weather.tempF;
    weatherPressure.value = weather.pressureMbar;

    btnFetchWeather.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i> Synced!`;
    lucide.createIcons();
    setTimeout(() => {
      btnFetchWeather.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sync Live Weather`;
      lucide.createIcons();
    }, 2000);
  }

  railHeading.addEventListener("input", () => {
    const val = parseInt(railHeading.value, 10);
    const dirs = ["North", "NE", "East", "SE", "South", "SW", "West", "NW", "North"];
    const compass = dirs[Math.round(val / 45)];
    railHeadingVal.textContent = `${val}° (${compass})`;
  });

  // -------------------------------------------------------------
  // 4. 6-DOF SIMULATION & TELEMETRY CHARTS
  // -------------------------------------------------------------
  function runSimulation() {
    const env = {
      windSpeed: parseFloat(weatherWindSpeed.value) * 0.44704, // mph to m/s
      windHeading: parseFloat(weatherWindDir.value),
      temperature: (parseFloat(weatherTemp.value) - 32) * (5/9) + 273.15,
      pressure: parseFloat(weatherPressure.value) * 100,
      railLength: parseFloat(railLength.value),
      railAngle: parseFloat(railAngle.value),
      railAzimuth: parseFloat(railHeading.value)
    };

    activeRocket.motor.designation = simMotorSelect.value;
    activeRocket.motor.delay = parseFloat(simDelay.value);

    const simEngine = new RocketSimulation(activeRocket, env);
    currentSimulation = simEngine.run(parseFloat(simDelay.value));

    // Update Scorecard
    statApogee.textContent = `${currentSimulation.apogee.feet.toLocaleString()} ft`;
    statApogeeM.textContent = `${currentSimulation.apogee.meters.toLocaleString()} m`;
    statMaxVel.textContent = `${currentSimulation.maxVelocity.mph} mph`;
    statMach.textContent = `Mach ${currentSimulation.maxVelocity.mach}`;
    statOptDelay.textContent = `${currentSimulation.optimumDelay} s`;
    statDeployVel.textContent = `${currentSimulation.deploymentVelocity.fps} ft/s`;

    // Warnings
    updateWarnings(currentSimulation.warnings, currentSimulation);

    // Update Charts & Trajectory
    updateCharts(currentSimulation.trajectory);
    flightVisualizer.loadSimulationTrajectory(currentSimulation.trajectory);
  }

  function updateWarnings(warnings, sim) {
    hudWarningsList.innerHTML = "";
    const list = [...warnings];

    if (Math.abs(sim.actualDelay - sim.optimumDelay) > 2.5) {
      list.push({
        title: "Sub-optimal Delay",
        text: `Configured delay (${sim.actualDelay}s) vs Optimum (${sim.optimumDelay}s). Drill down with UDDT tool!`
      });
    }

    if (simMotorSelect.value === "I280DM") {
      list.push({
        title: "Tripoli Sparky Rule",
        text: "Dark Matter propellant emits sparks: minimum 200 ft spectator standoff required."
      });
    }

    if (list.length > 0) {
      hudWarningsBox.classList.remove("hidden");
      list.forEach(w => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="font-bold text-amber-300">${w.title}:</span> ${w.text}`;
        hudWarningsList.appendChild(li);
      });
    } else {
      hudWarningsBox.classList.add("hidden");
    }
  }

  function initCharts() {
    const ctxAlt = document.getElementById("chart-altitude").getContext("2d");
    chartAltitude = new Chart(ctxAlt, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          data: [],
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          borderWidth: 2,
          fill: true,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "#1e293b" }, ticks: { color: "#64748b", font: { size: 9 } } },
          y: { grid: { color: "#1e293b" }, ticks: { color: "#64748b", font: { size: 9 } } }
        }
      }
    });

    const ctxVel = document.getElementById("chart-velocity").getContext("2d");
    chartVelocity = new Chart(ctxVel, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { data: [], borderColor: "#34d399", borderWidth: 2, pointRadius: 0 },
          { data: [], borderColor: "#f97316", borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "#1e293b" }, ticks: { color: "#64748b", font: { size: 9 } } },
          y: { grid: { color: "#1e293b" }, ticks: { color: "#64748b", font: { size: 9 } } }
        }
      }
    });
  }

  function updateCharts(traj) {
    if (!traj || traj.length === 0) return;
    const sampled = traj.filter((_, i) => i % 5 === 0);
    const times = sampled.map(p => `${p.time}s`);

    chartAltitude.data.labels = times;
    chartAltitude.data.datasets[0].data = sampled.map(p => p.altitudeFt);
    chartAltitude.update("none");

    chartVelocity.data.labels = times;
    chartVelocity.data.datasets[0].data = sampled.map(p => p.velocityMph);
    chartVelocity.data.datasets[1].data = sampled.map(p => p.thrust);
    chartVelocity.update("none");
  }

  // -------------------------------------------------------------
  // 5. PLAYBACK & REAL-TIME HUD EVENTS
  // -------------------------------------------------------------
  btnSimPlay.addEventListener("click", () => {
    if (flightVisualizer.isPlaying) {
      flightVisualizer.pause();
      btnSimPlay.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> RESUME`;
    } else {
      flightVisualizer.play();
      btnSimPlay.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-white"></i> PAUSE`;
    }
    lucide.createIcons();
  });

  btnSimReset.addEventListener("click", () => {
    flightVisualizer.reset();
    btnSimPlay.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> LAUNCH`;
    lucide.createIcons();
  });

  btnSpeed1x.addEventListener("click", () => { flightVisualizer.setSpeed(1.0); highlightSpeed(btnSpeed1x); });
  btnSpeed2x.addEventListener("click", () => { flightVisualizer.setSpeed(2.0); highlightSpeed(btnSpeed2x); });
  btnSpeed5x.addEventListener("click", () => { flightVisualizer.setSpeed(5.0); highlightSpeed(btnSpeed5x); });

  function highlightSpeed(btn) {
    [btnSpeed1x, btnSpeed2x, btnSpeed5x].forEach(b => {
      b.classList.remove("bg-slate-800", "text-sky-400", "font-bold");
      b.classList.add("text-slate-400");
    });
    btn.classList.add("bg-slate-800", "text-sky-400", "font-bold");
    btn.classList.remove("text-slate-400");
  }

  // Camera views
  camPad.addEventListener("click", () => setCamMode("pad", camPad));
  camFollow.addEventListener("click", () => setCamMode("follow", camFollow));
  camRocket.addEventListener("click", () => setCamMode("rocket", camRocket));
  camTop.addEventListener("click", () => setCamMode("top", camTop));

  function setCamMode(mode, btn) {
    flightVisualizer.setCameraMode(mode);
    [camPad, camFollow, camRocket, camTop].forEach(b => {
      b.classList.remove("bg-sky-600", "text-white");
      b.classList.add("bg-slate-800", "text-slate-300");
    });
    btn.classList.add("bg-sky-600", "text-white");
    btn.classList.remove("bg-slate-800", "text-slate-300");
  }

  window.addEventListener("telemetry-update", (e) => {
    const p = e.detail;
    hudAlt.textContent = p.altitudeFt.toLocaleString();
    hudVel.textContent = p.velocityMph;
    hudAcc.textContent = p.accelG;
    hudTime.textContent = `T+ ${p.time.toFixed(2)}s`;

    if (p.phase === "powered") {
      hudFlightPhase.textContent = "Boost Phase (Thrust Powered)";
      hudFlightPhase.className = "text-xs font-mono font-bold text-amber-400 uppercase";
      phasePulse.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping";
    } else if (p.phase === "coast") {
      hudFlightPhase.textContent = "Coasting to Apogee";
      hudFlightPhase.className = "text-xs font-mono font-bold text-sky-400 uppercase";
      phasePulse.className = "w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse";
    } else if (p.phase === "descent") {
      if (p.posY <= 0.05) {
        hudFlightPhase.textContent = "Touchdown / Landed";
        hudFlightPhase.className = "text-xs font-mono font-bold text-emerald-400 uppercase";
        phasePulse.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
      } else {
        hudFlightPhase.textContent = "Parachute Recovery Descent";
        hudFlightPhase.className = "text-xs font-mono font-bold text-emerald-400 uppercase";
        phasePulse.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
      }
    }
  });

  // -------------------------------------------------------------
  // 6. .ORK IMPORT & EXPORT
  // -------------------------------------------------------------
  orkFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      activeRocketName.textContent = `Loading ${file.name}...`;
      const buffer = await file.arrayBuffer();
      const parsed = await parser.parseOrkFile(buffer);
      activeRocket = parsed;
      activeRocketName.textContent = parsed.name;
      recalculateAndRender();
      switchWorkflowStep(1); // Go straight to designer
    } catch (err) {
      alert("Error parsing OpenRocket file: " + err.message);
    }
  });

  btnQuickSample.addEventListener("click", () => {
    location.reload();
  });

  btnExportOrk.addEventListener("click", () => {
    const exportData = {
      rocket: activeRocket,
      simulation: currentSimulation ? {
        apogee: currentSimulation.apogee,
        maxVelocity: currentSimulation.maxVelocity,
        optimumDelay: currentSimulation.optimumDelay
      } : null
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeRocket.name || "rocket"}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Initial Startup
  initCharts();
  recalculateAndRender();
  switchWorkflowStep(1); // Start in Rocket Designer
});
