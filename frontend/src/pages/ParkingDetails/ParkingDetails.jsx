import { useEffect, useState } from "react";
import { FiClock, FiMapPin, FiNavigation, FiPhone, FiStar, FiTruck } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { listBookings } from "../../api/bookings";
import { getParkingDetail } from "../../api/parking";
import MapView from "../../components/MapView";
import { useAuth } from "../../context/AuthContext";
import "./ParkingDetails.css";

const PARKING_TYPE_LABELS = {
  municipal: "Municipal Parking",
  public: "Public Parking",
  private: "Private Parking",
  mall: "Mall Parking",
  railway_station: "Railway Station Parking",
  airport: "Airport Parking",
  hospital: "Hospital Parking",
  tourist_attraction: "Tourist Attraction Parking",
  smart: "Smart Parking",
  multi_level: "Multi-Level Parking",
  bus_station: "Bus Station Parking",
};

export default function ParkingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [parking, setParking] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linkedBooking, setLinkedBooking] = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    getParkingDetail(id, userLocation || {})
      .then(setParking)
      .finally(() => setLoading(false));
  }, [id, userLocation]);

  // Directions only make sense once this location is actually booked — otherwise
  // there's nothing to navigate to yet. Only an upcoming/active booking counts.
  useEffect(() => {
    if (!isAuthenticated || !id) return;
    Promise.all([listBookings({ status: "upcoming" }), listBookings({ status: "active" })])
      .then(([upcoming, active]) => {
        const match = [...upcoming, ...active].find((b) => b.parking_id === Number(id));
        setLinkedBooking(match || null);
      })
      .catch(() => setLinkedBooking(null));
  }, [id, isAuthenticated]);

  const requireAuth = (path, state) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: { pathname: path } } });
    } else {
      navigate(path, { state });
    }
  };

  const handleDirections = () => {
    requireAuth("/navigation", {
      bookingId: linkedBooking?.id,
      destLat: parseFloat(parking.latitude),
      destLng: parseFloat(parking.longitude),
      destName: parking.name,
      destAddress: parking.address,
    });
  };

  if (loading || !parking) {
    return <div className="skeleton" style={{ height: 400 }} />;
  }

  const markers = [{ lat: parseFloat(parking.latitude), lng: parseFloat(parking.longitude), color: "#7d35ff" }];
  if (userLocation) markers.unshift({ lat: userLocation.lat, lng: userLocation.lng, color: "#3b82f6" });

  const isLowStock = parking.available_slots > 0 && parking.available_slots <= 8;

  return (
    <div className="parking-details fade-in">
      <div className="parking-details-hero" style={{ backgroundImage: `url(${parking.image})` }}>
        {isLowStock && <span className="low-stock-badge">Only {parking.available_slots} Slots Left</span>}
      </div>

      <div className="parking-details-grid">
        <div>
          <div className="parking-details-header">
            <div>
              <h1>{parking.name}</h1>
              <p className="parking-details-address"><FiMapPin /> {parking.address}</p>
            </div>
            <div className="parking-details-rating"><FiStar /> {parking.rating} <span>({parking.rating_count})</span></div>
          </div>

          <p className="parking-details-description">{parking.description}</p>

          <div className="parking-details-tags">
            <span className="badge badge-selected">{PARKING_TYPE_LABELS[parking.parking_type] || parking.parking_type}</span>
            <span className="badge badge-completed">
              <FiClock /> {parking.is_24_hours ? "Open 24/7" : `${parking.opens_at?.slice(0, 5)} - ${parking.closes_at?.slice(0, 5)}`}
            </span>
            <span className="badge badge-available">{parking.available_slots} / {parking.total_slots} Available</span>
            <span className="badge badge-completed">₹{parking.price_per_hour}/hr · ₹{parking.price_day_max}/day max</span>
          </div>

          <div className="parking-details-meta-row">
            <span><FiMapPin /> {parking.city}, Gujarat</span>
            <span><FiTruck /> {parking.vehicle_types}</span>
            {parking.contact_number && <span><FiPhone /> {parking.contact_number}</span>}
          </div>

          {parking.amenities && (
            <div className="parking-details-amenities">
              {parking.amenities.split(",").map((a) => (
                <span key={a} className="amenity-chip">{a.trim()}</span>
              ))}
            </div>
          )}

          <h3>Available Floors</h3>
          <div className="floors-list">
            {parking.floors.map((f) => (
              <div key={f.id} className="floor-row">
                <span>{f.name}</span>
                <span className={f.available_slots > 0 ? "text-success" : "text-danger"}>
                  {f.available_slots} / {f.total_slots} available
                </span>
              </div>
            ))}
          </div>

          <div className="parking-details-actions">
            {linkedBooking && (
              <button className="btn btn-outline btn-block" onClick={handleDirections}>
                <FiNavigation /> Directions
              </button>
            )}
            <button
              className="btn btn-primary btn-block"
              disabled={parking.available_slots === 0}
              onClick={() => requireAuth(`/book/${parking.id}`)}
            >
              Book Now
            </button>
          </div>
        </div>

        <div>
          <MapView markers={markers} height={340} />
          {parking.google_maps_url && (
            <a href={parking.google_maps_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block gmaps-link">
              <FiMapPin /> View on Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
