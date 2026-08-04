import { useEffect, useState } from "react";
import { FiLogOut, FiMail, FiPhone, FiUser } from "react-icons/fi";
import { Link } from "react-router-dom";
import { changeOwnerPassword, fetchOwnerProfile, getOwnerDashboard, updateOwnerProfile } from "../../api/owner";
import { useOwnerAuth } from "../../context/OwnerAuthContext";
import "../Profile/Profile.css";
import "./OwnerProfile.css";

function BusinessInfoSection() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchOwnerProfile().then((data) => setForm({
      business_address: data.business_address || "", gst_number: data.gst_number || "",
      business_registration_number: data.business_registration_number || "", business_description: data.business_description || "",
    }));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateOwnerProfile(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="skeleton" style={{ height: 220 }} />;

  return (
    <form className="card owner-profile-section" onSubmit={handleSave}>
      <h2>Business Information</h2>
      <div className="form-group">
        <label className="form-label">Business Address</label>
        <input className="input" value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} />
      </div>
      <div className="auth-row">
        <div className="form-group">
          <label className="form-label">GST Number (Optional)</label>
          <input className="input" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Business Registration Number (Optional)</label>
          <input className="input" value={form.business_registration_number} onChange={(e) => setForm({ ...form, business_registration_number: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Business Description</label>
        <textarea className="input" rows={3} value={form.business_description} onChange={(e) => setForm({ ...form, business_description: e.target.value })} />
      </div>
      {saved && <div className="owner-form-success">Business information saved.</div>}
      <button type="submit" className="btn btn-outline" disabled={saving}>{saving ? "Saving..." : "Save Business Info"}</button>
    </form>
  );
}

function ParkingStatsSection() {
  const [stats, setStats] = useState(null);

  useEffect(() => { getOwnerDashboard().then(setStats); }, []);

  if (!stats) return <div className="skeleton" style={{ height: 140 }} />;

  const cards = [
    { label: "Total Facilities", value: stats.total_facilities },
    { label: "Total Capacity", value: stats.total_capacity },
    { label: "Active Bookings", value: stats.active_bookings },
    { label: "Completed Bookings", value: stats.completed_bookings },
    { label: "Monthly Revenue", value: `₹${stats.monthly_revenue}` },
    { label: "Occupancy", value: `${stats.occupancy_pct}%` },
  ];

  return (
    <div className="card owner-profile-section">
      <h2>Parking Statistics</h2>
      <div className="profile-stats owner-profile-stats">
        {cards.map((c) => (
          <div key={c.label} className="card stat-card">
            <div className="stat-value">{c.value}</div>
            <div className="page-subtitle">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentInfoSection() {
  const [info, setInfo] = useState(null);

  useEffect(() => { fetchOwnerProfile().then(setInfo); }, []);

  if (!info) return <div className="skeleton" style={{ height: 120 }} />;

  return (
    <div className="card owner-profile-section">
      <h2>Payment Information</h2>
      {info.upi_id || info.bank_name ? (
        <>
          <div className="profile-detail">UPI ID: {info.upi_id || "—"}</div>
          <div className="profile-detail">Bank: {info.bank_name || "—"} {info.account_number && `· ****${info.account_number.slice(-4)}`}</div>
        </>
      ) : (
        <p className="page-subtitle">No payment details configured yet.</p>
      )}
      <Link to="/owner/payments" className="btn btn-outline">Manage in Payments</Link>
    </div>
  );
}

function SecuritySection() {
  const { logout } = useOwnerAuth();
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await changeOwnerPassword(form);
      setForm({ current_password: "", new_password: "" });
      setSaved(true);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.current_password?.[0] || data?.new_password?.[0] || "Could not change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card owner-profile-section">
      <h2>Security</h2>
      <form onSubmit={handleChangePassword}>
        <div className="form-group">
          <label className="form-label">Current Password</label>
          <input className="input" type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input className="input" type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} />
        </div>
        {error && <div className="form-error">{error}</div>}
        {saved && <div className="owner-form-success">Password changed successfully.</div>}
        <button type="submit" className="btn btn-outline" disabled={saving}>{saving ? "Changing..." : "Change Password"}</button>
      </form>
      <button className="btn btn-danger owner-logout-btn" onClick={logout}><FiLogOut /> Logout</button>
    </div>
  );
}

export default function OwnerProfile() {
  const { owner, updateOwner } = useOwnerAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    owner_name: owner?.owner_name || "",
    business_name: owner?.business_name || "",
    phone: owner?.phone || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateOwnerProfile(form);
      updateOwner(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page fade-in">
      <h1>Profile</h1>

      <div className="profile-card card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">{owner?.business_name?.[0]?.toUpperCase()}</div>
        </div>

        {editing ? (
          <form className="profile-edit-form" onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input className="input" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Business Name</label>
              <input className="input" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="profile-edit-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        ) : (
          <>
            <h2>{owner?.business_name}</h2>
            <div className="profile-detail"><FiUser /> {owner?.owner_name}</div>
            <div className="profile-detail"><FiMail /> {owner?.email}</div>
            <div className="profile-detail"><FiPhone /> {owner?.phone}</div>
            <button className="btn btn-outline" onClick={() => setEditing(true)}>Edit Profile</button>
          </>
        )}
      </div>

      <BusinessInfoSection />
      <ParkingStatsSection />
      <PaymentInfoSection />
      <SecuritySection />
    </div>
  );
}
