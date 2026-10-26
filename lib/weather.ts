/* ===================== TYPES ===================== */

export type Unit = 'C' | 'F';

export type Place = { name: string; lat: number; lon: number };

export type LocationResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

export type ForecastDay = {
  day: string;
  date: string;
  temp: number;
  minTemp: number;
  icon: string;
  description: string;
  rainChance: number;
  windSpeed: number;
  uv: number;
};

export type HourSlot = {
  label: string;
  temp: number;
  icon: string;
  rain: number;
};

export type WeatherData = {
  place: Place;
  fetchedAt: number;
  localTime: string; // "2026-10-24T14:00" in the place's own time zone
  isDay: boolean;
  weatherCode: number;
  description: string;
  temperature: number;
  high: number;
  low: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  rainProbability: number;
  visibility: number | null;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  aqi: number | null;
  daily: ForecastDay[];
  hourly: HourSlot[];
};

export type RecentSearch = {
  city: string;
  temp: number;
  icon: string;
  lat: number;
  lon: number;
};

/* ===================== STORAGE ===================== */

export const KEYS = {
  unit: 'ww:unit',
  favorites: 'ww:favorites',
  recent: 'ww:recent',
  place: 'ww:place',
  cache: 'ww:cache',
};

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: ignore */
  }
}

/* ===================== NETWORK ===================== */

async function fetchJSON(url: string, tries = 3) {
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      lastError = err;
      if (i < tries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** i));
      }
    }
  }
  throw lastError;
}

export async function searchLocations(
  name: string,
  count = 6
): Promise<LocationResult[]> {
  const data = await fetchJSON(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      name
    )}&count=${count}&language=en&format=json`,
    2
  );
  return data.results || [];
}

export const buildLocationName = (l: LocationResult) =>
  `${l.name}${l.admin1 ? ', ' + l.admin1 : ''}${l.country ? ', ' + l.country : ''}`;

export const toPlace = (l: LocationResult): Place => ({
  name: buildLocationName(l),
  lat: l.latitude,
  lon: l.longitude,
});

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const fallback = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;

  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (r.ok) {
      const d = await r.json();
      const name = [d.locality || d.city, d.principalSubdivision, d.countryName]
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(', ');
      if (name) return name;
    }
  } catch (e) {
    console.error('BigDataCloud failed:', e);
  }

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=14&addressdetails=1&accept-language=en`
    );
    if (r.ok) {
      const d = await r.json();
      const a = d.address || {};
      const place =
        a.suburb || a.neighbourhood || a.village || a.town || a.city || a.municipality || a.county;
      const name = [place, a.state || a.state_district, a.country].filter(Boolean).join(', ');
      if (name) return name;
    }
  } catch (e) {
    console.error('Nominatim failed:', e);
  }

  return fallback;
}

export async function fetchWeather(place: Place): Promise<WeatherData> {
  const { lat, lon } = place;

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,surface_pressure` +
    `&hourly=temperature_2m,weather_code,visibility,precipitation_probability` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code,uv_index_max,sunrise,sunset,precipitation_probability_max,wind_speed_10m_max` +
    `&forecast_days=7&timezone=auto`;

  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`;

  const [data, air] = await Promise.all([
    fetchJSON(forecastUrl),
    fetchJSON(airUrl, 1).catch(() => null),
  ]);

  const current = data.current;

  // Use the LOCATION's current hour, not the browser's.
  const hourKey = `${String(current.time).slice(0, 13)}:00`;
  const found = data.hourly.time.findIndex((t: string) => t === hourKey);
  const hour = found >= 0 ? found : 0;

  const hourly: HourSlot[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = hour + i * 2;
    if (idx >= data.hourly.time.length) break;
    hourly.push({
      label: i === 0 ? 'Now' : formatHourLabel(data.hourly.time[idx]),
      temp: data.hourly.temperature_2m[idx],
      icon: getWeatherIcon(data.hourly.weather_code[idx]),
      rain: data.hourly.precipitation_probability[idx] ?? 0,
    });
  }

  const daily: ForecastDay[] = data.daily.time.map((date: string, i: number) => ({
    day: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
    date,
    temp: data.daily.temperature_2m_max[i],
    minTemp: data.daily.temperature_2m_min[i],
    icon: getWeatherIcon(data.daily.weather_code[i]),
    description: getWeatherDescription(data.daily.weather_code[i]),
    rainChance: data.daily.precipitation_probability_max?.[i] ?? 0,
    windSpeed: data.daily.wind_speed_10m_max?.[i] ?? current.wind_speed_10m,
    uv: data.daily.uv_index_max[i] ?? 0,
  }));

  return {
    place,
    fetchedAt: Date.now(),
    localTime: String(current.time),
    isDay: current.is_day === 1,
    weatherCode: current.weather_code,
    description: getWeatherDescription(current.weather_code),
    temperature: current.temperature_2m,
    high: data.daily.temperature_2m_max[0],
    low: data.daily.temperature_2m_min[0],
    feelsLike: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    pressure: current.surface_pressure,
    rainProbability: data.hourly.precipitation_probability[hour] ?? 0,
    visibility: data.hourly.visibility[hour] ?? null,
    uvIndex: data.daily.uv_index_max[0] ?? 0,
    sunrise: data.daily.sunrise[0],
    sunset: data.daily.sunset[0],
    aqi: air?.current?.us_aqi ?? null,
    daily,
    hourly,
  };
}

/* ===================== WEATHER HELPERS ===================== */

export function getWeatherDescription(code: number) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code >= 45 && code <= 48) return 'Foggy';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rainy';
  if (code >= 71 && code <= 77) return 'Snowy';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Unknown weather';
}

export function getWeatherIcon(code: number) {
  if (code === 0) return 'sun';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return 'cloud';
}

// "2026-10-24T14:00" -> "02:00 PM" (already local to the place, no conversion)
export function formatClock(value: string) {
  if (!value) return '--';
  const hour = parseInt(value.slice(11, 13), 10);
  const minute = value.slice(14, 16);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(h12).padStart(2, '0')}:${minute} ${suffix}`;
}

export function formatHourLabel(value: string) {
  const hour = parseInt(value.slice(11, 13), 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

export function aqiInfo(aqi: number | null) {
  if (aqi === null) return { label: 'No data', short: '--' };
  if (aqi <= 50) return { label: 'Good', short: `${aqi} · Good` };
  if (aqi <= 100) return { label: 'Moderate', short: `${aqi} · Moderate` };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', short: `${aqi} · Sensitive` };
  if (aqi <= 200) return { label: 'Unhealthy', short: `${aqi} · Unhealthy` };
  if (aqi <= 300) return { label: 'Very unhealthy', short: `${aqi} · Very bad` };
  return { label: 'Hazardous', short: `${aqi} · Hazardous` };
}

export function buildTip(d: WeatherData): string {
  const nextRain = d.hourly.find((h, i) => i > 0 && h.rain >= 60);

  if (d.weatherCode >= 95) return 'Thunderstorms nearby. Stay indoors and avoid open areas.';
  if (d.rainProbability >= 60) return 'Rain is likely right now. Take an umbrella.';
  if (nextRain) return `Rain is likely around ${nextRain.label}. Take an umbrella if you go out.`;
  if (d.aqi !== null && d.aqi > 100) return 'Air quality is poor. Limit time outdoors, especially exercise.';
  if (d.uvIndex >= 8) return 'UV is very high today. Use sunscreen and avoid the midday sun.';
  if (d.temperature >= 33) return 'It is hot out. Drink plenty of water and stay in the shade.';
  if (d.temperature <= 10) return 'It is cold out. Wear a warm layer.';
  return 'Conditions look comfortable. A good time to go outside.';
}

// Soft glow colours for the page background, based on the weather and day/night.
export function getTheme(code: number, isDay: boolean) {
  if (!isDay) return { a: 'rgba(99,102,241,0.14)', b: 'rgba(34,211,238,0.07)' };
  if (code >= 95) return { a: 'rgba(168,85,247,0.16)', b: 'rgba(71,85,105,0.18)' };
  if (code >= 71 && code <= 77) return { a: 'rgba(191,219,254,0.14)', b: 'rgba(148,163,184,0.12)' };
  if (code >= 85 && code <= 86) return { a: 'rgba(191,219,254,0.14)', b: 'rgba(148,163,184,0.12)' };
  if (code >= 51) return { a: 'rgba(34,211,238,0.14)', b: 'rgba(59,130,246,0.12)' };
  if (code <= 2) return { a: 'rgba(251,191,36,0.14)', b: 'rgba(249,115,22,0.09)' };
  return { a: 'rgba(148,163,184,0.12)', b: 'rgba(34,211,238,0.07)' };
}