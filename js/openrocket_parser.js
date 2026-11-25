/**
 * OpenRocket XML / .ork Archive Parser
 * Standard DOM traversal without fragile CSS selectors.
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

    const parseError = doc.getElementsByTagName("parsererror")[0];
    if (parseError) {
      throw new Error("Invalid XML in OpenRocket file: " + parseError.textContent);
    }

    // Rocket element
    const rocketNodes = doc.getElementsByTagName("rocket");
    const rocketNode = rocketNodes.length > 0 ? rocketNodes[0] : doc.documentElement;
    
    let rocketName = "Imported Rocket";
    for (let i = 0; i < rocketNode.childNodes.length; i++) {
      if (rocketNode.childNodes[i].nodeName === "name") {
        rocketName = rocketNode.childNodes[i].textContent || rocketName;
        break;
      }
    }

    // Find the real physical stage (the <stage> that has a <subcomponents> child)
    const stageNodes = doc.getElementsByTagName("stage");
    let physicalStage = null;
    for (let i = 0; i < stageNodes.length; i++) {
      const s = stageNodes[i];
      for (let j = 0; j < s.childNodes.length; j++) {
        if (s.childNodes[j].nodeName === "subcomponents") {
          physicalStage = s;
          break;
        }
      }
      if (physicalStage) break;
    }

    if (!physicalStage && stageNodes.length > 0) {
      physicalStage = stageNodes[0];
    }

    let stageName = "Sustainer";
    let stageSubcomponentsNode = null;
    if (physicalStage) {
      for (let i = 0; i < physicalStage.childNodes.length; i++) {
        const cn = physicalStage.childNodes[i];
        if (cn.nodeName === "name") stageName = cn.textContent || stageName;
        if (cn.nodeName === "subcomponents") stageSubcomponentsNode = cn;
      }
    }

    const parseNum = (str, fallback = 0) => {
      if (!str) return fallback;
      const clean = str.replace(/auto/gi, "").trim();
      const val = parseFloat(clean);
      return isNaN(val) ? fallback : val;
    };

    const getChildText = (node, tagName, fallback = "") => {
      for (let i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeName === tagName) {
          return node.childNodes[i].textContent || fallback;
        }
      }
      return fallback;
    };

    const components = [];
    let totalLength = 0;
    let maxRadius = 0.0508;

    if (stageSubcomponentsNode) {
      for (let i = 0; i < stageSubcomponentsNode.childNodes.length; i++) {
        const node = stageSubcomponentsNode.childNodes[i];
        if (node.nodeType !== 1) continue; // skip text/comment nodes

        const tag = node.nodeName.toLowerCase();
        const compName = getChildText(node, "name", tag);
        const compId = getChildText(node, "id", `id-${Date.now()}-${Math.random()}`);

        if (tag === "nosecone") {
          const len = parseNum(getChildText(node, "length"), 0.503);
          let rad = parseNum(getChildText(node, "aftradius"), 0);
          if (!rad) rad = parseNum(getChildText(node, "radius"), 0.0508);
          if (rad > maxRadius) maxRadius = rad;
          totalLength += len;

          components.push({
            id: compId,
            type: "nosecone",
            name: compName,
            length: len,
            radius: rad,
            shape: getChildText(node, "shape", "ogive"),
            color: "white",
            children: []
          });
        } else if (tag === "bodytube") {
          const len = parseNum(getChildText(node, "length"), 0.457);
          const rad = parseNum(getChildText(node, "radius"), 0.0508);
          if (rad > maxRadius) maxRadius = rad;
          totalLength += len;

          // Nested subcomponents
          const children = [];
          for (let j = 0; j < node.childNodes.length; j++) {
            const innerSub = node.childNodes[j];
            if (innerSub.nodeName === "subcomponents") {
              for (let k = 0; k < innerSub.childNodes.length; k++) {
                const childNode = innerSub.childNodes[k];
                if (childNode.nodeType !== 1) continue;

                const childTag = childNode.nodeName.toLowerCase();
                const childName = getChildText(childNode, "name", childTag);
                const childId = getChildText(childNode, "id", `child-${Math.random()}`);

                if (childTag === "tubecoupler") {
                  children.push({
                    id: childId,
                    type: "coupler",
                    name: childName,
                    length: parseNum(getChildText(childNode, "length"), 0.20),
                    radius: parseNum(getChildText(childNode, "radius"), rad * 0.98)
                  });
                } else if (childTag === "parachute") {
                  children.push({
                    id: childId,
                    type: "parachute",
                    name: childName,
                    diameter: parseNum(getChildText(childNode, "diameter"), 1.22)
                  });
                } else if (childTag.includes("finset") || childTag.includes("fins")) {
                  children.push({
                    id: childId,
                    type: "fins",
                    name: childName,
                    count: parseInt(getChildText(childNode, "fincount", "3"), 10),
                    rootChord: parseNum(getChildText(childNode, "rootchord"), 0.22),
                    tipChord: parseNum(getChildText(childNode, "tipchord"), 0.09),
                    span: parseNum(getChildText(childNode, "height"), 0.125),
                    sweepLength: parseNum(getChildText(childNode, "sweeplength"), 0.13)
                  });
                } else if (childTag === "innertube") {
                  children.push({
                    id: childId,
                    type: "innertube",
                    name: childName,
                    length: parseNum(getChildText(childNode, "length"), 0.279),
                    radius: parseNum(getChildText(childNode, "innerradius") || getChildText(childNode, "radius"), 0.019)
                  });
                } else if (childTag === "centeringring") {
                  children.push({
                    id: childId,
                    type: "ring",
                    name: childName,
                    position: parseNum(getChildText(childNode, "position"), 0.02)
                  });
                } else {
                  children.push({
                    id: childId,
                    type: childTag,
                    name: childName
                  });
                }
              }
            }
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
      }
    }

    // Motor check
    let designation = "I280DM";
    let delay = 10.0;
    const motorNodes = doc.getElementsByTagName("motor");
    if (motorNodes.length > 0) {
      designation = getChildText(motorNodes[0], "designation", designation);
      delay = parseNum(getChildText(motorNodes[0], "delay"), delay);
    }

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
