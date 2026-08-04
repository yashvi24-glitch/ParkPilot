import { useEffect, useState } from "react";
import { FiEdit2, FiPlusCircle, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { Link } from "react-router-dom";
import { deleteOwnerParking, listOwnerParking } from "../../api/owner";
import "./OwnerParkingList.css";

const MODE_LABELS = { slot_based: "Slot-Based", open_ground: "Open Ground" };
const CATEGORY_LABELS = { mall: "Mall", hospital: "Hospital", hotel: "Hotel", office: "Office", residential: "Residential", other: "Other" };

export default function OwnerParkingList() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const load = () => {
    setLoading(true);
    listOwnerParking()
      .then(setLocations)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this parking facility? This cannot be undone.")) return;
    setDeleteError("");
    setDeletingId(id);
    try {
      await deleteOwnerParking(id);
      load();
    } catch {
      setDeleteError("Could not delete this facility. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="owner-parking-list fade-in">
      <div className="owner-parking-list-head">
        <div>
          <h1>My Parking Facilities</h1>
          <p className="page-subtitle">Manage all the parking facilities you've registered.</p>
        </div>
        <div className="owner-parking-list-actions">
          <Link to="/owner/parking/import" className="btn btn-outline">
            <FiUploadCloud /> Bulk Import (CSV)
          </Link>
          <Link to="/owner/parking/new" className="btn btn-primary">
            <FiPlusCircle /> Add Parking
          </Link>
        </div>
      </div>

      {deleteError && <div className="form-error">{deleteError}</div>}

      {loading ? (
        <div className="parking-grid">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 220 }} />)}
        </div>
      ) : locations.length === 0 ? (
        <div className="empty-state">
          You haven't added any parking facilities yet. <Link to="/owner/parking/new">Add your first one</Link>.
        </div>
      ) : (
        <div className="parking-grid">
          {locations.map((loc) => (
            <div key={loc.id} className="card owner-parking-card">
              <div className="owner-parking-card-badges">
                <span className="badge badge-active">{MODE_LABELS[loc.parking_mode]}</span>
                {loc.category && <span className="badge badge-completed">{CATEGORY_LABELS[loc.category] || loc.category}</span>}
              </div>
              <h3>{loc.name}</h3>
              <p className="owner-parking-card-address">{loc.city}, {loc.district}</p>
              <div className="owner-parking-card-stats">
                <span>{loc.available_slots} / {loc.total_slots} available</span>
                <span>₹{loc.price_per_hour}/hr</span>
              </div>
              <div className="owner-parking-card-actions">
                <Link to={`/owner/parking/${loc.id}/edit`} className="btn btn-outline btn-sm">
                  <FiEdit2 /> Edit
                </Link>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(loc.id)}
                  disabled={deletingId === loc.id}
                >
                  <FiTrash2 /> {deletingId === loc.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
