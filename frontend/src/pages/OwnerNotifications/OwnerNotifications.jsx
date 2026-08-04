import { useEffect, useState } from "react";
import {
  FiAlertTriangle, FiBell, FiCheckCircle, FiCreditCard, FiEdit3, FiImage,
  FiInfo, FiKey, FiLock, FiTool, FiUploadCloud, FiXCircle,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { listOwnerNotifications, markAllOwnerNotificationsRead, markOwnerNotificationRead } from "../../api/owner";
import "../../styles/owner-shared.css";
import "../Notifications/Notifications.css";

const TYPE_META = {
  booking_received: { icon: FiCheckCircle, className: "notif-success" },
  booking_cancelled: { icon: FiXCircle, className: "notif-danger" },
  booking_completed: { icon: FiCheckCircle, className: "notif-success" },
  payment_received: { icon: FiCreditCard, className: "notif-success" },
  payment_failed: { icon: FiCreditCard, className: "notif-danger" },
  facility_updated: { icon: FiEdit3, className: "notif-info" },
  capacity_reached: { icon: FiAlertTriangle, className: "notif-danger" },
  limited_availability: { icon: FiAlertTriangle, className: "notif-warning" },
  csv_upload_success: { icon: FiUploadCloud, className: "notif-success" },
  csv_upload_failed: { icon: FiUploadCloud, className: "notif-danger" },
  images_updated: { icon: FiImage, className: "notif-info" },
  details_modified: { icon: FiEdit3, className: "notif-info" },
  password_changed: { icon: FiKey, className: "notif-info" },
  new_device_login: { icon: FiLock, className: "notif-warning" },
  system: { icon: FiInfo, className: "notif-info" },
  maintenance: { icon: FiTool, className: "notif-warning" },
};

const POLL_MS = 20000;

export default function OwnerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => listOwnerNotifications().then(setNotifications).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleClick = async (n) => {
    if (!n.is_read) {
      await markOwnerNotificationRead(n.id);
      load();
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAll = async () => {
    await markAllOwnerNotificationsRead();
    load();
  };

  const renderRow = (n) => {
    const meta = TYPE_META[n.type] || TYPE_META.system;
    const Icon = meta.icon;
    return (
      <button key={n.id} className={"notification-row card" + (n.is_read ? "" : " unread")} onClick={() => handleClick(n)}>
        <span className={"notification-icon " + meta.className}><Icon /></span>
        <div className="notification-body">
          <div className="notification-title">{n.title}</div>
          <div className="notification-msg">{n.message}</div>
          <div className="notification-time">{new Date(n.created_at).toLocaleString()}</div>
        </div>
        {!n.is_read && <span className="notification-dot" />}
      </button>
    );
  };

  const unread = notifications.filter((n) => !n.is_read);
  const read = notifications.filter((n) => n.is_read);

  return (
    <div className="notifications-page fade-in">
      <div className="notifications-header">
        <h1>Notifications</h1>
        {unread.length > 0 && <button className="link-btn" onClick={handleMarkAll}>Mark all as read</button>}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300 }} />
      ) : notifications.length === 0 ? (
        <div className="empty-state"><FiBell size={32} /><p>You're all caught up.</p></div>
      ) : (
        <>
          {unread.length > 0 && (
            <>
              <h2 className="owner-dashboard-section-title">Unread</h2>
              <div className="notifications-list">{unread.map(renderRow)}</div>
            </>
          )}
          {read.length > 0 && (
            <>
              <h2 className="owner-dashboard-section-title">Earlier</h2>
              <div className="notifications-list">{read.map(renderRow)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
