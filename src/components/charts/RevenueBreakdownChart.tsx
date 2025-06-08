
"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell, Legend, Tooltip } from "recharts"

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export interface RevenueSourceData {
  name: string;
  value: number;
  color: string; // HSL color string
}

interface RevenueBreakdownChartProps {
  data: RevenueSourceData[];
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

export function RevenueBreakdownChart({ data }: RevenueBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No revenue breakdown data to display.
        </div>
    );
  }

  const chartConfig = data.reduce((acc, item) => {
    acc[item.name] = { label: item.name, color: item.color };
    return acc;
  }, {} as ChartConfig);


  const totalValue = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.value, 0)
  }, [data])

  return (
    <ChartContainer
      config={chartConfig}
      className="h-full w-full" // Fill parent height/width
    >
      <div className="flex h-full w-full items-center">
        <ResponsiveContainer width="60%" height="100%">
          <PieChart>
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth:1 }}
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="name"
                  formatter={(value, name, item) => (
                    <>
                      <div
                        className="flex items-center gap-2 font-medium leading-none text-foreground"
                      >
                        {item.payload.name}: {formatCurrency(item.payload.value as number)}
                      </div>
                      <div className="flex items-center gap-2 leading-none text-muted-foreground">
                        ({((item.payload.value / totalValue) * 100).toFixed(1)}%)
                      </div>
                    </>
                  )}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="50%" 
              outerRadius="80%" 
              strokeWidth={2}
              labelLine={false}
              label={({
                cx,
                cy,
                midAngle,
                innerRadius,
                outerRadius,
                value,
                index,
                percent
              }) => {
                const RADIAN = Math.PI / 180
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5; // Label inside segment
                const x = cx + radius * Math.cos(-midAngle * RADIAN)
                const y = cy + radius * Math.sin(-midAngle * RADIAN)

                if (percent < 0.08) return null; // Hide label for very small segments

                return (
                  <text
                    x={x}
                    y={y}
                    className="fill-background text-[9px] sm:text-[10px] font-medium"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                )
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="w-2/5 h-full flex flex-col justify-center pl-3 pr-1 text-xs">
            <ul className="space-y-1">
                {data.map((entry) => (
                    <li key={entry.name} className="flex items-center gap-1.5">
                        <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate flex-1">{entry.name}</span>
                        <span className="font-medium text-muted-foreground">
                            ({((entry.value / totalValue) * 100).toFixed(0)}%)
                        </span>
                    </li>
                ))}
            </ul>
        </div>
      </div>
    </ChartContainer>
  )
}
