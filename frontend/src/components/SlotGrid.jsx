import "./SlotGrid.css";

export default function SlotGrid({ slots, selectedSlotId, onSelect, highlightSlotId, readOnly = false }) {
  const cols = slots.length ? Math.max(...slots.map((s) => s.col)) : 0;

  return (
    <div className="slot-grid-wrap">
      <div className="slot-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {slots.map((slot) => {
          const isSelected = slot.id === selectedSlotId;
          const isHighlighted = slot.id === highlightSlotId;
          const isBooked = slot.status === "booked" && !isHighlighted;
          const classNames = [
            "slot-cell",
            isHighlighted ? "highlighted" : isSelected ? "selected" : isBooked ? "booked" : "available",
          ].join(" ");

          return (
            <button
              key={slot.id}
              type="button"
              className={classNames}
              disabled={readOnly || isBooked}
              onClick={() => onSelect && onSelect(slot)}
              title={slot.code}
            >
              {slot.code}
            </button>
          );
        })}
      </div>

      <div className="slot-grid-legend">
        <span><i className="legend-dot available" /> Available</span>
        <span><i className="legend-dot booked" /> Booked</span>
        <span><i className="legend-dot selected" /> Selected</span>
      </div>
    </div>
  );
}
