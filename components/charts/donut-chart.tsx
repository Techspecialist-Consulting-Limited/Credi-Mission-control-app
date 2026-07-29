"use client";

import type { ApexOptions } from "apexcharts";
import { ReactApexChart } from "./react-apex-chart";

const DEFAULT_COLORS = ["#27ae60", "#5b7cfa", "#f59e0b", "#ef4444", "#a855f7", "#64748b"];

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
    chart: { type: "donut", fontFamily: "var(--font-manrope), sans-serif", toolbar: { show: false } },
    labels,
    colors,
    legend: {
      position: "bottom",
      fontSize: "12.5px",
      fontWeight: 600,
      labels: { colors: "#374151" },
      markers: { size: 7 },
      itemMargin: { horizontal: 10, vertical: 4 },
    },
    dataLabels: { enabled: false },
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
              color: "#374151",
              formatter: (w) => {
                const sum = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                return valueFormatter ? valueFormatter(sum) : sum.toLocaleString();
              },
            },
            value: {
              fontSize: "22px",
              fontWeight: 700,
              color: "#111827",
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
