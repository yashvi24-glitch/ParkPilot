import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiCrosshair, FiMapPin, FiRefreshCw, FiSearch } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { getRoute, geocode, reverseGeocode } from "../../api/navigation";
import { getCities, nearbyParking, searchParking } from "../../api/parking";
import MapView from "../../components/MapView";
import ParkingCard from "../../components/ParkingCard";
import "./FindParking.css";

const DEFAULT_CENTER = { lat: 23.0326, lng: 72.5061 };
const NEARBY_THRESHOLD_MIN = 30;
// Real routing calls only go out for the closest-by-straight-line candidates —
// anything farther is already a near-certain "beyond 30 min" and doesn't need an
// exact number. Keeps the whole ranking pass fast regardless of dataset size.
const TRAVEL_TIME_CANDIDATE_LIMIT = 20;
// Hard cap per routing request so one slow/stuck call can't stall the whole
// search — combined with running every candidate concurrently (not batched in
// sequential rounds), the entire ranking pass finishes well under 10s.
const TRAVEL_TIME_TIMEOUT_MS = 6000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// "free" typed alongside other words (e.g. "free ranip") is a filter keyword,
// not part of the place name — pull it out so the rest of the text can be
// matched against free-only results instead.
function parseFreeQuery(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const free = tokens.some((t) => t.toLowerCase() === "free");
  const remainder = tokens.filter((t) => t.toLowerCase() !== "free").join(" ");
  return { free, remainder };
}

const PARKING_TYPES = [
  { value: "", label: "All Types" },
  { value: "free", label: "Free Parking" },
  { value: "municipal", label: "Municipal" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
  { value: "mall", label: "Mall" },
  { value: "railway_station", label: "Railway Station" },
  { value: "airport", label: "Airport" },
  { value: "hospital", label: "Hospital" },
  { value: "tourist_attraction", label: "Tourist Attraction" },
  { value: "smart", label: "Smart Parking" },
  { value: "multi_level", label: "Multi-Level" },
  { value: "bus_station", label: "Bus Station" },
];

// Real driving travel time for the closest-by-distance candidates, all requested
// concurrently (each with its own timeout) so the pass can't stall — then sorted
// by: travel time -> distance -> availability (per spec), nearest-by-time first.
async function rankByTravelTime(locations, origin) {
  const candidates = locations.slice(0, TRAVEL_TIME_CANDIDATE_LIMIT);
  const rest = locations.slice(TRAVEL_TIME_CANDIDATE_LIMIT);

  const withTravelTime = await Promise.all(
    candidates.map(async (loc) => {
      try {
        const route = await withTimeout(
          getRoute({
            fromLat: origin.lat,
            fromLng: origin.lng,
            toLat: parseFloat(loc.latitude),
            toLng: parseFloat(loc.longitude),
            mode: "driving",
          }),
          TRAVEL_TIME_TIMEOUT_MS
        );
        return { ...loc, travel_time_min: route.duration_min };
      } catch {
        return { ...loc, travel_time_min: null };
      }
    })
  );
  withTravelTime.push(...rest.map((loc) => ({ ...loc, travel_time_min: null })));

  withTravelTime.sort((a, b) => {
    if (a.travel_time_min != null && b.travel_time_min != null && a.travel_time_min !== b.travel_time_min) {
      return a.travel_time_min - b.travel_time_min;
    }
    if (a.travel_time_min != null && b.travel_time_min == null) return -1;
    if (a.travel_time_min == null && b.travel_time_min != null) return 1;
    if (a.distance_km !== b.distance_km) return (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity);
    return (b.available_slots ?? 0) - (a.available_slots ?? 0);
  });
  return withTravelTime;
}

export default function FindParking() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [results, setResults] = useState([]);
  const [showMore, setShowMore] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationModeActive, setLocationModeActive] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [rankingByTime, setRankingByTime] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [cities, setCities] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Guards against out-of-order responses: a slow request (e.g. still
  // running travel-time ranking) can otherwise resolve after a newer one
  // and overwrite its results. Each fetch checks it's still the latest
  // before touching state.
  const requestIdRef = useRef(0);

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  // "Free Parking" is a price-based filter, not a real parking_type, so it's
  // translated to a separate `free` param here rather than sent as `type`.
  const buildFilterParams = ({ city, type } = {}) => {
    const filters = {};
    if (city) filters.city = city;
    if (type === "free") filters.free = true;
    else if (type) filters.type = type;
    return filters;
  };

  const activeFilters = () => buildFilterParams({ city: cityFilter, type: typeFilter });

  const loadNearby = async (coords, filters = {}) => {
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError("");
    setShowMore(false);
    try {
      const data = await nearbyParking({ lat: coords.lat, lng: coords.lng, radius: 500, ...filters });
      if (myRequestId !== requestIdRef.current) return;
      setResults(data);
      setLoading(false);
      if (data.length > 0) {
        setRankingByTime(true);
        const ranked = await rankByTravelTime(data, coords);
        if (myRequestId !== requestIdRef.current) return;
        setResults(ranked);
        setRankingByTime(false);
      }
    } catch {
      if (myRequestId !== requestIdRef.current) return;
      setSearchError("Could not load nearby parking. Please try again.");
      setLoading(false);
    }
  };

  const resolveAddress = (coords) => {
    reverseGeocode(coords.lat, coords.lng)
      .then((res) => setDetectedAddress(res.display_name))
      .catch(() => setDetectedAddress(""));
  };

  // Default state: Current Location isn't enabled and there's no search text,
  // so every parking location is shown (no distance/time ordering, no cap).
  const loadAllLocations = () => {
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError("");
    setShowMore(false);
    searchParking(activeFilters())
      .then((data) => {
        if (myRequestId !== requestIdRef.current) return;
        setResults(data);
      })
      .catch(() => {
        if (myRequestId !== requestIdRef.current) return;
        setSearchError("Could not load parking locations. Please try again.");
      })
      .finally(() => {
        if (myRequestId !== requestIdRef.current) return;
        setLoading(false);
      });
  };

  // A single getCurrentPosition call often returns whatever fix is available first —
  // frequently a coarse Wi-Fi/cell-based guess rather than a refined GPS lock, which
  // can take a few seconds to arrive. Watch for updates briefly and keep the most
  // accurate (lowest pos.coords.accuracy, in meters) reading instead of the first one.
  const ACCURACY_TARGET_M = 30;
  const REFINE_WINDOW_MS = 7000;

  // Explicitly (re-)activating Current Location Mode always wins over whatever
  // manual search was in progress — clear the typed query so the two modes
  // never both look "active" at once.
  const detectLocation = () => {
    setLocationError("");
    setDetectedAddress("");
    setQuery("");
    if (!navigator.geolocation) {
      setLocationModeActive(false);
      setLocationError("Your browser doesn't support location detection.");
      loadAllLocations();
      return;
    }
    setLoading(true);

    let best = null;
    let settled = false;
    let watchId;

    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      if (best) {
        const coords = { lat: best.latitude, lng: best.longitude };
        setLocationModeActive(true);
        setUserLocation(coords);
        loadNearby(coords, activeFilters());
        resolveAddress(coords);
      } else {
        setLocationModeActive(false);
        setLocationError("Couldn't detect your location. Please retry, or search a place instead.");
        loadAllLocations();
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.accuracy) best = pos.coords;
        if (pos.coords.accuracy <= ACCURACY_TARGET_M) finish();
      },
      (err) => {
        if (best) return;
        settled = true;
        navigator.geolocation.clearWatch(watchId);
        setLocationModeActive(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Enable location permissions in your browser, then retry — or search a place instead."
            : "Couldn't detect your location. Please retry, or search a place instead."
        );
        loadAllLocations();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: REFINE_WINDOW_MS }
    );

    setTimeout(finish, REFINE_WINDOW_MS);
  };

  // Default state: Current Location is opt-in, not automatic — until the user
  // explicitly enables it or types a search, show every parking location.
  useEffect(() => {
    if (query) {
      runSearch(query);
    } else {
      loadAllLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = async (q) => {
    const myRequestId = ++requestIdRef.current;
    setLocationModeActive(false);
    setLoading(true);
    setSearchError("");
    setLocationError("");
    setDetectedAddress("");
    setShowMore(false);

    // "free" is a database filter keyword, not a geocodable place — skip the
    // geocode lookup entirely and go straight to a filtered name search.
    const { free, remainder } = parseFreeQuery(q);
    if (free) {
      try {
        const data = await searchParking({ q: remainder, free: true, ...activeFilters() });
        if (myRequestId !== requestIdRef.current) return;
        if (data.length === 0) {
          setSearchError(`Couldn't find "${q}". Try a different search.`);
        }
        setResults(data);
        setLoading(false);
      } catch {
        if (myRequestId !== requestIdRef.current) return;
        setSearchError("Something went wrong while searching. Please try again.");
        setLoading(false);
      }
      return;
    }

    try {
      const geoResults = await geocode(q);
      if (myRequestId !== requestIdRef.current) return;
      if (geoResults.length > 0) {
        const { lat, lng, display_name } = geoResults[0];
        setUserLocation({ lat, lng });
        setDetectedAddress(display_name);
        const data = await searchParking({ lat, lng, ...activeFilters() });
        if (myRequestId !== requestIdRef.current) return;
        setLoading(false);
        setResults(data);
        if (data.length > 0) {
          setRankingByTime(true);
          const ranked = await rankByTravelTime(data, { lat, lng });
          if (myRequestId !== requestIdRef.current) return;
          setResults(ranked);
          setRankingByTime(false);
        }
      } else {
        const data = await searchParking({ q, ...activeFilters() });
        if (myRequestId !== requestIdRef.current) return;
        if (data.length === 0) {
          setSearchError(`Couldn't find "${q}". Try a different search.`);
        }
        setResults(data);
        setLoading(false);
      }
    } catch {
      if (myRequestId !== requestIdRef.current) return;
      setSearchError("Something went wrong while searching. Please try again.");
      setLoading(false);
    }
  };

  // Typing always wins over Current Location Mode: the moment a character is
  // entered, stop treating GPS as the search source and search the full
  // dataset by name-prefix instead — debounced so it doesn't fire a request
  // per keystroke, but with no need to press Search.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (locationModeActive) return;

    const trimmed = query.trim();
    setShowMore(false);
    if (!trimmed) {
      // Cleared back to empty with Current Location still off: fall back to
      // showing every parking location, per the "not enabled, no search text" default.
      loadAllLocations();
      return;
    }

    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setSearchError("");
    const timer = setTimeout(() => {
      searchParking({ q: trimmed, ...activeFilters() })
        .then((data) => {
          if (myRequestId !== requestIdRef.current) return;
          if (data.length === 0) setSearchError(`Couldn't find "${trimmed}". Try a different search.`);
          setResults(data);
          setLoading(false);
        })
        .catch(() => {
          if (myRequestId !== requestIdRef.current) return;
          setSearchError("Something went wrong while searching. Please try again.");
          setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, locationModeActive]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) runSearch(query.trim());
    else detectLocation();
  };

  const handleFilterChange = (next) => {
    const filters = buildFilterParams({ city: cityFilter, type: typeFilter, ...next });
    if (locationModeActive && userLocation) {
      loadNearby(userLocation, filters);
    } else {
      const myRequestId = ++requestIdRef.current;
      setLoading(true);
      setSearchError("");
      setShowMore(false);
      const params = query.trim() ? { q: query.trim(), ...filters } : filters;
      searchParking(params)
        .then((data) => {
          if (myRequestId !== requestIdRef.current) return;
          setResults(data);
        })
        .finally(() => {
          if (myRequestId !== requestIdRef.current) return;
          setLoading(false);
        });
    }
  };

  // Real-time, case-insensitive prefix filter over the currently loaded results —
  // narrows the list as the user types, with no need to submit the search.
  // "free" is treated as a filter keyword rather than name text: it narrows to
  // price_per_hour === 0, and any remaining words match as a substring instead
  // of a prefix, since free-zone names bury the area name mid-string.
  const trimmedQuery = query.trim();
  const { free: quickFree, remainder: quickRemainder } = parseFreeQuery(trimmedQuery);
  const filteredResults = quickFree
    ? results.filter((p) => Number(p.price_per_hour) === 0 && (!quickRemainder || p.name.toLowerCase().includes(quickRemainder.toLowerCase())))
    : trimmedQuery
      ? results.filter((p) => p.name.toLowerCase().startsWith(trimmedQuery.toLowerCase()))
      : results;

  // The 30-minute priority split only applies once Current Location Mode has
  // finished ranking by real travel time — otherwise (manual search, browse-all,
  // or still mid-ranking) every matching location is shown together, uncapped.
  const splitByTravelTime = locationModeActive && !rankingByTime;
  const withinRange = splitByTravelTime
    ? filteredResults.filter((p) => p.travel_time_min != null && p.travel_time_min <= NEARBY_THRESHOLD_MIN)
    : filteredResults;
  const beyondRange = splitByTravelTime
    ? filteredResults.filter((p) => p.travel_time_min == null || p.travel_time_min > NEARBY_THRESHOLD_MIN)
    : [];

  const center = userLocation || DEFAULT_CENTER;
  const visibleOnMap = showMore ? filteredResults : withinRange;
  const markers = [
    { lat: center.lat, lng: center.lng, color: "#3b82f6" },
    ...visibleOnMap.map((p) => ({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude), color: "#7d35ff" })),
  ];

  return (
    <div className="find-parking fade-in">
      <h1>Find Nearest Parking</h1>
      <p className="page-subtitle">Search any location across Gujarat or use your current position to discover nearby parking.</p>

      <form className="find-parking-search" onSubmit={handleSubmit}>
        <FiSearch />
        <input
          placeholder="Search location, mall, airport, hospital..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (locationModeActive) {
              setLocationModeActive(false);
              setDetectedAddress("");
              setLocationError("");
            }
          }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={detectLocation}>
          <FiCrosshair /> Current Location
        </button>
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
      </form>

      {locationModeActive && (
        <p className="detected-location">
          <span className="location-mode-badge"><FiCrosshair /> Current Location Mode</span>
          {detectedAddress && <> <FiMapPin /> Showing parking near: {detectedAddress}</>}
        </p>
      )}

      <div className="find-parking-filters">
        <select
          className="input"
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            handleFilterChange({ city: e.target.value });
          }}
        >
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="input"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            handleFilterChange({ type: e.target.value });
          }}
        >
          {PARKING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {locationError && (
        <div className="location-warning">
          <FiAlertTriangle /> {locationError}
          <button className="location-retry-btn" onClick={detectLocation}>
            <FiRefreshCw /> Retry
          </button>
        </div>
      )}

      <MapView markers={markers} height={320} />

      <div className="find-parking-results">
        {loading ? (
          <div className="parking-grid">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />)}
          </div>
        ) : searchError ? (
          <div className="empty-state">{searchError}</div>
        ) : results.length === 0 ? (
          <div className="empty-state">No parking areas found. Try a different search or filter.</div>
        ) : filteredResults.length === 0 ? (
          <div className="empty-state">No parking locations found matching your search.</div>
        ) : (
          <>
            {rankingByTime && <p className="ranking-hint">Calculating travel times to sort by fastest route...</p>}
            <div className="parking-grid">
              {withinRange.map((p) => <ParkingCard key={p.id} parking={p} showTravelTime />)}
            </div>
            {splitByTravelTime && beyondRange.length > 0 && (
              <>
                <button className="btn btn-outline view-more-btn" onClick={() => setShowMore((s) => !s)}>
                  {showMore ? "Hide Farther Parking Locations" : `Show More Parking Locations (${beyondRange.length})`}
                </button>
                {showMore && (
                  <div className="parking-grid more-parking-grid">
                    {beyondRange.map((p) => <ParkingCard key={p.id} parking={p} showTravelTime />)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
