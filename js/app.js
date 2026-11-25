/**
 * Main Application Controller
 * Coordinates UI, file imports, weather API, 6-DOF simulation, and 3D rendering.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Services
  const parser = new OpenRocketParser();
  const weatherService = new WeatherService();
  const visualizer = new Rocket3DVisualizer("canvas-container");

  let currentSimulation = null;
  let chartAltitude = null;
  let chartVelocity = null;

  // DOM Elements
  const orkFileInput = document.getElementById("ork-file-input");
  const btnQuickSample = document.getElementById("btn-quick-sample");
  const btnExportOrk = document.getElementById("btn-export-ork");
  const activeRocketName = document.getElementById("active-rocket-name");

  // Environmental inputs
  const launchSiteSelect = document.getElementById("launch-site-select");
  const siteCoords = document.getElementById("site-coords");
  const customCoordsRow = document.getElementById("custom-coords-row");
  const btnFetchWeather = document.getElementById("btn-fetch-live-weather");
  const weatherWindSpeed = document.getElementById("weather-wind-speed");
  const weatherWindDir = document.getElementById("weather-wind-dir");
  const weatherTemp = document.getElementById("weather-temp");
  const weatherPressure = document.getElementById("weather-pressure");

  // Rail & Motor inputs
  const railLength = document.getElementById("rail-length");
  const railAngle = document.getElementById("rail-angle");
  const railHeading = document.getElementById("rail-heading");
  const railHeadingVal = document.getElementById("rail-heading-val");
  const simMotorSelect = document.getElementById("sim-motor-select");
  const simDelay = document.getElementById("sim-delay");

  // Telemetry HUD Elements
  const hudAlt = document.getElementById("hud-alt");
  const hudVel = document.getElementById("hud-vel");
  const hudAcc = document.getElementById("hud-acc");
  const hudTime = document.getElementById("hud-time");
  const hudFlightPhase = document.getElementById("hud-flight-phase");
  const phasePulse = document.getElementById("phase-pulse");
  const hudWarningsBox = document.getElementById("hud-warnings-box");
  const hudWarningsList = document.getElementById("hud-warnings-list");

  // Sim Playback Controls
  const btnSimPlay = document.getElementById("btn-sim-play");
  const btnSimReset = document.getElementById("btn-sim-reset");
  const btnSpeed1x = document.getElementById("btn-speed-1x");
  const btnSpeed2x = document.getElementById("btn-speed-2x");
  const btnSpeed5x = document.getElementById("btn-speed-5x");

  // Camera buttons
  const camPad = document.getElementById("cam-pad");
  const camFollow = document.getElementById("cam-follow");
  const camRocket = document.getElementById("cam-rocket");
  const camTop = document.getElementById("cam-top");

  // Stats Scorecard
  const statApogee = document.getElementById("stat-apogee");
  const statApogeeM = document.getElementById("stat-apogee-m");
  const statMaxVel = document.getElementById("stat-max-vel");
  const statMach = document.getElementById("stat-mach");
  const statOptDelay = document.getElementById("stat-opt-delay");
  const statDeployVel = document.getElementById("stat-deploy-vel");
  const statMaxAcc = document.getElementById("stat-max-acc");
  const statLandingVel = document.getElementById("stat-landing-vel");

  // Metrics
  const metricStability = document.getElementById("metric-stability");
  const metricCg = document.getElementById("metric-cg");
  const metricCp = document.getElementById("metric-cp");
  const metricMass = document.getElementById("metric-mass");

  // Set today's date in picker
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("sim-date").value = today;

  // Initialize Telemetry Charts
  initCharts();

  // Load initial Zephyr model & run simulation
  loadZephyrDefault();

  // 1. Handle .ork File Import
  orkFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      activeRocketName.textContent = `Loading ${file.name}...`;
      const buffer = await file.arrayBuffer();
      const parsedRocket = await parser.parseOrkFile(buffer);
      
      activeRocketName.textContent = parsedRocket.name;
      updateRocketUI(parsedRocket);
      runSimulation();
    } catch (err) {
      alert("Error parsing OpenRocket file: " + err.message);
      console.error(err);
    }
  });

  // 2. Load Sample Zephyr
  btnQuickSample.addEventListener("click", () => {
    loadZephyrDefault();
  });

  function loadZephyrDefault() {
    activeRocketName.textContent = "Apogee Zephyr (Tripoli L1 Setup)";
    const rocket = {
      name: "Apogee Zephyr",
      components: [
        { type: "nosecone", name: "Ogive Nose Cone", length: 0.503, radius: 0.051 },
        { type: "bodytube", name: "Upper Body Tube (Payload)", length: 0.457, radius: 0.051 },
        { type: "bodytube", name: "Lower Body Tube (Booster)", length: 0.457, radius: 0.051 },
        { type: "fins", name: "Zephyr TTW Plywood Fins", count: 3, rootChord: 0.22, tipChord: 0.09, span: 0.125, sweepLength: 0.13 }
      ],
      motor: {
        designation: simMotorSelect.value,
        delay: parseFloat(simDelay.value)
      },
      length: 1.417,
      diameter: 0.102,
      dryMass: 1.50,
      totalMass: 1.854
    };
    parser.rocket = rocket;
    parser.calculateBarrowmanStability();
    updateRocketUI(parser.rocket);
    runSimulation();
  }

  function updateRocketUI(rocket) {
    metricStability.textContent = `${rocket.stabilityCalibers || 1.82} cal (Stable)`;
    metricCg.textContent = `${rocket.cg || 1.02} m`;
    metricCp.textContent = `${rocket.cp || 1.21} m`;
    metricMass.textContent = `${rocket.totalMass || 1.85} kg (${((rocket.totalMass || 1.85) * 2.20462).toFixed(2)} lbs)`;
    visualizer.buildRocketModel(rocket);
  }

  // 3. Launch Site & Weather Sync
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
    btnFetchWeather.innerHTML = `<i data-lucide="loader" class="w-3 h-3 animate-spin"></i> Syncing...`;
    lucide.createIcons();

    const siteKey = launchSiteSelect.value;
    const customLat = document.getElementById("custom-lat")?.value;
    const customLon = document.getElementById("custom-lon")?.value;

    const weather = await weatherService.fetchLiveWeather(siteKey, customLat, customLon);
    weatherWindSpeed.value = weather.windSpeedMph;
    weatherWindDir.value = weather.windDirDeg;
    weatherTemp.value = weather.tempF;
    weatherPressure.value = weather.pressureMbar;

    btnFetchWeather.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> Updated`;
    lucide.createIcons();
    setTimeout(() => {
      btnFetchWeather.innerHTML = `<i data-lucide="refresh-cw" class="w-3 h-3"></i> Sync Live`;
      lucide.createIcons();
    }, 2000);

    runSimulation();
  }

  // Rail heading slider
  railHeading.addEventListener("input", () => {
    const val = parseInt(railHeading.value, 10);
    const dirs = ["North", "NE", "East", "SE", "South", "SW", "West", "NW", "North"];
    const compass = dirs[Math.round(val / 45)];
    railHeadingVal.textContent = `${val}° (${compass})`;
    runSimulation();
  });

  // Re-run simulation on parameter changes
  [weatherWindSpeed, weatherWindDir, weatherTemp, weatherPressure, railLength, railAngle, simMotorSelect, simDelay].forEach(el => {
    el.addEventListener("change", () => runSimulation());
  });

  // 4. Run 6-DOF Simulation
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

    parser.rocket.motor.designation = simMotorSelect.value;
    parser.rocket.motor.delay = parseFloat(simDelay.value);

    const simEngine = new RocketSimulation(parser.rocket, env);
    currentSimulation = simEngine.run(parseFloat(simDelay.value));

    // Update Telemetry Scorecard
    statApogee.textContent = `${currentSimulation.apogee.feet.toLocaleString()} ft`;
    statApogeeM.textContent = `${currentSimulation.apogee.meters.toLocaleString()} m`;
    statMaxVel.textContent = `${currentSimulation.maxVelocity.mph} mph`;
    statMach.textContent = `Mach ${currentSimulation.maxVelocity.mach}`;
    statOptDelay.textContent = `${currentSimulation.optimumDelay} s`;
    statDeployVel.textContent = `${currentSimulation.deploymentVelocity.fps} ft/s`;
    statMaxAcc.textContent = `${currentSimulation.maxAccelerationG} G`;
    statLandingVel.textContent = `${currentSimulation.landingVelocity.fps} ft/s`;

    // Warnings and Safety Checks
    updateWarnings(currentSimulation.warnings, currentSimulation);

    // Update Charts
    updateCharts(currentSimulation.trajectory);

    // Load into 3D World
    visualizer.loadSimulationTrajectory(currentSimulation.trajectory);
  }

  function updateWarnings(warnings, sim) {
    hudWarningsList.innerHTML = "";
    const list = [...warnings];

    // Check Tripoli delay warning
    if (Math.abs(sim.actualDelay - sim.optimumDelay) > 2.5) {
      list.push({
        type: "danger",
        title: "Sub-optimal Ejection Delay",
        text: `Motor delay (${sim.actualDelay}s) differs from optimum (${sim.optimumDelay}s). Drill delay with UDDT tool!`
      });
    }

    // Check Sparky motor standoff distance
    if (simMotorSelect.value === "I280DM") {
      list.push({
        type: "info",
        title: "Tripoli Sparky Rule",
        text: "Dark Matter propellant emits sparks. Tripoli Safety Code requires 200 ft minimum spectator standoff."
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

  // 5. Chart.js Setup
  function initCharts() {
    const ctxAlt = document.getElementById("chart-altitude").getContext("2d");
    chartAltitude = new Chart(ctxAlt, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Altitude (ft)",
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
          {
            label: "Velocity (mph)",
            data: [],
            borderColor: "#34d399",
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: "Thrust (N)",
            data: [],
            borderColor: "#f97316",
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0
          }
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

  function updateCharts(trajectory) {
    if (!trajectory || trajectory.length === 0) return;
    const sampled = trajectory.filter((_, i) => i % 5 === 0);

    const times = sampled.map(p => `${p.time}s`);
    const alts = sampled.map(p => p.altitudeFt);
    const vels = sampled.map(p => p.velocityMph);
    const thrusts = sampled.map(p => p.thrust);

    chartAltitude.data.labels = times;
    chartAltitude.data.datasets[0].data = alts;
    chartAltitude.update("none");

    chartVelocity.data.labels = times;
    chartVelocity.data.datasets[0].data = vels;
    chartVelocity.data.datasets[1].data = thrusts;
    chartVelocity.update("none");
  }

  // 6. Playback & HUD Event Listeners
  btnSimPlay.addEventListener("click", () => {
    if (visualizer.isPlaying) {
      visualizer.pause();
      btnSimPlay.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> RESUME`;
    } else {
      visualizer.play();
      btnSimPlay.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-white"></i> PAUSE`;
    }
    lucide.createIcons();
  });

  btnSimReset.addEventListener("click", () => {
    visualizer.reset();
    btnSimPlay.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> LAUNCH`;
    lucide.createIcons();
  });

  btnSpeed1x.addEventListener("click", () => { visualizer.setSpeed(1.0); highlightSpeedBtn(btnSpeed1x); });
  btnSpeed2x.addEventListener("click", () => { visualizer.setSpeed(2.0); highlightSpeedBtn(btnSpeed2x); });
  btnSpeed5x.addEventListener("click", () => { visualizer.setSpeed(5.0); highlightSpeedBtn(btnSpeed5x); });

  function highlightSpeedBtn(activeBtn) {
    [btnSpeed1x, btnSpeed2x, btnSpeed5x].forEach(b => {
      b.classList.remove("bg-slate-800", "text-sky-400", "font-bold");
      b.classList.add("text-slate-400");
    });
    activeBtn.classList.add("bg-slate-800", "text-sky-400", "font-bold");
    activeBtn.classList.remove("text-slate-400");
  }

  // Camera angle buttons
  camPad.addEventListener("click", () => setCamMode("pad", camPad));
  camFollow.addEventListener("click", () => setCamMode("follow", camFollow));
  camRocket.addEventListener("click", () => setCamMode("rocket", camRocket));
  camTop.addEventListener("click", () => setCamMode("top", camTop));

  function setCamMode(mode, activeBtn) {
    visualizer.setCameraMode(mode);
    [camPad, camFollow, camRocket, camTop].forEach(b => {
      b.classList.remove("bg-sky-600", "text-white");
      b.classList.add("bg-slate-800", "text-slate-300");
    });
    activeBtn.classList.add("bg-sky-600", "text-white");
    activeBtn.classList.remove("bg-slate-800", "text-slate-300");
  }

  // Real-time telemetry receiver from visualizer
  window.addEventListener("telemetry-update", (e) => {
    const p = e.detail;
    hudAlt.textContent = p.altitudeFt.toLocaleString();
    hudVel.textContent = p.velocityMph;
    hudAcc.textContent = p.accelG;
    hudTime.textContent = `T+ ${p.time.toFixed(2)}s`;

    // Flight phase badge
    if (p.phase === "powered") {
      hudFlightPhase.textContent = "Boost Phase (Thrust Powered)";
      hudFlightPhase.className = "text-xs font-mono font-bold text-amber-400 uppercase tracking-wide";
      phasePulse.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping";
    } else if (p.phase === "coast") {
      hudFlightPhase.textContent = "Coasting to Apogee";
      hudFlightPhase.className = "text-xs font-mono font-bold text-sky-400 uppercase tracking-wide";
      phasePulse.className = "w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse";
    } else if (p.phase === "descent") {
      if (p.posY <= 0.05) {
        hudFlightPhase.textContent = "Touchdown / Landed";
        hudFlightPhase.className = "text-xs font-mono font-bold text-emerald-400 uppercase tracking-wide";
        phasePulse.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
      } else {
        hudFlightPhase.textContent = "Parachute Recovery Descent";
        hudFlightPhase.className = "text-xs font-mono font-bold text-emerald-400 uppercase tracking-wide";
        phasePulse.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
      }
    }
  });

  // Export .ork / JSON config
  btnExportOrk.addEventListener("click", () => {
    const exportData = {
      rocket: parser.rocket,
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
    a.download = `${parser.rocket.name || "rocket"}-sim.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});
