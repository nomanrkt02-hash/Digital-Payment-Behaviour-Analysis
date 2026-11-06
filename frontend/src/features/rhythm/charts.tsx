import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useData } from "./data";
const month = (s: string) =>
  new Date(s + "-01").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
export function ReturnTrend({ from, until }: { from?: string; until?: string }) {
  const SAMPLE_DATA = useData();
  const fromMonth = from ?? String(SAMPLE_DATA.summary.date_min || "").slice(0, 7);
  const untilMonth =
    until ??
    String(SAMPLE_DATA.summary.snapshot_date || SAMPLE_DATA.summary.date_max || "").slice(0, 7);
  const data = SAMPLE_DATA.analytics.return_trend
    .filter((d) => d.snapshot >= fromMonth && d.snapshot <= untilMonth)
    .map((d) => ({ ...d, rate: Math.round(d.return_rate * 100), label: month(d.snapshot) }));
  return (
    <div className="chart-height">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 16, top: 16, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            dy={8}
          />
          <YAxis
            width={42}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
            }}
            formatter={(v: number) => [`${v}%`, "Observed return rate"]}
            labelFormatter={(_, items) => items[0]?.payload.snapshot ?? ""}
          />
          <Line
            type="monotone"
            dataKey="rate"
            stroke="var(--primary)"
            strokeWidth={3}
            dot={{ r: 4, fill: "var(--card)", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Distribution() {
  const SAMPLE_DATA = useData();
  const data = SAMPLE_DATA.analytics.status_distribution.slice(0, 3);
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data}
            dataKey="customers"
            innerRadius={66}
            outerRadius={85}
            paddingAngle={5}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {["risk", "active", "loyal"].map((c) => (
              <Cell key={c} fill={`var(--${c})`} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [v, "Customers"]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-label">
        <strong>{SAMPLE_DATA.summary.total_customers.toLocaleString()}</strong>
        <span>customers</span>
      </div>
    </div>
  );
}
export function MonthlyChart() {
  const SAMPLE_DATA = useData();
  return (
    <div className="chart-height">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={SAMPLE_DATA.analytics.monthly_activity.map((d) => ({
            ...d,
            label: month(d.month),
          }))}
          margin={{ left: -15, right: 8, top: 10 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            contentStyle={{ borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
          />
          <Bar
            dataKey="orders"
            name="Orders"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
