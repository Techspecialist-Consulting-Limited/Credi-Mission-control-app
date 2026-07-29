"use client";

import type { ApexOptions } from "apexcharts";
import { ReactApexChart } from "./react-apex-chart";

export function ScatterChart({
  points,
  height = 260,
  xLabel,
  yFormatter,
}: {
  points: { x: number; y: number; outlier: boolean }[];
  height?: number;
  xLabel?: string;
  yFormatter?: (value: number) => string;
}) {
  const options: ApexOptions = {
    chart: { type: "scatter", fontFamily: "var(--font-manrope), sans-serif", toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 3 },
    xaxis: {
      type: "numeric",
      title: xLabel ? { text: xLabel, style: { fontSize: "11px", fontWeight: 600, color: "#374151" } } : undefined,
      labels: { style: { colors: "#374151", fontSize: "11px", fontWeight: 600 } },
    },
    yaxis: {
      labels: {
        style: { colors: "#374151", fontSize: "11px", fontWeight: 600 },
        formatter: (val) => (yFormatter ? yFormatter(val) : val.toLocaleString()),
      },
    },
    tooltip: {
      y: { formatter: (val) => (yFormatter ? yFormatter(val) : val.toLocaleString()) },
    },
  };

  const normal = points.filter((p) => !p.outlier).map((p) => ({ x: p.x, y: p.y }));
  const outliers = points.filter((p) => p.outlier).map((p) => ({ x: p.x, y: p.y }));

  return (
    <ReactApexChart
      options={{
        ...options,
        colors: ["#0F172A", "#EF4444"],
        legend: { position: "top", horizontalAlign: "left", fontSize: "12px", fontWeight: 600 },
      }}
      series={[
        { name: "Within range", data: normal },
        { name: "Cost outlier (IQR)", data: outliers },
      ]}
      type="scatter"
      height={height}
    />
  );
}
