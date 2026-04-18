const fetch = require('node-fetch');

const WMO_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Showers', 82: 'Violent showers', 95: 'Thunderstorm', 99: 'Thunderstorm with hail',
};

async function getWeather(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature` +
      `&wind_speed_unit=ms`;

    const res = await fetch(url, { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = data.current;

    return {
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m,
      windDirection: c.wind_direction_10m,
      weatherCode: c.weather_code,
      condition: WMO_CODES[c.weather_code] || 'Unknown',
      flightSafe: c.wind_speed_10m < 12,
      lat, lng,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Weather fetch failed, using mock data:', err.message);
    return {
      temperature: 12.4,
      feelsLike: 9.8,
      humidity: 68,
      windSpeed: 4.2,
      windDirection: 225,
      weatherCode: 2,
      condition: 'Partly cloudy',
      flightSafe: true,
      lat, lng,
      fetchedAt: new Date().toISOString(),
      mock: true,
    };
  }
}

module.exports = { getWeather };
