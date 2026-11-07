"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface TrendChartProps {
  data: { label: string; value: number | null }[];
  valueLabel: string;
  color?: string;
  valueFormatter?: "minutesToHours" | "raw";
}

/**
 * A single-series trend line. Callers are responsible for deciding whether
 * there's enough real data to be worth rendering — this component does not
 * fabricate points for missing days.
 */
export function TrendChart({ data, valueLabel, color = "#2F6E5E", valueFormatter = "raw" }: TrendChartProps) {
  const formatValue = (v: number) => {
    if (valueFormatter === "minutesToHours") return `${Math.round(v / 60)}h`;
    return String(v);
  };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#E7E9EB" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#5A636B" }}
          axisLine={{ stroke: "#C9CDD1" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#5A636B" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatValue}
          width={48}
        />
        <Tooltip
          formatter={(value: number) => [formatValue(value), valueLabel]}
          contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#C9CDD1" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={valueLabel}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
