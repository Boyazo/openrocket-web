/**
 * OpenRocket Comprehensive Motor Database & RSE Parser
 * Contains major Estes, Cesaroni (CTI), and AeroTech motors across classes A through M
 * Supports parsing custom .rse / .eng files packed inside .ork archives!
 */

class MotorDatabase {
  constructor() {
    this.motors = {
      // --- LOW POWER (Estes & Quest: A - D) ---
      "A8": {
        manufacturer: "Estes",
        code: "A8",
        commonName: "A8",
        impulseClass: "A",
        diameter: 0.018,
        length: 0.070,
        totalImpulse: 2.5,
        burnTime: 0.5,
        avgThrust: 8.0,
        peakThrust: 14.0,
        propellantMass: 0.0031,
        totalMass: 0.016,
        delays: [0, 3, 5],
        defaultDelay: 3,
        curve: [[0.0, 0.2], [0.05, 1.0], [0.2, 0.45], [0.5, 0.35], [0.8, 0.25], [1.0, 0.0]]
      },
      "B6": {
        manufacturer: "Estes",
        code: "B6",
        commonName: "B6",
        impulseClass: "B",
        diameter: 0.018,
        length: 0.070,
        totalImpulse: 5.0,
        burnTime: 0.85,
        avgThrust: 6.0,
        peakThrust: 13.0,
        propellantMass: 0.0062,
        totalMass: 0.019,
        delays: [0, 4, 6],
        defaultDelay: 4,
        curve: [[0.0, 0.2], [0.06, 1.0], [0.25, 0.45], [0.6, 0.35], [0.9, 0.25], [1.0, 0.0]]
      },
      "C6": {
        manufacturer: "Estes",
        code: "C6",
        commonName: "C6",
        impulseClass: "C",
        diameter: 0.018,
        length: 0.070,
        totalImpulse: 10.0,
        burnTime: 1.6,
        avgThrust: 6.0,
        peakThrust: 14.0,
        propellantMass: 0.0125,
        totalMass: 0.025,
        delays: [0, 3, 5, 7],
        defaultDelay: 5,
        curve: [[0.0, 0.2], [0.05, 1.0], [0.2, 0.4], [0.6, 0.32], [0.9, 0.25], [1.0, 0.0]]
      },
      "D12": {
        manufacturer: "Estes",
        code: "D12",
        commonName: "D12",
        impulseClass: "D",
        diameter: 0.024,
        length: 0.070,
        totalImpulse: 20.0,
        burnTime: 1.65,
        avgThrust: 12.0,
        peakThrust: 30.0,
        propellantMass: 0.025,
        totalMass: 0.043,
        delays: [0, 3, 5, 7],
        defaultDelay: 5,
        curve: [[0.0, 0.3], [0.08, 1.0], [0.25, 0.38], [0.6, 0.32], [0.9, 0.2], [1.0, 0.0]]
      },

      // --- MID POWER (E - G) ---
      "E12": {
        manufacturer: "Estes",
        code: "E12",
        commonName: "E12",
        impulseClass: "E",
        diameter: 0.024,
        length: 0.095,
        totalImpulse: 38.0,
        burnTime: 2.8,
        avgThrust: 12.0,
        peakThrust: 30.0,
        propellantMass: 0.036,
        totalMass: 0.060,
        delays: [0, 4, 6, 8],
        defaultDelay: 6,
        curve: [[0.0, 0.3], [0.06, 1.0], [0.25, 0.4], [0.6, 0.35], [0.9, 0.25], [1.0, 0.0]]
      },
      "E16": {
        manufacturer: "Estes",
        code: "E16",
        commonName: "E16",
        impulseClass: "E",
        diameter: 0.029,
        length: 0.114,
        totalImpulse: 40.0,
        burnTime: 2.1,
        avgThrust: 16.0,
        peakThrust: 34.0,
        propellantMass: 0.040,
        totalMass: 0.080,
        delays: [4, 6, 8],
        defaultDelay: 6,
        curve: [[0.0, 0.3], [0.08, 1.0], [0.3, 0.45], [0.7, 0.4], [1.0, 0.0]]
      },
      "F29": {
        manufacturer: "AeroTech",
        code: "F29",
        commonName: "F29",
        impulseClass: "F",
        diameter: 0.029,
        length: 0.124,
        totalImpulse: 60.0,
        burnTime: 2.1,
        avgThrust: 29.0,
        peakThrust: 45.0,
        propellantMass: 0.030,
        totalMass: 0.085,
        delays: [4, 8],
        defaultDelay: 8,
        curve: [[0.0, 0.4], [0.08, 1.0], [0.4, 0.65], [0.8, 0.6], [1.0, 0.0]]
      },
      "F50": {
        manufacturer: "AeroTech",
        code: "F50",
        commonName: "F50",
        impulseClass: "F",
        diameter: 0.029,
        length: 0.124,
        totalImpulse: 78.0,
        burnTime: 1.5,
        avgThrust: 50.0,
        peakThrust: 72.0,
        propellantMass: 0.038,
        totalMass: 0.090,
        delays: [4, 6, 9],
        defaultDelay: 6,
        curve: [[0.0, 0.5], [0.05, 1.0], [0.3, 0.7], [0.8, 0.65], [1.0, 0.0]]
      },
      "G80": {
        manufacturer: "AeroTech",
        code: "G80",
        commonName: "G80",
        impulseClass: "G",
        diameter: 0.029,
        length: 0.124,
        totalImpulse: 138.0,
        burnTime: 1.7,
        avgThrust: 80.0,
        peakThrust: 135.0,
        propellantMass: 0.062,
        totalMass: 0.145,
        delays: [4, 7, 10, 13],
        defaultDelay: 10,
        curve: [[0.0, 0.4], [0.05, 1.0], [0.3, 0.65], [0.7, 0.55], [0.95, 0.4], [1.0, 0.0]]
      },
      "G76G": {
        manufacturer: "AeroTech",
        code: "G76G",
        commonName: "G76G",
        impulseClass: "G",
        diameter: 0.029,
        length: 0.124,
        totalImpulse: 110.0,
        burnTime: 1.45,
        avgThrust: 76.0,
        peakThrust: 115.0,
        propellantMass: 0.054,
        totalMass: 0.130,
        delays: [4, 7, 10],
        defaultDelay: 7,
        curve: [[0.0, 0.35], [0.08, 1.0], [0.4, 0.7], [0.85, 0.6], [1.0, 0.0]]
      },

      // --- HIGH POWER LEVEL 1 (H - I) ---
      "H128W": {
        manufacturer: "AeroTech",
        code: "H128W",
        commonName: "H128W",
        impulseClass: "H",
        diameter: 0.029,
        length: 0.200,
        totalImpulse: 198.0,
        burnTime: 1.55,
        avgThrust: 128.0,
        peakThrust: 180.0,
        propellantMass: 0.098,
        totalMass: 0.210,
        delays: [6, 9, 12, 14],
        defaultDelay: 10,
        curve: [[0.0, 0.3], [0.1, 1.0], [0.5, 0.8], [0.9, 0.7], [1.0, 0.0]]
      },
      "H180W": {
        manufacturer: "AeroTech",
        code: "H180W",
        commonName: "H180W",
        impulseClass: "H",
        diameter: 0.029,
        length: 0.240,
        totalImpulse: 240.0,
        burnTime: 1.30,
        avgThrust: 184.0,
        peakThrust: 230.0,
        propellantMass: 0.115,
        totalMass: 0.230,
        delays: [6, 10, 14],
        defaultDelay: 10,
        curve: [[0.0, 0.4], [0.08, 1.0], [0.6, 0.85], [0.95, 0.5], [1.0, 0.0]]
      },
      "H135W": {
        manufacturer: "Cesaroni",
        code: "H135W",
        commonName: "H135W",
        impulseClass: "H",
        diameter: 0.029,
        length: 0.180,
        totalImpulse: 215.0,
        burnTime: 1.60,
        avgThrust: 135.0,
        peakThrust: 195.0,
        propellantMass: 0.105,
        totalMass: 0.220,
        delays: [9, 13],
        defaultDelay: 9,
        curve: [[0.0, 0.4], [0.08, 1.0], [0.4, 0.75], [0.8, 0.65], [1.0, 0.0]]
      },
      "H250G": {
        manufacturer: "Cesaroni",
        code: "H250G",
        commonName: "H250G",
        impulseClass: "H",
        diameter: 0.038,
        length: 0.190,
        totalImpulse: 230.0,
        burnTime: 0.92,
        avgThrust: 250.0,
        peakThrust: 310.0,
        propellantMass: 0.112,
        totalMass: 0.260,
        delays: [8, 12, 14],
        defaultDelay: 10,
        curve: [[0.0, 0.5], [0.05, 1.0], [0.5, 0.8], [0.9, 0.6], [1.0, 0.0]]
      },
      "I280DM": {
        manufacturer: "AeroTech",
        code: "I280DM",
        commonName: "I280DM",
        impulseClass: "I",
        diameter: 0.038,
        length: 0.356,
        totalImpulse: 370.0,
        burnTime: 1.35,
        avgThrust: 274.0,
        peakThrust: 345.0,
        propellantMass: 0.178,
        totalMass: 0.354,
        delays: [6, 8, 10, 12, 14],
        defaultDelay: 10,
        curve: [
          [0.0, 0.2],
          [0.05, 1.0],
          [0.2, 0.95],
          [0.5, 0.85],
          [0.8, 0.75],
          [0.95, 0.4],
          [1.0, 0.0]
        ]
      },
      "I350CS": {
        manufacturer: "AeroTech",
        code: "I350CS",
        commonName: "I350CS",
        impulseClass: "I",
        diameter: 0.038,
        length: 0.356,
        totalImpulse: 398.0,
        burnTime: 1.15,
        avgThrust: 346.0,
        peakThrust: 420.0,
        propellantMass: 0.190,
        totalMass: 0.380,
        delays: [8, 10, 12, 14],
        defaultDelay: 10,
        curve: [[0.0, 0.5], [0.05, 1.0], [0.4, 0.9], [0.9, 0.8], [1.0, 0.0]]
      },
      "I218R": {
        manufacturer: "AeroTech",
        code: "I218R",
        commonName: "I218R",
        impulseClass: "I",
        diameter: 0.038,
        length: 0.356,
        totalImpulse: 380.0,
        burnTime: 1.74,
        avgThrust: 218.0,
        peakThrust: 290.0,
        propellantMass: 0.185,
        totalMass: 0.365,
        delays: [8, 10, 14],
        defaultDelay: 10,
        curve: [[0.0, 0.4], [0.08, 1.0], [0.5, 0.8], [0.9, 0.7], [1.0, 0.0]]
      },
      "I435T": {
        manufacturer: "Cesaroni",
        code: "I435T",
        commonName: "I435T",
        impulseClass: "I",
        diameter: 0.038,
        length: 0.315,
        totalImpulse: 460.0,
        burnTime: 1.05,
        avgThrust: 435.0,
        peakThrust: 560.0,
        propellantMass: 0.225,
        totalMass: 0.460,
        delays: [10, 14, 18],
        defaultDelay: 14,
        curve: [[0.0, 0.5], [0.05, 1.0], [0.4, 0.85], [0.85, 0.7], [1.0, 0.0]]
      },

      // --- HIGH POWER LEVEL 2 (J - L) ---
      "J350W": {
        manufacturer: "AeroTech",
        code: "J350W",
        commonName: "J350W",
        impulseClass: "J",
        diameter: 0.054,
        length: 0.326,
        totalImpulse: 720.0,
        burnTime: 2.05,
        avgThrust: 351.0,
        peakThrust: 450.0,
        propellantMass: 0.350,
        totalMass: 0.720,
        delays: [10, 14, 18],
        defaultDelay: 14,
        curve: [[0.0, 0.3], [0.1, 1.0], [0.5, 0.85], [0.9, 0.75], [1.0, 0.0]]
      },
      "J420R": {
        manufacturer: "AeroTech",
        code: "J420R",
        commonName: "J420R",
        impulseClass: "J",
        diameter: 0.054,
        length: 0.326,
        totalImpulse: 840.0,
        burnTime: 2.00,
        avgThrust: 420.0,
        peakThrust: 530.0,
        propellantMass: 0.410,
        totalMass: 0.810,
        delays: [11, 14, 18],
        defaultDelay: 14,
        curve: [[0.0, 0.4], [0.07, 1.0], [0.45, 0.85], [0.9, 0.7], [1.0, 0.0]]
      },
      "K550W": {
        manufacturer: "AeroTech",
        code: "K550W",
        commonName: "K550W",
        impulseClass: "K",
        diameter: 0.054,
        length: 0.550,
        totalImpulse: 1650.0,
        burnTime: 3.00,
        avgThrust: 550.0,
        peakThrust: 720.0,
        propellantMass: 0.820,
        totalMass: 1.550,
        delays: [12, 16, 20],
        defaultDelay: 16,
        curve: [[0.0, 0.3], [0.08, 1.0], [0.5, 0.8], [0.9, 0.7], [1.0, 0.0]]
      },
      "L1000W": {
        manufacturer: "AeroTech",
        code: "L1000W",
        commonName: "L1000W",
        impulseClass: "L",
        diameter: 0.075,
        length: 0.650,
        totalImpulse: 3800.0,
        burnTime: 3.80,
        avgThrust: 1000.0,
        peakThrust: 1400.0,
        propellantMass: 1.850,
        totalMass: 3.450,
        delays: [15, 20],
        defaultDelay: 18,
        curve: [[0.0, 0.4], [0.06, 1.0], [0.4, 0.85], [0.85, 0.75], [1.0, 0.0]]
      },
      "M1297W": {
        manufacturer: "AeroTech",
        code: "M1297W",
        commonName: "M1297W",
        impulseClass: "M",
        diameter: 0.098,
        length: 0.750,
        totalImpulse: 7800.0,
        burnTime: 6.00,
        avgThrust: 1300.0,
        peakThrust: 1850.0,
        propellantMass: 3.900,
        totalMass: 7.200,
        delays: [18, 25],
        defaultDelay: 20,
        curve: [[0.0, 0.3], [0.05, 1.0], [0.5, 0.85], [0.9, 0.75], [1.0, 0.0]]
      }
    };
  }

  getMotor(code) {
    if (!code) return this.motors["I280DM"];
    const cleanCode = code.toUpperCase().trim();
    if (this.motors[cleanCode]) return this.motors[cleanCode];

    // Search partial match
    const foundKey = Object.keys(this.motors).find(k => cleanCode.startsWith(k) || k.startsWith(cleanCode));
    if (foundKey) return this.motors[foundKey];

    // Fallback: Synthesize plausible motor based on standard letter class
    const impulseLetter = cleanCode.charAt(0);
    const letterMap = {
      'A': { impulse: 2.5, thrust: 8, burn: 0.5, pMass: 0.003, tMass: 0.016, dia: 0.018, len: 0.07 },
      'B': { impulse: 5.0, thrust: 6, burn: 0.85, pMass: 0.006, tMass: 0.019, dia: 0.018, len: 0.07 },
      'C': { impulse: 10.0, thrust: 6, burn: 1.6, pMass: 0.012, tMass: 0.025, dia: 0.018, len: 0.07 },
      'D': { impulse: 20.0, thrust: 12, burn: 1.65, pMass: 0.025, tMass: 0.043, dia: 0.024, len: 0.07 },
      'E': { impulse: 40.0, thrust: 16, burn: 2.5, pMass: 0.040, tMass: 0.070, dia: 0.029, len: 0.11 },
      'F': { impulse: 80.0, thrust: 40, burn: 2.0, pMass: 0.045, tMass: 0.095, dia: 0.029, len: 0.12 },
      'G': { impulse: 140.0, thrust: 80, burn: 1.7, pMass: 0.065, tMass: 0.140, dia: 0.029, len: 0.12 },
      'H': { impulse: 240.0, thrust: 160, burn: 1.5, pMass: 0.110, tMass: 0.220, dia: 0.029, len: 0.20 },
      'I': { impulse: 400.0, thrust: 280, burn: 1.4, pMass: 0.180, tMass: 0.360, dia: 0.038, len: 0.356 },
      'J': { impulse: 800.0, thrust: 400, burn: 2.0, pMass: 0.380, tMass: 0.750, dia: 0.054, len: 0.35 },
      'K': { impulse: 1600.0, thrust: 550, burn: 2.9, pMass: 0.800, tMass: 1.550, dia: 0.054, len: 0.55 },
      'L': { impulse: 3600.0, thrust: 1000, burn: 3.6, pMass: 1.800, tMass: 3.400, dia: 0.075, len: 0.65 },
      'M': { impulse: 7500.0, thrust: 1300, burn: 5.8, pMass: 3.800, tMass: 7.200, dia: 0.098, len: 0.75 }
    };

    const spec = letterMap[impulseLetter] || letterMap['I'];
    const syntheticMotor = {
      manufacturer: "Custom",
      code: cleanCode,
      commonName: cleanCode,
      impulseClass: impulseLetter,
      diameter: spec.dia,
      length: spec.len,
      totalImpulse: spec.impulse,
      burnTime: spec.burn,
      avgThrust: spec.thrust,
      peakThrust: spec.thrust * 1.35,
      propellantMass: spec.pMass,
      totalMass: spec.tMass,
      delays: [10],
      defaultDelay: 10,
      curve: [[0.0, 0.3], [0.08, 1.0], [0.5, 0.85], [0.9, 0.7], [1.0, 0.0]]
    };

    this.motors[cleanCode] = syntheticMotor;
    return syntheticMotor;
  }

  /**
   * Parse RockSim Engine (.rse) XML format commonly stored in .ork archives
   */
  parseRse(rseString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rseString, "application/xml");
      const engines = doc.getElementsByTagName("engine");
      if (engines.length === 0) return null;

      const eng = engines[0];
      const mfg = eng.getAttribute("mfg") || "Imported";
      const code = (eng.getAttribute("code") || "CUSTOM").toUpperCase();
      const diaMm = parseFloat(eng.getAttribute("dia")) || 38;
      const lenMm = parseFloat(eng.getAttribute("len")) || 356;
      const initWtG = parseFloat(eng.getAttribute("initWt")) || 600;
      const propWtG = parseFloat(eng.getAttribute("propWt")) || 300;

      const dataPoints = doc.getElementsByTagName("eng-data");
      const curve = [];
      let maxThrust = 0;
      let burnTime = 0;
      let totalImpulse = 0;

      for (let i = 0; i < dataPoints.length; i++) {
        const pt = dataPoints[i];
        const t = parseFloat(pt.getAttribute("t")) || 0;
        const f = parseFloat(pt.getAttribute("f")) || 0;
        curve.push([t, f]);
        if (f > maxThrust) maxThrust = f;
        if (t > burnTime) burnTime = t;
      }

      // Compute total impulse by trapezoidal numerical integration
      for (let i = 0; i < curve.length - 1; i++) {
        const dt = curve[i + 1][0] - curve[i][0];
        const avgF = (curve[i][1] + curve[i + 1][1]) / 2;
        totalImpulse += avgF * dt;
      }

      // Normalize curve to [t/burnTime, F/maxThrust]
      const normCurve = burnTime > 0 && maxThrust > 0
        ? curve.map(pt => [pt[0] / burnTime, pt[1] / maxThrust])
        : [[0, 0], [0.1, 1], [1, 0]];

      const impulseLetter = code.charAt(0);
      const motorObj = {
        manufacturer: mfg,
        code: code,
        commonName: code,
        impulseClass: impulseLetter,
        diameter: diaMm / 1000,
        length: lenMm / 1000,
        totalImpulse: Math.round(totalImpulse) || 370,
        burnTime: parseFloat(burnTime.toFixed(2)) || 1.35,
        avgThrust: burnTime > 0 ? Math.round(totalImpulse / burnTime) : 274,
        peakThrust: Math.round(maxThrust) || 345,
        propellantMass: propWtG / 1000,
        totalMass: initWtG / 1000,
        delays: [6, 10, 14],
        defaultDelay: 10,
        curve: normCurve
      };

      this.motors[code] = motorObj;
      return motorObj;
    } catch (e) {
      console.warn("Failed to parse RSE data:", e);
      return null;
    }
  }

  getAllMotors() {
    return Object.values(this.motors);
  }
}

window.MotorDatabase = MotorDatabase;
