import { FiCompass, FiMapPin, FiShield } from "react-icons/fi";
import "./AuthShell.css";

const DEFAULT_POINTS = [
  { icon: FiMapPin, text: "Real-time parking availability near you" },
  { icon: FiCompass, text: "Turn-by-turn navigation to your slot" },
  { icon: FiShield, text: "Secure bookings, every time" },
];

export default function AuthShell({
  children,
  title = "Find. Book. Park.",
  subtitle = "Discover nearby parking spaces, reserve instantly, and navigate confidently — all in one smart app.",
  points = DEFAULT_POINTS,
  logoSub = "ParkPilot",
}) {
  return (
    <div className="auth-shell">
      <div className="auth-visual">
        <div className="auth-visual-logo">
          <span className="sidebar-logo-mark">P</span> {logoSub}
        </div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <ul className="auth-visual-points">
          {points.map(({ icon: Icon, text }) => (
            <li key={text}><Icon /> {text}</li>
          ))}
        </ul>
      </div>
      <div className="auth-form-side">
        <div className="auth-card fade-in">{children}</div>
      </div>
    </div>
  );
}
