import { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiInfo,
  FiMapPin,
  FiXCircle,
} from "react-icons/fi";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../../api/notifications";
import "./Notifications.css";

const TYPE_META = {
  booking_confirmed: { icon: FiCheckCircle, className: "notif-success" },
  booking_cancelled: { icon: FiXCircle, className: "notif-danger" },
  booking_reminder: { icon: FiClock, className: "notif-warning" },
  parking_expiry: { icon: FiAlertTriangle, className: "notif-warning" },
  payment_success: { icon: FiCreditCard, className: "notif-success" },
  payment_failed: { icon: FiCreditCard, className: "notif-danger" },
  slot_update: { icon: FiMapPin, className: "notif-info" },
  system: { icon: FiInfo, className: "notif-info" },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => listNotifications().then(setNotifications).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    load();
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    load();
  };

  return (
    <div className="notifications-page fade-in">
      <div className="notifications-header">
        <h1>Notifications</h1>
        <button className="link-btn" onClick={handleMarkAll}>Mark all as read</button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : notifications.length === 0 ? (
        <div className="empty-state"><FiBell size={32} /><p>You're all caught up.</p></div>
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                className={"notification-row card" + (n.is_read ? "" : " unread")}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
              >
                <span className={"notification-icon " + meta.className}><Icon /></span>
                <div className="notification-body">
                  <div className="notification-title">{n.title}</div>
                  <div className="notification-msg">{n.message}</div>
                  <div className="notification-time">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.is_read && <span className="notification-dot" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
