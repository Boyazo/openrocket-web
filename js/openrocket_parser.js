/**
 * Robust OpenRocket XML / .ork Archive Parser
 * Supports nested OpenRocket schemas:
 * Handles multiple <stage> elements, auto-dimensions, nested finsets, and motor configs.
 */

class OpenRocketParser {
  constructor() {
    this.rocket = null;
  }

  async parseOrkFile(fileOrBuffer) {
    let xmlText = "";

    if (fileOrBuffer instanceof ArrayBuffer || fileOrBuffer instanceof Uint8Array) {
      try {
        const zip = await JSZip.loadAsync(fileOrBuffer);
        const candidateName = Object.keys(zip.files).find(
          name => name === "rocket.ork" || name.endsWith(".ork") || name.endsWith(".xml")
        );

        if (candidateName) {
          xmlText = await zip.files[candidateName].async("string");
        } else {
          throw new Error("No XML file found inside .ork archive.");
        }
      } catch (err) {
        console.warn("JSZip failed or raw XML passed, trying UTF-8 text decode:", err);
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

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid XML in OpenRocket file: " + parseError.textContent);
    }

    const rocketNode = doc.querySelector("rocket");
    const rocketName = rocketNode?.querySelector("name")?.textContent || "Apogee Zephyr";

    // In OpenRocket XML, stages can be listed under <motorconfiguration> or <subcomponents>
    // We want the <stage> that contains actual rocket subcomponents!
    const allStages = Array.from(doc.querySelectorAll("subcomponents > stage"));
    let activeStage = allStages.find(s => s.querySelector("nosecone, bodytube")) || allStages[0] || doc.querySelector("stage");

    const stageName = activeStage?.querySelector(":scope > name")?.textContent || "Sustainer";

    const parseNum = (str, fallback = 0) => {
      if (!str) return fallback;
      const clean = str.replace(/auto/gi, "").trim();
      const val = parseFloat(clean);
      return isNaN(val) ? fallback : val;
    };

    const components = [];
    let totalLength = 0;
    let maxRadius = 0.0508;

    // Direct children under the active stage's <subcomponents>
    const stageSubcomps = activeStage ? activeStage.querySelector(":scope > subcomponents") : doc.querySelector("subcomponents");
    const topLevelNodes = stageSubcomps ? Array.from(stageSubcomps.children) : [];

    topLevelNodes.forEach(node => {
      const tag = node.tagName.toLowerCase();
      const compName = node.querySelector(":scope > name")?.textContent || tag;
      const compId = node.querySelector(":scope > id")?.textContent || `id-${Date.now()}-${Math.random()}`;

      if (tag === "nosecone") {
        const len = parseNum(node.querySelector("length")?.textContent, 0.503);
        const rad = parseNum(node.querySelector("aftradius, radius")?.textContent, 0.0508);
        if (rad > maxRadius) maxRadius = rad;
        totalLength += len;

        components.push({
          id: compId,
          type: "nosecone",
          name: compName,
          length: len,
          radius: rad,
          shape: "ogive",
          color: "white",
          children: []
        });
      } else if (tag === "bodytube") {
        const len = parseNum(node.querySelector("length")?.textContent, 0.457);
        const rad = parseNum(node.querySelector("radius")?.textContent, 0.0508);
        if (rad > maxRadius) maxRadius = rad;
        totalLength += len;

        // Parse nested subcomponents inside this bodytube
        const innerSubcompsNode = node.querySelector(":scope > subcomponents");
        const children = [];

        if (innerSubcompsNode) {
          Array.from(innerSubcompsNode.children).forEach(childNode => {
            const childTag = childNode.tagName.toLowerCase();
            const childName = childNode.querySelector(":scope > name")?.textContent || childTag;
            const childId = childNode.querySelector(":scope > id")?.textContent || `child-${Math.random()}`;

            if (childTag === "tubecoupler") {
              children.push({
                id: childId,
                type: "coupler",
                name: childName,
                length: parseNum(childNode.querySelector("length")?.textContent, 0.20),
                radius: parseNum(childNode.querySelector("radius")?.textContent, rad * 0.98)
              });
            } else if (childTag === "parachute") {
              children.push({
                id: childId,
                type: "parachute",
                name: childName,
                diameter: parseNum(childNode.querySelector("diameter")?.textContent, 1.22)
              });
            } else if (childTag.includes("finset") || childTag.includes("fins")) {
              const rootChord = parseNum(childNode.querySelector("rootchord")?.textContent, 0.22);
              const tipChord = parseNum(childNode.querySelector("tipchord")?.textContent, 0.09);
              const span = parseNum(childNode.querySelector("height")?.textContent, 0.125);
              const sweepLength = parseNum(childNode.querySelector("sweeplength")?.textContent, 0.13);
              const count = parseInt(childNode.querySelector("fincount")?.textContent || "3", 10);

              children.push({
                id: childId,
                type: "fins",
                name: childName,
                count,
                rootChord,
                tipChord,
                span,
                sweepLength
              });
            } else if (childTag === "innertube") {
              children.push({
                id: childId,
                type: "innertube",
                name: childName,
                length: parseNum(childNode.querySelector("length")?.textContent, 0.279),
                radius: parseNum(childNode.querySelector("innerradius, radius")?.textContent, 0.019)
              });
            } else if (childTag === "centeringring") {
              children.push({
                id: childId,
                type: "ring",
                name: childName,
                position: parseNum(childNode.querySelector("position")?.textContent, 0.02)
              });
            } else {
              children.push({
                id: childId,
                type: childTag,
                name: childName
              });
            }
          });
        }

        components.push({
          id: compId,
          type: "bodytube",
          name: compName,
          length: len,
          radius: rad,
          color: "white",
          children: children
        });
      }
    });

    // Motor configuration check
    const motorNode = doc.querySelector("motor");
    const designation = motorNode?.querySelector("designation")?.textContent || "I280DM";
    const delay = parseNum(motorNode?.querySelector("delay")?.textContent, 10.0);

    this.rocket = {
      name: rocketName,
      stage: stageName,
      components: components,
      motor: {
        designation: designation,
        delay: delay
      },
      length: parseFloat(totalLength.toFixed(3)) || 1.417,
      diameter: parseFloat((maxRadius * 2).toFixed(3)) || 0.102,
      dryMass: 1.492,
      totalMass: 1.846
    };

    this.calculateBarrowmanStability();
    return this.rocket;
  }

  calculateBarrowmanStability() {
    if (!this.rocket) return;
    const d = this.rocket.diameter || 0.102;
    const R = d / 2;

    const nose = this.rocket.components.find(c => c.type === "nosecone") || { length: 0.503 };
    const CN_nose = 2.0;
    const X_nose = 0.466 * (nose.length || 0.503);

    // Look for fins in components or children
    let fins = null;
    this.rocket.components.forEach(c => {
      if (c.type === "fins") fins = c;
      if (c.children) {
        const f = c.children.find(ch => ch.type === "fins");
        if (f) fins = f;
      }
    });

    if (!fins) {
      fins = { count: 3, rootChord: 0.22, tipChord: 0.09, span: 0.125, sweepLength: 0.13 };
    }

    const cr = fins.rootChord || 0.22;
    const ct = fins.tipChord || 0.09;
    const s = fins.span || 0.125;
    const sweep = fins.sweepLength || 0.13;
    const count = fins.count || 3;

    const lf = Math.sqrt(Math.pow(sweep + ct / 2 - cr / 2, 2) + Math.pow(s, 2));
    const finCorrection = 1 + (R / (s + R));
    const CN_fins = finCorrection * ((4 * count * Math.pow(s / d, 2)) / (1 + Math.sqrt(1 + Math.pow((2 * lf) / (cr + ct), 2))));

    const finRootPos = this.rocket.length - cr;
    const X_fins = finRootPos + (sweep / 3) * ((cr + 2 * ct) / (cr + ct)) + (1 / 6) * ((Math.pow(cr, 2) + Math.pow(ct, 2) + cr * ct) / (cr + ct));

    const totalCN = CN_nose + CN_fins;
    const CP = (CN_nose * X_nose + CN_fins * X_fins) / totalCN;
    const CG = this.rocket.length * 0.72;

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
