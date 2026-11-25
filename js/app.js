/**
 * OpenRocket Web Edition Controller
 * Connects OpenRocket CAD Layout:
 *  - Component Tree (Sustainer, Nose cone, Body tubes, Fins, Coupler, Rings)
 *  - Recursive Deletion (handles deleting child subcomponents inside body tubes!)
 *  - 2D Blueprint Canvas (Centimeter ruler, technical line render, CG/CP markers)
 *  - Synchronizes all design edits directly into 6-DOF simulation & 3D launch world!
 */

document.addEventListener("DOMContentLoaded", () => {
  window.globalMotorDb = new MotorDatabase();
  const motorDb = window.globalMotorDb;
  const parser = new OpenRocketParser();
  const weatherService = new WeatherService();
  const blueprint = new RocketBlueprintRenderer("blueprint-canvas", "ruler-canvas");
  const flightVisualizer = new Rocket3DVisualizer("canvas-container", false);

  // Active Rocket Architecture (Default Apogee Zephyr)
  let activeRocket = {
    name: "Apogee Zephyr",
    stage: "Sustainer",
    components: [
      { id: "comp-1", type: "nosecone", name: "Nose cone", length: 0.503, radius: 0.051, color: "white", children: [] },
      { id: "comp-2", type: "bodytube", name: "Body tube", length: 0.457, radius: 0.051, color: "white", children: [
        { id: "comp-2a", type: "coupler", name: "Tube coupler", length: 0.15, radius: 0.049 },
        { id: "comp-2b", type: "parachute", name: "Parachute", diameter: 1.22 }
      ]},
      { id: "comp-3", type: "bodytube", name: "Body tube", length: 0.457, radius: 0.051, color: "white", children: [
        { id: "comp-3a", type: "shockcord", name: "Shock cord", length: 7.5 },
        { id: "comp-3b", type: "fins", name: "Freeform fin set", count: 3, rootChord: 0.22, span: 0.125, tipChord: 0.09, sweepLength: 0.13 },
        { id: "comp-3c", type: "innertube", name: "Inner Tube", length: 0.279, radius: 0.019 },
        { id: "comp-3d", type: "ring", name: "Centering ring", position: 0.02 },
        { id: "comp-3e", type: "ring", name: "Centering ring", position: 0.26 },
        { id: "comp-3f", type: "eyebolt", name: "Eye bolt, nut and washers" },
        { id: "comp-3g", type: "protector", name: "Parachute protector" }
      ]}
    ],
    motor: {
      designation: "I280DM",
      delay: 10.0
    },
    length: 1.417,
    diameter: 0.102,
    dryMass: 1.492,
    totalMass: 1.846
  };

  let selectedComponent = activeRocket.components[0];
  let currentSimulation = null;
  let chartAltitude = null;

  // DOM Elements - Navigation Tabs
  const tabRocketDesign = document.getElementById("tab-rocket-design");
  const tabMotorsConfig = document.getElementById("tab-motors-config");
  const tabFlightSims = document.getElementById("tab-flight-sims");
  const btnTestFlightTop = document.getElementById("btn-test-flight-top");

  const viewRocketDesign = document.getElementById("view-rocket-design");
  const viewMotorsConfig = document.getElementById("view-motors-config");
  const viewFlightSims = document.getElementById("view-flight-sims");

  // Tree & Actions
  const treeContainer = document.getElementById("tree-container");
  const btnTreeUp = document.getElementById("btn-tree-up");
  const btnTreeDown = document.getElementById("btn-tree-down");
  const btnTreeEdit = document.getElementById("btn-tree-edit");
  const btnTreeDelete = document.getElementById("btn-tree-delete");

  // Add Component Toolbar
  const toolAddNose = document.getElementById("tool-add-nose");
  const toolAddBodytube = document.getElementById("tool-add-bodytube");
  const toolAddTransition = document.getElementById("tool-add-transition");
  const toolAddTrapezoidFins = document.getElementById("tool-add-trapezoid-fins");
  const toolAddFreeformFins = document.getElementById("tool-add-freeform-fins");
  const toolAddInnertube = document.getElementById("tool-add-innertube");
  const toolAddCoupler = document.getElementById("tool-add-coupler");
  const toolAddRings = document.getElementById("tool-add-rings");
  const toolAddParachute = document.getElementById("tool-add-parachute");
  const toolAddMass = document.getElementById("tool-add-mass");

  // Blueprint Toolbar
  const selectViewType = document.getElementById("select-view-type");
  const btnZoomIn = document.getElementById("btn-zoom-in");
  const btnZoomOut = document.getElementById("btn-zoom-out");
  const zoomLevelText = document.getElementById("zoom-level-text");
  const checkShowCgCp = document.getElementById("check-show-cg-cp");
  const checkCallipers = document.getElementById("check-callipers");
  const configMotorSelect = document.getElementById("config-motor-select");

  // Edit Modal
  const editModal = document.getElementById("edit-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalCompName = document.getElementById("modal-comp-name");
  const modalCompLen = document.getElementById("modal-comp-len");
  const modalCompDia = document.getElementById("modal-comp-dia");
  const modalCompColor = document.getElementById("modal-comp-color");
  const modalClose = document.getElementById("modal-close");
  const modalBtnCancel = document.getElementById("modal-btn-cancel");
  const modalBtnSave = document.getElementById("modal-btn-save");

  // File I/O
  const orkFileInput = document.getElementById("ork-file-input");
  const btnExportOrk = document.getElementById("btn-export-ork");

  // -------------------------------------------------------------
  // 1. TAB SWITCHING
  // -------------------------------------------------------------
  function switchTab(target) {
    [viewRocketDesign, viewMotorsConfig, viewFlightSims].forEach(v => v?.classList.add("hidden"));
    [tabRocketDesign, tabMotorsConfig, tabFlightSims].forEach(t => {
      if (t) t.className = "px-4 h-full border-t border-l border-r border-transparent hover:bg-slate-100 font-medium text-slate-600 rounded-t-sm";
    });

    if (target === "design") {
      viewRocketDesign?.classList.remove("hidden");
      if (tabRocketDesign) tabRocketDesign.className = "px-4 h-full border-t border-l border-r border-slate-300 bg-white font-bold text-slate-800 rounded-t-sm shadow-sm";
      setTimeout(() => {
        blueprint.resizeCanvases();
        blueprint.draw();
      }, 50);
    } else if (target === "motors") {
      viewMotorsConfig?.classList.remove("hidden");
      if (tabMotorsConfig) tabMotorsConfig.className = "px-4 h-full border-t border-l border-r border-slate-300 bg-white font-bold text-slate-800 rounded-t-sm shadow-sm";
    } else if (target === "sims") {
      viewFlightSims?.classList.remove("hidden");
      if (tabFlightSims) tabFlightSims.className = "px-4 h-full border-t border-l border-r border-slate-300 bg-white font-bold text-slate-800 rounded-t-sm shadow-sm";
      flightVisualizer.buildRocketModel(activeRocket);
      setTimeout(() => flightVisualizer.onWindowResize(), 50);
      runSimulation();
    }
  }

  tabRocketDesign?.addEventListener("click", () => switchTab("design"));
  tabMotorsConfig?.addEventListener("click", () => switchTab("motors"));
  tabFlightSims?.addEventListener("click", () => switchTab("sims"));
  btnTestFlightTop?.addEventListener("click", () => switchTab("sims"));

  // -------------------------------------------------------------
  // 2. OPENROCKET COMPONENT TREE RENDERING
  // -------------------------------------------------------------
  function renderTree() {
    if (!treeContainer) return;
    treeContainer.innerHTML = "";

    const root = document.createElement("div");
    root.className = "flex items-center gap-1 text-slate-800 font-bold px-1 py-0.5";
    root.innerHTML = `<i data-lucide="folder" class="w-3.5 h-3.5 text-sky-600"></i> <span>${activeRocket.stage || "Sustainer"}</span>`;
    treeContainer.appendChild(root);

    (activeRocket.components || []).forEach((comp) => {
      const item = document.createElement("div");
      const isSelected = selectedComponent === comp;
      item.className = `flex items-center justify-between pl-4 pr-1 py-1 rounded cursor-pointer ${
        isSelected ? "tree-item-selected" : "hover:bg-slate-100 text-slate-700"
      }`;

      let icon = "cone";
      if (comp.type === "bodytube") icon = "cylinder";
      else if (comp.type === "fins") icon = "triangle";

      item.innerHTML = `
        <div class="flex items-center gap-1.5">
          <i data-lucide="${icon}" class="w-3.5 h-3.5 text-slate-500"></i>
          <span>${comp.name}</span>
        </div>
      `;

      item.addEventListener("click", () => {
        selectedComponent = comp;
        renderTree();
      });

      item.addEventListener("dblclick", () => {
        openEditModal(comp);
      });

      treeContainer.appendChild(item);

      // Render Child subcomponents
      if (comp.children && comp.children.length > 0) {
        comp.children.forEach(sub => {
          const subItem = document.createElement("div");
          const isSubSelected = selectedComponent === sub;
          subItem.className = `flex items-center gap-1.5 pl-8 pr-1 py-0.5 rounded cursor-pointer text-[11px] ${
            isSubSelected ? "tree-item-selected" : "hover:bg-slate-100 text-slate-600"
          }`;

          let subIcon = "box";
          if (sub.type === "parachute") subIcon = "umbrella";
          else if (sub.type === "fins") subIcon = "triangle";
          else if (sub.type === "innertube") subIcon = "circle-dot";
          else if (sub.type === "ring") subIcon = "disc";
          else if (sub.type === "coupler") subIcon = "link";

          subItem.innerHTML = `<i data-lucide="${subIcon}" class="w-3 h-3 text-slate-400"></i> <span>${sub.name}</span>`;

          subItem.addEventListener("click", () => {
            selectedComponent = sub;
            renderTree();
          });

          subItem.addEventListener("dblclick", () => {
            openEditModal(sub);
          });

          treeContainer.appendChild(subItem);
        });
      }
    });

    if (window.lucide) lucide.createIcons();
    updateReadouts();
  }

  // -------------------------------------------------------------
  // 3. EDIT & DELETE (Supports both Root & Nested Subcomponents!)
  // -------------------------------------------------------------
  function openEditModal(comp) {
    selectedComponent = comp;
    modalTitle.textContent = `Edit ${comp.name}`;
    modalCompName.value = comp.name;
    modalCompLen.value = comp.length ? (comp.length * 100).toFixed(1) : 45.7;
    modalCompDia.value = comp.radius ? (comp.radius * 2 * 100).toFixed(1) : 10.2;
    modalCompColor.value = comp.color || "white";
    editModal.classList.remove("hidden");
  }

  modalClose?.addEventListener("click", () => editModal.classList.add("hidden"));
  modalBtnCancel?.addEventListener("click", () => editModal.classList.add("hidden"));

  modalBtnSave?.addEventListener("click", () => {
    if (!selectedComponent) return;
    selectedComponent.name = modalCompName.value;
    if (selectedComponent.length !== undefined) {
      selectedComponent.length = parseFloat(modalCompLen.value) / 100;
    }
    if (selectedComponent.radius !== undefined) {
      selectedComponent.radius = (parseFloat(modalCompDia.value) / 2) / 100;
    }
    selectedComponent.color = modalCompColor.value;

    editModal.classList.add("hidden");
    recalcStability();
    renderTree();
    blueprint.setRocket(activeRocket);
    flightVisualizer.buildRocketModel(activeRocket);
  });

  btnTreeEdit?.addEventListener("click", () => {
    if (selectedComponent) openEditModal(selectedComponent);
  });

  // RECURSIVE DELETE (Deletes root components OR child items inside bodytubes)
  btnTreeDelete?.addEventListener("click", () => {
    if (!selectedComponent) return;

    // Check top level
    const topIdx = activeRocket.components.indexOf(selectedComponent);
    if (topIdx !== -1) {
      activeRocket.components.splice(topIdx, 1);
      selectedComponent = activeRocket.components[0] || null;
    } else {
      // Check inside child subcomponents of body tubes
      for (const comp of activeRocket.components) {
        if (comp.children) {
          const childIdx = comp.children.indexOf(selectedComponent);
          if (childIdx !== -1) {
            comp.children.splice(childIdx, 1);
            selectedComponent = comp;
            break;
          }
        }
      }
    }

    recalcStability();
    renderTree();
    blueprint.setRocket(activeRocket);
    flightVisualizer.buildRocketModel(activeRocket);
  });

  // -------------------------------------------------------------
  // 4. ADD COMPONENTS TOOLBAR
  // -------------------------------------------------------------
  toolAddNose?.addEventListener("click", () => {
    activeRocket.components.unshift({
      id: "nose-" + Date.now(),
      type: "nosecone",
      name: "Nose cone",
      length: 0.503,
      radius: 0.051,
      color: "white",
      children: []
    });
    recalcStability();
    renderTree();
    blueprint.setRocket(activeRocket);
    flightVisualizer.buildRocketModel(activeRocket);
  });

  toolAddBodytube?.addEventListener("click", () => {
    activeRocket.components.push({
      id: "tube-" + Date.now(),
      type: "bodytube",
      name: "Body tube",
      length: 0.457,
      radius: 0.051,
      color: "white",
      children: []
    });
    recalcStability();
    renderTree();
    blueprint.setRocket(activeRocket);
    flightVisualizer.buildRocketModel(activeRocket);
  });

  toolAddFreeformFins?.addEventListener("click", () => {
    const targetTube = (selectedComponent && selectedComponent.type === "bodytube")
      ? selectedComponent
      : activeRocket.components.filter(c => c.type === "bodytube").pop();

    if (targetTube) {
      if (!targetTube.children) targetTube.children = [];
      targetTube.children.push({
        id: "fins-" + Date.now(),
        type: "fins",
        name: "Freeform fin set",
        count: 3,
        rootChord: 0.22,
        span: 0.125,
        tipChord: 0.09,
        sweepLength: 0.13
      });
      recalcStability();
      renderTree();
      blueprint.setRocket(activeRocket);
      flightVisualizer.buildRocketModel(activeRocket);
    }
  });

  toolAddParachute?.addEventListener("click", () => {
    const targetTube = (selectedComponent && selectedComponent.type === "bodytube")
      ? selectedComponent
      : activeRocket.components.find(c => c.type === "bodytube");

    if (targetTube) {
      if (!targetTube.children) targetTube.children = [];
      targetTube.children.push({
        id: "chute-" + Date.now(),
        type: "parachute",
        name: "Parachute",
        diameter: 1.22
      });
      recalcStability();
      renderTree();
      blueprint.setRocket(activeRocket);
      flightVisualizer.buildRocketModel(activeRocket);
    }
  });

  // -------------------------------------------------------------
  // 5. BLUEPRINT VIEWPORT & RECALCULATION
  // -------------------------------------------------------------
  btnZoomIn?.addEventListener("click", () => {
    blueprint.zoom = Math.min(2.0, blueprint.zoom + 0.15);
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(blueprint.zoom * 100)}%`;
    blueprint.draw();
  });

  btnZoomOut?.addEventListener("click", () => {
    blueprint.zoom = Math.max(0.4, blueprint.zoom - 0.15);
    if (zoomLevelText) zoomLevelText.textContent = `${Math.round(blueprint.zoom * 100)}%`;
    blueprint.draw();
  });

  checkShowCgCp?.addEventListener("change", () => {
    blueprint.showCgCp = checkShowCgCp.checked;
    blueprint.draw();
  });

  checkCallipers?.addEventListener("change", () => {
    blueprint.showCallipers = checkCallipers.checked;
    blueprint.draw();
  });

  const configTableMotor = document.getElementById("config-table-motor");
  const configTableDelay = document.getElementById("config-table-delay");

  // Populate Motor Selection Dropdowns (both in Blueprint toolbar and Motors & Config tab)
  function populateMotorDropdown(selectedCode) {
    const dropdowns = [configMotorSelect, configTableMotor].filter(Boolean);
    if (dropdowns.length === 0) return;

    const allMotors = motorDb.getAllMotors();

    // Group motors by impulse class
    const classes = {};
    allMotors.forEach(m => {
      const cls = m.impulseClass || m.code.charAt(0);
      if (!classes[cls]) classes[cls] = [];
      classes[cls].push(m);
    });

    dropdowns.forEach(dd => {
      dd.innerHTML = "";

      Object.keys(classes).sort().forEach(cls => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `Class ${cls} Motors`;
        classes[cls].forEach(m => {
          const opt = document.createElement("option");
          opt.value = m.code;
          const diaMm = Math.round((m.diameter || 0.038) * 1000);
          const delayStr = m.defaultDelay ? `-${m.defaultDelay}` : "";
          opt.textContent = `${m.manufacturer || 'Aerotech'} ${m.code}${delayStr} (${m.avgThrust}N avg / ${diaMm}mm)`;
          if (selectedCode && (m.code === selectedCode || m.code.toUpperCase() === selectedCode.toUpperCase())) {
            opt.selected = true;
          }
          optgroup.appendChild(opt);
        });
        dd.appendChild(optgroup);
      });

      // If selected code is not in predefined list, add it dynamically
      if (selectedCode && !allMotors.some(m => m.code === selectedCode || m.code.toUpperCase() === selectedCode.toUpperCase())) {
        const customOpt = document.createElement("option");
        customOpt.value = selectedCode;
        customOpt.textContent = `${activeRocket.motor?.manufacturer || 'Imported'} ${selectedCode} (Active Imported Motor)`;
        customOpt.selected = true;
        dd.insertBefore(customOpt, dd.firstChild);
      }

      if (selectedCode) {
        dd.value = selectedCode;
      }
    });

    if (configTableDelay && activeRocket.motor?.delay) {
      configTableDelay.value = activeRocket.motor.delay;
    }
  }

  populateMotorDropdown(activeRocket.motor?.designation || "I280DM");

  function onMotorChanged(newMotorCode) {
    activeRocket.motor.designation = newMotorCode;
    if (configMotorSelect) configMotorSelect.value = newMotorCode;
    if (configTableMotor) configTableMotor.value = newMotorCode;

    const delayVal = configTableDelay ? parseFloat(configTableDelay.value) || 10 : 10;
    activeRocket.motor.delay = delayVal;

    const infoFlight = document.getElementById("info-flight-config");
    if (infoFlight) infoFlight.textContent = `Flight configuration: [${newMotorCode}-${delayVal}]`;

    // Recalculate and update simulations
    blueprint.draw();
    runSimulation();
  }

  configMotorSelect?.addEventListener("change", () => onMotorChanged(configMotorSelect.value));
  configTableMotor?.addEventListener("change", () => onMotorChanged(configTableMotor.value));
  configTableDelay?.addEventListener("input", () => {
    activeRocket.motor.delay = parseFloat(configTableDelay.value) || 10;
    const infoFlight = document.getElementById("info-flight-config");
    if (infoFlight) infoFlight.textContent = `Flight configuration: [${activeRocket.motor.designation}-${activeRocket.motor.delay}]`;
    runSimulation();
  });

  function recalcStability() {
    parser.rocket = activeRocket;
    parser.calculateBarrowmanStability();
    updateReadouts();
  }

  function updateReadouts() {
    let len = 0;
    (activeRocket.components || []).forEach(c => {
      if (c.length) len += c.length;
    });
    activeRocket.length = len;

    const cgCm = (activeRocket.cg || 1.02) * 100;
    const cpCm = (activeRocket.cp || 1.21) * 100;
    const stabCal = (((activeRocket.cp || 1.21) - (activeRocket.cg || 1.02)) / 0.102).toFixed(2);

    const elTitle = document.getElementById("active-rocket-title");
    const elInfoTitle = document.getElementById("info-rocket-title");
    const elLen = document.getElementById("info-len");
    const elCg = document.getElementById("info-cg");
    const elCp = document.getElementById("info-cp");
    const elStab = document.getElementById("info-stability-cal");

    if (elTitle) elTitle.textContent = `${activeRocket.name} (${activeRocket.stage || "Sustainer"})`;
    if (elInfoTitle) elInfoTitle.textContent = `Rocket: ${activeRocket.name}`;
    if (elLen) elLen.textContent = `${Math.round(len * 100)} cm`;
    if (elCg) elCg.textContent = `${Math.round(cgCm)} cm`;
    if (elCp) elCp.textContent = `${Math.round(cpCm)} cm`;
    if (elStab) elStab.textContent = `${stabCal} cal`;
  }

  // -------------------------------------------------------------
  // 6. 3D FLIGHT SIMULATION EXECUTION (Re-simulates dynamically on design change!)
  // -------------------------------------------------------------
  function runSimulation() {
    const env = {
      windSpeed: (parseFloat(document.getElementById("weather-wind-speed")?.value) || 6.5) * 0.44704,
      windHeading: parseFloat(document.getElementById("weather-wind-dir")?.value) || 240,
      temperature: ((parseFloat(document.getElementById("weather-temp")?.value) || 72) - 32) * (5/9) + 273.15,
      pressure: (parseFloat(document.getElementById("weather-pressure")?.value) || 1013) * 100,
      railLength: parseFloat(document.getElementById("rail-length")?.value) || 2.44,
      railAngle: parseFloat(document.getElementById("rail-angle")?.value) || 0,
      railAzimuth: 0
    };

    if (configMotorSelect) activeRocket.motor.designation = configMotorSelect.value;
    const simEngine = new RocketSimulation(activeRocket, env);
    currentSimulation = simEngine.run(activeRocket.motor?.delay || 10.0);

    // Update Blueprint Prediction Box
    const elApogee = document.getElementById("info-apogee");
    const elMaxVel = document.getElementById("info-max-vel");
    if (elApogee) elApogee.textContent = `${currentSimulation.apogee.meters} m (${currentSimulation.apogee.feet} ft)`;
    if (elMaxVel) elMaxVel.textContent = `${currentSimulation.maxVelocity.mps} m/s (Mach ${currentSimulation.maxVelocity.mach})`;

    // Load trajectory & rebuild 3D rocket
    flightVisualizer.buildRocketModel(activeRocket);
    flightVisualizer.loadSimulationTrajectory(currentSimulation.trajectory);

    // Altitude Chart
    updateAltChart(currentSimulation.trajectory);
  }

  function updateAltChart(traj) {
    if (!traj) return;
    const chartEl = document.getElementById("chart-altitude");
    if (!chartEl) return;
    const ctx = chartEl.getContext("2d");
    if (!chartAltitude) {
      chartAltitude = new Chart(ctx, {
        type: "line",
        data: {
          labels: [],
          datasets: [{ data: [], borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0, fill: true, backgroundColor: "rgba(56,189,248,0.1)" }]
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

    const sampled = traj.filter((_, i) => i % 6 === 0);
    chartAltitude.data.labels = sampled.map(p => `${p.time}s`);
    chartAltitude.data.datasets[0].data = sampled.map(p => p.altitudeFt);
    chartAltitude.update();
  }

  // 3D Playback buttons
  const btnSimPlay = document.getElementById("btn-sim-play");
  const btnSimReset = document.getElementById("btn-sim-reset");

  btnSimPlay?.addEventListener("click", () => {
    if (flightVisualizer.isPlaying) {
      flightVisualizer.pause();
      btnSimPlay.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> LAUNCH`;
    } else {
      flightVisualizer.play();
      btnSimPlay.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-white"></i> PAUSE`;
    }
    if (window.lucide) lucide.createIcons();
  });

  btnSimReset?.addEventListener("click", () => {
    flightVisualizer.reset();
    if (btnSimPlay) btnSimPlay.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-white"></i> LAUNCH`;
    if (window.lucide) lucide.createIcons();
  });

  window.addEventListener("telemetry-update", (e) => {
    const p = e.detail;
    const elAlt = document.getElementById("hud-alt");
    const elVel = document.getElementById("hud-vel");
    const elAcc = document.getElementById("hud-acc");
    const elTime = document.getElementById("hud-time");
    if (elAlt) elAlt.textContent = p.altitudeFt.toLocaleString();
    if (elVel) elVel.textContent = p.velocityMph;
    if (elAcc) elAcc.textContent = p.accelG;
    if (elTime) elTime.textContent = `T+ ${p.time.toFixed(2)}s`;
  });

  document.getElementById("cam-pad")?.addEventListener("click", () => flightVisualizer.setCameraMode("pad"));
  document.getElementById("cam-follow")?.addEventListener("click", () => flightVisualizer.setCameraMode("follow"));
  document.getElementById("cam-rocket")?.addEventListener("click", () => flightVisualizer.setCameraMode("rocket"));

  document.getElementById("btn-fetch-live-weather")?.addEventListener("click", async () => {
    const siteSelect = document.getElementById("launch-site-select");
    const w = await weatherService.fetchLiveWeather(siteSelect ? siteSelect.value : "friends_lake");
    const elWs = document.getElementById("weather-wind-speed");
    const elWd = document.getElementById("weather-wind-dir");
    const elT = document.getElementById("weather-temp");
    const elP = document.getElementById("weather-pressure");
    if (elWs) elWs.value = w.windSpeedMph;
    if (elWd) elWd.value = w.windDirDeg;
    if (elT) elT.value = w.tempF;
    if (elP) elP.value = w.pressureMbar;
    runSimulation();
  });

  document.getElementById("btn-re-simulate")?.addEventListener("click", () => runSimulation());

  // -------------------------------------------------------------
  // 7. FILE IMPORT / EXPORT (Completely wired!)
  // -------------------------------------------------------------
  orkFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parser.parseOrkFile(buffer);
      activeRocket = parsed;
      selectedComponent = activeRocket.components[0] || null;

      // Update motor dropdown to match the motor from the imported .ork file
      populateMotorDropdown(activeRocket.motor?.designation || "I280DM");
      const infoFlight = document.getElementById("info-flight-config");
      if (infoFlight) {
        infoFlight.textContent = `Flight configuration: [${activeRocket.motor?.designation || "I280DM"}-${activeRocket.motor?.delay || 10}]`;
      }

      recalcStability();
      renderTree();
      blueprint.setRocket(activeRocket);
      flightVisualizer.buildRocketModel(activeRocket);
      runSimulation();
      switchTab("design");
    } catch (err) {
      alert("Error parsing .ork file: " + err.message);
      console.error(err);
    }
  });

  btnExportOrk?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(activeRocket, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeRocket.name || "rocket"}-design.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Startup initialization
  recalcStability();
  renderTree();
  blueprint.setRocket(activeRocket);
  flightVisualizer.buildRocketModel(activeRocket);
});
