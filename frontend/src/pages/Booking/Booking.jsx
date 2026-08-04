import { useEffect, useState } from "react";
import {
  FiCheck,
  FiGrid,
  FiSmartphone,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { createBooking } from "../../api/bookings";
import { getFloorSlots, getParkingDetail, getParkingFloors } from "../../api/parking";
import { addVehicle, listVehicles } from "../../api/vehicles";
import SlotGrid from "../../components/SlotGrid";
import { useAuth } from "../../context/AuthContext";
import {
  validateEmail,
  validateFullName,
  validatePhone,
  validatePlate,
  validateUpiId,
} from "../../utils/validation";
import "./Booking.css";

const today = () => new Date().toISOString().slice(0, 10);

const nowTimeString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 5);
  return d.toTimeString().slice(0, 5);
};

const STEPS = ["Slot", "Date & Time", "Vehicle", "Your Details", "Review", "Payment"];

const PAYMENT_METHODS = [
  { key: "upi", label: "UPI", icon: FiSmartphone },
  { key: "qr", label: "QR Code", icon: FiGrid },
];

export default function Booking() {
  const { locationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);

  // Location data
  const [parking, setParking] = useState(null);
  const [floors, setFloors] = useState([]);

  // Step 1: slot
  const [floorId, setFloorId] = useState(null);
  const [floorData, setFloorData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Step 2: date & time
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState(nowTimeString());
  const [endTime, setEndTime] = useState("");

  // Step 3: vehicle
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newVehicleType, setNewVehicleType] = useState("car");
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState("");

  // Step 4: personal details
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [mobile, setMobile] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [personalErrors, setPersonalErrors] = useState({});

  // Step 6: payment
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const [paymentErrors, setPaymentErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const isToday = date === today();
  const minStartTime = isToday ? nowTimeString() : "00:00";

  useEffect(() => {
    getParkingDetail(locationId).then(setParking);
    getParkingFloors(locationId).then((data) => {
      setFloors(data);
      if (data.length) setFloorId(data[0].id);
    });
    listVehicles().then((data) => {
      setVehicles(data);
      if (data.length) setVehicleId(data[0].id);
    });
  }, [locationId]);

  useEffect(() => {
    if (!floorId) return;
    const load = () => getFloorSlots(locationId, floorId).then(setFloorData);
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [locationId, floorId]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [floorId]);

  // Open Ground locations reserve capacity, not a specific numbered slot —
  // silently take the first available generic slot instead of showing a grid.
  useEffect(() => {
    if (parking?.parking_mode === "open_ground" && floorData && !selectedSlot) {
      const firstAvailable = floorData.slots.find((s) => s.status === "available");
      if (firstAvailable) setSelectedSlot(firstAvailable);
    }
  }, [parking, floorData, selectedSlot]);

  useEffect(() => {
    if (isToday && startTime < minStartTime) setStartTime(minStartTime);
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default exit time is entry + 1 hour — but bookings can't span past
  // midnight into the next calendar day (the backend rejects end_time <=
  // start_time on the same date), so a late entry time clamps to 23:59
  // instead of silently wrapping around to an earlier-looking clock time.
  useEffect(() => {
    const [h, m] = startTime.split(":").map(Number);
    const totalMinutes = h * 60 + m + 60;
    if (totalMinutes >= 24 * 60) {
      setEndTime("23:59");
    } else {
      const endDate = new Date();
      endDate.setHours(h, m + 60, 0, 0);
      setEndTime(endDate.toTimeString().slice(0, 5));
    }
  }, [startTime]);

  const durationHours = (() => {
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const hrs = (end - start) / 3600000;
    return hrs > 0 ? hrs : 0;
  })();

  const estimatedAmount = parking
    ? Math.min(
        Math.round(Math.max(durationHours, 0.5) * parseFloat(parking.price_per_hour) * 100) / 100,
        parseFloat(parking.price_day_max)
      )
    : 0;

  // Free parking (₹0/hr) has nothing to pay, so the wizard skips the Payment
  // step entirely — Review's own button confirms the booking directly.
  const isFree = !!parking && parseFloat(parking.price_per_hour) === 0;
  const steps = isFree ? STEPS.slice(0, 5) : STEPS;

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    const plateErr = validatePlate(newPlate);
    if (plateErr) return setVehicleError(plateErr);
    setAddingVehicle(true);
    setVehicleError("");
    try {
      const vehicle = await addVehicle({ plate_number: newPlate.trim().toUpperCase(), vehicle_type: newVehicleType });
      setVehicles((prev) => [vehicle, ...prev]);
      setVehicleId(vehicle.id);
      setNewPlate("");
    } catch (err) {
      setVehicleError(err.response?.data?.plate_number?.[0] || "Could not add vehicle.");
    } finally {
      setAddingVehicle(false);
    }
  };

  const validatePersonalStep = () => {
    const errors = {
      fullName: validateFullName(fullName),
      mobile: validatePhone(mobile),
      email: validateEmail(email),
    };
    setPersonalErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const validatePaymentStep = () => {
    const errors = {};
    if (paymentMethod === "upi") {
      errors.upiId = validateUpiId(upiId);
    } else if (paymentMethod === "qr") {
      if (!qrConfirmed) errors.qr = "Please confirm you've completed the payment via QR code.";
    }
    setPaymentErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const canProceed = () => {
    if (step === 1) return !!selectedSlot;
    if (step === 2) return durationHours > 0 && (!isToday || startTime >= minStartTime);
    if (step === 3) return !!vehicleId;
    return true;
  };

  const handleNext = () => {
    if (step === 4) {
      if (!validatePersonalStep()) return;
    }
    setStep((s) => Math.min(s + 1, steps.length));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleConfirmAndPay = async () => {
    setSubmitError("");
    if (!isFree && !validatePaymentStep()) return;

    setSubmitting(true);
    try {
      const booking = await createBooking({
        vehicle: vehicleId,
        slot: selectedSlot.id,
        date,
        start_time: startTime,
        end_time: endTime,
        payment_method: isFree ? "free" : paymentMethod,
      });
      navigate(`/booking-success/${booking.id}`, { state: { booking } });
    } catch (err) {
      setSubmitError(
        err.response?.data?.slot?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.detail ||
        "Could not complete booking. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!parking || !floors.length) {
    return <div className="skeleton" style={{ height: 400 }} />;
  }

  const selectedFloor = floors.find((f) => f.id === floorId);
  const selectedVehicle = vehicles.find((v) => v.id === Number(vehicleId));

  return (
    <div className="booking-wizard fade-in">
      <div className="booking-header card">
        <img src={parking.image} alt={parking.name} />
        <div>
          <h2>{parking.name}</h2>
          <p>{parking.address}</p>
        </div>
      </div>

      <div className="wizard-steps">
        {steps.map((label, i) => {
          const n = i + 1;
          return (
            <div key={label} className={"wizard-step" + (n === step ? " active" : n < step ? " done" : "")}>
              <span className="wizard-step-dot">{n < step ? <FiCheck /> : n}</span>
              <span className="wizard-step-label">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="card wizard-panel">
        {step === 1 && (
          <div>
            <h3>Select a Parking Slot</h3>
            {parking.parking_mode === "open_ground" ? (
              <div className="confirm-card">
                <div className="confirm-row"><span>Total Capacity</span><strong>{parking.total_slots}</strong></div>
                <div className="confirm-row"><span>Available Now</span><strong>{parking.available_slots}</strong></div>
                {!selectedSlot && (
                  <div className="form-error">No spaces are currently available at this location.</div>
                )}
              </div>
            ) : (
              <>
                <div className="booking-floor-tabs">
                  {floors.map((f) => (
                    <button
                      key={f.id}
                      className={"booking-floor-tab" + (f.id === floorId ? " active" : "")}
                      onClick={() => setFloorId(f.id)}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
                {floorData ? (
                  <SlotGrid slots={floorData.slots} selectedSlotId={selectedSlot?.id} onSelect={setSelectedSlot} />
                ) : (
                  <div className="skeleton" style={{ height: 260 }} />
                )}
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Select Booking Date & Time</h3>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="input" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="auth-row">
              <div className="form-group">
                <label className="form-label">Entry Time</label>
                <input className="input" type="time" min={minStartTime} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Exit Time</label>
                <input className="input" type="time" min={startTime} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            {isToday && <p className="booking-time-hint">Bookings for today must start after {minStartTime}.</p>}
            <div className="wizard-duration-box">
              Duration: <strong>{durationHours > 0 ? durationHours.toFixed(1) : "0"} hours</strong>
              {durationHours <= 0 && <span className="form-error"> — exit time must be after entry time.</span>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3>Vehicle Details</h3>
            {vehicles.length > 0 && (
              <div className="form-group">
                <label className="form-label">Select Vehicle</label>
                <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate_number} ({v.vehicle_type})</option>
                  ))}
                </select>
              </div>
            )}
            <form className="add-vehicle-form" onSubmit={handleAddVehicle}>
              <div className="form-group">
                <label className="form-label">Add a New Vehicle</label>
                <div className="add-vehicle-row">
                  <input
                    className="input"
                    placeholder="Vehicle number (e.g. GJ01AB1234)"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                  />
                  <select className="input wizard-vehicle-type" value={newVehicleType} onChange={(e) => setNewVehicleType(e.target.value)}>
                    <option value="car">Car</option>
                    <option value="bike">Bike</option>
                  </select>
                  <button className="btn btn-outline btn-sm" type="submit" disabled={addingVehicle}>Add</button>
                </div>
              </div>
              {vehicleError && <div className="form-error">{vehicleError}</div>}
            </form>
            {!vehicleId && vehicles.length === 0 && (
              <p className="page-subtitle">Add a vehicle above to continue.</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div>
            <h3>Your Details</h3>
            <p className="page-subtitle">Confirm the contact details for this booking.</p>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              {personalErrors.fullName && <div className="form-error">{personalErrors.fullName}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                className="input"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
              {personalErrors.mobile && <div className="form-error">{personalErrors.mobile}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {personalErrors.email && <div className="form-error">{personalErrors.email}</div>}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3>Review Your Booking</h3>
            <div className="confirm-card">
              <div className="confirm-row"><span>Parking</span><strong>{parking.name}</strong></div>
              <div className="confirm-row"><span>Address</span><strong>{parking.address}</strong></div>
              <div className="confirm-row"><span>Floor</span><strong>{selectedFloor?.name}</strong></div>
              <div className="confirm-row"><span>Slot</span><strong>{selectedSlot?.code}</strong></div>
              <div className="confirm-row"><span>Date</span><strong>{date}</strong></div>
              <div className="confirm-row"><span>Time</span><strong>{startTime} - {endTime}</strong></div>
              <div className="confirm-row"><span>Duration</span><strong>{durationHours.toFixed(1)} hrs</strong></div>
              <div className="confirm-row"><span>Vehicle</span><strong>{selectedVehicle?.plate_number} ({selectedVehicle?.vehicle_type})</strong></div>
              <div className="confirm-row"><span>Name</span><strong>{fullName}</strong></div>
              <div className="confirm-row"><span>Mobile</span><strong>{mobile}</strong></div>
              <div className="confirm-row"><span>Email</span><strong>{email}</strong></div>
              <div className="confirm-row confirm-amount"><span>Estimated Amount</span><strong>₹{estimatedAmount}</strong></div>
            </div>
            {isFree && (
              <p className="payment-secure-note">This is a free parking zone — no payment is required. Just confirm your booking below.</p>
            )}
            {submitError && <div className="form-error">{submitError}</div>}
          </div>
        )}

        {step === 6 && (
          <div>
            <h3>Complete Payment</h3>
            <div className="payment-summary">
              <div>
                <div className="payment-summary-name">{parking.name}</div>
                <div className="payment-summary-meta">Slot {selectedSlot?.code} · {date} · {startTime} - {endTime}</div>
              </div>
              <div className="payment-summary-amount">₹{estimatedAmount}</div>
            </div>

            <div className="payment-methods">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.key}
                  className={"payment-method-tab" + (paymentMethod === m.key ? " active" : "")}
                  onClick={() => { setPaymentMethod(m.key); setPaymentErrors({}); }}
                >
                  <m.icon /> {m.label}
                </button>
              ))}
            </div>

            <div className="card payment-method-panel">
              {paymentMethod === "upi" && (
                <div className="form-group">
                  <label className="form-label">UPI ID</label>
                  <input className="input" placeholder="yourname@okhdfcbank" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                  {paymentErrors.upiId && <div className="form-error">{paymentErrors.upiId}</div>}
                  <p className="payment-hint">You'll receive a payment request on your UPI app.</p>
                </div>
              )}

              {paymentMethod === "qr" && (
                <div className="payment-qr">
                  {parking?.owner_qr_code ? (
                    <>
                      <img src={parking.owner_qr_code} alt="Payment QR code" className="payment-qr-image" />
                      <p className="payment-hint">
                        Scan with any UPI app to pay.
                        {parking.owner_upi_id && <><br />UPI ID: {parking.owner_upi_id}</>}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="payment-qr-box"><FiGrid /></div>
                      <p className="payment-hint">Scan with any UPI app to pay.<br />(This facility hasn't set up a QR code yet.)</p>
                    </>
                  )}
                  <label className="qr-confirm-check">
                    <input type="checkbox" checked={qrConfirmed} onChange={(e) => setQrConfirmed(e.target.checked)} />
                    I have completed the payment via QR code
                  </label>
                  {paymentErrors.qr && <div className="form-error">{paymentErrors.qr}</div>}
                </div>
              )}

            </div>

            {submitError && <div className="form-error">{submitError}</div>}
            <p className="payment-secure-note">🔒 Payments are simulated in this preview — no real transaction will be made.</p>
          </div>
        )}
      </div>

      <div className="wizard-nav">
        {step > 1 && (
          <button className="btn btn-outline" onClick={handleBack} disabled={submitting}>Back</button>
        )}
        {step < steps.length ? (
          <button className="btn btn-primary wizard-nav-next" onClick={handleNext} disabled={!canProceed()}>
            Continue
          </button>
        ) : (
          <button className="btn btn-primary wizard-nav-next" onClick={handleConfirmAndPay} disabled={submitting}>
            {submitting ? (isFree ? "Confirming..." : "Processing Payment...") : isFree ? "Confirm Booking" : `Confirm & Pay ₹${estimatedAmount}`}
          </button>
        )}
      </div>
    </div>
  );
}
