"use client";

import type { ApexOptions } from "apexcharts";
import { ReactApexChart } from "./react-apex-chart";

export function BarChart({
  categories,
  values,
  color = "#0D7A42",
  height = 240,
  horizontal = false,
  valueFormatter,
}: {
  categories: string[];
  values: number[];
  color?: string;
  height?: number;
  horizontal?: boolean;
  valueFormatter?: (value: number) => string;
}) {
  const maxValue = values.length ? Math.max(...values) : 1;
  const tickAmount = Math.max(1, Math.min(maxValue, 8));

  const options: ApexOptions = {
    chart: { type: "bar", fontFamily: "var(--font-sans)", toolbar: { show: false } },
    plotOptions: {
      bar: {
        horizontal,
        borderRadius: 5,
        borderRadiusApplication: "end",
        ...(horizontal ? { barHeight: "62%" } : { columnWidth: "55%" }),
        distributed: false,
        dataLabels: { position: "top" },
      },
    },
    colors: [color],
    dataLabels: {
      enabled: true,
      offsetY: horizontal ? 0 : -18,
      offsetX: horizontal ? 6 : 0,
      style: { fontSize: "10.5px", fontWeight: 700, colors: ["#0A0E1A"] },
      formatter: (val) => (valueFormatter ? valueFormatter(Number(val)) : Math.round(Number(val)).toLocaleString()),
    },
    grid: {
      borderColor: "rgba(10,14,26,0.08)",
      strokeDashArray: 3,
      yaxis: { lines: { show: !horizontal } },
      xaxis: { lines: { show: horizontal } },
      padding: { top: horizontal ? 0 : 20 },
    },
    xaxis: {
      categories,
      tickAmount: horizontal ? tickAmount : undefined,
      labels: {
        style: { colors: "#5A6880", fontSize: "11.5px", fontWeight: 600 },
        formatter: horizontal ? (val) => (valueFormatter ? valueFormatter(Number(val)) : Math.round(Number(val)).toLocaleString()) : undefined,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      tickAmount: horizontal ? undefined : tickAmount,
      labels: {
        style: { colors: "#5A6880", fontSize: "11.5px", fontWeight: 600 },
        formatter: horizontal ? undefined : (val) => (valueFormatter ? valueFormatter(val) : Math.round(val).toLocaleString()),
      },
    },
    tooltip: { y: { formatter: (val) => (valueFormatter ? valueFormatter(val) : val.toLocaleString()) } },
  };

  return <ReactApexChart options={options} series={[{ name: "Value", data: values }]} type="bar" height={height} />;
}
