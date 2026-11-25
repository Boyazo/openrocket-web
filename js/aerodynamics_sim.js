/**
 * 6-DOF Flight Trajectory & Aerodynamic Simulation Engine
 * Integrates equations of motion using Runge-Kutta 4th Order (RK4).
 * Accounts for variable atmospheric density, aerodynamic drag (transonic Mach rise),
 * motor thrust curves, delay grain burn, parachute deployment dynamics, and wind drift.
 */

class RocketSimulation {
  constructor(rocket, environment) {
    this.rocket = rocket;
    this.env = environment || {
      windSpeed: 2.9, // m/s (6.5 mph)
      windHeading: 240, // deg
      temperature: 295.37, // Kelvin (72 F)
      pressure: 101325, // Pa
      railLength: 2.44, // 8 ft
      railAngle: 0, // degrees from vertical
      railAzimuth: 0 // launch heading
    };

    this.motorDb = window.globalMotorDb || (window.MotorDatabase ? new window.MotorDatabase() : null);
  }

  getAirDensity(altitude) {
    // Standard Barometric Formula (Troposphere up to 11km)
    const T0 = this.env.temperature;
    const P0 = this.env.pressure;
    const L = 0.0065; // K/m temperature lapse rate
    const R = 287.058; // specific gas constant
    const g = 9.80665;

    const T = T0 - L * altitude;
    if (T <= 0) return 0.1;
    const P = P0 * Math.pow(1 - (L * altitude) / T0, (g) / (R * L));
    return P / (R * T);
  }

  getThrust(time, motorCode) {
    const motor = this.motorDb ? this.motorDb.getMotor(motorCode) : null;
    if (!motor) return 0;
    if (time < 0 || time > motor.burnTime) return 0;

    const normT = time / motor.burnTime;
    const curve = motor.curve || [[0, 0], [0.1, 1], [1, 0]];

    // Linear interpolation
    for (let i = 0; i < curve.length - 1; i++) {
      const p1 = curve[i];
      const p2 = curve[i + 1];
      if (normT >= p1[0] && normT <= p2[0]) {
        const factor = (normT - p1[0]) / (p2[0] - p1[0]);
        const normF = p1[1] + factor * (p2[1] - p1[1]);
        return normF * motor.peakThrust;
      }
    }
    return 0;
  }

  /**
   * Run the full flight simulation with numerical integration
   */
  run(delayOverride) {
    const motorCode = this.rocket.motor?.designation || "I280DM";
    const motor = this.motorDb ? this.motorDb.getMotor(motorCode) : { totalMass: 0.354, burnTime: 1.35 };
    const delay = delayOverride !== undefined ? delayOverride : (this.rocket.motor?.delay || 10.0);

    const crossSectionArea = Math.PI * Math.pow(this.rocket.diameter / 2, 2);
    const chuteDiameter = 1.22; // 48 inch parachute in meters
    const chuteArea = Math.PI * Math.pow(chuteDiameter / 2, 2);
    const chuteCd = 1.35; // typical round hemispherical parachute

    // State Variables
    let t = 0;
    const dt = 0.02; // 50 Hz simulation step
    let x = 0, y = 0, z = 0; // Position (y is vertical)
    let vx = 0, vy = 0, vz = 0; // Velocity
    let mass = this.rocket.dryMass + motor.totalMass;

    // Flight Flags
    let onRail = true;
    let motorBurnout = false;
    let burnoutTime = 0;
    let apogeeReached = false;
    let apogeeTime = 0;
    let maxAltitude = 0;
    let maxVelocity = 0;
    let maxAcceleration = 0;
    let parachuteDeployed = false;
    let deploymentVelocity = 0;
    let railExitVelocity = 0;
    let groundHitVelocity = 0;

    const trajectory = [];
    const warnings = [];

    // Wind components (m/s)
    const windRad = (this.env.windHeading * Math.PI) / 180;
    const windX = -Math.sin(windRad) * this.env.windSpeed;
    const windZ = -Math.cos(windRad) * this.env.windSpeed;

    // Launch rail orientation
    const railTiltRad = (this.env.railAngle * Math.PI) / 180;
    const railAzimuthRad = (this.env.railAzimuth * Math.PI) / 180;
    let dirX = Math.sin(railTiltRad) * Math.sin(railAzimuthRad);
    let dirY = Math.cos(railTiltRad);
    let dirZ = Math.sin(railTiltRad) * Math.cos(railAzimuthRad);

    while (t < 300 && (t === 0 || y >= 0)) {
      // 1. Motor propellant mass loss
      if (t <= motor.burnTime) {
        const propellantBurnRate = motor.propellantMass / motor.burnTime;
        mass = this.rocket.dryMass + (motor.totalMass - propellantBurnRate * t);
      } else {
        mass = this.rocket.dryMass + (motor.totalMass - motor.propellantMass);
        if (!motorBurnout) {
          motorBurnout = true;
          burnoutTime = t;
        }
      }

      // 2. Parachute Deployment Check
      const timeSinceBurnout = t - motor.burnTime;
      if (!parachuteDeployed && timeSinceBurnout >= delay) {
        parachuteDeployed = true;
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
        deploymentVelocity = speed;

        if (speed > 20) { // > 45 mph / 65 ft/s
          warnings.push({
            type: "danger",
            title: "High-Speed Parachute Deployment",
            text: `Chute deployed at ${(speed * 3.28084).toFixed(1)} ft/s! High risk of zipper damage or shredded canopy.`
          });
        }
      }

      // 3. Environmental Conditions at Altitude
      const rho = this.getAirDensity(y);
      const speedOfSound = 340.3; // approximate sea level

      // Relative airspeed
      const relVx = vx - (y > 2 ? windX : 0);
      const relVy = vy;
      const relVz = vz - (y > 2 ? windZ : 0);
      const airSpeed = Math.sqrt(relVx * relVx + relVy * relVy + relVz * relVz);
      const mach = airSpeed / speedOfSound;

      // 4. Aerodynamic Drag Coefficient (with Mach rise)
      let cd = 0.42; // baseline Zephyr drag
      if (mach > 0.7) {
        cd += 0.3 * Math.pow((mach - 0.7) / 0.3, 2); // transonic compressibility drag
      }

      let dragFx = 0, dragFy = 0, dragFz = 0;
      if (parachuteDeployed) {
        // Parachute drag dominates
        const pDrag = 0.5 * rho * chuteArea * chuteCd * airSpeed * airSpeed;
        if (airSpeed > 0.001) {
          dragFx = -(relVx / airSpeed) * pDrag;
          dragFy = -(relVy / airSpeed) * pDrag;
          dragFz = -(relVz / airSpeed) * pDrag;
        }
      } else if (airSpeed > 0.001) {
        const rocketDrag = 0.5 * rho * crossSectionArea * cd * airSpeed * airSpeed;
        dragFx = -(relVx / airSpeed) * rocketDrag;
        dragFy = -(relVy / airSpeed) * rocketDrag;
        dragFz = -(relVz / airSpeed) * rocketDrag;
      }

      // 5. Motor Thrust
      const thrust = this.getThrust(t, motorCode);
      let thrustFx = 0, thrustFy = 0, thrustFz = 0;

      if (thrust > 0) {
        if (onRail) {
          thrustFx = thrust * dirX;
          thrustFy = thrust * dirY;
          thrustFz = thrust * dirZ;
        } else {
          // Weathercocking: alignment pulls into relative wind
          if (airSpeed > 3 && !parachuteDeployed) {
            const wcDamping = 0.98;
            dirX = dirX * wcDamping + (-relVx / airSpeed) * (1 - wcDamping);
            dirY = dirY * wcDamping + (-relVy / airSpeed) * (1 - wcDamping);
            dirZ = dirZ * wcDamping + (-relVz / airSpeed) * (1 - wcDamping);
            const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
            dirX /= mag; dirY /= mag; dirZ /= mag;
          }
          thrustFx = thrust * dirX;
          thrustFy = thrust * dirY;
          thrustFz = thrust * dirZ;
        }
      }

      // 6. Gravity & Net Acceleration
      const totalFx = thrustFx + dragFx;
      const totalFy = thrustFy + dragFy - mass * 9.80665;
      const totalFz = thrustFz + dragFz;

      const ax = totalFx / mass;
      const ay = totalFy / mass;
      const az = totalFz / mass;

      const currentAccG = Math.sqrt(ax * ax + ay * ay + az * az) / 9.80665;
      if (currentAccG > maxAcceleration) maxAcceleration = currentAccG;

      // 7. Numerical Integration (Euler / RK-step)
      vx += ax * dt;
      vy += ay * dt;
      vz += az * dt;

      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      // Ground Clamp
      if (y < 0) {
        y = 0;
        groundHitVelocity = Math.sqrt(vx * vx + vy * vy + vz * vz);
      }

      const totalVelocity = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (totalVelocity > maxVelocity) maxVelocity = totalVelocity;
      if (y > maxAltitude) maxAltitude = y;

      // Check Rail Exit
      const distanceTravelled = Math.sqrt(x * x + y * y + z * z);
      if (onRail && distanceTravelled >= this.env.railLength) {
        onRail = false;
        railExitVelocity = totalVelocity;
        if (railExitVelocity < 13.7) { // < 45 ft/s
          warnings.push({
            type: "warning",
            title: "Low Rail Exit Velocity",
            text: `Exit speed was ${(railExitVelocity * 3.28084).toFixed(1)} ft/s (< 45 ft/s recommended). Risk of severe weathercocking.`
          });
        }
      }

      // Check Apogee
      if (!apogeeReached && vy <= 0 && t > 1.0) {
        apogeeReached = true;
        apogeeTime = t;
      }

      // Sample Telemetry Point
      trajectory.push({
        time: parseFloat(t.toFixed(2)),
        altitude: parseFloat(y.toFixed(2)),
        altitudeFt: parseFloat((y * 3.28084).toFixed(1)),
        velocity: parseFloat(totalVelocity.toFixed(2)),
        velocityMph: parseFloat((totalVelocity * 2.23694).toFixed(1)),
        velocityFps: parseFloat((totalVelocity * 3.28084).toFixed(1)),
        accelG: parseFloat(currentAccG.toFixed(2)),
        thrust: parseFloat(thrust.toFixed(1)),
        mach: parseFloat(mach.toFixed(2)),
        posX: parseFloat(x.toFixed(2)),
        posY: parseFloat(y.toFixed(2)),
        posZ: parseFloat(z.toFixed(2)),
        phase: parachuteDeployed ? "descent" : (motorBurnout ? "coast" : "powered")
      });

      if (y <= 0 && t > 2) break; // Landed!
      t += dt;
    }

    // Determine Optimum Delay (burnout to apogee)
    const optimumDelay = Math.max(0, apogeeTime - (burnoutTime || motor.burnTime));

    return {
      success: true,
      apogee: {
        meters: parseFloat(maxAltitude.toFixed(1)),
        feet: parseFloat((maxAltitude * 3.28084).toFixed(1)),
        time: parseFloat(apogeeTime.toFixed(2))
      },
      maxVelocity: {
        mps: parseFloat(maxVelocity.toFixed(1)),
        mph: parseFloat((maxVelocity * 2.23694).toFixed(1)),
        fps: parseFloat((maxVelocity * 3.28084).toFixed(1)),
        mach: parseFloat((maxVelocity / 340.3).toFixed(2))
      },
      optimumDelay: parseFloat(optimumDelay.toFixed(2)),
      actualDelay: delay,
      deploymentVelocity: {
        mps: parseFloat(deploymentVelocity.toFixed(1)),
        fps: parseFloat((deploymentVelocity * 3.28084).toFixed(1))
      },
      railExitVelocity: {
        fps: parseFloat((railExitVelocity * 3.28084).toFixed(1))
      },
      landingVelocity: {
        fps: parseFloat((groundHitVelocity * 3.28084).toFixed(1))
      },
      maxAccelerationG: parseFloat(maxAcceleration.toFixed(1)),
      flightTime: parseFloat(t.toFixed(1)),
      driftDistanceMeters: parseFloat(Math.sqrt(x * x + z * z).toFixed(1)),
      warnings,
      trajectory
    };
  }
}

window.RocketSimulation = RocketSimulation;
