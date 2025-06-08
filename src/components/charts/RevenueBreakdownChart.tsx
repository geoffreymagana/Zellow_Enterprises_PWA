
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
      className="mx-auto aspect-square max-h-[280px] sm:max-h-[320px] md:max-h-[350px]" 
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
            innerRadius="30%" 
            outerRadius="70%" 
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
              
              const radius = outerRadius + 15 
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)

              
              if (percent < 0.05) return null; 

              return (
                <text
                  x={x}
                  y={y}
                  className="fill-muted-foreground text-[9px] sm:text-[10px]" 
                  textAnchor={x > cx ? "start" : "end"}
                  dominantBaseline="central"
                >
                  {`${data[index].name} (${(percent * 100).toFixed(0)}%)`}
                </text>
              )
            }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            layout="vertical"
            verticalAlign="middle"
            align="right"
            wrapperStyle={{ paddingLeft: "10px", fontSize: "10px" }} 
            iconSize={10}
            content={({ payload }) => {
              return (
                <ul className="flex flex-col gap-y-1 text-xs">
                  {payload?.map((entry, index) => (
                     <li key={`legend-${index}`} className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      {entry.value} ({((entry.payload?.value / totalValue) * 100).toFixed(0)}%)
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


    