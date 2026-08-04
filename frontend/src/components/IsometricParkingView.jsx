import { FiMapPin } from "react-icons/fi";
import "./IsometricParkingView.css";

export default function IsometricParkingView({ floors, currentFloor, onFloorChange, highlightSlotId }) {
  const slots = currentFloor?.slots || [];
  const cols = slots.length ? Math.max(...slots.map((s) => s.col)) : 0;
  const highlighted = slots.find((s) => s.id === highlightSlotId);

  return (
    <div className="iso-view">
      <div className="iso-floor-label">
        <span className="badge badge-selected">{currentFloor?.name}</span>
      </div>

      <div className="iso-entrance">
        <FiMapPin /> Entrance
      </div>

      <div className="iso-stage">
        <div className="iso-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {slots.map((slot) => {
            const isHighlighted = slot.id === highlightSlotId;
            const isBooked = slot.status === "booked" && !isHighlighted;
            return (
              <div
                key={slot.id}
                className={
                  "iso-block " + (isHighlighted ? "highlighted" : isBooked ? "booked" : "available")
                }
              >
                <div className="iso-block-top">{isHighlighted ? "🚗" : slot.code}</div>
              </div>
            );
          })}
        </div>
      </div>

      {highlighted && (
        <div className="iso-callout fade-in">
          Your car is parked at <strong>{currentFloor.name} — Slot {highlighted.code}</strong>
        </div>
      )}

      <div className="iso-floor-tabs">
        {floors.map((f) => (
          <button
            key={f.id}
            className={"iso-floor-tab" + (f.id === currentFloor?.id ? " active" : "")}
            onClick={() => onFloorChange(f)}
          >
            {f.name.replace("Basement ", "B").replace("Floor ", "F").replace("Ground Floor", "G")}
          </button>
        ))}
      </div>
    </div>
  );
}
