"use client";

import type { ApexOptions } from "apexcharts";
import { ReactApexChart } from "./react-apex-chart";

const DEFAULT_COLORS = ["#0F8A4B", "#34D399", "#D97706", "#DC2626", "#7C3AED", "#6B7A94"];

export function DonutChart({
  labels,
  values,
  colors = DEFAULT_COLORS,
  height = 240,
  valueFormatter,
}: {
  labels: string[];
  values: number[];
  colors?: string[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const options: ApexOptions = {
    chart: { type: "donut", fontFamily: "Inter, sans-serif", toolbar: { show: false } },
    labels,
    colors,
    legend: {
      position: "bottom",
      fontSize: "12px",
      fontWeight: 600,
      labels: { colors: "#2D3748" },
      markers: { size: 7 },
      itemMargin: { horizontal: 10, vertical: 4 },
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: "11px", fontWeight: 700, colors: ["#ffffff"] },
      dropShadow: { enabled: false },
      formatter: (val) => `${Number(val).toFixed(0)}%`,
    },
    stroke: { width: 2, colors: ["#ffffff"] },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Total",
              fontSize: "12px",
              fontWeight: 600,
              color: "#6B7A94",
              formatter: (w) => {
                const sum = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                return valueFormatter ? valueFormatter(sum) : sum.toLocaleString();
              },
            },
            value: {
              fontSize: "22px",
              fontWeight: 700,
              color: "#0A0E1A",
              formatter: (val) => (valueFormatter ? valueFormatter(Number(val)) : Number(val).toLocaleString()),
            },
          },
        },
      },
    },
    tooltip: { y: { formatter: (val) => (valueFormatter ? valueFormatter(val) : val.toLocaleString()) } },
  };

  return <ReactApexChart options={options} series={values} type="donut" height={height} />;
}
