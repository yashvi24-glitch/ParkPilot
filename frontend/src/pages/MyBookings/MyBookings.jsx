import { useEffect, useState } from "react";
import { FiCalendar, FiMapPin, FiNavigation } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { cancelBooking, listBookings } from "../../api/bookings";
import "./MyBookings.css";

const TABS = ["all", "upcoming", "active", "completed", "cancelled"];

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  const load = () => {
    setLoading(true);
    listBookings(tab === "all" ? {} : { status: tab })
      .then(setBookings)
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      await cancelBooking(id);
      load();
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="my-bookings fade-in">
      <h1>My Bookings</h1>
      <p className="page-subtitle">View and manage all your parking reservations.</p>

      <div className="booking-tabs">
        {TABS.map((t) => (
          <button key={t} className={"booking-tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : bookings.length === 0 ? (
        <div className="empty-state">No {tab !== "all" ? tab : ""} bookings found.</div>
      ) : (
        <div className="bookings-list">
          {bookings.map((b) => (
            <div key={b.id} className="booking-item card">
              <div className="booking-item-main">
                <div>
                  <div className="booking-item-title">{b.parking_name}</div>
                  <div className="booking-item-address"><FiMapPin /> {b.parking_address}</div>
                  <div className="booking-item-meta">
                    <span><FiCalendar /> {b.date}</span>
                    <span>{b.start_time} - {b.end_time}</span>
                    <span>Floor {b.floor_name} · Slot {b.slot_code}</span>
                  </div>
                </div>
                <div className="booking-item-badges">
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                  {b.payment_method && <span className="badge badge-completed">Paid via {b.payment_method.toUpperCase()}</span>}
                </div>
              </div>
              <div className="booking-item-footer">
                <span className="booking-item-code">#{b.booking_code}</span>
                <span className="booking-item-amount">₹{b.amount}</span>
                <div className="booking-item-actions">
                  {(b.status === "upcoming" || b.status === "active") && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        navigate("/navigation", {
                          state: { bookingId: b.id, destLat: parseFloat(b.latitude), destLng: parseFloat(b.longitude), destName: b.parking_name, destAddress: b.parking_address },
                        })
                      }
                    >
                      <FiNavigation /> Navigate
                    </button>
                  )}
                  {b.status === "upcoming" && (
                    <button
                      className="btn btn-danger btn-sm"
                      disabled={cancellingId === b.id}
                      onClick={() => handleCancel(b.id)}
                    >
                      {cancellingId === b.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
