import { useEffect, useState } from "react";
import {
  FiCalendar,
  FiCheckCircle,
  FiDollarSign,
  FiGrid,
  FiPercent,
  FiXCircle,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { getOwnerDashboard } from "../../api/owner";
import { useOwnerAuth } from "../../context/OwnerAuthContext";
import "../../styles/owner-shared.css";
import "./OwnerDashboard.css";

const STAT_CARDS = [
  { key: "total_facilities", label: "Total Facilities", icon: FiGrid },
  { key: "total_capacity", label: "Total Capacity", icon: FiGrid },
  { key: "available_capacity", label: "Available Capacity", icon: FiGrid },
  { key: "occupied_capacity", label: "Occupied Capacity", icon: FiGrid },
  { key: "active_bookings", label: "Active Bookings", icon: FiCalendar },
  { key: "completed_bookings", label: "Completed Bookings", icon: FiCheckCircle },
  { key: "cancelled_bookings", label: "Cancelled Bookings", icon: FiXCircle },
  { key: "occupancy_pct", label: "Occupancy", icon: FiPercent, suffix: "%" },
];

const REVENUE_CARDS = [
  { key: "today_revenue", label: "Today's Revenue" },
  { key: "weekly_revenue", label: "Weekly Revenue" },
  { key: "monthly_revenue", label: "Monthly Revenue" },
];

const LIVE_POLL_MS = 15000;

export default function OwnerDashboard() {
  const { owner } = useOwnerAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => getOwnerDashboard().then(setStats).finally(() => setLoading(false));
    load();
    const interval = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="owner-dashboard fade-in">
      <h1>Welcome back, {owner?.business_name}</h1>
      <p className="page-subtitle">Here's an overview of your parking business.</p>

      {loading ? (
        <div className="owner-stat-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
      ) : (
        <>
          <div className="owner-stat-grid">
            {STAT_CARDS.map(({ key, label, icon: Icon, suffix }) => (
              <div key={key} className="card owner-stat-card">
                <span className="owner-stat-icon"><Icon /></span>
                <div>
                  <div className="owner-stat-value">
                    {stats[key]}
                    {suffix || ""}
                  </div>
                  <div className="owner-stat-label">{label}</div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="owner-dashboard-section-title">Revenue</h2>
          <div className="owner-stat-grid owner-revenue-grid">
            {REVENUE_CARDS.map(({ key, label }) => (
              <div key={key} className="card owner-stat-card">
                <span className="owner-stat-icon revenue"><FiDollarSign /></span>
                <div>
                  <div className="owner-stat-value">₹{stats[key]}</div>
                  <div className="owner-stat-label">{label}</div>
                </div>
              </div>
            ))}
          </div>

          {stats.total_facilities === 0 ? (
            <div className="empty-state owner-dashboard-empty">
              You haven't added any parking facilities yet.{" "}
              <Link to="/owner/parking/new">Add your first parking facility</Link>.
            </div>
          ) : (
            <>
              <h2 className="owner-dashboard-section-title">Live Parking Monitoring</h2>
              <div className="owner-live-grid">
                {stats.live_monitoring.map((loc) => (
                  <div key={loc.id} className="card owner-live-card">
                    <h3>{loc.name}</h3>
                    {loc.parking_mode === "slot_based" ? (
                      <div className="owner-live-stats">
                        <div className="owner-live-stat available"><strong>{loc.available}</strong><span>Available</span></div>
                        <div className="owner-live-stat occupied"><strong>{loc.occupied}</strong><span>Occupied</span></div>
                        <div className="owner-live-stat reserved"><strong>{loc.reserved}</strong><span>Reserved</span></div>
                        <div className="owner-live-stat maintenance"><strong>{loc.maintenance}</strong><span>Maintenance</span></div>
                      </div>
                    ) : (
                      <div className="owner-live-stats">
                        <div className="owner-live-stat"><strong>{loc.total_capacity}</strong><span>Total Capacity</span></div>
                        <div className="owner-live-stat available"><strong>{loc.available_capacity}</strong><span>Available</span></div>
                        <div className="owner-live-stat occupied"><strong>{loc.occupied_capacity}</strong><span>Occupied</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
