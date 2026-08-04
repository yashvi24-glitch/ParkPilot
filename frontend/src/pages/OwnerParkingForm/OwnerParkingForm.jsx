import { useEffect, useState } from "react";
import { FiMapPin, FiPlusCircle, FiTrash2, FiUploadCloud } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { geocode, reverseGeocode } from "../../api/navigation";
import MapView from "../../components/MapView";
import {
  addOwnerFloor,
  createOwnerParking,
  deleteOwnerFloor,
  deleteOwnerParkingImage,
  generateOwnerSlots,
  getOwnerParking,
  updateOwnerParking,
  uploadOwnerParkingImage,
} from "../../api/owner";
import OwnerSlotGrid from "./OwnerSlotGrid";
import "./OwnerParkingForm.css";

const FIELD_LABELS = {
  name: "Parking Name", category: "Category", parking_mode: "Parking Type",
  address: "Complete Address", city: "City", district: "District", state: "State",
  pincode: "Pincode", latitude: "Latitude", longitude: "Longitude",
  opens_at: "Opening Time", closes_at: "Closing Time", available_days: "Available Days",
  contact_number: "Contact Number", contact_email: "Contact Email",
  price_per_hour: "Price Per Hour", price_day_max: "Daily Charge", monthly_price: "Monthly Charge",
  vehicle_types: "Accepted Vehicle Types", amenities: "Facilities", total_capacity: "Total Capacity",
  non_field_errors: "", detail: "",
};

const CATEGORY_OPTIONS = [
  { value: "", label: "Select a category" },
  { value: "mall", label: "Mall" },
  { value: "hospital", label: "Hospital" },
  { value: "hotel", label: "Hotel" },
  { value: "office", label: "Office" },
  { value: "residential", label: "Residential" },
  { value: "other", label: "Other" },
];

const AMENITY_OPTIONS = [
  "CCTV", "Security", "Covered Parking", "Open Parking", "EV Charging",
  "Disabled Parking", "Lift Access", "Washroom", "Emergency Exit",
];

// A facility can't be both covered and open-air — picking one rules out the other.
const EXCLUSIVE_AMENITIES = { "Covered Parking": "Open Parking", "Open Parking": "Covered Parking" };

const VEHICLE_OPTIONS = ["Car", "Bike"];

const SLOT_VEHICLE_TYPE_OPTIONS = [
  { value: "car", label: "Car" },
  { value: "bike", label: "Bike" },
  { value: "ev", label: "EV" },
  { value: "suv", label: "SUV" },
  { value: "other", label: "Other" },
];

const DIGITS_ONLY_FIELDS = ["pincode", "contact_number"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_REGEX = /^\d{6}$/;
const PHONE_REGEX = /^\d{10}$/;

const EMPTY_FORM = {
  name: "", description: "", category: "", parking_mode: "slot_based",
  address: "", city: "", district: "", state: "Gujarat", country: "India", pincode: "",
  opens_at: "09:00", closes_at: "21:00", is_24_hours: false, available_days: "All Days",
  contact_number: "", contact_email: "",
  price_per_hour: "", price_day_max: "", monthly_price: "",
  total_capacity: "",
};

export default function OwnerParkingForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [vehicleTypes, setVehicleTypes] = useState(["Car"]);
  const [amenities, setAmenities] = useState([]);
  const [otherAmenities, setOtherAmenities] = useState("");
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [newFloor, setNewFloor] = useState({ name: "", level: 0 });
  const [generateForm, setGenerateForm] = useState({});
  const [generating, setGenerating] = useState(null);
  const [generateError, setGenerateError] = useState({});
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickedCoords, setPickedCoords] = useState(null);
  const [mapLookupLoading, setMapLookupLoading] = useState(false);
  const [mapNote, setMapNote] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const ADDRESS_FIELDS = ["address", "city", "district", "state", "pincode"];

  // Backend stores lat/lng as DecimalField(decimal_places=6) — geocoders and
  // Leaflet's click coordinates both return far more precision than that.
  const round6 = (n) => Math.round(n * 1e6) / 1e6;

  useEffect(() => {
    if (!isEdit) return;
    getOwnerParking(id).then((data) => {
      populateForm(data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const populateForm = (data) => {
    setLocation(data);
    setForm({
      name: data.name, description: data.description, category: data.category,
      parking_mode: data.parking_mode,
      address: data.address, city: data.city, district: data.district,
      state: data.state, country: data.country, pincode: data.pincode,
      opens_at: data.opens_at?.slice(0, 5) || "09:00",
      closes_at: data.closes_at?.slice(0, 5) || "21:00",
      is_24_hours: data.is_24_hours, available_days: data.available_days,
      contact_number: data.contact_number, contact_email: data.contact_email,
      price_per_hour: data.price_per_hour, price_day_max: data.price_day_max,
      monthly_price: data.monthly_price ?? "",
      total_capacity: data.total_slots,
    });
    setVehicleTypes(data.vehicle_types ? data.vehicle_types.split(",").map((v) => v.trim()) : ["Car"]);
    const existing = data.amenities ? data.amenities.split(",").map((a) => a.trim()).filter(Boolean) : [];
    setAmenities(existing.filter((a) => AMENITY_OPTIONS.includes(a)));
    setOtherAmenities(existing.filter((a) => !AMENITY_OPTIONS.includes(a)).join(", "));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let nextValue = type === "checkbox" ? checked : value;
    if (DIGITS_ONLY_FIELDS.includes(name)) nextValue = nextValue.replace(/\D/g, "");
    setForm({ ...form, [name]: nextValue });
    setSaveSuccess(false);
    // Address changed — the previously picked/geocoded point no longer applies.
    if (ADDRESS_FIELDS.includes(name)) {
      setPickingLocation(false);
      setPickedCoords(null);
      setMapNote("");
    }
  };

  // Nominatim (OpenStreetMap) doesn't reliably index specific business names or
  // minor street names — try progressively broader queries (full address, then
  // just the address line, then city/district/state) so most real addresses
  // still resolve automatically before falling back to manual map placement.
  const resolveCoordinates = async () => {
    const full = [form.address, form.city, form.district, form.state, form.pincode, "India"]
      .filter((p) => p && p.trim()).join(", ");
    const addressOnly = [form.address, "India"].filter((p) => p && p.trim()).join(", ");
    const areaOnly = [form.city, form.district, form.state, "India"].filter((p) => p && p.trim()).join(", ");
    const queries = [...new Set([full, addressOnly, areaOnly])].filter(Boolean);

    for (const query of queries) {
      try {
        const results = await geocode(query);
        if (results.length) return { lat: round6(results[0].lat), lng: round6(results[0].lng) };
      } catch {
        // try the next, broader query
      }
    }
    return null;
  };

  const toggleFromList = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handlePickLocationOnMap = async (lat, lng) => {
    const coords = { lat: round6(lat), lng: round6(lng) };
    setPickedCoords(coords);
    setMapLookupLoading(true);
    setMapNote("");
    try {
      const { display_name } = await reverseGeocode(lat, lng);
      setForm((prev) => ({ ...prev, address: display_name }));
      setMapNote("Location and address set from the map.");
    } catch {
      setMapNote("Location pinned — couldn't fetch an address automatically, so enter it manually.");
    } finally {
      setMapLookupLoading(false);
      setPickingLocation(false);
    }
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Parking name is required.";
    if (!form.category) next.category = "Category is required.";
    if (!form.address.trim()) next.address = "Address is required.";
    if (!form.city.trim()) next.city = "City is required.";
    if (!form.price_per_hour) next.price_per_hour = "Price per hour is required.";
    if (!vehicleTypes.length) next.vehicle_types = "Select at least one accepted vehicle type.";
    if (form.parking_mode === "open_ground" && !isEdit && !form.total_capacity) {
      next.total_capacity = "Total capacity is required for Open Ground parking.";
    }
    if (!form.is_24_hours && form.opens_at >= form.closes_at) {
      next.closes_at = "Closing time must be after opening time.";
    }
    if (form.pincode && !PINCODE_REGEX.test(form.pincode)) {
      next.pincode = "Pincode must be exactly 6 digits.";
    }
    if (form.contact_number && !PHONE_REGEX.test(form.contact_number)) {
      next.contact_number = "Contact number must be a valid 10-digit number.";
    }
    if (form.contact_email && !EMAIL_REGEX.test(form.contact_email)) {
      next.contact_email = "Enter a valid email address.";
    }
    setErrors(next);

    const firstKey = Object.keys(next)[0];
    if (firstKey) {
      // Long form, error can be off-screen from wherever the user submitted —
      // without this, a validation failure silently does nothing visible.
      document.querySelector(`[name="${firstKey}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(next).length === 0;
  };

  const buildPayload = () => {
    const combinedAmenities = [
      ...amenities,
      ...otherAmenities.split(",").map((a) => a.trim()).filter(Boolean),
    ].join(", ");

    const payload = {
      ...form,
      vehicle_types: vehicleTypes.join(", "),
      amenities: combinedAmenities,
      // monthly_price is genuinely nullable on the model, so "" -> null is fine.
      monthly_price: form.monthly_price || null,
    };
    // price_day_max is NOT nullable (it's used as a hard cap in booking price
    // calculations) — leaving it blank must omit the key entirely so the
    // backend's own default applies, not send an explicit null.
    if (form.price_day_max) payload.price_day_max = form.price_day_max;
    else delete payload.price_day_max;

    if (form.parking_mode !== "open_ground") delete payload.total_capacity;
    else payload.total_capacity = Number(form.total_capacity);
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");
    setSaveSuccess(false);
    if (!validate()) return;

    setSaving(true);
    try {
      let coords = pickedCoords;
      if (!coords) {
        coords = await resolveCoordinates();
        if (!coords) {
          setPickingLocation(true);
          setServerError(
            "Could not automatically locate this address on the map. Click your facility's location on the map below, then save again."
          );
          setSaving(false);
          return;
        }
      }

      const payload = buildPayload();
      // .toFixed(6) (not just rounding the number) guarantees an exact 6-decimal
      // string — plain floats can still serialize with stray extra digits.
      payload.latitude = coords.lat.toFixed(6);
      payload.longitude = coords.lng.toFixed(6);

      if (isEdit) {
        const updated = await updateOwnerParking(id, payload);
        populateForm(updated);
        setSaveSuccess(true);
      } else {
        const created = await createOwnerParking(payload);
        navigate(`/owner/parking/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        const fieldErrors = {};
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val;
        });
        setErrors(fieldErrors);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !location) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadOwnerParkingImage(location.id, file);
      }
      const refreshed = await getOwnerParking(location.id);
      setLocation(refreshed);
    } finally {
      setUploading(false);
    }
  };

  const handleImageDelete = async (imageId) => {
    await deleteOwnerParkingImage(imageId);
    setLocation((prev) => ({ ...prev, gallery_images: prev.gallery_images.filter((img) => img.id !== imageId) }));
  };

  const refreshLocation = async () => {
    const refreshed = await getOwnerParking(location.id);
    setLocation(refreshed);
  };

  const handleAddFloor = async (e) => {
    e.preventDefault();
    if (!newFloor.name.trim() || !location) return;
    const floor = await addOwnerFloor(location.id, { name: newFloor.name, level: Number(newFloor.level) || 0 });
    setLocation((prev) => ({ ...prev, floors: [...prev.floors, floor] }));
    setNewFloor({ name: "", level: 0 });
  };

  const handleDeleteFloor = async (floorId) => {
    await deleteOwnerFloor(floorId);
    setLocation((prev) => ({ ...prev, floors: prev.floors.filter((f) => f.id !== floorId) }));
  };

  const handleGenerateSlots = async (e, floorId) => {
    e.preventDefault();
    if (!location) return;
    const gen = generateForm[floorId] || {};
    setGenerateError({ ...generateError, [floorId]: "" });
    if (!gen.rows || !gen.cols) {
      setGenerateError({ ...generateError, [floorId]: "Enter the number of rows and columns." });
      return;
    }
    setGenerating(floorId);
    try {
      await generateOwnerSlots(location.id, floorId, {
        prefix: (gen.prefix || "").trim(),
        rows: Number(gen.rows),
        cols: Number(gen.cols),
        vehicle_type: gen.vehicleType || "car",
      });
      const refreshed = await getOwnerParking(location.id);
      setLocation(refreshed);
      setGenerateForm({ ...generateForm, [floorId]: { prefix: "", rows: "", cols: "", vehicleType: "car" } });
    } catch (err) {
      const data = err.response?.data;
      const message = data && typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "Could not generate slots. Please try again.";
      setGenerateError({ ...generateError, [floorId]: message });
    } finally {
      setGenerating(null);
    }
  };

  if (loading) return <div className="skeleton" style={{ height: 500 }} />;

  return (
    <div className="owner-parking-form fade-in">
      <h1>{isEdit ? "Edit Parking Facility" : "Add Parking Facility"}</h1>
      <p className="page-subtitle">Fill in the details for your parking facility.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card owner-form-section">
          <h2>Parking Type</h2>
          <div className="owner-mode-toggle">
            <button
              type="button"
              className={"owner-mode-btn" + (form.parking_mode === "slot_based" ? " active" : "")}
              onClick={() => setForm({ ...form, parking_mode: "slot_based" })}
              disabled={isEdit}
            >
              Slot-Based Parking
            </button>
            <button
              type="button"
              className={"owner-mode-btn" + (form.parking_mode === "open_ground" ? " active" : "")}
              onClick={() => setForm({ ...form, parking_mode: "open_ground" })}
              disabled={isEdit}
            >
              Open Ground Parking
            </button>
          </div>
          {isEdit && <p className="page-subtitle">Parking type can't be changed after creation.</p>}
          {form.parking_mode === "open_ground" && (
            <div className="form-group">
              <label className="form-label">{isEdit ? "Total Capacity" : "Total Capacity"}</label>
              <input
                className="input"
                type="number"
                min="1"
                name="total_capacity"
                value={form.total_capacity}
                onChange={handleChange}
              />
              {isEdit && <p className="page-subtitle">Current available: {location?.available_slots}</p>}
              {errors.total_capacity && <div className="form-error">{errors.total_capacity}</div>}
            </div>
          )}
        </div>

        <div className="card owner-form-section">
          <h2>Basic Information</h2>
          <div className="form-group">
            <label className="form-label">Parking Name</label>
            <input className="input" name="name" value={form.name} onChange={handleChange} />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" name="description" rows={3} value={form.description} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="input" name="category" value={form.category} onChange={handleChange}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {errors.category && <div className="form-error">{errors.category}</div>}
          </div>
          <div className="form-group">
            <div className="owner-address-label-row">
              <label className="form-label">Complete Address</label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPickingLocation((prev) => !prev)}
              >
                <FiMapPin /> {pickingLocation ? "Cancel" : pickedCoords ? "Change Location on Map" : "Choose on Map"}
              </button>
            </div>
            <input className="input" name="address" value={form.address} onChange={handleChange} />
            {errors.address && <div className="form-error">{errors.address}</div>}
            {mapNote && <p className="page-subtitle">{mapNote}</p>}
          </div>
          <div className="auth-row">
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="input" name="city" value={form.city} onChange={handleChange} />
              {errors.city && <div className="form-error">{errors.city}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">District</label>
              <input className="input" name="district" value={form.district} onChange={handleChange} />
            </div>
          </div>
          <div className="auth-row">
            <div className="form-group">
              <label className="form-label">State</label>
              <input className="input" name="state" value={form.state} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Pincode</label>
              <input
                className="input"
                name="pincode"
                inputMode="numeric"
                maxLength={6}
                value={form.pincode}
                onChange={handleChange}
              />
              {errors.pincode && <div className="form-error">{errors.pincode}</div>}
            </div>
          </div>
          <p className="page-subtitle">
            Map coordinates are detected automatically from the address above, or set exactly with "Choose on Map".
          </p>
          {pickingLocation && (
            <div className="form-group">
              <label className="form-label">
                {mapLookupLoading ? "Locating address..." : "Click your facility's exact location on the map"}
              </label>
              <MapView
                height={280}
                fitToMarkers={!!pickedCoords}
                markers={pickedCoords ? [{ lat: pickedCoords.lat, lng: pickedCoords.lng, color: "#7d35ff" }] : []}
                onMapClick={handlePickLocationOnMap}
              />
            </div>
          )}
        </div>

        <div className="card owner-form-section">
          <h2>Operating Information</h2>
          <label className="owner-checkbox-row">
            <input type="checkbox" name="is_24_hours" checked={form.is_24_hours} onChange={handleChange} />
            Open 24 Hours
          </label>
          {!form.is_24_hours && (
            <div className="auth-row">
              <div className="form-group">
                <label className="form-label">Opening Time</label>
                <input className="input" type="time" name="opens_at" value={form.opens_at} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Closing Time</label>
                <input className="input" type="time" name="closes_at" value={form.closes_at} onChange={handleChange} />
                {errors.closes_at && <div className="form-error">{errors.closes_at}</div>}
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Available Days</label>
            <input className="input" name="available_days" value={form.available_days} onChange={handleChange} placeholder="e.g. All Days, Mon-Sat" />
          </div>
          <div className="auth-row">
            <div className="form-group">
              <label className="form-label">Contact Number</label>
              <input
                className="input"
                name="contact_number"
                inputMode="numeric"
                maxLength={10}
                value={form.contact_number}
                onChange={handleChange}
              />
              {errors.contact_number && <div className="form-error">{errors.contact_number}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input className="input" type="email" name="contact_email" value={form.contact_email} onChange={handleChange} />
              {errors.contact_email && <div className="form-error">{errors.contact_email}</div>}
            </div>
          </div>
        </div>

        <div className="card owner-form-section">
          <h2>Pricing</h2>
          <div className="auth-row">
            <div className="form-group">
              <label className="form-label">Price Per Hour (₹)</label>
              <input className="input" type="number" min="0" name="price_per_hour" value={form.price_per_hour} onChange={handleChange} />
              {errors.price_per_hour && <div className="form-error">{errors.price_per_hour}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Daily Charge (Optional, ₹)</label>
              <input className="input" type="number" min="0" name="price_day_max" value={form.price_day_max} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Monthly Charge (Optional, ₹)</label>
            <input className="input" type="number" min="0" name="monthly_price" value={form.monthly_price} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Accepted Vehicle Types</label>
            <div className="owner-checkbox-grid">
              {VEHICLE_OPTIONS.map((v) => (
                <label key={v} className="owner-checkbox-row">
                  <input type="checkbox" checked={vehicleTypes.includes(v)} onChange={() => toggleFromList(vehicleTypes, setVehicleTypes, v)} />
                  {v}
                </label>
              ))}
            </div>
            {errors.vehicle_types && <div className="form-error">{errors.vehicle_types}</div>}
          </div>
        </div>

        <div className="card owner-form-section">
          <h2>Facilities</h2>
          <div className="owner-checkbox-grid">
            {AMENITY_OPTIONS.map((a) => {
              const exclusiveWith = EXCLUSIVE_AMENITIES[a];
              const disabled = exclusiveWith && amenities.includes(exclusiveWith);
              return (
                <label key={a} className={"owner-checkbox-row" + (disabled ? " owner-checkbox-row-disabled" : "")}>
                  <input
                    type="checkbox"
                    checked={amenities.includes(a)}
                    disabled={disabled}
                    onChange={() => toggleFromList(amenities, setAmenities, a)}
                  />
                  {a}
                </label>
              );
            })}
          </div>
          <p className="page-subtitle">A facility is either Covered or Open Parking — not both.</p>
          <div className="form-group">
            <label className="form-label">Other Amenities</label>
            <input className="input" value={otherAmenities} onChange={(e) => setOtherAmenities(e.target.value)} placeholder="Comma-separated" />
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="owner-form-error-summary">
            Please fix the following before saving:
            <ul>
              {Object.entries(errors).map(([key, msg]) => {
                const label = FIELD_LABELS[key] ?? key;
                return <li key={key}>{label ? `${label}: ${msg}` : msg}</li>;
              })}
            </ul>
          </div>
        )}
        {serverError && <div className="form-error">{serverError}</div>}
        {saveSuccess && <div className="owner-form-success">Changes saved successfully.</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Parking Facility"}
        </button>
      </form>

      {isEdit && location && (
        <>
          <div className="card owner-form-section">
            <h2>Parking Images</h2>
            <label className="owner-upload-btn">
              <FiUploadCloud /> {uploading ? "Uploading..." : "Upload Images"}
              <input type="file" accept="image/*" multiple hidden onChange={handleImageUpload} disabled={uploading} />
            </label>
            <div className="owner-image-grid">
              {location.gallery_images?.map((img) => (
                <div key={img.id} className="owner-image-tile">
                  <img src={img.image} alt="" />
                  <button type="button" className="owner-image-remove" onClick={() => handleImageDelete(img.id)}>
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              {(!location.gallery_images || location.gallery_images.length === 0) && (
                <p className="page-subtitle">No images uploaded yet.</p>
              )}
            </div>
          </div>

          {form.parking_mode === "slot_based" && (
            <div className="card owner-form-section">
              <h2>Floor & Slot Management</h2>
              <form className="owner-inline-form" onSubmit={handleAddFloor}>
                <input
                  className="input"
                  placeholder="Floor name (e.g. Ground Floor)"
                  value={newFloor.name}
                  onChange={(e) => setNewFloor({ ...newFloor, name: e.target.value })}
                />
                <input
                  className="input owner-level-input"
                  type="number"
                  placeholder="Level"
                  value={newFloor.level}
                  onChange={(e) => setNewFloor({ ...newFloor, level: e.target.value })}
                />
                <button type="submit" className="btn btn-outline btn-sm"><FiPlusCircle /> Add Floor</button>
              </form>

              {location.floors?.map((floor) => (
                <div key={floor.id} className="owner-floor-block">
                  <div className="owner-floor-head">
                    <strong>{floor.name}</strong>
                    <span className="page-subtitle">{floor.available_slots} / {floor.total_slots} available</span>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteFloor(floor.id)}>
                      <FiTrash2 /> Remove Floor
                    </button>
                  </div>

                  <div className="owner-generate-block">
                    <p className="form-label">Auto-Generate Slots</p>
                    <form className="owner-inline-form" onSubmit={(e) => handleGenerateSlots(e, floor.id)}>
                      <input
                        className="input owner-level-input"
                        placeholder="Prefix (e.g. A)"
                        maxLength={6}
                        value={generateForm[floor.id]?.prefix ?? ""}
                        onChange={(e) =>
                          setGenerateForm({ ...generateForm, [floor.id]: { ...generateForm[floor.id], prefix: e.target.value } })
                        }
                      />
                      <input
                        className="input owner-level-input"
                        type="number"
                        min="1"
                        max="50"
                        placeholder="Rows"
                        value={generateForm[floor.id]?.rows ?? ""}
                        onChange={(e) =>
                          setGenerateForm({ ...generateForm, [floor.id]: { ...generateForm[floor.id], rows: e.target.value } })
                        }
                      />
                      <input
                        className="input owner-level-input"
                        type="number"
                        min="1"
                        max="50"
                        placeholder="Columns"
                        value={generateForm[floor.id]?.cols ?? ""}
                        onChange={(e) =>
                          setGenerateForm({ ...generateForm, [floor.id]: { ...generateForm[floor.id], cols: e.target.value } })
                        }
                      />
                      <select
                        className="input"
                        value={generateForm[floor.id]?.vehicleType ?? "car"}
                        onChange={(e) =>
                          setGenerateForm({ ...generateForm, [floor.id]: { ...generateForm[floor.id], vehicleType: e.target.value } })
                        }
                      >
                        {SLOT_VEHICLE_TYPE_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                      </select>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={generating === floor.id}>
                        {generating === floor.id ? "Generating..." : "Generate Layout"}
                      </button>
                    </form>
                    {generateForm[floor.id]?.rows > 0 && generateForm[floor.id]?.cols > 0 && (
                      <p className="page-subtitle">
                        Will create {Number(generateForm[floor.id].rows) * Number(generateForm[floor.id].cols)} slots
                        ({(generateForm[floor.id].prefix || "").trim()}
                        {String(1).padStart(Math.max(2, String(Number(generateForm[floor.id].rows) * Number(generateForm[floor.id].cols)).length), "0")}
                        {" – "}
                        {(generateForm[floor.id].prefix || "").trim()}
                        {String(Number(generateForm[floor.id].rows) * Number(generateForm[floor.id].cols)).padStart(
                          Math.max(2, String(Number(generateForm[floor.id].rows) * Number(generateForm[floor.id].cols)).length), "0"
                        )}
                        ).
                      </p>
                    )}
                    {generateError[floor.id] && <div className="form-error">{generateError[floor.id]}</div>}
                  </div>

                  <OwnerSlotGrid locationId={location.id} floor={floor} onChanged={refreshLocation} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
