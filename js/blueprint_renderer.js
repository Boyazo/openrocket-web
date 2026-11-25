/**
 * 2D Technical Rocket Blueprint Canvas Renderer
 * Renders technical OpenRocket CAD schematic:
 *  - Metric Centimeter / Millimeter tick ruler
 *  - Blue/Black outlines for Nose cone, Upper body tube, Lower body tube
 *  - Through-The-Wall Freeform Fins
 *  - Centering rings, inner 38mm motor tube & motor casing
 *  - Dotted parachute & shock cord symbols
 *  - Center of Gravity (CG - Blue/White circle) & Center of Pressure (CP - Red dot)
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
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.rulerCanvas.width = rect.width;
    this.rulerCanvas.height = 24;
  }

  setRocket(rocket) {
    this.activeRocket = rocket;
    this.draw();
  }

  draw() {
    if (!this.canvas || !this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Rocket length in meters (default to Zephyr ~1.42m / 142cm)
    const rocketLen = this.activeRocket?.length || 1.42;
    const rocketDia = this.activeRocket?.diameter || 0.102;

    // Drawing scale: map rocket from ~20cm on ruler with margin
    const marginX = 80;
    const availableWidth = w - marginX * 2;
    const scale = (availableWidth / (rocketLen * 100)) * this.zoom; // pixels per cm

    const startX = marginX;
    const centerY = h / 2;

    // 1. Draw Top Centimeter Ruler
    this.drawRuler(startX, scale);

    // 2. Draw Callipers Grid Lines if enabled
    if (this.showCallipers) {
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      // Centerline
      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
    }

    // 3. Draw Rocket Outlines (OpenRocket technical blue/black line style)
    const radiusPx = (rocketDia * 100 / 2) * scale;
    let curX = startX;

    // A. Nose Cone (Ogive Shape)
    const nose = this.activeRocket?.components?.find(c => c.type === "nosecone") || { length: 0.503 };
    const noseLenPx = (nose.length * 100) * scale;

    ctx.strokeStyle = "#1d4ed8"; // Classic OpenRocket technical blue
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(curX, centerY);
    // Upper curve
    ctx.quadraticCurveTo(curX + noseLenPx * 0.7, centerY - radiusPx, curX + noseLenPx, centerY - radiusPx);
    // Base line
    ctx.lineTo(curX + noseLenPx, centerY + radiusPx);
    // Lower curve
    ctx.quadraticCurveTo(curX + noseLenPx * 0.7, centerY + radiusPx, curX, centerY);
    ctx.stroke();

    curX += noseLenPx;

    // B. Upper Body Tube
    const upperTubeLen = 0.457 * 100 * scale;
    ctx.strokeStyle = "#1d4ed8";
    ctx.strokeRect(curX, centerY - radiusPx, upperTubeLen, radiusPx * 2);

    // Parachute Symbol (Dotted inside upper tube)
    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(curX + upperTubeLen * 0.35, centerY - radiusPx * 0.65, upperTubeLen * 0.35, radiusPx * 1.3);
    ctx.restore();

    curX += upperTubeLen;

    // C. Coupler Joint Ring
    ctx.strokeStyle = "#64748b";
    ctx.strokeRect(curX - 8, centerY - radiusPx * 0.95, 16, radiusPx * 1.9);

    // D. Lower Body Tube (Booster)
    const lowerTubeLen = 0.457 * 100 * scale;
    ctx.strokeStyle = "#1d4ed8";
    ctx.strokeRect(curX, centerY - radiusPx, lowerTubeLen, radiusPx * 2);

    // Shock cord wave inside lower tube
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    for (let i = 0; i < 40; i += 5) {
      ctx.lineTo(curX + 15 + i, centerY + Math.sin(i) * 6);
    }
    ctx.stroke();
    ctx.restore();

    // E. Inner Motor Mount Tube (38mm)
    const mmtRadiusPx = (0.038 * 100 / 2) * scale;
    const mmtLenPx = (0.28 * 100) * scale;
    const mmtStartX = (curX + lowerTubeLen) - mmtLenPx;

    ctx.strokeStyle = "#7c3aed"; // Purple inner tube line
    ctx.strokeRect(mmtStartX, centerY - mmtRadiusPx, mmtLenPx, mmtRadiusPx * 2);

    // Centering Rings
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    // Forward ring
    ctx.strokeRect(mmtStartX, centerY - radiusPx, 4, radiusPx - mmtRadiusPx);
    ctx.strokeRect(mmtStartX, centerY + mmtRadiusPx, 4, radiusPx - mmtRadiusPx);
    // Aft ring
    ctx.strokeRect(curX + lowerTubeLen - 15, centerY - radiusPx, 4, radiusPx - mmtRadiusPx);
    ctx.strokeRect(curX + lowerTubeLen - 15, centerY + mmtRadiusPx, 4, radiusPx - mmtRadiusPx);

    // F. Motor Casing (AeroTech I280DM - Grey Block sticking out rear and front)
    const motorRadiusPx = (0.038 * 100 / 2) * scale * 0.95;
    const motorLenPx = (0.356 * 100) * scale;
    const motorOverhangAft = 0.012 * 100 * scale;
    const motorStartX = (curX + lowerTubeLen + motorOverhangAft) - motorLenPx;

    ctx.fillStyle = "rgba(100, 116, 139, 0.45)"; // Semi-transparent grey
    ctx.fillRect(motorStartX, centerY - motorRadiusPx, motorLenPx, motorRadiusPx * 2);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    ctx.strokeRect(motorStartX, centerY - motorRadiusPx, motorLenPx, motorRadiusPx * 2);

    // G. Fins (Trapezoid / Freeform TTW)
    const finRootPx = (0.22 * 100) * scale;
    const finSpanPx = (0.125 * 100) * scale;
    const finSweepPx = (0.13 * 100) * scale;
    const finTipPx = (0.09 * 100) * scale;
    const finStartX = curX + lowerTubeLen - finRootPx;

    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 1.5;

    // Top Fin
    ctx.beginPath();
    ctx.moveTo(finStartX, centerY - radiusPx);
    ctx.lineTo(finStartX + finSweepPx, centerY - radiusPx - finSpanPx);
    ctx.lineTo(finStartX + finSweepPx + finTipPx, centerY - radiusPx - finSpanPx);
    ctx.lineTo(finStartX + finRootPx, centerY - radiusPx);
    ctx.stroke();

    // Bottom Fin
    ctx.beginPath();
    ctx.moveTo(finStartX, centerY + radiusPx);
    ctx.lineTo(finStartX + finSweepPx, centerY + radiusPx + finSpanPx);
    ctx.lineTo(finStartX + finSweepPx + finTipPx, centerY + radiusPx + finSpanPx);
    ctx.lineTo(finStartX + finRootPx, centerY + radiusPx);
    ctx.stroke();

    // 4. Draw Center of Gravity (CG) & Center of Pressure (CP)
    if (this.showCgCp) {
      const totalLenCm = rocketLen * 100;
      const cgCm = (this.activeRocket?.cg || 1.02) * 100;
      const cpCm = (this.activeRocket?.cp || 1.21) * 100;

      const cgX = startX + cgCm * scale;
      const cpX = startX + cpCm * scale;

      // Draw CG (Blue circle with alternating quadrants)
      const r = 9;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cgX, centerY, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Quadrants
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

      // Draw CP (Red dot inside circle)
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

  drawRuler(startX, scale) {
    const rctx = this.rulerCtx;
    const rw = this.rulerCanvas.width;
    rctx.clearRect(0, 0, rw, 24);

    rctx.fillStyle = "#475569";
    rctx.font = "9px Consolas, monospace";
    rctx.textAlign = "center";
    rctx.strokeStyle = "#94a3b8";
    rctx.lineWidth = 1;

    // Major tick every 10cm, minor every 5cm
    const maxCm = 200;
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
