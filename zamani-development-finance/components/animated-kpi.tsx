"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, type Variants } from "framer-motion";

/** Animates a plain integer or percentage (e.g. "48", "81%") counting up from 0
 * on first view. Anything else (currency strings, day counts with text) renders
 * statically - re-deriving the raw number from an arbitrary formatted string
 * risks a wrong intermediate frame. */
function useCountUpText(value: string): { display: string; ref: React.RefObject<HTMLSpanElement | null> } {
  const ref = useRef<HTMLSpanElement>(null);
  const match = /^(-?[\d,]+(?:\.\d+)?)(%?)$/.exec(value.trim());
  const target = match ? Number(match[1].replace(/,/g, "")) : null;
  const suffix = match?.[2] ?? "";
  const decimals = match && match[1].includes(".") ? match[1].split(".")[1].length : 0;
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(target === null ? value : `0${suffix}`);

  useEffect(() => {
    if (target === null || !inView) return;
    const duration = 700;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(`${(eased * target).toFixed(decimals)}${suffix}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, target]);

  return { display, ref };
}

export function AnimatedNumber({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const { display, ref } = useCountUpText(value);
  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {display}
    </span>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function AnimatedGrid({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-10% 0px" }} className={className} style={style}>
      {children}
    </motion.div>
  );
}

export function AnimatedGridItem({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <motion.div
      variants={item}
      whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(10,14,26,0.1)" }}
      transition={{ duration: 0.2 }}
      style={style}
    >
      {children}
    </motion.div>
  );
}
