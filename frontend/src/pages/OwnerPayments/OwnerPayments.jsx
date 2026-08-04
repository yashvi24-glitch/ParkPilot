import { useEffect, useState } from "react";
import {
  FiCalendar, FiCheckCircle, FiClock, FiDollarSign, FiRotateCcw, FiTrendingUp,
} from "react-icons/fi";
import {
  fetchOwnerProfile,
  getOwnerPaymentsSummary,
  getOwnerRevenueAnalytics,
  listOwnerPaymentHistory,
  updateOwnerProfile,
} from "../../api/owner";
import { OwnerLineChart } from "../../components/OwnerCharts";
import "../../styles/owner-shared.css";
import "./OwnerPayments.css";

const SUMMARY_CARDS = [
  { key: "today_revenue", label: "Today's Revenue", icon: FiDollarSign, prefix: "₹", iconClass: "revenue" },
  { key: "weekly_revenue", label: "Weekly Revenue", icon: FiTrendingUp, prefix: "₹", iconClass: "revenue" },
  { key: "monthly_revenue", label: "Monthly Revenue", icon: FiCalendar, prefix: "₹", iconClass: "revenue" },
  { key: "pending_payments", label: "Pending Payments", icon: FiClock, iconClass: "warning" },
  { key: "successful_payments", label: "Successful Payments", icon: FiCheckCircle },
  { key: "refunded_payments", label: "Refunded Payments", icon: FiRotateCcw, iconClass: "danger" },
];

const RANGES = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

const PAYMENT_STATUS_OPTIONS = ["", "pending", "paid", "failed", "refunded"];

function PaymentConfigForm() {
  const [form, setForm] = useState(null);
  const [qrFile, setQrFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    fetchOwnerProfile().then((data) => setForm({
      upi_id: data.upi_id || "", qr_code: data.qr_code || "",
    }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      let updated;
      if (qrFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (k !== "qr_code") fd.append(k, v); });
        fd.append("qr_code", qrFile);
        updated = await updateOwnerProfile(fd);
      } else {
        // eslint-disable-next-line no-unused-vars -- excluding qr_code from the plain-JSON submit path
        const { qr_code: _qrCode, ...rest } = form;
        updated = await updateOwnerProfile(rest);
      }
      setForm({ ...form, qr_code: updated.qr_code });
      setQrFile(null);
      setSaved(true);
    } catch (err) {
      const data = err.response?.data;
      setSaveError(
        data && typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not save payment details. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="skeleton" style={{ height: 300 }} />;

  return (
    <form className="card owner-payment-config" onSubmit={handleSave}>
      <h2>Payment Configuration</h2>
      <p className="page-subtitle">
        Shown to you for reference — no real payment gateway is connected, payments are simulated throughout the app.
      </p>
      <div className="form-group">
        <label className="form-label">UPI ID</label>
        <input className="input" placeholder="yourname@okhdfcbank" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label">QR Code</label>
        {form.qr_code && !qrFile && <img src={form.qr_code} alt="Payment QR" className="owner-qr-preview" />}
        <input type="file" accept="image/*" onChange={(e) => setQrFile(e.target.files[0] || null)} />
      </div>
      {saveError && <div className="form-error">{saveError}</div>}
      {saved && <div className="owner-form-success">Payment details saved.</div>}
      <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Payment Details"}</button>
    </form>
  );
}

export default function OwnerPayments() {
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState("daily");
  const [revenue, setRevenue] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [filters, setFilters] = useState({ q: "", payment_status: "" });

  useEffect(() => { getOwnerPaymentsSummary().then(setSummary); }, []);
  useEffect(() => { getOwnerRevenueAnalytics(range).then((d) => setRevenue(d.data)); }, [range]);

  useEffect(() => {
    setLoadingHistory(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const timer = setTimeout(() => {
      listOwnerPaymentHistory(params).then(setHistory).finally(() => setLoadingHistory(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  return (
    <div className="owner-payments fade-in">
      <h1>Payments</h1>
      <p className="page-subtitle">Track earnings, payment history, and manage how you get paid.</p>

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

      <div className="owner-range-row">
        {RANGES.map((r) => (
          <button key={r.key} className={"owner-range-btn" + (range === r.key ? " active" : "")} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>
      <OwnerLineChart title="Revenue" data={revenue} formatValue={(v) => `₹${v}`} />

      <div className="card owner-payments-history">
        <div className="owner-payments-history-head">
          <h2>Payment History</h2>
          <div className="owner-payments-history-filters">
            <input
              className="input" placeholder="Search customer, vehicle, booking ID..."
              value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select className="input" value={filters.payment_status} onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}>
              {PAYMENT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? s[0].toUpperCase() + s.slice(1) : "All Statuses"}</option>)}
            </select>
          </div>
        </div>

        {loadingHistory ? (
          <div className="skeleton" style={{ height: 240 }} />
        ) : history.length === 0 ? (
          <div className="empty-state">No payment records match your filters.</div>
        ) : (
          <div className="owner-bookings-table-wrap">
            <table className="owner-bookings-table">
              <thead>
                <tr>
                  <th>Transaction ID</th><th>Customer</th><th>Vehicle</th><th>Facility</th>
                  <th>Amount</th><th>Method</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id}>
                    <td>{p.transaction_id}</td>
                    <td>{p.customer_name}</td>
                    <td>{p.vehicle_number}</td>
                    <td>{p.parking_facility}</td>
                    <td>₹{p.amount}</td>
                    <td>{p.payment_method || "—"}</td>
                    <td><span className={`badge badge-${p.payment_status}`}>{p.payment_status}</span></td>
                    <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentConfigForm />
    </div>
  );
}
