/**
 * Global Launch Sites & Real-time Weather Service
 * Connects to Open-Meteo API (free, open, no API key required)
 * to fetch live or historical temperature, wind speed, wind direction,
 * surface pressure, and atmospheric elevation.
 */

class WeatherService {
  constructor() {
    this.launchSites = {
      "black-rock": {
        name: "Black Rock Desert, NV (BALLS / Tripoli)",
        lat: 40.7864,
        lon: -119.2065,
        elevation: 1191 // meters
      },
      "spaceport-am": {
        name: "Spaceport America, NM (Spaceport Cup)",
        lat: 32.9904,
        lon: -106.9750,
        elevation: 1400
      },
      "lucerne": {
        name: "Lucerne Dry Lake, CA (ROC / ROCstock)",
        lat: 34.5125,
        lon: -116.9400,
        elevation: 868
      },
      "argonia": {
        name: "Argonia, KS (Rocket City / LDRS)",
        lat: 37.2642,
        lon: -97.6981,
        elevation: 382
      },
      "manchester": {
        name: "Manchester, TN (Music City Missile)",
        lat: 35.4842,
        lon: -86.0886,
        elevation: 323
      },
      "kourou": {
        name: "Guiana Space Centre, Kourou (CSG)",
        lat: 5.2372,
        lon: -52.7686,
        elevation: 15
      },
      "woomera": {
        name: "Woomera Test Range, Australia",
        lat: -30.9553,
        lon: 136.5322,
        elevation: 167
      }
    };
  }

  getSite(siteKey) {
    return this.launchSites[siteKey] || this.launchSites["black-rock"];
  }

  /**
   * Fetch real-time or historical forecast data from Open-Meteo
   */
  async fetchLiveWeather(siteKey, customLat, customLon) {
    let lat, lon;
    if (siteKey === "custom" && customLat && customLon) {
      lat = parseFloat(customLat);
      lon = parseFloat(customLon);
    } else {
      const site = this.getSite(siteKey);
      lat = site.lat;
      lon = site.lon;
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather API returned status: ${response.status}`);
      }
      const data = await response.json();
      const current = data.current;

      const tempC = current.temperature_2m;
      const tempF = (tempC * 9/5) + 32;
      const windSpeedMph = current.wind_speed_10m;
      const windDirDeg = current.wind_direction_10m;
      const pressureMbar = current.surface_pressure;

      return {
        success: true,
        tempF: parseFloat(tempF.toFixed(1)),
        tempK: parseFloat((tempC + 273.15).toFixed(2)),
        windSpeedMph: parseFloat(windSpeedMph.toFixed(1)),
        windSpeedMps: parseFloat((windSpeedMph * 0.44704).toFixed(2)),
        windDirDeg: Math.round(windDirDeg),
        pressureMbar: parseFloat(pressureMbar.toFixed(1)),
        pressurePa: parseFloat((pressureMbar * 100).toFixed(0)),
        elevation: data.elevation
      };
    } catch (err) {
      console.warn("Could not fetch live weather, using standard atmospheric fallback:", err);
      // Realistic default values
      return {
        success: false,
        fallback: true,
        tempF: 72.0,
        tempK: 295.37,
        windSpeedMph: 6.5,
        windSpeedMps: 2.9,
        windDirDeg: 240,
        pressureMbar: 1013.25,
        pressurePa: 101325,
        elevation: 1191
      };
    }
  }
}

window.WeatherService = WeatherService;
