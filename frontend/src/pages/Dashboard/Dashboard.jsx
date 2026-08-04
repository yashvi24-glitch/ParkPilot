import { useEffect, useState } from "react";
import { FiCalendar, FiCompass, FiMapPin, FiSearch } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { listBookings } from "../../api/bookings";
import { nearbyParking } from "../../api/parking";
import ParkingCard from "../../components/ParkingCard";
import { useAuth } from "../../context/AuthContext";
import "./Dashboard.css";

const DEFAULT_CENTER = { lat: 23.0326, lng: 72.5061 };

const FEATURE_CARDS = [
  { to: "/find-parking", label: "Find Parking", icon: FiMapPin },
  { to: "/my-bookings", label: "My Bookings", icon: FiCalendar },
  { to: "/find-my-car", label: "Find My Car", icon: FiCompass },
];

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [nearby, setNearby] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const loadNearby = (coords) => {
      nearbyParking({ lat: coords.lat, lng: coords.lng, radius: 500 })
        .then((data) => setNearby(data.slice(0, 4)))
        .catch(() => {})
        .finally(() => setNearbyLoading(false));
    };

    if (isAuthenticated && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => loadNearby({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => loadNearby(DEFAULT_CENTER),
        { timeout: 5000 }
      );
    } else {
      loadNearby(DEFAULT_CENTER);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    listBookings().then((data) => setBookings(data.slice(0, 3))).catch(() => {});
  }, [isAuthenticated]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: "/find-parking" } } });
      return;
    }
    navigate(`/find-parking${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  };

  const handleFeatureClick = (to) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: to } } });
    } else {
      navigate(to);
    }
  };

  return (
    <div className="dashboard fade-in">
      <section className="dashboard-hero">
        <div className="dashboard-hero-overlay">
          {isAuthenticated ? (
            <>
              <p className="dashboard-hero-eyebrow">Good to see you 👋</p>
              <h1>Welcome back, {user?.full_name?.split(" ")[0]}</h1>
            </>
          ) : (
            <p className="dashboard-hero-eyebrow">Welcome to ParkPilot</p>
          )}
          <h1 className={isAuthenticated ? "hidden-sm" : ""}>Find. Book. Park.</h1>
          <p>Discover nearby parking spaces, reserve instantly, and navigate confidently.</p>

          <form className="dashboard-search" onSubmit={handleSearch}>
            <FiSearch />
            <input
              placeholder="Search location (e.g. Alpha Mall)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>
      </section>

      <section className="dashboard-features">
        {FEATURE_CARDS.map(({ to, label, icon: Icon }) => (
          <button key={to} className="feature-card" onClick={() => handleFeatureClick(to)}>
            <span className="feature-card-icon"><Icon /></span>
            {label}
          </button>
        ))}
      </section>

      {isAuthenticated && bookings.length > 0 && (
        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <h2>Recent Bookings</h2>
            <button className="link-btn" onClick={() => navigate("/my-bookings")}>View All</button>
          </div>
          <div className="recent-bookings">
            {bookings.map((b) => (
              <div key={b.id} className="recent-booking-row card">
                <div>
                  <div className="recent-booking-name">{b.parking_name}</div>
                  <div className="recent-booking-meta">{b.date} • Floor {b.floor_name} • Slot {b.slot_code}</div>
                </div>
                <span className={`badge badge-${b.status}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <div className="dashboard-section-head">
          <h2>Nearby Parking Areas</h2>
          <button className="link-btn" onClick={() => handleFeatureClick("/find-parking")}>View All</button>
        </div>
        {nearbyLoading ? (
          <div className="parking-grid">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />)}
          </div>
        ) : nearby.length === 0 ? (
          <div className="empty-state">No parking areas found nearby yet.</div>
        ) : (
          <div className="parking-grid">
            {nearby.map((p) => <ParkingCard key={p.id} parking={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
