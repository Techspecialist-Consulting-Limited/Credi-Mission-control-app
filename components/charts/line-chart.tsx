"use client";

import type { ApexOptions } from "apexcharts";
import { ReactApexChart } from "./react-apex-chart";

export function LineChart({
  categories,
  values,
  color = "#27ae60",
  height = 240,
  valueFormatter,
}: {
  categories: string[];
  values: number[];
  color?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const options: ApexOptions = {
    chart: { type: "area", fontFamily: "var(--font-manrope), sans-serif", toolbar: { show: false }, zoom: { enabled: false } },
    colors: [color],
    stroke: { curve: "smooth", width: 2.5 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0, stops: [0, 90, 100] },
    },
    dataLabels: { enabled: false },
    grid: { borderColor: "#e5e7eb", strokeDashArray: 3 },
    markers: { size: 3.5, colors: [color], strokeWidth: 0, hover: { size: 5 } },
    xaxis: {
      categories,
      labels: { style: { colors: "#374151", fontSize: "11px", fontWeight: 600 } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#374151", fontSize: "11.5px", fontWeight: 600 },
        formatter: (val) => (valueFormatter ? valueFormatter(val) : Math.round(val).toLocaleString()),
      },
    },
    tooltip: { y: { formatter: (val) => (valueFormatter ? valueFormatter(val) : val.toLocaleString()) } },
  };

  return (
    <ReactApexChart
      options={options}
      series={[{ name: "Value", data: values }]}
      type="area"
      height={height}
    />
  );
}
