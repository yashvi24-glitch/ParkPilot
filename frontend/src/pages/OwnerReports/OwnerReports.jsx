import { useEffect, useState } from "react";
import {
  FiCalendar, FiClock, FiDollarSign, FiPercent, FiRepeat, FiUsers,
} from "react-icons/fi";
import {
  getOwnerBookingTrends,
  getOwnerFloorPerformance,
  getOwnerOccupancyWeekday,
  getOwnerParkingPerformance,
  getOwnerPeakHours,
  getOwnerReportsSummary,
  getOwnerRevenueAnalytics,
  getOwnerVehicleDistribution,
} from "../../api/owner";
import { OwnerBarChart, OwnerLineChart, OwnerPieChart } from "../../components/OwnerCharts";
import "../../styles/owner-shared.css";

const SUMMARY_CARDS = [
  { key: "total_revenue", label: "Total Revenue", icon: FiDollarSign, prefix: "₹", iconClass: "revenue" },
  { key: "total_customers", label: "Total Customers", icon: FiUsers },
  { key: "total_bookings", label: "Total Bookings", icon: FiCalendar },
  { key: "active_bookings", label: "Active Bookings", icon: FiClock },
  { key: "avg_parking_duration", label: "Avg. Duration (hrs)", icon: FiClock },
  { key: "occupancy_pct", label: "Occupancy", icon: FiPercent, suffix: "%" },
  { key: "returning_customers", label: "Returning Customers", icon: FiRepeat },
];

const RANGES = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

function RangeSwitcher({ value, onChange }) {
  return (
    <div className="owner-range-row">
      {RANGES.map((r) => (
        <button key={r.key} className={"owner-range-btn" + (value === r.key ? " active" : "")} onClick={() => onChange(r.key)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export default function OwnerReports() {
  const [summary, setSummary] = useState(null);
  const [revenueRange, setRevenueRange] = useState("daily");
  const [revenue, setRevenue] = useState([]);
  const [trendRange, setTrendRange] = useState("daily");
  const [trends, setTrends] = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [parkingPerf, setParkingPerf] = useState([]);
  const [floorPerf, setFloorPerf] = useState([]);

  useEffect(() => { getOwnerReportsSummary().then(setSummary); }, []);
  useEffect(() => { getOwnerRevenueAnalytics(revenueRange).then((d) => setRevenue(d.data)); }, [revenueRange]);
  useEffect(() => { getOwnerBookingTrends(trendRange).then((d) => setTrends(d.data)); }, [trendRange]);
  useEffect(() => {
    getOwnerOccupancyWeekday().then((d) => setOccupancy(d.map((r) => ({ name: r.day.slice(0, 3), occupancy_pct: r.occupancy_pct }))));
    getOwnerPeakHours().then((d) => setPeakHours(d.filter((_, i) => i >= 6 && i <= 22).map((r) => ({ name: r.hour, bookings: r.bookings }))));
    getOwnerVehicleDistribution().then(setVehicles);
    getOwnerParkingPerformance().then((d) => setParkingPerf(d.map((r) => ({ name: r.name, revenue: r.revenue }))));
    getOwnerFloorPerformance().then((d) => setFloorPerf(d.map((r) => ({ name: `${r.parking_name} — ${r.name}`, occupancy_pct: r.occupancy_pct }))));
  }, []);

  return (
    <div className="owner-reports fade-in">
      <h1>Reports &amp; Analytics</h1>
      <p className="page-subtitle">Detailed business insights across all your parking facilities.</p>

      {summary && (
        <div className="owner-stat-grid">
          {SUMMARY_CARDS.map(({ key, label, icon: Icon, prefix, suffix, iconClass }) => (
            <div key={key} className="card owner-stat-card">
              <span className={`owner-stat-icon ${iconClass || ""}`}><Icon /></span>
              <div>
                <div className="owner-stat-value">{prefix || ""}{summary[key]}{suffix || ""}</div>
                <div className="owner-stat-label">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="owner-dashboard-section-title">Revenue Analytics</h2>
      <RangeSwitcher value={revenueRange} onChange={setRevenueRange} />
      <OwnerBarChart title="Revenue Over Time" data={revenue} dataKey="period" valueKey="value" formatValue={(v) => `₹${v}`} />

      <h2 className="owner-dashboard-section-title">Booking Trends</h2>
      <RangeSwitcher value={trendRange} onChange={setTrendRange} />
      <OwnerLineChart title="Bookings Over Time" data={trends} />

      <div className="owner-charts-grid">
        <OwnerBarChart title="Occupancy by Day of Week" subtitle="Based on bookings over the last 90 days, relative to capacity" data={occupancy} valueKey="occupancy_pct" formatValue={(v) => `${v}%`} />
        <OwnerBarChart title="Peak Hours" subtitle="Bookings by entry-time hour" data={peakHours} valueKey="bookings" />
        <OwnerPieChart title="Vehicle Distribution" data={vehicles} />
        <OwnerBarChart title="Parking Facility Performance" subtitle="Ranked by revenue" data={parkingPerf} valueKey="revenue" layout="vertical" formatValue={(v) => `₹${v}`} />
      </div>

      <OwnerBarChart title="Floor Performance" subtitle="Live occupancy by floor, Slot-Based facilities" data={floorPerf} valueKey="occupancy_pct" layout="vertical" formatValue={(v) => `${v}%`} />
    </div>
  );
}
