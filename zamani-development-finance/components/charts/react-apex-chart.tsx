"use client";

import dynamic from "next/dynamic";

export const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-secondary/60" />,
});
