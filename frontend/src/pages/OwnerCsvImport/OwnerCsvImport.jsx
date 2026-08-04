import { useState } from "react";
import { FiCheckCircle, FiDownload, FiInfo, FiUploadCloud } from "react-icons/fi";
import {
  importOwnerFacilities,
  importOwnerFloors,
  importOwnerLocations,
  importOwnerPricing,
  importOwnerSlots,
} from "../../api/owner";
import "./OwnerCsvImport.css";

const SECTIONS = [
  {
    key: "locations",
    title: "Parking Information CSV",
    description: "Creates or updates parking facilities. Upload this first.",
    importFn: importOwnerLocations,
    sample: "/sample-csv/1_parking_information.csv",
    columns: [
      { name: "Parking_ID", required: true, format: "Any text you choose, unique across your own files (e.g. P001). Re-uploading the same Parking_ID updates that facility instead of creating a duplicate." },
      { name: "Parking_Name", required: true, format: "Text" },
      { name: "Parking_Category", required: true, format: "Mall, Hospital, Hotel, Office, Residential, or Other" },
      { name: "Parking_Type", required: true, format: "Slot-Based Parking or Open Ground Parking" },
      { name: "Address", required: true, format: "Text" },
      { name: "City", required: true, format: "Text" },
      { name: "District", required: true, format: "Text" },
      { name: "State", required: true, format: "Text" },
      { name: "Pincode", required: true, format: "Text" },
      { name: "Latitude", required: true, format: "Decimal degrees, -90 to 90 (e.g. 23.0300)" },
      { name: "Longitude", required: true, format: "Decimal degrees, -180 to 180 (e.g. 72.5800)" },
      { name: "Opening_Time", required: true, format: "24-hour HH:MM or HH:MM:SS (e.g. 09:00)" },
      { name: "Closing_Time", required: true, format: "24-hour HH:MM or HH:MM:SS — must be after Opening_Time" },
      { name: "Total_Capacity", required: "Open Ground only", format: "Whole number, at least 1. Leave blank for Slot-Based rows." },
      { name: "Vehicle_Types", required: true, format: "Comma-separated: Car, Bike" },
      { name: "Price_Per_Hour", required: true, format: "Non-negative number" },
      { name: "Contact_Number", required: false, format: "Text" },
      { name: "Description", required: false, format: "Text" },
      { name: "Parking_Image_URL", required: false, format: "A link to an image (not an uploaded file)" },
    ],
    notes: [
      "Slot-Based facilities need Floor and Slot CSVs uploaded afterward — Open Ground facilities don't.",
      "A duplicate Parking_ID within the same file is rejected; re-using one from a previous upload updates that facility.",
    ],
  },
  {
    key: "floors",
    title: "Floor Information CSV",
    description: "For Slot-Based facilities only. Requires the Parking_ID to already exist.",
    importFn: importOwnerFloors,
    sample: "/sample-csv/2_floor_information.csv",
    columns: [
      { name: "Floor_ID", required: true, format: "Any text you choose, unique within this facility (e.g. F1). Used by the Slot CSV to attach slots to this floor." },
      { name: "Parking_ID", required: true, format: "Must match a Parking_ID already uploaded via the Parking Information CSV." },
      { name: "Floor_Name", required: true, format: "e.g. Ground Floor, Basement 1, Floor 2" },
    ],
    notes: [
      "The referenced Parking_ID must be a Slot-Based facility — floors don't apply to Open Ground parking.",
      "Total_Slots is not part of this CSV — the actual slot count comes from however many rows you add for that floor in the Parking Slot CSV.",
    ],
  },
  {
    key: "slots",
    title: "Parking Slot CSV",
    description: "Requires the Parking_ID and Floor_ID to already exist.",
    importFn: importOwnerSlots,
    sample: "/sample-csv/3_parking_slots.csv",
    columns: [
      { name: "Slot_ID", required: true, format: "Any text you choose to identify this row" },
      { name: "Parking_ID", required: true, format: "Must already exist (Parking Information CSV)" },
      { name: "Floor_ID", required: true, format: "Must already exist on that facility (Floor Information CSV)" },
      { name: "Slot_Number", required: true, format: "e.g. A1 — must be unique on that floor" },
      { name: "Vehicle_Type", required: true, format: "Car or Bike" },
      { name: "Slot_Status", required: true, format: "Available, Booked, Reserved, or Maintenance" },
    ],
    notes: [],
  },
  {
    key: "pricing",
    title: "Pricing CSV (Optional)",
    description: "Updates a facility's price per hour and daily rate.",
    importFn: importOwnerPricing,
    sample: "/sample-csv/4_pricing.csv",
    columns: [
      { name: "Parking_ID", required: true, format: "Must already exist (Parking Information CSV)" },
      { name: "Vehicle_Type", required: true, format: "Car or Bike" },
      { name: "Price_Per_Hour", required: true, format: "Non-negative number" },
      { name: "Daily_Rate", required: true, format: "Non-negative number" },
    ],
    notes: [
      "Each facility only has one price (not a separate price per vehicle type) — if you include multiple rows for the same Parking_ID, the last one in the file wins.",
    ],
  },
  {
    key: "facilities",
    title: "Facilities CSV (Optional)",
    description: "Adds amenities (CCTV, Security, EV Charging, Disabled Parking, Covered Parking) to a facility.",
    importFn: importOwnerFacilities,
    sample: "/sample-csv/5_facilities.csv",
    columns: [
      { name: "Parking_ID", required: true, format: "Must already exist (Parking Information CSV)" },
      { name: "CCTV", required: true, format: "Yes or No" },
      { name: "Security", required: true, format: "Yes or No" },
      { name: "EV_Charging", required: true, format: "Yes or No" },
      { name: "Disabled_Parking", required: true, format: "Yes or No" },
      { name: "Covered_Parking", required: true, format: "Yes or No" },
    ],
    notes: [
      "Amenities marked Yes are added to the facility's existing list — nothing already set is removed.",
    ],
  },
];

function ImportCard({ title, description, importFn, sample, columns, notes }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [showRequirements, setShowRequirements] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const data = await importFn(file);
      setResult(data);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card owner-csv-card">
      <div className="owner-csv-card-head">
        <div>
          <h2>{title}</h2>
          <p className="page-subtitle">{description}</p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setShowRequirements((s) => !s)}
        >
          <FiInfo /> {showRequirements ? "Hide" : "View"} Requirements
        </button>
      </div>

      {showRequirements && (
        <div className="owner-csv-requirements">
          <div className="owner-csv-requirements-table">
            <table>
              <thead>
                <tr><th>Column</th><th>Required</th><th>Format</th></tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name}>
                    <td><code>{col.name}</code></td>
                    <td>{col.required === true ? "Yes" : col.required === false ? "Optional" : col.required}</td>
                    <td>{col.format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {notes.length > 0 && (
            <ul className="owner-csv-requirements-notes">
              {notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          )}
          <a className="btn btn-outline btn-sm" href={sample} download>
            <FiDownload /> Download Sample CSV
          </a>
        </div>
      )}

      <div className="owner-csv-upload-row">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
        />
        <button className="btn btn-outline btn-sm" onClick={handleUpload} disabled={!file || uploading}>
          <FiUploadCloud /> {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {result && result.errors.length === 0 && (
        <div className="owner-csv-success">
          <FiCheckCircle /> {result.created} created, {result.updated} updated.
        </div>
      )}

      {result && result.errors.length > 0 && (
        <div className="owner-csv-errors">
          <table>
            <thead>
              <tr><th>Row</th><th>Column</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {result.errors.map((err, i) => (
                <tr key={i}>
                  <td>{err.row ?? "—"}</td>
                  <td>{err.column ?? "—"}</td>
                  <td>{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function OwnerCsvImport() {
  return (
    <div className="owner-csv-import fade-in">
      <h1>Bulk Import via CSV</h1>
      <p className="page-subtitle">
        Upload each CSV type below. If any row fails validation, that file's import is rejected entirely and
        nothing is saved — fix the listed rows and re-upload. Click "View Requirements" on any section for the
        exact columns needed and a sample file.
      </p>

      {SECTIONS.map((section) => (
        <ImportCard key={section.key} {...section} />
      ))}
    </div>
  );
}
