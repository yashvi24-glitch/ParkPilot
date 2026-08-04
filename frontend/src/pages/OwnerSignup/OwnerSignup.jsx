import { useState } from "react";
import { FiBriefcase, FiEye, FiEyeOff, FiLock, FiMail, FiPhone, FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import AuthShell from "../../components/AuthShell";
import { useOwnerAuth } from "../../context/OwnerAuthContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const OWNER_POINTS = [
  { icon: FiBriefcase, text: "List and manage your own parking facilities" },
  { icon: FiUser, text: "See real-time bookings and revenue" },
  { icon: FiLock, text: "Your business data stays fully separate from users" },
];

export default function OwnerSignup() {
  const { signup, loading } = useOwnerAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    owner_name: "",
    business_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const validate = () => {
    const next = {};
    if (!form.owner_name.trim()) next.owner_name = "Owner name is required.";
    if (!form.business_name.trim()) next.business_name = "Business name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.phone.trim()) next.phone = "Phone number is required.";
    else if (!PHONE_RE.test(form.phone.trim())) next.phone = "Enter a valid 10-digit phone number.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    if (form.confirm_password !== form.password) next.confirm_password = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    try {
      await signup(form);
      navigate("/owner/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const fieldErrors = {};
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val;
        });
        setErrors(fieldErrors);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    }
  };

  return (
    <AuthShell
      title="Grow Your Parking Business"
      subtitle="List your facilities, manage bookings, and track revenue — all in one owner portal."
      points={OWNER_POINTS}
      logoSub="ParkPilot for Owners"
    >
      <h2>Create Your Owner Account</h2>
      <p className="auth-subtitle">Sign up to start managing your parking facilities</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label className="form-label">Owner Name</label>
          <div className="input-with-icon">
            <FiUser />
            <input
              className="input"
              name="owner_name"
              placeholder="Your full name"
              value={form.owner_name}
              onChange={handleChange}
            />
          </div>
          {errors.owner_name && <div className="form-error">{errors.owner_name}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Business Name</label>
          <div className="input-with-icon">
            <FiBriefcase />
            <input
              className="input"
              name="business_name"
              placeholder="Your parking business name"
              value={form.business_name}
              onChange={handleChange}
            />
          </div>
          {errors.business_name && <div className="form-error">{errors.business_name}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <div className="input-with-icon">
            <FiMail />
            <input
              className="input"
              type="email"
              name="email"
              placeholder="you@business.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>
          {errors.email && <div className="form-error">{errors.email}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <div className="input-with-icon">
            <FiPhone />
            <input
              className="input"
              name="phone"
              placeholder="10-digit mobile number"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            />
          </div>
          {errors.phone && <div className="form-error">{errors.phone}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div className="input-with-icon">
            <FiLock />
            <input
              className="input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
            />
            <button type="button" className="input-icon-toggle" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.password && <div className="form-error">{errors.password}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <div className="input-with-icon">
            <FiLock />
            <input
              className="input"
              type={showPassword ? "text" : "password"}
              name="confirm_password"
              placeholder="Re-enter your password"
              value={form.confirm_password}
              onChange={handleChange}
            />
          </div>
          {errors.confirm_password && <div className="form-error">{errors.confirm_password}</div>}
        </div>

        {serverError && <div className="form-error">{serverError}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an owner account? <Link to="/owner/login">Log in</Link>
      </p>
      <p className="auth-switch">
        Not a parking owner? <Link to="/">Go back</Link>
      </p>
    </AuthShell>
  );
}
