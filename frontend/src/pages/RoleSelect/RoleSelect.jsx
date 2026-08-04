import { FiArrowRight, FiBriefcase, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import "./RoleSelect.css";

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="role-select fade-in">
      <div className="role-select-logo">
        <span className="sidebar-logo-mark">P</span> ParkPilot
      </div>
      <h1>How would you like to continue?</h1>
      <p className="page-subtitle">Choose how you want to use ParkPilot.</p>

      <div className="role-select-cards">
        <button className="role-select-card card" onClick={() => navigate("/app")}>
          <span className="role-select-icon"><FiUser /></span>
          <div>
            <h2>Continue as User</h2>
            <p>Find, book, and navigate to parking spaces near you.</p>
          </div>
          <FiArrowRight className="role-select-arrow" />
        </button>

        <button className="role-select-card card" onClick={() => navigate("/owner/login")}>
          <span className="role-select-icon owner"><FiBriefcase /></span>
          <div>
            <h2>Continue as Parking Owner</h2>
            <p>Register and manage your own parking facilities.</p>
          </div>
          <FiArrowRight className="role-select-arrow" />
        </button>
      </div>
    </div>
  );
}
