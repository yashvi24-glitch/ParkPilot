import { FiClock, FiMapPin, FiStar, FiTrendingUp } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import "./ParkingCard.css";

const PARKING_TYPE_LABELS = {
  municipal: "Municipal",
  public: "Public",
  private: "Private",
  mall: "Mall",
  railway_station: "Railway Station",
  airport: "Airport",
  hospital: "Hospital",
  tourist_attraction: "Tourist Spot",
  smart: "Smart Parking",
  multi_level: "Multi-Level",
  bus_station: "Bus Station",
};

const CATEGORY_LABELS = {
  mall: "Mall",
  hospital: "Hospital",
  hotel: "Hotel",
  office: "Office",
  residential: "Residential",
  other: "Other",
};

export default function ParkingCard({ parking, showTravelTime }) {
  const navigate = useNavigate();
  const hasTravelTime = showTravelTime && parking.travel_time_min != null;

  return (
    <div className="parking-card fade-in" onClick={() => navigate(`/parking/${parking.id}`)}>
      <div className="parking-card-image" style={{ backgroundImage: `url(${parking.image})` }}>
        <span className={"badge " + (parking.available_slots > 0 ? "badge-available" : "badge-booked")}>
          {parking.available_slots > 0 ? "Available" : "Full"}
        </span>
        <div className="parking-card-tags">
          {parking.parking_type && (
            <span className="parking-card-type-tag">{PARKING_TYPE_LABELS[parking.parking_type] || parking.parking_type}</span>
          )}
          {parking.category && (
            <span className="parking-card-type-tag">{CATEGORY_LABELS[parking.category] || parking.category}</span>
          )}
        </div>
      </div>
      {hasTravelTime && (
        <div className="parking-card-travel-time">
          <FiTrendingUp /> {Math.round(parking.travel_time_min)} min drive
        </div>
      )}
      <div className="parking-card-body">
        <div className="parking-card-top">
          <h3>{parking.name}</h3>
          <div className="parking-card-rating">
            <FiStar /> {parking.rating}
          </div>
        </div>
        <p className="parking-card-address">
          <FiMapPin /> {parking.city ? `${parking.city}, Gujarat` : parking.address}
        </p>
        <div className="parking-card-meta">
          {parking.distance_km != null && (
            <>
              <span>{parking.distance_km} km away</span>
              <span className="dot">•</span>
            </>
          )}
          <span>
            <FiClock /> {parking.is_24_hours ? "Open 24/7" : `${parking.opens_at?.slice(0, 5)} - ${parking.closes_at?.slice(0, 5)}`}
          </span>
        </div>
        <div className="parking-card-footer">
          <div>
            <span className="parking-card-slots">{parking.available_slots}</span>
            <span className="parking-card-slots-total"> / {parking.total_slots} slots</span>
          </div>
          <div className="parking-card-price">₹{parking.price_per_hour}/hr</div>
        </div>
        <button className="btn btn-primary btn-block btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/parking/${parking.id}`); }}>
          View Details
        </button>
      </div>
    </div>
  );
}
