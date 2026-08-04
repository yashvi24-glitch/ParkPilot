import { useState } from "react";
import { FiCopy, FiGrid, FiTrash2, FiX } from "react-icons/fi";
import { deleteOwnerSlot, duplicateOwnerSlot, listOwnerSlots, updateOwnerSlot } from "../../api/owner";

const VEHICLE_TYPE_OPTIONS = [
  { value: "car", label: "Car" },
  { value: "bike", label: "Bike" },
  { value: "ev", label: "EV" },
  { value: "suv", label: "SUV" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "booked", label: "Occupied" },
  { value: "maintenance", label: "Maintenance" },
];

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]));

export default function OwnerSlotGrid({ locationId, floor, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [editingSlot, setEditingSlot] = useState(null);
  const [editForm, setEditForm] = useState({ code: "", vehicle_type: "car", status: "available" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadSlots = async () => {
    setLoading(true);
    setListError("");
    try {
      const data = await listOwnerSlots(locationId, floor.id);
      setSlots(data);
    } catch {
      setListError("Could not load slots for this floor.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && slots === null) loadSlots();
  };

  const openEdit = (slot) => {
    setEditError("");
    setEditingSlot(slot);
    setEditForm({ code: slot.code, vehicle_type: slot.vehicle_type, status: slot.status });
  };

  const closeEdit = () => {
    setEditingSlot(null);
    setEditError("");
  };

  const refreshAfterChange = async (updater) => {
    await updater();
    await loadSlots();
    onChanged?.();
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.code.trim()) {
      setEditError("Slot number is required.");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      await refreshAfterChange(() =>
        updateOwnerSlot(editingSlot.id, {
          code: editForm.code.trim(),
          vehicle_type: editForm.vehicle_type,
          status: editForm.status,
        })
      );
      closeEdit();
    } catch (err) {
      const data = err.response?.data;
      setEditError(
        data && typeof data === "object" ? Object.values(data).flat().join(" ") : "Could not save changes."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnable = async () => {
    const nextStatus = editForm.status === "maintenance" ? "available" : "maintenance";
    setSaving(true);
    setEditError("");
    try {
      await refreshAfterChange(() => updateOwnerSlot(editingSlot.id, { status: nextStatus }));
      setEditForm({ ...editForm, status: nextStatus });
    } catch {
      setEditError("Could not update slot status.");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    setSaving(true);
    setEditError("");
    try {
      await refreshAfterChange(() => duplicateOwnerSlot(editingSlot.id));
      closeEdit();
    } catch {
      setEditError("Could not duplicate this slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setEditError("");
    try {
      await refreshAfterChange(() => deleteOwnerSlot(editingSlot.id));
      closeEdit();
    } catch (err) {
      const data = err.response?.data;
      setEditError(
        typeof data === "string" ? data : data?.detail || "Could not delete this slot."
      );
    } finally {
      setSaving(false);
    }
  };

  const maxCol = slots?.length ? Math.max(...slots.map((s) => s.col || 1)) : 1;

  return (
    <div className="owner-slot-grid-wrap">
      <button type="button" className="btn btn-outline btn-sm" onClick={toggleExpanded}>
        <FiGrid /> {expanded ? "Hide Slots" : "View Slots"}
      </button>

      {expanded && (
        <div className="owner-slot-grid-panel">
          {loading && <div className="page-subtitle">Loading slots...</div>}
          {listError && <div className="form-error">{listError}</div>}
          {!loading && !listError && slots?.length === 0 && (
            <p className="page-subtitle">No slots yet — generate a layout or add slots manually above.</p>
          )}
          {!loading && slots?.length > 0 && (
            <>
              <div className="owner-slot-legend">
                <span className="owner-slot-legend-item"><i className="owner-slot-dot available" /> Available</span>
                <span className="owner-slot-legend-item"><i className="owner-slot-dot booked" /> Occupied</span>
                <span className="owner-slot-legend-item"><i className="owner-slot-dot reserved" /> Reserved</span>
                <span className="owner-slot-legend-item"><i className="owner-slot-dot maintenance" /> Maintenance</span>
              </div>
              <div className="owner-slot-grid" style={{ gridTemplateColumns: `repeat(${maxCol}, 64px)` }}>
                {slots.map((slot) => (
                  <button
                    type="button"
                    key={slot.id}
                    className={`owner-slot-card owner-slot-${slot.status}`}
                    style={{ gridRow: (slot.row || 0) + 1, gridColumn: slot.col || 1 }}
                    onClick={() => openEdit(slot)}
                    title={`${slot.code} — ${STATUS_LABEL[slot.status]}`}
                  >
                    <span className="owner-slot-code">{slot.code}</span>
                    <span className="owner-slot-vtype">{slot.vehicle_type?.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {editingSlot && (
        <div className="owner-modal-backdrop" onClick={closeEdit}>
          <div className="card owner-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="owner-modal-close" onClick={closeEdit}><FiX /></button>
            <h2>Edit Slot</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Slot Number</label>
                <input
                  className="input"
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Type</label>
                <select
                  className="input"
                  value={editForm.vehicle_type}
                  onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value })}
                >
                  {VEHICLE_TYPE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Slot Status</label>
                <select
                  className="input"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {editError && <div className="form-error">{editError}</div>}
              <div className="owner-modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
            <div className="owner-modal-actions">
              <button type="button" className="btn btn-outline" onClick={handleToggleEnable} disabled={saving}>
                {editForm.status === "maintenance" ? "Enable Slot" : "Disable Slot"}
              </button>
              <button type="button" className="btn btn-outline" onClick={handleDuplicate} disabled={saving}>
                <FiCopy /> Duplicate
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                <FiTrash2 /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
