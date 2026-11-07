"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

interface CategoryBarChartProps {
  data: { label: string; minutes: number }[];
}

export function CategoryBarChart({ data }: CategoryBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#E7E9EB" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#5A636B" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: "#1A1D1F" }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip
          formatter={(value: number) => [`${Math.round(value)} min`, "Time"]}
          contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#C9CDD1" }}
        />
        <Bar dataKey="minutes" fill="#2F6E5E" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
