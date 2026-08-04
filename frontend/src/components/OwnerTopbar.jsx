import { useEffect, useRef, useState } from "react";
import { FiBell, FiChevronDown, FiLogOut, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { listOwnerNotifications } from "../api/owner";
import { useOwnerAuth } from "../context/OwnerAuthContext";
import "./Topbar.css";

export default function OwnerTopbar() {
  const { owner, logout } = useOwnerAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      listOwnerNotifications()
        .then((data) => mounted && setNotifications(data))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setShowNotifs(false);
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="topbar" ref={ref}>
      <div className="topbar-actions">
        <div className="topbar-icon-wrap">
          <button className="topbar-icon-btn" onClick={() => setShowNotifs((v) => !v)}>
            <FiBell />
            {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
          </button>
          {showNotifs && (
            <div className="topbar-dropdown fade-in">
              <div className="topbar-dropdown-header">Notifications</div>
              {notifications.length === 0 ? (
                <div className="topbar-dropdown-empty">You're all caught up.</div>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <div key={n.id} className={"topbar-notif" + (n.is_read ? "" : " unread")}>
                    <div className="topbar-notif-title">{n.title}</div>
                    <div className="topbar-notif-msg">{n.message}</div>
                  </div>
                ))
              )}
              <button className="topbar-dropdown-viewall" onClick={() => navigate("/owner/notifications")}>
                View all notifications
              </button>
            </div>
          )}
        </div>

        <button className="topbar-user" onClick={() => setShowMenu((v) => !v)}>
          <span className="topbar-avatar">{owner?.business_name?.[0]?.toUpperCase() || "?"}</span>
          <span className="topbar-username">{owner?.business_name}</span>
          <FiChevronDown />
        </button>
        {showMenu && (
          <div className="topbar-dropdown topbar-menu fade-in">
            <button className="topbar-menu-item" onClick={() => navigate("/owner/profile")}>
              <FiUser /> Profile
            </button>
            <button className="topbar-menu-item danger" onClick={logout}>
              <FiLogOut /> Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
