
"use client"

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell, Legend, Tooltip } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
      className="mx-auto aspect-square max-h-[300px] sm:max-h-[350px]" // Adjusted max-h for better fit
    >
      <ResponsiveContainer width="100%" height="100%">
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
            innerRadius="30%" // Makes it a donut chart
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
            }) => {
              const RADIAN = Math.PI / 180
              const radius = 12 + innerRadius + (outerRadius - innerRadius)
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)

              if (data[index].value / totalValue < 0.05) return null; // Hide small labels

              return (
                <text
                  x={x}
                  y={y}
                  className="fill-muted-foreground text-xs"
                  textAnchor={x > cx ? "start" : "end"}
                  dominantBaseline="central"
                >
                  {data[index].name} ({(value / totalValue * 100).toFixed(0)}%)
                </text>
              )
            }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={40}
            content={({ payload }) => {
              return (
                <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
                  {payload?.map((entry, index) => (
                     <li key={`legend-${index}`} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      {entry.value}
                    </li>
                  ))}
                </ul>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
