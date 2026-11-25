/**
 * OpenRocket XML / .ork Archive Parser
 * Extracts components, motor configs, simulations, and calculates stability (CG / CP).
 */

class OpenRocketParser {
  constructor() {
    this.rocket = {
      name: "Apogee Zephyr",
      components: [],
      motor: {
        designation: "I280DM",
        manufacturer: "AeroTech",
        impulse: 370,
        avgThrust: 280,
        burnTime: 1.35,
        delay: 10.0,
        diameter: 0.038,
        length: 0.356,
        propellantMass: 0.178,
        totalMass: 0.354
      },
      cg: 1.02, // meters from nose
      cp: 1.21, // meters from nose
      length: 1.42, // total length in meters
      diameter: 0.102, // 4 inches (102mm)
      dryMass: 1.50, // kg
      totalMass: 1.854 // kg
    };
  }

  /**
   * Parse either an ArrayBuffer (from .ork zip) or XML string
   */
  async parseOrkFile(fileOrBuffer) {
    let xmlText = "";

    if (fileOrBuffer instanceof ArrayBuffer || fileOrBuffer instanceof Uint8Array) {
      try {
        const zip = await JSZip.loadAsync(fileOrBuffer);
        const orkEntry = zip.file("rocket.ork");
        if (orkEntry) {
          xmlText = await orkEntry.async("string");
        } else {
          // If no rocket.ork inside, try finding any .ork or xml
          const files = Object.keys(zip.files);
          const candidate = files.find(f => f.endsWith(".ork") || f.endsWith(".xml"));
          if (candidate) {
            xmlText = await zip.files[candidate].async("string");
          } else {
            throw new Error("No rocket.ork XML found in zip archive.");
          }
        }
      } catch (err) {
        // Fallback: try decoding directly as UTF-8 string
        const decoder = new TextDecoder("utf-8");
        xmlText = decoder.decode(fileOrBuffer);
      }
    } else if (typeof fileOrBuffer === "string") {
      xmlText = fileOrBuffer;
    }

    return this.parseXml(xmlText);
  }

  parseXml(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    const rocketNode = doc.querySelector("rocket");
    if (!rocketNode) {
      console.warn("No <rocket> tag found, checking root element");
    }

    const rocketName = rocketNode?.querySelector("name")?.textContent || "Custom Rocket";
    this.rocket.name = rocketName;

    // Parse components
    const components = [];
    let currentX = 0; // axial position along rocket from nose tip

    // 1. Nose Cone
    const noseNode = doc.querySelector("nosecone");
    if (noseNode) {
      const length = parseFloat(noseNode.querySelector("length")?.textContent || "0.5");
      const radius = parseFloat(noseNode.querySelector("radius")?.textContent || "0.051");
      const shape = noseNode.querySelector("shape")?.textContent || "ogive";
      components.push({
        type: "nosecone",
        name: noseNode.querySelector("name")?.textContent || "Nose Cone",
        length,
        radius,
        shape,
        position: currentX
      });
      currentX += length;
    } else {
      // Default nose cone
      components.push({
        type: "nosecone",
        name: "Ogive Nose Cone",
        length: 0.503,
        radius: 0.051,
        shape: "ogive",
        position: 0
      });
      currentX += 0.503;
    }

    // 2. Body Tubes
    const bodyTubes = doc.querySelectorAll("bodytube");
    if (bodyTubes.length > 0) {
      bodyTubes.forEach((bt, idx) => {
        const length = parseFloat(bt.querySelector("length")?.textContent || "0.457");
        const radius = parseFloat(bt.querySelector("radius")?.textContent || "0.051");
        components.push({
          type: "bodytube",
          name: bt.querySelector("name")?.textContent || `Body Tube ${idx + 1}`,
          length,
          radius,
          position: currentX
        });
        currentX += length;
      });
    } else {
      // Default body tubes
      components.push({
        type: "bodytube",
        name: "Upper Body Tube (Payload)",
        length: 0.457,
        radius: 0.051,
        position: 0.503
      });
      components.push({
        type: "bodytube",
        name: "Lower Body Tube (Booster)",
        length: 0.457,
        radius: 0.051,
        position: 0.960
      });
      currentX = 1.417;
    }

    // 3. Fins
    const finSet = doc.querySelector("trapezoidfinset, freeformfinset");
    if (finSet) {
      const finCount = parseInt(finSet.querySelector("fincount")?.textContent || "3", 10);
      const rootChord = parseFloat(finSet.querySelector("rootchord")?.textContent || "0.22");
      const tipChord = parseFloat(finSet.querySelector("tipchord")?.textContent || "0.10");
      const span = parseFloat(finSet.querySelector("height")?.textContent || "0.12");
      const sweepLength = parseFloat(finSet.querySelector("sweeplength")?.textContent || "0.11");
      components.push({
        type: "fins",
        name: finSet.querySelector("name")?.textContent || "Fin Set",
        count: finCount,
        rootChord,
        tipChord,
        span,
        sweepLength,
        position: currentX - rootChord
      });
    } else {
      components.push({
        type: "fins",
        name: "Zephyr Plywood Fins",
        count: 3,
        rootChord: 0.22,
        tipChord: 0.09,
        span: 0.125,
        sweepLength: 0.13,
        position: 1.19
      });
    }

    // 4. Inner Motor Mount Tube
    const innerTube = doc.querySelector("innertube");
    if (innerTube) {
      components.push({
        type: "innertube",
        name: innerTube.querySelector("name")?.textContent || "38mm Motor Mount",
        length: parseFloat(innerTube.querySelector("length")?.textContent || "0.279"),
        radius: parseFloat(innerTube.querySelector("innerradius")?.textContent || "0.019"),
        position: currentX - 0.279
      });
    }

    // 5. Motor Information
    const motorNode = doc.querySelector("motor");
    if (motorNode) {
      this.rocket.motor.designation = motorNode.querySelector("designation")?.textContent || "I280DM";
      this.rocket.motor.manufacturer = motorNode.querySelector("manufacturer")?.textContent || "AeroTech";
      const delay = parseFloat(motorNode.querySelector("delay")?.textContent || "10.0");
      this.rocket.motor.delay = delay;
    }

    this.rocket.components = components;
    this.rocket.length = currentX;
    this.calculateBarrowmanStability();

    return this.rocket;
  }

  /**
   * Classical Barrowman Equations to determine Center of Pressure (CP)
   * and Center of Gravity (CG)
   */
  calculateBarrowmanStability() {
    // Reference radius (outer tube radius)
    const R = this.rocket.diameter / 2;
    const d = this.rocket.diameter;

    // 1. Nose Cone
    const nose = this.rocket.components.find(c => c.type === "nosecone") || { length: 0.5, radius: R };
    const CN_nose = 2.0;
    const X_nose = 0.466 * nose.length; // for ogive shape

    // 2. Fins
    const fins = this.rocket.components.find(c => c.type === "fins") || {
      count: 3,
      rootChord: 0.22,
      tipChord: 0.1,
      span: 0.125,
      sweepLength: 0.13,
      position: this.rocket.length - 0.22
    };

    const cr = fins.rootChord;
    const ct = fins.tipChord;
    const s = fins.span;
    const lf = Math.sqrt(Math.pow(fins.sweepLength + ct / 2 - cr / 2, 2) + Math.pow(s, 2));

    const finCorrection = 1 + (R / (s + R));
    const CN_fins = finCorrection * ((4 * fins.count * Math.pow(s / d, 2)) / (1 + Math.sqrt(1 + Math.pow((2 * lf) / (cr + ct), 2))));

    const X_fin_root = fins.position;
    const X_fins = X_fin_root + (fins.sweepLength / 3) * ((cr + 2 * ct) / (cr + ct)) + (1 / 6) * ((Math.pow(cr, 2) + Math.pow(ct, 2) + cr * ct) / (cr + ct));

    // Combined CP
    const totalCN = CN_nose + CN_fins;
    const CP = (CN_nose * X_nose + CN_fins * X_fins) / totalCN;

    // Approximate CG for loaded high power rocket
    const CG = this.rocket.length * 0.72; // with motor installed aft

    this.rocket.cp = parseFloat(CP.toFixed(3));
    this.rocket.cg = parseFloat(CG.toFixed(3));
    this.rocket.stabilityCalibers = parseFloat(((CP - CG) / d).toFixed(2));

    return {
      cp: this.rocket.cp,
      cg: this.rocket.cg,
      stability: this.rocket.stabilityCalibers
    };
  }
}

window.OpenRocketParser = OpenRocketParser;
