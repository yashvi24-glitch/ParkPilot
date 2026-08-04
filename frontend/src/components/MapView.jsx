import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./MapView.css";

export function createPinIcon(color = "#7d35ff") {
  return L.divIcon({
    className: "map-pin",
    html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.3 17 27 17 27s17-14.7 17-27C34 7.6 26.4 0 17 0z" fill="${color}"/>
      <circle cx="17" cy="17" r="7" fill="#fff"/>
    </svg>`,
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -40],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  if (points.length > 1) {
    map.fitBounds(points, { padding: [40, 40] });
  } else if (points.length === 1) {
    map.setView(points[0], 15);
  }
  return null;
}

function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({ markers = [], routeCoords = [], height = 320, fitToMarkers = true, onMapClick }) {
  const center = markers[0] ? [markers[0].lat, markers[0].lng] : [23.0326, 72.5061];
  const fitPoints = [...markers.map((m) => [m.lat, m.lng]), ...routeCoords];

  return (
    <div className="map-view" style={{ height }}>
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m, i) => (
          <Marker key={i} position={[m.lat, m.lng]} icon={createPinIcon(m.color)} />
        ))}
        {routeCoords.length > 1 && (
          <Polyline positions={routeCoords} pathOptions={{ color: "#7d35ff", weight: 5, opacity: 0.85 }} />
        )}
        {fitToMarkers && fitPoints.length > 0 && <FitBounds points={fitPoints} />}
        {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      </MapContainer>
    </div>
  );
}
