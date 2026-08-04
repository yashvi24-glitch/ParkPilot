import {
  FiBarChart2,
  FiBell,
  FiCreditCard,
  FiGrid,
  FiList,
  FiPlusCircle,
  FiUser,
} from "react-icons/fi";
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/owner/dashboard", label: "Dashboard", icon: FiGrid, end: true },
  { to: "/owner/parking", label: "My Parking Facilities", icon: FiList },
  { to: "/owner/parking/new", label: "Add Parking", icon: FiPlusCircle },
  { to: "/owner/bookings", label: "Bookings", icon: FiList },
  { to: "/owner/payments", label: "Payments", icon: FiCreditCard },
  { to: "/owner/reports", label: "Reports & Analytics", icon: FiBarChart2 },
  { to: "/owner/notifications", label: "Notifications", icon: FiBell },
  { to: "/owner/profile", label: "Profile", icon: FiUser },
];

export default function OwnerSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark">P</span>
        <div>
          <div className="sidebar-logo-title">ParkPilot</div>
          <div className="sidebar-logo-sub">Owner Portal</div>
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
