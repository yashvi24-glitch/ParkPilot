import { useEffect, useRef, useState } from "react";
import { FiCamera, FiLogOut, FiMail, FiPhone, FiUser } from "react-icons/fi";
import { updateProfile } from "../../api/auth";
import { listBookings } from "../../api/bookings";
import { listVehicles } from "../../api/vehicles";
import { useAuth } from "../../context/AuthContext";
import "./Profile.css";

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: user?.full_name || "", phone: user?.phone || "" });
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, upcoming: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listVehicles().then(setVehicles).catch(() => {});
    listBookings().then((data) => {
      setStats({
        total: data.length,
        completed: data.filter((b) => b.status === "completed").length,
        upcoming: data.filter((b) => b.status === "upcoming").length,
      });
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      updateUser(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("profile_picture", file);
    const updated = await updateProfile(formData);
    updateUser(updated);
  };

  return (
    <div className="profile-page fade-in">
      <h1>Profile</h1>

      <div className="profile-card card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {user?.profile_picture ? (
              <img src={user.profile_picture} alt={user.full_name} />
            ) : (
              user?.full_name?.[0]?.toUpperCase()
            )}
          </div>
          <button className="profile-avatar-edit" onClick={() => fileRef.current.click()}>
            <FiCamera />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePictureChange} />
        </div>

        {editing ? (
          <form className="profile-edit-form" onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
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
            <h2>{user?.full_name}</h2>
            <div className="profile-detail"><FiMail /> {user?.email}</div>
            <div className="profile-detail"><FiPhone /> {user?.phone}</div>
            <button className="btn btn-outline" onClick={() => setEditing(true)}>Edit Profile</button>
          </>
        )}
      </div>

      <div className="profile-stats">
        <div className="stat-card card"><div className="stat-value">{stats.total}</div><div>Total Bookings</div></div>
        <div className="stat-card card"><div className="stat-value">{stats.upcoming}</div><div>Upcoming</div></div>
        <div className="stat-card card"><div className="stat-value">{stats.completed}</div><div>Completed</div></div>
      </div>

      <div className="card profile-vehicles">
        <h3>My Vehicles</h3>
        {vehicles.length === 0 ? (
          <p className="page-subtitle">No vehicles added yet. Add one during your next booking.</p>
        ) : (
          vehicles.map((v) => (
            <div key={v.id} className="vehicle-row">
              <FiUser /> {v.plate_number} <span className="badge badge-completed">{v.vehicle_type}</span>
            </div>
          ))
        )}
      </div>

      <button className="btn btn-danger" onClick={logout}><FiLogOut /> Logout</button>
    </div>
  );
}
