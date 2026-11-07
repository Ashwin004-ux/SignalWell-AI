"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface Series {
  key: string;
  label: string;
  color: string;
}

interface MultiTrendChartProps {
  data: Record<string, string | number | null>[];
  series: Series[];
}

export function MultiTrendChart({ data, series }: MultiTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#E7E9EB" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5A636B" }} axisLine={{ stroke: "#C9CDD1" }} tickLine={false} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#5A636B" }} axisLine={false} tickLine={false} width={24} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#C9CDD1" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 2.5, fill: s.color }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
