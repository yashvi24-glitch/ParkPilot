import { useState } from "react";
import { FiBriefcase, FiEye, FiEyeOff, FiLock, FiMail, FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import { useOwnerAuth } from "../../context/OwnerAuthContext";

const OWNER_POINTS = [
  { icon: FiBriefcase, text: "List and manage your own parking facilities" },
  { icon: FiUser, text: "See real-time bookings and revenue" },
  { icon: FiLock, text: "Your business data stays fully separate from users" },
];

export default function OwnerLogin() {
  const { login, loading } = useOwnerAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.email, form.password);
      navigate("/owner/dashboard", { replace: true });
    } catch (err) {
      const detail =
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        "Invalid email or password. Please try again.";
      setError(detail);
    }
  };

  return (
    <AuthShell
      title="Grow Your Parking Business"
      subtitle="List your facilities, manage bookings, and track revenue — all in one owner portal."
      points={OWNER_POINTS}
      logoSub="ParkPilot for Owners"
    >
      <h2>Owner Login</h2>
      <p className="auth-subtitle">Log in to manage your parking facilities</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <div className="input-with-icon">
            <FiMail />
            <input
              className="input"
              type="email"
              name="email"
              placeholder="Enter your business email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="input-with-icon">
            <FiLock />
            <input
              className="input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              required
            />
            <button type="button" className="input-icon-toggle" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="auth-switch">
        Don't have an owner account? <Link to="/owner/signup">Sign up</Link>
      </p>
      <p className="auth-switch">
        Not a parking owner? <Link to="/">Go back</Link>
      </p>
    </AuthShell>
  );
}
