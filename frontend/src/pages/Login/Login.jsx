import { useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form.email, form.password);
      const redirectTo = location.state?.from?.pathname || "/app";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const detail =
        err.response?.data?.detail || "Invalid email or password. Please try again.";
      setError(detail);
    }
  };

  return (
    <AuthShell>
      <h2>Welcome Back 👋</h2>
      <p className="auth-subtitle">Login to continue to ParkPilot</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email</label>
          <div className="input-with-icon">
            <FiMail />
            <input
              className="input"
              type="email"
              name="email"
              placeholder="Enter your email"
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
        Don't have an account? <Link to="/signup">Sign up</Link>
      </p>
    </AuthShell>
  );
}
