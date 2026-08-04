import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBooking, markFoundCar } from "../../api/bookings";
import { getFloorSlots, getParkingFloors } from "../../api/parking";
import IsometricParkingView from "../../components/IsometricParkingView";
import "./ParkingArrival3D.css";

export default function ParkingArrival3D() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [floors, setFloors] = useState([]);
  const [currentFloor, setCurrentFloor] = useState(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    getBooking(bookingId).then(async (b) => {
      setBooking(b);
      const floorList = await getParkingFloors(b.parking_id);
      setFloors(floorList);
      const activeFloor = floorList.find((f) => f.id === b.floor_id) || floorList[0];
      loadFloor(b.parking_id, activeFloor);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const loadFloor = (parkingId, floor) => {
    getFloorSlots(parkingId, floor.id).then(setCurrentFloor);
  };

  const handleFoundCar = async () => {
    setMarking(true);
    try {
      await markFoundCar(bookingId);
      navigate("/app");
    } finally {
      setMarking(false);
    }
  };

  if (!booking || !currentFloor) return <div className="skeleton" style={{ height: 420 }} />;

  return (
    <div className="parking-arrival fade-in">
      <h1>Your Car Location</h1>
      <p className="page-subtitle">{booking.parking_name}</p>

      <IsometricParkingView
        floors={floors}
        currentFloor={currentFloor}
        onFloorChange={(f) => loadFloor(booking.parking_id, f)}
        highlightSlotId={booking.slot}
      />

      <div className="arrival-actions">
        <button className="btn btn-outline btn-block" onClick={() => navigate("/find-my-car")}>
          Back to Find My Car
        </button>
        <button className="btn btn-primary btn-block" onClick={handleFoundCar} disabled={marking}>
          {marking ? "Please wait..." : "I Have Found My Car"}
        </button>
      </div>
    </div>
  );
}
