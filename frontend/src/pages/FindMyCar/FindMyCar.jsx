import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCalendar, FiClock, FiMapPin, FiNavigation, FiTrendingUp } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { listBookings, markFoundCar } from "../../api/bookings";
import { getRoute } from "../../api/navigation";
import MapView from "../../components/MapView";
import "./FindMyCar.css";

export default function FindMyCar() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [enrouteRoute, setEnrouteRoute] = useState(null);
  const [route, setRoute] = useState(null);
  const [marking, setMarking] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listBookings({ status: "upcoming" }), listBookings({ status: "active" })])
      .then(([upcoming, active]) => setBookings([...upcoming, ...active]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Location access denied. Enable location permissions to get a route to your car.")
    );
  }, []);

  // Exactly one booking represents the user's current parking journey at a time:
  // an already-parked session takes priority (Case 3/4), otherwise the soonest
  // booking still awaiting arrival (Case 2). Neither existing means no session (Case 1).
  const parkedSession = bookings.find((b) => b.parked_at);
  const enrouteSession = [...bookings]
    .filter((b) => !b.parked_at)
    .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))[0];
  const session = parkedSession || enrouteSession;

  useEffect(() => {
    if (!enrouteSession || parkedSession || !userLocation) return;
    getRoute({
      fromLat: userLocation.lat,
      fromLng: userLocation.lng,
      toLat: parseFloat(enrouteSession.latitude),
      toLng: parseFloat(enrouteSession.longitude),
      mode: "driving",
    }).then(setEnrouteRoute).catch(() => setEnrouteRoute(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrouteSession?.id, parkedSession, userLocation]);

  useEffect(() => {
    if (!parkedSession || !userLocation) return;
    getRoute({
      fromLat: userLocation.lat,
      fromLng: userLocation.lng,
      toLat: parseFloat(parkedSession.latitude),
      toLng: parseFloat(parkedSession.longitude),
      mode: "walking",
    }).then(setRoute).catch(() => setRoute(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkedSession?.id, userLocation]);

  const handleFoundCar = async () => {
    setMarking(true);
    try {
      await markFoundCar(session.id);
      navigate("/app");
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 300 }} />;

  // Case 1 - no upcoming or active booking at all.
  if (!session) {
    return (
      <div className="find-my-car fade-in">
        <h1>Find My Car</h1>
        <div className="fmc-empty card">
          <FiMapPin size={32} />
          <h2>No Active Parking Session</h2>
          <p>You don't have a parked vehicle right now. Reserve a spot first, then come back here to find your way back to it.</p>
          <div className="fmc-empty-actions">
            <button className="btn btn-primary" onClick={() => navigate("/find-parking")}>Find Parking</button>
            <button className="btn btn-outline" onClick={() => navigate("/my-bookings")}>View My Bookings</button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2 - booked but not yet checked in as parked.
  if (!session.parked_at) {
    return (
      <div className="find-my-car fade-in">
        <h1>Find My Car</h1>
        <div className="fmc-enroute card">
          <span className={`badge badge-${session.status}`}>{session.status}</span>
          <h2>{session.parking_name}</h2>
          <p className="booking-item-address"><FiMapPin /> {session.parking_address}</p>
          <div className="booking-item-meta">
            <span><FiCalendar /> {session.date}</span>
            <span><FiClock /> Entry {session.start_time}</span>
          </div>

          {enrouteRoute ? (
            <p className="fmc-eta"><FiNavigation /> ~{Math.round(enrouteRoute.duration_min)} min away ({enrouteRoute.distance_km} km)</p>
          ) : locationError ? (
            <div className="location-warning"><FiAlertTriangle /> {locationError}</div>
          ) : (
            <p className="fmc-eta">Calculating estimated arrival time...</p>
          )}

          <p className="fmc-enroute-hint">You haven't parked yet — tap Continue Navigation, and once you arrive at the lot confirm you've parked from there to unlock Find My Car.</p>

          <div className="fmc-enroute-actions">
            <button
              className="btn btn-primary btn-block"
              onClick={() =>
                navigate("/navigation", {
                  state: {
                    bookingId: session.id,
                    destLat: parseFloat(session.latitude),
                    destLng: parseFloat(session.longitude),
                    destName: session.parking_name,
                    destAddress: session.parking_address,
                  },
                })
              }
            >
              <FiNavigation /> Continue Navigation
            </button>
            <button className="btn btn-outline btn-block" onClick={() => navigate("/my-bookings")}>View Booking Details</button>
          </div>
        </div>
      </div>
    );
  }

  // Case 4 - parked, active session: walking route back to the vehicle.
  const markers = [];
  if (userLocation) markers.push({ lat: userLocation.lat, lng: userLocation.lng, color: "#3b82f6" });
  markers.push({ lat: parseFloat(session.latitude), lng: parseFloat(session.longitude), color: "#7d35ff" });
  const routeCoords = route?.geometry?.map(([lng, lat]) => [lat, lng]) || [];

  return (
    <div className="find-my-car fade-in">
      <h1>We'll help you find your parked car</h1>

      <div className="fmc-target-card card">
        <div>
          <div className="booking-item-title">{session.parking_name}</div>
          <div className="booking-item-address">Floor {session.floor_name} · Slot {session.slot_code}</div>
        </div>
      </div>

      {locationError && (
        <div className="location-warning">
          <FiAlertTriangle /> {locationError}
        </div>
      )}

      <MapView markers={markers} routeCoords={routeCoords} height={340} />

      <div className="nav-stats">
        {route ? (
          <>
            <div className="nav-stat"><FiTrendingUp /> {route.distance_km} km</div>
            <div className="nav-stat"><FiClock /> {route.duration_min} min walk</div>
          </>
        ) : userLocation ? (
          <div className="empty-state">Calculating route...</div>
        ) : (
          <div className="empty-state">Enable location access to calculate your walking route.</div>
        )}
      </div>

      <div className="fmc-actions">
        <button
          className="btn btn-outline btn-block"
          disabled={!userLocation}
          onClick={() => {
            const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}&destination=${session.latitude},${session.longitude}&travelmode=walking`;
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          <FiNavigation /> Start Navigation
        </button>
        <button className="btn btn-primary btn-block" onClick={() => navigate(`/parking-arrival/${session.id}`)}>
          View My Parking Slot
        </button>
        <button className="btn btn-primary btn-block" onClick={handleFoundCar} disabled={marking}>
          {marking ? "Please wait..." : "I Have Found My Car"}
        </button>
      </div>
    </div>
  );
}
