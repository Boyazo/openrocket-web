# AeroSim Pro (OpenRocket Web)

A modern, high-fidelity web-based model & high-power rocketry simulator built to provide an interactive 3D alternative to OpenRocket.

## ✨ Key Features

1. **OpenRocket `.ork` & XML Import/Export**:
   * Direct parsing of standard compressed `.ork` zip archives and uncompressed XML rocketry files.
   * Component extraction: ogive/conical nosecones, body tubes, through-the-wall fin sets, inner motor mounts, and recovery gear.
   * Classical Barrowman aerodynamic stability calculations (Center of Pressure & Center of Gravity).

2. **Global Launch Sites & Real-time Weather Integration**:
   * Pre-configured world launch sites:
     * **Black Rock Desert, NV** (BALLS / Tripoli)
     * **Spaceport America, NM** (Spaceport America Cup)
     * **Lucerne Dry Lake, CA** (ROCstock)
     * **Argonia, KS** (Rocket City / LDRS)
     * **Manchester, TN** (Music City Missile)
     * **Guiana Space Centre, Kourou** (CSG)
     * **Woomera Test Range, Australia**
     * Custom GPS coordinates input.
   * Real-time atmospheric API integration via Open-Meteo: live wind speed, wind direction, surface pressure, temperature, and elevation.

3. **6-DOF Numerical Trajectory Simulation**:
   * Numerical Runge-Kutta 4th-order (RK4) integration with 50 Hz physics stepping.
   * Variable atmospheric air density modeled with standard barometric lapse equations.
   * Transonic compressibility Mach-drag rise calculation.
   * Thrust profiles for popular high-power motors (AeroTech I280DM, H128W, H180W, Cesaroni I350CS, J350W).
   * Weathercocking into relative crosswinds, launch rail departure velocity calculation, and parachute drift radius.

4. **Interactive 3D WebGL Visualization (Three.js)**:
   * 3D rocket geometry rendered to scale with customizable materials.
   * 8-ft extruded aluminum 1010 launch rail and tripod pad.
   * Dynamic particle exhaust flame & sparks (tuned for Dark Matter / Sparky propellants).
   * Animated hemispherical parachute deployment and descent oscillation.
   * **Multi-Angle Camera Modes**:
     * **Launch Pad**: Spectator view with tracking target.
     * **Chase Cam**: Dynamic following camera.
     * **On-board GoPro**: Looking down along the airframe.
     * **Bird's Eye**: Overhead satellite/drone perspective.

5. **Flight HUD, Telemetry Graphs & Tripoli Safety Checks**:
   * Live flight time, altitude, velocity, acceleration (G), and Mach counter.
   * Real-time flight phase indicator (`Boost Phase` ➔ `Coasting` ➔ `Apogee` ➔ `Parachute Recovery` ➔ `Touchdown`).
   * Dynamic Chart.js altitude and velocity/thrust curves.
   * Automated Tripoli / NAR safety checks:
     * Delay grain discrepancy warnings (alerting when to drill delay with UDDT).
     * Tripoli Sparky propellant standoff distance requirements (200 ft).
     * Minimum launch rail departure velocity threshold (> 45 ft/s).

## 🚀 Getting Started

Simply open `index.html` in any modern web browser, or serve it via any static HTTP server:

```bash
# Using Python
python -m http.server 8000

# Using Node / npx
npx serve .
```

Then visit `http://localhost:8000` in your browser.
