import { FiMail, FiMessageCircle, FiPhone } from "react-icons/fi";

const FAQS = [
  { q: "How do I book a parking slot?", a: "Search for a parking location, open its details, choose a floor and slot, then confirm your booking with your vehicle and time." },
  { q: "How do I find my parked car?", a: "Go to Find My Car, select your active booking, and follow the walking route to your exact slot." },
  { q: "Can I cancel a booking?", a: "Yes, open My Bookings and cancel any upcoming booking before its start time." },
  { q: "Is my payment information secure?", a: "ParkPilot never stores card details. All amounts shown are estimates payable at the parking location." },
];

export default function HelpSupport() {
  return (
    <div className="fade-in" style={{ maxWidth: 720 }}>
      <h1>Help & Support</h1>
      <p style={{ color: "var(--text-muted)" }}>We're here to help with anything related to your parking experience.</p>

      <div className="card" style={{ padding: "var(--space-5)", margin: "var(--space-5) 0" }}>
        <h3 style={{ marginTop: 0 }}>Frequently Asked Questions</h3>
        {FAQS.map((f, i) => (
          <div key={i} style={{ padding: "var(--space-3) 0", borderBottom: i < FAQS.length - 1 ? "1px solid var(--border)" : "none" }}>
            <strong>{f.q}</strong>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>{f.a}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "var(--space-5)", display: "flex", gap: "var(--space-6)", flexWrap: "wrap" }}>
        <div><FiMail /> support@parkpilot.app</div>
        <div><FiPhone /> +91 98765 43210</div>
        <div><FiMessageCircle /> Live chat: 9 AM - 9 PM</div>
      </div>
    </div>
  );
}
