import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./OwnerCharts.css";

// Validated (dataviz skill, --mode light): categorical pair for the one
// 2-series chart in this phase (Vehicle Distribution: Car/Bike). CVD
// separation lands in the 6-8 "legal with secondary encoding" band, which is
// why every slice/legend entry here also carries a direct text label.
const CATEGORICAL = ["#7d35ff", "#3b82f6"];
const PRIMARY = "#7d35ff";
const GRID = "#ece6fb";
const AXIS_TEXT = "#6b6580";

function ChartCard({ title, subtitle, children, empty }) {
  return (
    <div className="card owner-chart-card">
      <h3>{title}</h3>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
      {empty ? <div className="owner-chart-empty">No data yet.</div> : children}
    </div>
  );
}

function ChartTooltip({ active, payload, label, formatValue }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="owner-chart-tooltip">
      <div className="owner-chart-tooltip-label">{label}</div>
      <div className="owner-chart-tooltip-value">{formatValue ? formatValue(payload[0].value) : payload[0].value}</div>
    </div>
  );
}

export function OwnerLineChart({ title, subtitle, data, dataKey = "period", valueKey = "value", formatValue }) {
  const isEmpty = !data || data.every((d) => !d[valueKey]);
  return (
    <ChartCard title={title} subtitle={subtitle} empty={isEmpty}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={dataKey} tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={40} />
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
          <Line
            type="monotone" dataKey={valueKey} stroke={PRIMARY} strokeWidth={2}
            dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }} activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OwnerBarChart({ title, subtitle, data, dataKey = "name", valueKey = "value", formatValue, layout = "horizontal" }) {
  const isEmpty = !data || data.length === 0 || data.every((d) => !d[valueKey]);
  return (
    <ChartCard title={title} subtitle={subtitle} empty={isEmpty}>
      <ResponsiveContainer width="100%" height={Math.max(260, layout === "vertical" ? data?.length * 34 : 0)}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} horizontal={layout === "horizontal"} vertical={layout === "vertical"} />
          {layout === "horizontal" ? (
            <>
              <XAxis dataKey={dataKey} tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={40} />
            </>
          ) : (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey={dataKey} tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={110} />
            </>
          )}
          <Tooltip content={<ChartTooltip formatValue={formatValue} />} cursor={{ fill: "rgba(125,53,255,0.06)" }} />
          <Bar dataKey={valueKey} fill={PRIMARY} radius={layout === "vertical" ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OwnerPieChart({ title, subtitle, data, dataKey = "count", nameKey = "type" }) {
  const isEmpty = !data || data.length === 0 || data.every((d) => !d[dataKey]);
  return (
    <ChartCard title={title} subtitle={subtitle} empty={isEmpty}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data} dataKey={dataKey} nameKey={nameKey}
            cx="50%" cy="50%" innerRadius={55} outerRadius={90}
            paddingAngle={2}
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={false}
          >
            {data?.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} stroke="#fff" strokeWidth={2} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {!isEmpty && (
        <div className="owner-chart-legend">
          {data.map((d, i) => (
            <span key={i} className="owner-chart-legend-item">
              <span className="owner-chart-legend-dot" style={{ background: CATEGORICAL[i % CATEGORICAL.length] }} />
              {d[nameKey]}
            </span>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
