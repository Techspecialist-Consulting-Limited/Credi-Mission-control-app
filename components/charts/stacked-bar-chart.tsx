"use client";

import type { ApexOptions } from "apexcharts";
import { ReactApexChart } from "./react-apex-chart";

export function StackedBarChart({
  categories,
  series,
  height = 280,
  horizontal = false,
  valueFormatter,
}: {
  categories: string[];
  series: { name: string; data: number[]; color: string }[];
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (value: number) => string;
}) {
  const options: ApexOptions = {
    chart: { type: "bar", stacked: true, fontFamily: "var(--font-manrope), sans-serif", toolbar: { show: false } },
    plotOptions: {
      bar: { horizontal, borderRadius: 4, borderRadiusApplication: "end", ...(horizontal ? { barHeight: "60%" } : { columnWidth: "55%" }) },
    },
    colors: series.map((s) => s.color),
    dataLabels: { enabled: false },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 3 },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", fontWeight: 600 },
    xaxis: {
      categories,
      labels: {
        style: { colors: "#374151", fontSize: "11.5px", fontWeight: 600 },
        formatter: horizontal ? (val) => (valueFormatter ? valueFormatter(Number(val)) : Math.round(Number(val)).toLocaleString()) : undefined,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#374151", fontSize: "11.5px", fontWeight: 600 },
        formatter: horizontal ? undefined : (val) => (valueFormatter ? valueFormatter(val) : Math.round(val).toLocaleString()),
      },
    },
    tooltip: { y: { formatter: (val) => (valueFormatter ? valueFormatter(val) : val.toLocaleString()) } },
  };

  return <ReactApexChart options={options} series={series} type="bar" height={height} />;
}
