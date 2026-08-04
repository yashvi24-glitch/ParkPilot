import {
  FiCalendar,
  FiCompass,
  FiGrid,
  FiHelpCircle,
  FiMapPin,
  FiUser,
} from "react-icons/fi";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/app", label: "Dashboard", icon: FiGrid, end: true },
  { to: "/find-parking", label: "Find Parking", icon: FiMapPin },
  { to: "/my-bookings", label: "My Bookings", icon: FiCalendar },
  { to: "/find-my-car", label: "Find My Car", icon: FiCompass },
  { to: "/profile", label: "Profile", icon: FiUser },
  { to: "/help", label: "Help & Support", icon: FiHelpCircle },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">P</span>
        <div>
          <div className="sidebar-logo-title">ParkPilot</div>
          <div className="sidebar-logo-sub">Park Smart, Save Time</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
          >
            <Icon className="sidebar-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
