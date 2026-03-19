"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ActivityDataPoint {
  label: string;
  value: number;
}

interface ActivityChartProps {
  title?: string;
  totalLabel: string;
  totalValue: string | number;
  data: ActivityDataPoint[];
  className?: string;
  barColor?: string;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function ActivityChart({
  title = "Активность",
  totalLabel,
  totalValue,
  data,
  className,
  barColor = "var(--color-accent)",
}: ActivityChartProps) {
  const maxValue = useMemo(
    () => data.reduce((max, item) => (item.value > max ? item.value : max), 0),
    [data]
  );

  return (
    <div className={cn("glass-panel rounded-[1.5rem] px-6 py-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[0.6rem] uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
          {title}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Total */}
        <div className="shrink-0">
          <div className="display-title text-[2.4rem] leading-none text-[var(--color-text)]">
            {totalValue}
          </div>
          <div className="mt-1 text-[0.66rem] text-[var(--color-text-muted)]">
            {totalLabel}
          </div>
        </div>

        {/* Bars */}
        <motion.div
          className="flex h-24 w-full items-end justify-between gap-1.5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.08 },
            },
          }}
        >
          {data.map((item, index) => (
            <div
              key={index}
              className="flex h-full w-full flex-col items-center justify-end gap-1.5"
            >
              <motion.div
                className="w-full rounded-md"
                style={{
                  height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`,
                  background: item.value > 0 ? barColor : 'rgb(201 184 154 / 0.08)',
                  minHeight: item.value > 0 ? '4px' : '2px',
                }}
                variants={{
                  hidden: { scaleY: 0, opacity: 0, transformOrigin: "bottom" },
                  visible: {
                    scaleY: 1,
                    opacity: 1,
                    transformOrigin: "bottom",
                    transition: { duration: 0.5, ease: EASE },
                  },
                }}
              />
              <span className="text-[0.5rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                {item.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
