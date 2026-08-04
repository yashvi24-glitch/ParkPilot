import { useEffect, useState } from "react";
import {
  FiCalendar, FiCheckCircle, FiChevronDown, FiChevronUp,
  FiClock, FiDollarSign, FiList, FiX, FiXCircle,
} from "react-icons/fi";
import {
  cancelOwnerBooking,
  completeOwnerBooking,
  getOwnerBooking,
  getOwnerBookingsSummary,
  listOwnerBookings,
  listOwnerParking,
} from "../../api/owner";
import "../../styles/owner-shared.css";
import "./OwnerBookings.css";

const SUMMARY_CARDS = [
  { key: "total_bookings", label: "Total Bookings", icon: FiList },
  { key: "today_bookings", label: "Today's Bookings", icon: FiCalendar },
  { key: "active_bookings", label: "Active Sessions", icon: FiClock },
  { key: "completed_bookings", label: "Completed", icon: FiCheckCircle },
  { key: "cancelled_bookings", label: "Cancelled", icon: FiXCircle },
  { key: "today_revenue", label: "Today's Revenue", icon: FiDollarSign, prefix: "₹", iconClass: "revenue" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "All Payments" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
];

const COLUMNS = [
  { key: "booking_code", label: "Booking ID", sortable: false },
  { key: "user__full_name", label: "Customer" },
  { key: "vehicle__plate_number", label: "Vehicle" },
  { key: "slot__floor__location__name", label: "Facility" },
  { key: "floor_slot", label: "Floor / Slot", sortable: false },
  { key: "start_time", label: "Entry" },
  { key: "duration", label: "Duration", sortable: false },
  { key: "amount", label: "Amount" },
  { key: "payment_status", label: "Payment" },
  { key: "status", label: "Status" },
  { key: "action", label: "Action", sortable: false },
];

const errorMessage = (err, fallback) => {
  const data = err.response?.data;
  if (Array.isArray(data)) return data[0];
  if (data?.detail) return data.detail;
  return fallback;
};

export default function OwnerBookings() {
  const [summary, setSummary] = useState(null);
  const [locations, setLocations] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", parking_id: "", date: "", status: "", payment_status: "" });
  const [ordering, setOrdering] = useState("-created_at");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadSummary = () => getOwnerBookingsSummary().then(setSummary);

  useEffect(() => {
    loadSummary();
    listOwnerParking().then(setLocations);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { ordering };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const timer = setTimeout(() => {
      listOwnerBookings(params).then(setBookings).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters, ordering]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setActionError("");
    getOwnerBooking(selectedId).then(setDetail);
  }, [selectedId]);

  const toggleSort = (key) => {
    setOrdering((prev) => (prev === key ? `-${key}` : key));
  };

  const runAction = async (fn) => {
    setActionLoading(true);
    setActionError("");
    try {
      await fn();
      setSelectedId(null);
      loadSummary();
      setFilters((f) => ({ ...f }));
    } catch (err) {
      setActionError(errorMessage(err, "Could not complete this action. Please try again."));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="owner-bookings fade-in">
      <h1>Bookings</h1>
      <p className="page-subtitle">Monitor and manage every booking across your parking facilities.</p>

      {summary && (
        <div className="owner-stat-grid">
          {SUMMARY_CARDS.map(({ key, label, icon: Icon, prefix, iconClass }) => (
            <div key={key} className="card owner-stat-card">
              <span className={`owner-stat-icon ${iconClass || ""}`}><Icon /></span>
              <div>
                <div className="owner-stat-value">{prefix || ""}{summary[key]}</div>
                <div className="owner-stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card owner-bookings-filters">
        <input
          className="input"
          placeholder="Search customer, vehicle, booking ID..."
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select className="input" value={filters.parking_id} onChange={(e) => setFilters({ ...filters, parking_id: e.target.value })}>
          <option value="">All Facilities</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input className="input" type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="input" value={filters.payment_status} onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}>
          {PAYMENT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="card owner-bookings-table-wrap">
        {loading ? (
          <div className="skeleton" style={{ height: 300 }} />
        ) : bookings.length === 0 ? (
          <div className="empty-state">No bookings match your filters.</div>
        ) : (
          <table className="owner-bookings-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col.key} onClick={col.sortable === false ? undefined : () => toggleSort(col.key)} className={col.sortable === false ? "" : "sortable"}>
                    {col.label}
                    {col.sortable !== false && ordering.replace("-", "") === col.key && (
                      ordering.startsWith("-") ? <FiChevronDown /> : <FiChevronUp />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.booking_code}</td>
                  <td>{b.customer_name}</td>
                  <td>{b.vehicle_plate}</td>
                  <td>{b.parking_name}</td>
                  <td>{b.floor_name} / {b.slot_code}</td>
                  <td>{b.date} {b.start_time?.slice(0, 5)}</td>
                  <td>{b.duration_hours} hrs</td>
                  <td>₹{b.amount}</td>
                  <td><span className={`badge badge-${b.payment_status}`}>{b.payment_status}</span></td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td><button className="btn btn-outline btn-sm" onClick={() => setSelectedId(b.id)}>View Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <div className="owner-modal-backdrop" onClick={() => setSelectedId(null)}>
          <div className="card owner-modal" onClick={(e) => e.stopPropagation()}>
            <button className="owner-modal-close" onClick={() => setSelectedId(null)}><FiX /></button>
            {!detail ? (
              <div className="skeleton" style={{ height: 200 }} />
            ) : (
              <>
                <h2>Booking {detail.booking_code}</h2>
                <div className="confirm-card">
                  <div className="confirm-row"><span>Customer</span><strong>{detail.customer_name}</strong></div>
                  <div className="confirm-row"><span>Contact</span><strong>{detail.customer_phone} · {detail.customer_email}</strong></div>
                  <div className="confirm-row"><span>Vehicle</span><strong>{detail.vehicle_plate} ({detail.vehicle_type})</strong></div>
                  <div className="confirm-row"><span>Parking Facility</span><strong>{detail.parking_name}</strong></div>
                  <div className="confirm-row"><span>Address</span><strong>{detail.parking_address}</strong></div>
                  <div className="confirm-row"><span>Floor</span><strong>{detail.floor_name || "—"}</strong></div>
                  <div className="confirm-row"><span>Slot</span><strong>{detail.slot_code || "—"}</strong></div>
                  <div className="confirm-row"><span>Date</span><strong>{detail.date}</strong></div>
                  <div className="confirm-row"><span>Entry Time</span><strong>{detail.start_time?.slice(0, 5)}</strong></div>
                  <div className="confirm-row"><span>Exit Time</span><strong>{detail.end_time?.slice(0, 5)}</strong></div>
                  <div className="confirm-row"><span>Duration</span><strong>{detail.duration_hours} hrs</strong></div>
                  <div className="confirm-row"><span>Charges</span><strong>₹{detail.amount}</strong></div>
                  <div className="confirm-row"><span>Payment</span><strong><span className={`badge badge-${detail.payment_status}`}>{detail.payment_status}</span> via {detail.payment_method || "—"}</strong></div>
                  <div className="confirm-row"><span>Status</span><strong><span className={`badge badge-${detail.status}`}>{detail.status}</span></strong></div>
                </div>

                {actionError && <div className="form-error">{actionError}</div>}

                {detail.status !== "completed" && detail.status !== "cancelled" && (
                  <div className="owner-modal-actions">
                    <button className="btn btn-primary" disabled={actionLoading} onClick={() => runAction(() => completeOwnerBooking(detail.id))}>
                      Mark as Completed
                    </button>
                    <button className="btn btn-danger" disabled={actionLoading} onClick={() => runAction(() => cancelOwnerBooking(detail.id))}>
                      Cancel Booking
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
