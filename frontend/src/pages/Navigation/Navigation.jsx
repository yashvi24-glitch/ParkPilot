import { useEffect, useState } from "react";
import { FiClock, FiNavigation, FiTrendingUp } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { checkInParked } from "../../api/bookings";
import { getRoute } from "../../api/navigation";
import MapView from "../../components/MapView";
import "./Navigation.css";

export default function NavigationPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [destination] = useState(
    state?.destLat ? { lat: state.destLat, lng: state.destLng, name: state.destName, address: state.destAddress } : null
  );
  const bookingId = state?.bookingId;
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [route, setRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState("");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Location access denied. Enable location permissions to get directions.")
    );
  }, []);

  useEffect(() => {
    if (!destination || !userLocation) return;
    setLoadingRoute(true);
    getRoute({
      fromLat: userLocation.lat,
      fromLng: userLocation.lng,
      toLat: destination.lat,
      toLng: destination.lng,
      mode: "driving",
    })
      .then(setRoute)
      .catch(() => setRoute(null))
      .finally(() => setLoadingRoute(false));
  }, [destination, userLocation]);

  const openExternalNavigation = () => {
    if (!userLocation || !destination) return;
    const { lat: oLat, lng: oLng } = userLocation;
    const { lat: dLat, lng: dLng } = destination;
    const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`;

    // The web directions URL only ever opens a route preview, never live turn-by-turn
    // navigation. On phones, the Google Maps app's own URL schemes jump straight into
    // driving navigation mode — fall back to the web preview only if the app isn't there.
    const ua = navigator.userAgent;
    const appUrl = /Android/i.test(ua)
      ? `google.navigation:q=${dLat},${dLng}&mode=d`
      : /iPhone|iPad|iPod/i.test(ua)
      ? `comgooglemaps://?saddr=${oLat},${oLng}&daddr=${dLat},${dLng}&directionsmode=driving`
      : null;

    if (!appUrl) {
      window.open(webUrl, "_blank", "noopener,noreferrer");
      return;
    }

    let fellBack = false;
    document.addEventListener("visibilitychange", () => { if (document.hidden) fellBack = true; }, { once: true });
    window.location.href = appUrl;
    setTimeout(() => {
      if (!fellBack && !document.hidden) window.open(webUrl, "_blank", "noopener,noreferrer");
    }, 1500);
  };

  const handleParked = async () => {
    setCheckingIn(true);
    setCheckInError("");
    try {
      await checkInParked(bookingId);
      navigate("/find-my-car");
    } catch (err) {
      setCheckInError(err.response?.data?.[0] || "Could not confirm parking. Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  const routeCoords = route?.geometry?.map(([lng, lat]) => [lat, lng]) || [];
  const markers = [];
  if (userLocation) markers.push({ lat: userLocation.lat, lng: userLocation.lng, color: "#3b82f6" });
  if (destination) markers.push({ lat: destination.lat, lng: destination.lng, color: "#7d35ff" });

  return (
    <div className="navigation-page fade-in">
      <h1>Navigation</h1>
      <p className="page-subtitle">Get real-time directions to any parking location.</p>

      {locationError && <div className="location-warning">{locationError}</div>}

      {!destination ? (
        <div className="empty-state">Open a parking location and tap "Directions" to navigate here.</div>
      ) : (
        <>
          <div className="nav-destination-card card">
            <div>
              <div className="nav-destination-name">{destination.name}</div>
              <div className="nav-destination-address">{destination.address}</div>
            </div>
          </div>

          <MapView markers={markers} routeCoords={routeCoords} height={360} />

          <div className="nav-stats">
            {loadingRoute ? (
              <div className="skeleton" style={{ height: 60, width: "100%" }} />
            ) : route ? (
              <>
                <div className="nav-stat"><FiTrendingUp /> {route.distance_km} km</div>
                <div className="nav-stat"><FiClock /> {route.duration_min} min</div>
              </>
            ) : (
              <div className="empty-state">Could not calculate a route. Try again.</div>
            )}
            <button className="btn btn-primary" onClick={openExternalNavigation} disabled={!route}>
              <FiNavigation /> Start Navigation
            </button>
          </div>

          {bookingId && (
            <>
              <button className="btn btn-primary btn-block nav-parked-btn" onClick={handleParked} disabled={checkingIn}>
                {checkingIn ? "Confirming..." : "I've Parked My Car"}
              </button>
              {checkInError && <div className="location-warning">{checkInError}</div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
