'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  MapPin,
  Menu,
  X,
  Sun,
  Wind,
  Eye,
  Gauge,
  Sunrise,
  Sunset,
  Thermometer,
  LocateFixed,
  RefreshCw,
  Umbrella,
  Droplets,
  CloudRain,
  Star,
  WifiOff,
  Leaf,
  Lightbulb,
} from 'lucide-react';
import {
  KEYS,
  aqiInfo,
  buildTip,
  fetchWeather,
  formatClock,
  getTheme,
  loadJSON,
  reverseGeocode,
  saveJSON,
  searchLocations,
  toPlace,
} from '../lib/weather';
import type {
  ForecastDay,
  LocationResult,
  Place,
  RecentSearch,
  Unit,
  WeatherData,
} from '../lib/weather';
import { DetailCard, InfoBox, PageSkeleton, WeatherIcon } from '../components/ui';

const DEFAULT_CITY = 'Eravur';
const REFRESH_MS = 15 * 60 * 1000;
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export default function Home() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [unit, setUnit] = useState<Unit>('C');
  const [favorites, setFavorites] = useState<Place[]>([]);
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(true);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mapTab, setMapTab] = useState<'map' | 'radar'>('map');
  const [showAllRecent, setShowAllRecent] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);

  const placeRef = useRef<Place | null>(null);
  const lastFetchRef = useRef(0);

  /* ---------- Temperature helpers (one unit for the whole app) ---------- */

  const convert = (value: number) =>
    unit === 'C' ? Math.round(value) : Math.round((value * 9) / 5 + 32);

  const showTemp = (value: number | null | undefined) =>
    value === null || value === undefined ? '--' : `${convert(value)}°${unit}`;

  /* ---------- Load weather for a place ---------- */

  const load = useCallback(
    async (place: Place, opts?: { silent?: boolean }): Promise<boolean> => {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      setNotice('');

      try {
        const fresh = await fetchWeather(place);

        placeRef.current = place;
        lastFetchRef.current = Date.now();

        setData(fresh);
        if (!opts?.silent) setSelectedIdx(0);

        saveJSON(KEYS.cache, fresh);
        saveJSON(KEYS.place, place);

        setRecent(previous =>
          [
            {
              city: place.name,
              temp: fresh.temperature,
              icon: fresh.daily[0]?.icon ?? 'cloud',
              lat: place.lat,
              lon: place.lon,
            },
            ...previous.filter(item => !sameName(item.city, place.name)),
          ].slice(0, 6)
        );
        return true;
      } catch (err) {
        console.error(err);
        const cached = loadJSON<WeatherData | null>(KEYS.cache, null);
        setData(previous => previous ?? cached);
        setError(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? "You're offline."
            : "Couldn't load the latest weather."
        );
        return false;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const loadByName = useCallback(
    async (name: string) => {
      setLoading(true);
      try {
        const results = await searchLocations(name, 1);
        if (!results.length) {
          setError('No locations found.');
          setLoading(false);
          return;
        }
        await load(toPlace(results[0]));
      } catch (err) {
        console.error(err);
        setError("Couldn't search for this location. Check your connection.");
        setLoading(false);
      }
    },
    [load]
  );

  /* ---------- First load: restore saved settings, show cached data instantly ---------- */

  useEffect(() => {
    setUnit(loadJSON<Unit>(KEYS.unit, 'C'));
    setFavorites(loadJSON<Place[]>(KEYS.favorites, []));
    setRecent(loadJSON<RecentSearch[]>(KEYS.recent, []));
    setOnline(navigator.onLine);

    const cached = loadJSON<WeatherData | null>(KEYS.cache, null);
    const saved = loadJSON<Place | null>(KEYS.place, null);

    if (cached) {
      setData(cached);
      setLoading(false);
    }

    if (saved) load(saved, { silent: !!cached });
    else loadByName(DEFAULT_CITY);

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Persist settings ---------- */

  useEffect(() => {
    if (hydrated) saveJSON(KEYS.unit, unit);
  }, [unit, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON(KEYS.favorites, favorites);
  }, [favorites, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON(KEYS.recent, recent);
  }, [recent, hydrated]);

  /* ---------- Auto refresh, online/offline, install prompt ---------- */

  useEffect(() => {
    const refresh = () => {
      if (placeRef.current && navigator.onLine) load(placeRef.current, { silent: true });
    };

    const onOnline = () => {
      setOnline(true);
      refresh();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFetchRef.current > REFRESH_MS
      ) {
        refresh();
      }
    };
    const onInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('beforeinstallprompt', onInstall);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, [load]);

  /* ---------- Search ---------- */

  const onSearchInput = async (value: string) => {
    setSearchText(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      setSuggestions(await searchLocations(value, 6));
    } catch {
      setSuggestions([]);
    }
  };

  const closeSearch = () => {
    setSearchText('');
    setSuggestions([]);
    setSearchOpen(false);
    setMobileMenuOpen(false);
  };

  const selectLocation = async (location: LocationResult) => {
    setAccuracy(null);
    closeSearch();
    await load(toPlace(location));
  };

  const performSearch = async () => {
    const text = searchText.trim();
    if (!text) return;
    try {
      const results = await searchLocations(text, 1);
      if (!results.length) {
        setError('No locations found.');
        return;
      }
      await selectLocation(results[0]);
    } catch {
      setError("Couldn't search for this location. Check your connection.");
    }
  };

  /* ---------- Use my location ---------- */

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationLoading(true);
    setError('');
    setNotice('');

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const { latitude, longitude, accuracy: acc } = position.coords;
          const name = await reverseGeocode(latitude, longitude);
          setAccuracy(Math.round(acc));

          const ok = await load({ name, lat: latitude, lon: longitude });

          // Desktops have no GPS, so the browser may only guess from the network.
          if (ok && acc > 5000) {
            setNotice(
              'Your device gave an approximate location. For exact weather, search your city.'
            );
          }
        } catch (err) {
          console.error(err);
          setError('Unable to load weather for your location.');
        } finally {
          setLocationLoading(false);
          setMobileMenuOpen(false);
        }
      },
      err => {
        console.error(err);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            'Location permission denied. Allow location access in your browser settings and try again.'
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Your location is unavailable right now.');
        } else if (err.code === err.TIMEOUT) {
          setError('Location request timed out. Please try again.');
        } else {
          setError('Unable to get your location.');
        }
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  /* ---------- Favorites ---------- */

  const currentPlace = data?.place ?? null;
  const isFavorite = !!currentPlace && favorites.some(f => sameName(f.name, currentPlace.name));

  const toggleFavorite = () => {
    if (!currentPlace) return;
    setFavorites(previous =>
      isFavorite
        ? previous.filter(f => !sameName(f.name, currentPlace.name))
        : [currentPlace, ...previous].slice(0, 8)
    );
  };

  /* ---------- Derived data ---------- */

  const selectedDay: ForecastDay | null = data?.daily[selectedIdx] ?? null;

  const graphPoints = useMemo(() => {
    if (!data?.daily.length) return '';
    const width = 800;
    const height = 180;
    const padding = 25;

    const temps = data.daily.map(d =>
      unit === 'C' ? Math.round(d.temp) : Math.round((d.temp * 9) / 5 + 32)
    );
    const max = Math.max(...temps);
    const min = Math.min(...temps);
    const range = max - min || 1;

    return temps
      .map((value, index) => {
        const x = padding + index * ((width - padding * 2) / Math.max(temps.length - 1, 1));
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [data, unit]);

  const theme = getTheme(data?.weatherCode ?? 3, data?.isDay ?? true);

  const isRaining = !!data && /rain|drizzle|thunderstorm/i.test(data.description);
  const isSevere =
    !!data &&
    (/thunderstorm|rain|drizzle|snow/i.test(data.description) || data.temperature > 35);

  const headerDate = data?.localTime
    ? new Date(`${data.localTime.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const updatedLabel = data
    ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const aqi = aqiInfo(data?.aqi ?? null);
  const cityName = data?.place.name ?? 'Loading location...';

  /* ===================== UI ===================== */

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#080a0f] text-white">
      {/* Background glow changes with the weather and time of day */}
      <div
        className="pointer-events-none absolute left-1/3 top-10 h-96 w-96 rounded-full blur-3xl transition-colors duration-1000"
        style={{ background: theme.a }}
      />
      <div
        className="pointer-events-none absolute right-10 top-1/3 h-96 w-96 rounded-full blur-3xl transition-colors duration-1000"
        style={{ background: theme.b }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col overflow-hidden border border-white/10 bg-[#11141b]/65 backdrop-blur-2xl lg:my-6 lg:min-h-[760px] lg:flex-row lg:rounded-[2.5rem]">
        {/* MOBILE HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-5 py-4 lg:hidden">
          <h1 className="text-lg font-semibold">WeatherWise</h1>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            className="rounded-xl border border-white/10 bg-white/5 p-2"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* SIDEBAR */}
        <aside
          className={`absolute left-0 top-0 z-50 h-full w-full max-w-sm overflow-y-auto border-r border-white/10 bg-[#12151d]/95 p-6 backdrop-blur-xl transition-transform duration-300 lg:relative lg:w-80 lg:max-w-none lg:translate-x-0 lg:bg-transparent ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-8 hidden lg:block">
            <h1 className="text-xl font-medium tracking-wide">WeatherWise</h1>
          </div>

          {/* STATUS CARD */}
          <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">Weather status</span>
              <span className="rounded-full bg-red-400/10 px-3 py-1 text-xs text-red-300">
                Live
              </span>
            </div>

            <p className="text-xs font-medium text-emerald-400">
              Feels like {showTemp(data?.feelsLike)}
            </p>

            <div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                isSevere
                  ? 'bg-white text-black'
                  : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
              }`}
            >
              <span aria-hidden>{isSevere ? '⚠' : '✓'}</span>
              {isSevere ? 'Dangerous' : 'Optimal'}
            </div>
          </div>

          {/* MAP / RADAR */}
          <div>
            <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
              <span>Select area</span>
              <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
                {(['map', 'radar'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setMapTab(tab)}
                    aria-pressed={mapTab === tab}
                    className={`rounded-full px-2.5 py-1 text-[10px] ${
                      mapTab === tab ? 'bg-cyan-400 font-bold text-black' : 'text-slate-400'
                    }`}
                  >
                    {tab === 'map' ? 'Map' : 'Rain radar'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-inner">
              {currentPlace ? (
                <iframe
                  key={`${mapTab}-${currentPlace.lat}-${currentPlace.lon}`}
                  title={mapTab === 'map' ? 'Location map' : 'Rain radar map'}
                  width="100%"
                  height="100%"
                  className="opacity-90"
                  loading="lazy"
                  src={
                    mapTab === 'map'
                      ? `https://maps.google.com/maps?q=${currentPlace.lat},${currentPlace.lon}&z=10&output=embed`
                      : `https://www.rainviewer.com/map.html?loc=${currentPlace.lat},${currentPlace.lon},6&oFa=0&oC=0&oU=0&oCS=1&oF=0&oAP=1&rmt=4&c=1&o=83&lm=1&layer=radar&sm=1&sn=1`
                  }
                />
              ) : (
                <MapPin size={24} className="text-slate-500" aria-hidden />
              )}
            </div>

            {currentPlace && (
              <a
                href={`https://www.google.com/maps?q=${currentPlace.lat},${currentPlace.lon}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-center text-[11px] text-slate-500 hover:text-cyan-300"
              >
                Map not loading? Open in Google Maps
              </a>
            )}
          </div>

          {/* MY LOCATION */}
          <button
            onClick={handleUseMyLocation}
            disabled={locationLoading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-xs text-cyan-200 transition hover:bg-cyan-300/20 disabled:opacity-50"
          >
            {locationLoading ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden />
            ) : (
              <LocateFixed size={15} aria-hidden />
            )}
            {locationLoading ? 'Finding location...' : 'Use my location'}
          </button>

          {/* CURRENT CITY */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs text-slate-300">
            {cityName}
            {accuracy !== null && (
              <p className="mt-1 text-[10px] text-slate-500">
                Accuracy: about{' '}
                {accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${accuracy} m`}
              </p>
            )}
          </div>

          {/* SAVED CITIES */}
          <div className="mt-6">
            <p className="mb-2 text-xs text-slate-400">Saved cities</p>
            {favorites.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-500">
                Tap the star next to a city name to save it here.
              </p>
            ) : (
              <ul className="space-y-2">
                {favorites.map(place => (
                  <li
                    key={place.name}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] pr-2"
                  >
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        load(place);
                      }}
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs text-slate-200 hover:text-cyan-300"
                    >
                      {place.name}
                    </button>
                    <button
                      onClick={() =>
                        setFavorites(prev => prev.filter(f => !sameName(f.name, place.name)))
                      }
                      aria-label={`Remove ${place.name} from saved cities`}
                      className="text-slate-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* CONTENT */}
        <main className="min-w-0 flex-1 p-5 sm:p-7 lg:p-10">
          {/* TOP NAV */}
          <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                <MapPin size={15} className="shrink-0 text-cyan-300" aria-hidden />
                <span className="truncate">
                  {cityName}
                  {headerDate && <span className="text-slate-400"> ({headerDate})</span>}
                </span>
              </div>
              {data && (
                <button
                  onClick={toggleFavorite}
                  aria-label={isFavorite ? 'Remove from saved cities' : 'Save this city'}
                  aria-pressed={isFavorite}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
                >
                  <Star
                    size={16}
                    className={isFavorite ? 'fill-amber-300 text-amber-300' : 'text-slate-400'}
                  />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              {!online && (
                <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                  <WifiOff size={13} aria-hidden /> Offline
                </span>
              )}

              {data && (
                <div className="hidden items-center gap-2 text-[11px] text-slate-500 md:flex">
                  Updated {updatedLabel}
                </div>
              )}

              <button
                onClick={() => placeRef.current && load(placeRef.current, { silent: true })}
                disabled={refreshing || !placeRef.current}
                aria-label="Refresh weather"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>

              <div
                className="flex rounded-full border border-white/10 bg-white/5 p-1"
                role="group"
                aria-label="Temperature unit"
              >
                {(['C', 'F'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    aria-pressed={unit === u}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${
                      unit === u ? 'bg-white font-medium text-black' : 'text-slate-400'
                    }`}
                  >
                    °{u}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  setSuggestions([]);
                }}
                aria-label="Search for a city"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10"
              >
                <Search size={16} />
              </button>

              <button
                onClick={() => setDownloadModalOpen(true)}
                className="hidden rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs transition hover:bg-white/15 sm:block"
              >
                Download App
              </button>
            </div>

            {/* SEARCH BOX */}
            {searchOpen && (
              <div className="absolute right-0 top-14 z-40 w-full max-w-sm">
                <div className="relative flex gap-2 rounded-2xl border border-white/10 bg-[#171922] p-3 shadow-2xl">
                  <input
                    autoFocus
                    value={searchText}
                    onChange={e => onSearchInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') performSearch();
                      if (e.key === 'Escape') closeSearch();
                    }}
                    aria-label="City name"
                    placeholder="Search city..."
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    onClick={performSearch}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Search
                  </button>

                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-16 overflow-hidden rounded-2xl border border-white/10 bg-[#171922] shadow-2xl">
                      {suggestions.map((location, index) => (
                        <button
                          key={`${location.id}-${index}`}
                          onClick={() => selectLocation(location)}
                          className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                        >
                          <MapPin size={16} className="shrink-0 text-cyan-300" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">{location.name}</p>
                            <p className="truncate text-xs text-slate-400">
                              {location.admin1 ? `${location.admin1}, ` : ''}
                              {location.country}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BANNERS */}
          {isRaining && (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 backdrop-blur-md"
            >
              <span className="flex h-2 w-2 animate-ping rounded-full bg-amber-400" aria-hidden />
              <span>
                <strong>Weather advisory:</strong> Rain or storms detected for {cityName}. Drive
                safely.
              </span>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mb-4 flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"
            >
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss message">
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
            >
              <span>
                {error}
                {data && ` Showing data from ${updatedLabel}.`}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                {placeRef.current && (
                  <button
                    onClick={() => placeRef.current && load(placeRef.current, { silent: true })}
                    className="text-xs underline"
                  >
                    Try again
                  </button>
                )}
                <button onClick={() => setError('')} aria-label="Dismiss error">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {!data ? (
            loading ? (
              <PageSkeleton />
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center text-sm text-slate-400">
                No weather to show yet. Search for a city to get started.
              </div>
            )
          ) : (
            <>
              {/* HERO */}
              <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] shadow-2xl">
                      {loading ? (
                        <RefreshCw size={40} className="animate-spin text-cyan-300" />
                      ) : (
                        <WeatherIcon type={data.daily[0]?.icon || 'cloud'} size={52} />
                      )}
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="text-6xl font-light tracking-tight sm:text-8xl">
                        {showTemp(data.temperature)}
                      </span>
                      <div className="flex flex-col gap-2 pt-3">
                        <span className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs">
                          H: {showTemp(data.high)}
                        </span>
                        <span className="rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs">
                          L: {showTemp(data.low)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <h2 className="mt-6 max-w-xl text-3xl font-light tracking-tight sm:text-5xl">
                    {data.description}
                  </h2>

                  <div className="mt-5 flex max-w-lg items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-sm text-slate-200">
                    <Lightbulb size={18} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden />
                    <p>{buildTip(data)}</p>
                  </div>
                </div>

                {/* RECENT */}
                <div className="xl:col-span-5">
                  <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                    <span>Recently searched</span>
                    {recent.length > 4 && (
                      <button
                        onClick={() => setShowAllRecent(!showAllRecent)}
                        className="hover:text-white"
                      >
                        {showAllRecent ? 'Show less' : 'See all'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {recent.slice(0, showAllRecent ? 6 : 4).map(item => (
                      <button
                        key={item.city}
                        onClick={() => load({ name: item.city, lat: item.lat, lon: item.lon })}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:-translate-y-1 hover:bg-white/[0.08]"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <WeatherIcon type={item.icon} size={20} />
                          <span className="text-lg">{showTemp(item.temp)}</span>
                        </div>
                        <p className="truncate text-xs font-medium text-slate-200">{item.city}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* 7-DAY GRAPH */}
              <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      Forecast trend
                    </p>
                    <h3 className="mt-1 text-xl font-medium">7-Day Temperature</h3>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-xs text-slate-500">Highest</p>
                    <p className="text-lg">
                      {showTemp(Math.max(...data.daily.map(d => d.temp)))}
                    </p>
                  </div>
                </div>

                <div className="relative mt-6 overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    <div className="border-t border-white/5" />
                    <div className="border-t border-white/5" />
                    <div className="border-t border-white/5" />
                    <div className="border-t border-white/5" />
                  </div>

                  <svg
                    viewBox="0 0 800 180"
                    className="relative h-52 w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Line chart of the daily high temperature for the next 7 days"
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                        <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                      </linearGradient>
                    </defs>
                    {graphPoints && (
                      <>
                        <polyline
                          points={graphPoints}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points={`25,155 ${graphPoints} 775,155`}
                          fill="url(#areaGradient)"
                          stroke="none"
                          opacity="0.7"
                        />
                        {graphPoints.split(' ').map((point, index) => {
                          const [x, y] = point.split(',');
                          return (
                            <circle
                              key={index}
                              cx={x}
                              cy={y}
                              r="5"
                              fill="#0b1118"
                              stroke="#67e8f9"
                              strokeWidth="3"
                            />
                          );
                        })}
                      </>
                    )}
                  </svg>

                  <div className="grid grid-cols-7 gap-2">
                    {data.daily.map((day, i) => (
                      <button
                        key={day.date}
                        onClick={() => setSelectedIdx(i)}
                        aria-pressed={i === selectedIdx}
                        className={`text-center text-xs transition ${
                          i === selectedIdx
                            ? 'font-medium text-cyan-300'
                            : 'text-slate-500 hover:text-white'
                        }`}
                      >
                        {day.day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* SELECTED DAY */}
              {selectedDay && (
                <section className="mt-8">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-cyan-300">
                          Selected day
                        </p>
                        <h3 className="mt-1 text-2xl font-light">{selectedDay.day}</h3>
                        <p className="mt-1 text-xs text-slate-500">{selectedDay.description}</p>
                      </div>

                      <div className="flex items-center gap-4">
                        <WeatherIcon type={selectedDay.icon} size={42} />
                        <div>
                          <p className="text-3xl font-light">{showTemp(selectedDay.temp)}</p>
                          <p className="text-xs text-slate-500">
                            Low {showTemp(selectedDay.minTemp)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <InfoBox
                        title="Rain"
                        value={`${selectedDay.rainChance}%`}
                        icon={<Umbrella size={17} />}
                      />
                      <InfoBox
                        title="Wind"
                        value={`${Math.round(selectedDay.windSpeed)} km/h`}
                        icon={<Wind size={17} />}
                      />
                      <InfoBox
                        title="UV index"
                        value={selectedDay.uv.toFixed(1)}
                        icon={<Sun size={17} />}
                      />
                      <InfoBox
                        title="Date"
                        value={new Date(`${selectedDay.date}T12:00:00`).toLocaleDateString(
                          'en-US',
                          { month: 'short', day: 'numeric' }
                        )}
                        icon={<Gauge size={17} />}
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* CURRENT DETAILS */}
              <section className="mt-8">
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-slate-500">
                    Live information
                  </p>
                  <h3 className="mt-1 text-xl font-medium">Current Weather Details</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <DetailCard
                    title="Feels like"
                    value={showTemp(data.feelsLike)}
                    icon={<Thermometer size={18} />}
                  />
                  <DetailCard
                    title="Humidity"
                    value={`${data.humidity}%`}
                    icon={<Droplets size={18} />}
                  />
                  <DetailCard
                    title="Wind"
                    value={`${Math.round(data.windSpeed)} km/h`}
                    icon={<Wind size={18} />}
                  />
                  <DetailCard
                    title="Rain chance"
                    value={`${data.rainProbability}%`}
                    icon={<CloudRain size={18} />}
                  />
                  <DetailCard
                    title="Visibility"
                    value={
                      data.visibility !== null
                        ? `${(data.visibility / 1000).toFixed(1)} km`
                        : '--'
                    }
                    icon={<Eye size={18} />}
                  />
                  <DetailCard
                    title="UV index"
                    value={data.uvIndex.toFixed(1)}
                    icon={<Sun size={18} />}
                  />
                  <DetailCard
                    title="Pressure"
                    value={`${Math.round(data.pressure)} hPa`}
                    icon={<Gauge size={18} />}
                  />
                  <DetailCard
                    title="Air quality"
                    value={aqi.short}
                    icon={<Leaf size={18} />}
                  />
                  <DetailCard
                    title="Sunrise"
                    value={formatClock(data.sunrise)}
                    icon={<Sunrise size={18} />}
                  />
                  <DetailCard
                    title="Sunset"
                    value={formatClock(data.sunset)}
                    icon={<Sunset size={18} />}
                  />
                </div>
              </section>

              {/* 24-HOUR FORECAST */}
              {data.hourly.length > 0 && (
                <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    24-Hour Forecast
                  </h4>
                  <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {data.hourly.map((slot, i) => (
                      <div
                        key={i}
                        className="flex min-w-[78px] flex-col items-center rounded-2xl border border-white/5 bg-white/5 p-3 text-center transition hover:border-cyan-400/40"
                      >
                        <span className="text-[11px] text-slate-400">{slot.label}</span>
                        <div className="my-2">
                          <WeatherIcon type={slot.icon} size={22} />
                        </div>
                        <span className="text-sm font-semibold text-white">
                          {showTemp(slot.temp)}
                        </span>
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-cyan-300">
                          <Droplets size={10} aria-hidden />
                          {slot.rain}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 7-DAY FORECAST */}
              <section className="mt-10 border-t border-white/10 pt-7">
                <div className="mb-5">
                  <p className="text-xs uppercase tracking-widest text-slate-500">
                    Weekly outlook
                  </p>
                  <h3 className="mt-1 text-xl font-medium">7-Day Forecast</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 lg:gap-3">
                  {data.daily.map((day, i) => {
                    const active = i === selectedIdx;
                    return (
                      <button
                        key={day.date}
                        onClick={() => setSelectedIdx(i)}
                        aria-pressed={active}
                        className={`rounded-2xl border p-4 transition-all ${
                          active
                            ? 'scale-105 border-cyan-300/30 bg-cyan-300/10 shadow-lg shadow-cyan-500/10'
                            : 'border-white/5 bg-white/[0.025] hover:-translate-y-1 hover:bg-white/[0.07]'
                        }`}
                      >
                        <p className={`text-xs ${active ? 'text-cyan-200' : 'text-slate-400'}`}>
                          {day.day}
                        </p>
                        <div className="my-4 flex justify-center">
                          <WeatherIcon type={day.icon} size={28} />
                        </div>
                        <p className="text-xl font-medium">{showTemp(day.temp)}</p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Low {showTemp(day.minTemp)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-slate-600">
            WeatherWise • Weather data by Open-Meteo
          </footer>
        </main>
      </div>

      {/* DOWNLOAD APP MODAL */}
      {downloadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install WeatherWise"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#171922] p-6 text-center shadow-2xl">
            <button
              onClick={() => setDownloadModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
              <MapPin size={28} aria-hidden />
            </div>

            <h3 className="text-xl font-medium text-white">Get WeatherWise App</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Install WeatherWise on your phone or desktop for instant access. It also shows your
              last forecast when you are offline.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-xs text-slate-300">
              <p className="mb-2 font-semibold text-cyan-300">How to install:</p>
              <ul className="list-inside list-disc space-y-1.5 text-[11px] text-slate-400">
                <li>
                  <strong className="text-slate-200">Desktop (Chrome/Edge):</strong> click the{' '}
                  <span className="text-white">Install</span> icon in the address bar.
                </li>
                <li>
                  <strong className="text-slate-200">Mobile (iOS/Android):</strong> tap{' '}
                  <span className="text-white">Share / Options</span> and choose{' '}
                  <span className="text-white">&quot;Add to Home Screen&quot;</span>.
                </li>
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={async () => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const choice = await deferredPrompt.userChoice;
                    if (choice.outcome === 'accepted') setDeferredPrompt(null);
                  } else {
                    setDownloadModalOpen(false);
                  }
                }}
                className="w-full rounded-2xl bg-cyan-400 py-3 text-xs font-semibold text-black transition hover:bg-cyan-300"
              >
                {deferredPrompt ? 'Install App Now' : 'Got It'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
