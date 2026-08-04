import { useEffect, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getBooking } from "../../api/bookings";
import "./BookingSuccess.css";

const PAYMENT_METHOD_LABELS = {
  upi: "UPI",
  qr: "QR Code",
  card: "Card",
  netbanking: "Net Banking",
};

export default function BookingSuccess() {
  const { bookingId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(state?.booking || null);

  useEffect(() => {
    if (!booking) getBooking(bookingId).then(setBooking).catch(() => navigate("/my-bookings"));
  }, [bookingId, booking, navigate]);

  if (!booking) return <div className="skeleton" style={{ height: 320 }} />;

  return (
    <div className="booking-success fade-in">
      <div className="success-icon"><FiCheckCircle /></div>
      <h1>{booking.payment_status === "paid" ? "Payment Successful!" : "Booking Confirmed!"}</h1>
      <p>Your slot {booking.slot_code} has been booked successfully.</p>

      <div className="success-card card">
        <div className="confirm-row"><span>Booking ID</span><strong>{booking.booking_code}</strong></div>
        <div className="confirm-row"><span>Parking</span><strong>{booking.parking_name}</strong></div>
        <div className="confirm-row"><span>Slot</span><strong>{booking.floor_name} - {booking.slot_code}</strong></div>
        <div className="confirm-row"><span>Date</span><strong>{booking.date}</strong></div>
        <div className="confirm-row"><span>Time</span><strong>{booking.start_time} - {booking.end_time}</strong></div>
        {booking.payment_method && (
          <div className="confirm-row"><span>Paid via</span><strong>{PAYMENT_METHOD_LABELS[booking.payment_method] || booking.payment_method}</strong></div>
        )}
        <div className="confirm-row confirm-amount"><span>Amount Paid</span><strong>₹{booking.amount}</strong></div>
      </div>

      <div className="success-actions">
        <button className="btn btn-outline btn-block" onClick={() => navigate(`/parking/${booking.parking_id}`)}>
          Back to Parking
        </button>
        <button className="btn btn-primary btn-block" onClick={() => navigate("/my-bookings")}>
          View My Bookings
        </button>
      </div>
    </div>
  );
}
