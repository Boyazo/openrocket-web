/**
 * 2D Technical Rocket Blueprint Canvas Renderer
 * Dynamically draws the rocket from the actual activeRocket.components array!
 */

class RocketBlueprintRenderer {
  constructor(canvasId, rulerCanvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.rulerCanvas = document.getElementById(rulerCanvasId);
    this.rulerCtx = this.rulerCanvas.getContext("2d");

    this.zoom = 1.0;
    this.showCgCp = true;
    this.showCallipers = true;
    this.activeRocket = null;

    this.resizeCanvases();
    window.addEventListener("resize", () => {
      this.resizeCanvases();
      this.draw();
    });
  }

  resizeCanvases() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    const w = rect.width || parent.clientWidth || 1000;
    const h = rect.height || parent.clientHeight || 500;

    this.canvas.width = Math.max(w, 800);
    this.canvas.height = Math.max(h, 400);

    this.rulerCanvas.width = this.canvas.width;
    this.rulerCanvas.height = 24;
  }

  setRocket(rocket) {
    this.activeRocket = rocket;
    this.resizeCanvases();
    this.draw();
  }

  draw() {
    if (!this.canvas || !this.ctx) return;
    this.resizeCanvases();

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    const rocketLen = Math.max(this.activeRocket?.length || 1.42, 0.4);
    const rocketDia = this.activeRocket?.diameter || 0.102;

    const marginX = 80;
    const availableWidth = w - marginX * 2;
    const scale = (availableWidth / (rocketLen * 100)) * this.zoom; // px per cm

    const startX = marginX;
    const centerY = h / 2;

    // 1. Draw Centimeter Ruler
    this.drawRuler(startX, scale);

    // 2. Callipers Centerline
    if (this.showCallipers) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
    }

    // 3. Dynamic Component Rendering (from components array)
    const comps = this.activeRocket?.components || [];
    let curX = startX;

    comps.forEach((comp) => {
      const compLen = comp.length || 0.457;
      const compRad = comp.radius || (rocketDia / 2);
      const lenPx = compLen * 100 * scale;
      const radPx = compRad * 100 * scale;

      if (comp.type === "nosecone") {
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curX, centerY);
        ctx.quadraticCurveTo(curX + lenPx * 0.7, centerY - radPx, curX + lenPx, centerY - radPx);
        ctx.lineTo(curX + lenPx, centerY + radPx);
        ctx.quadraticCurveTo(curX + lenPx * 0.7, centerY + radPx, curX, centerY);
        ctx.stroke();
      } else if (comp.type === "bodytube") {
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(curX, centerY - radPx, lenPx, radPx * 2);

        // Check nested children (Parachute, Shock cord, Coupler, Fins, Inner tube)
        if (comp.children && comp.children.length > 0) {
          comp.children.forEach(child => {
            if (child.type === "parachute") {
              ctx.save();
              ctx.strokeStyle = "#ef4444";
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(curX + lenPx * 0.25, centerY - radPx * 0.65, lenPx * 0.45, radPx * 1.3);
              ctx.restore();
            } else if (child.type === "coupler") {
              ctx.strokeStyle = "#64748b";
              ctx.strokeRect(curX + lenPx - 10, centerY - radPx * 0.95, 20, radPx * 1.9);
            } else if (child.type === "innertube") {
              const mmtRadPx = (child.radius || 0.019) * 100 * scale;
              const mmtLenPx = (child.length || 0.279) * 100 * scale;
              const mmtStartX = (curX + lenPx) - mmtLenPx;

              ctx.strokeStyle = "#7c3aed";
              ctx.strokeRect(mmtStartX, centerY - mmtRadPx, mmtLenPx, mmtRadPx * 2);

              // Centering Rings
              ctx.strokeStyle = "#dc2626";
              ctx.lineWidth = 2;
              ctx.strokeRect(mmtStartX, centerY - radPx, 4, radPx - mmtRadPx);
              ctx.strokeRect(mmtStartX, centerY + mmtRadPx, 4, radPx - mmtRadPx);
              ctx.strokeRect(curX + lenPx - 15, centerY - radPx, 4, radPx - mmtRadPx);
              ctx.strokeRect(curX + lenPx - 15, centerY + mmtRadPx, 4, radPx - mmtRadPx);

              // Motor Block
              const motorRadPx = mmtRadPx * 0.95;
              const motorLenPx = 0.356 * 100 * scale;
              const motorStartX = (curX + lenPx + 0.012 * 100 * scale) - motorLenPx;

              ctx.fillStyle = "rgba(100, 116, 139, 0.45)";
              ctx.fillRect(motorStartX, centerY - motorRadPx, motorLenPx, motorRadPx * 2);
              ctx.strokeStyle = "#334155";
              ctx.lineWidth = 1;
              ctx.strokeRect(motorStartX, centerY - motorRadPx, motorLenPx, motorRadPx * 2);
            } else if (child.type === "fins") {
              this.drawFins(ctx, curX, lenPx, radPx, scale, centerY, child);
            }
          });
        }
      } else if (comp.type === "fins") {
        this.drawFins(ctx, curX - (comp.rootChord || 0.22) * 100 * scale, (comp.rootChord || 0.22) * 100 * scale, radPx, scale, centerY, comp);
      }

      curX += lenPx;
    });

    // 4. Draw Center of Gravity (CG) & Center of Pressure (CP)
    if (this.showCgCp) {
      const cgCm = (this.activeRocket?.cg || 1.02) * 100;
      const cpCm = (this.activeRocket?.cp || 1.21) * 100;

      const cgX = startX + cgCm * scale;
      const cpX = startX + cpCm * scale;
      const r = 9;

      // Draw CG
      ctx.save();
      ctx.beginPath();
      ctx.arc(cgX, centerY, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.moveTo(cgX, centerY);
      ctx.arc(cgX, centerY, r, 0, Math.PI / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cgX, centerY);
      ctx.arc(cgX, centerY, r, Math.PI, Math.PI * 1.5);
      ctx.fill();
      ctx.restore();

      // Draw CP
      ctx.save();
      ctx.beginPath();
      ctx.arc(cpX, centerY, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cpX, centerY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.restore();
    }
  }

  drawFins(ctx, tubeStartX, tubeLenPx, tubeRadPx, scale, centerY, finObj) {
    const rootPx = (finObj.rootChord || 0.22) * 100 * scale;
    const spanPx = (finObj.span || 0.125) * 100 * scale;
    const sweepPx = (finObj.sweepLength || 0.13) * 100 * scale;
    const tipPx = (finObj.tipChord || 0.09) * 100 * scale;
    const finStartX = (tubeStartX + tubeLenPx) - rootPx;

    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 1.5;

    // Top Fin
    ctx.beginPath();
    ctx.moveTo(finStartX, centerY - tubeRadPx);
    ctx.lineTo(finStartX + sweepPx, centerY - tubeRadPx - spanPx);
    ctx.lineTo(finStartX + sweepPx + tipPx, centerY - tubeRadPx - spanPx);
    ctx.lineTo(finStartX + rootPx, centerY - tubeRadPx);
    ctx.stroke();

    // Bottom Fin
    ctx.beginPath();
    ctx.moveTo(finStartX, centerY + tubeRadPx);
    ctx.lineTo(finStartX + sweepPx, centerY + tubeRadPx + spanPx);
    ctx.lineTo(finStartX + sweepPx + tipPx, centerY + tubeRadPx + spanPx);
    ctx.lineTo(finStartX + rootPx, centerY + tubeRadPx);
    ctx.stroke();
  }

  drawRuler(startX, scale) {
    const rctx = this.rulerCtx;
    const rw = this.rulerCanvas.width;
    rctx.clearRect(0, 0, rw, 24);

    rctx.fillStyle = "#475569";
    rctx.font = "9px Consolas, monospace";
    rctx.textAlign = "center";
    rctx.strokeStyle = "#94a3b8";
    rctx.lineWidth = 1;

    const maxCm = 250;
    for (let cm = -20; cm <= maxCm; cm += 5) {
      const x = startX + cm * scale;
      if (x < 0 || x > rw) continue;

      const isMajor = cm % 10 === 0;
      const tickH = isMajor ? 12 : 6;

      rctx.beginPath();
      rctx.moveTo(x, 24 - tickH);
      rctx.lineTo(x, 24);
      rctx.stroke();

      if (isMajor) {
        rctx.fillText(`${cm}`, x, 10);
      }
    }
  }
}

window.RocketBlueprintRenderer = RocketBlueprintRenderer;
