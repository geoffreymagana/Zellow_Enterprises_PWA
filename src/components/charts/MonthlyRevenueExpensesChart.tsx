
"use client"

import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react"
import { AreaChart, Area, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts"

import {
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export interface DailyDataPoint {
  day: string; // e.g., "Jun 01"
  revenue: number;
  expenses: number;
}

interface MonthlyRevenueExpensesChartProps {
  dailyData: DailyDataPoint[];
  overallCumulativeNetProfit: number;
  latestMonthNetChange: number;
  latestMonthLabel: string;
}

const chartConfig = {
  revenue: {
    label: "Monthly Revenue",
    color: "hsl(var(--chart-2))", // Greenish accent
  },
  expenses: {
    label: "Monthly Expenses",
    color: "hsl(var(--destructive))", // Red
  },
} satisfies ChartConfig

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const formatCurrencyWithDecimals = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

export function MonthlyRevenueExpensesChart({ dailyData, overallCumulativeNetProfit, latestMonthNetChange, latestMonthLabel }: MonthlyRevenueExpensesChartProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No daily data available for the selected month.
        </div>
    );
  }

  // Prepend a "Previous Month" data point if only one actual month's data is present,
  // so the line/area has a starting point from zero or the previous month's end.
  let processedData = [...dailyData];
  if (dailyData.length === 1) {
    processedData = [
      { day: "Start", revenue: 0, expenses: 0 }, // Dummy point
      ...dailyData,
    ];
  }


  return (
    <ChartContainer config={chartConfig} className="flex flex-col h-full w-full">
        <div className="flex items-start justify-between gap-4 px-1 pb-2 pt-0 flex-shrink-0">
            <div className="grid gap-1">
            <CardTitle className="text-2xl sm:text-3xl flex items-baseline gap-1">
                {formatCurrency(overallCumulativeNetProfit)}
                <span className="text-sm font-normal text-muted-foreground">
                Total Balance
                </span>
            </CardTitle>
            <div className="flex items-center gap-1 text-sm">
                {latestMonthNetChange >= 0 ? (
                <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span className={latestMonthNetChange >= 0 ? "text-green-500" : "text-red-500"}>
                {formatCurrencyWithDecimals(latestMonthNetChange)}
                </span>
                <span className="text-muted-foreground">
                in {latestMonthLabel}
                </span>
            </div>
            </div>
        </div>
      <ResponsiveContainer width="100%" height="100%" className="flex-grow">
        <AreaChart
            accessibilityLayer
            data={processedData}
            margin={{
                left: 10, // Adjusted left margin
                right: 15, 
                top: 5,
                bottom: 5,
            }}
        >
            <defs>
                <linearGradient id="fillRevenueDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.7}/>
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="fillExpensesDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.1}/>
                </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickLine={true}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
              interval={processedData.length > 15 ? Math.floor(processedData.length / 10) : (processedData.length > 7 ? 1 : 0) } 
            />
            <YAxis
              tickLine={true}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatCurrency(value as number)}
              className="text-xs"
            />
            <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
                content={<ChartTooltipContent 
                    indicator="dot" 
                    hideLabel 
                    formatter={(value, name, props) => {
                        const itemConfig = chartConfig[name as keyof typeof chartConfig];
                        return (
                            <div className="flex min-w-[150px] items-center text-xs">
                                <div className="flex flex-1 items-center gap-1.5">
                                    <div
                                        className="aspect-square w-2.5 shrink-0 rounded-[2px]"
                                        style={{ backgroundColor: itemConfig?.color }}
                                    />
                                    {itemConfig?.label || name}
                                </div>
                                <div className="ml-auto font-mono font-medium text-foreground">
                                    {formatCurrency(value as number)}
                                </div>
                            </div>
                        )
                    }}
                />}
            />
            <Legend verticalAlign="top" height={40} iconSize={10} wrapperStyle={{fontSize: "12px"}}/>
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeOpacity={0.5}/>
            <Area 
                dataKey="revenue" 
                type="monotone" 
                fill="url(#fillRevenueDaily)"
                stroke="var(--color-revenue)" 
                strokeWidth={2} 
                dot={{ r: 2, fill: "var(--color-revenue)", strokeWidth:0 }}
                activeDot={{ r: 4, strokeWidth: 1, stroke: "var(--background)" }}
            />
            <Area 
                dataKey="expenses" 
                type="monotone" 
                fill="url(#fillExpensesDaily)"
                stroke="var(--color-expenses)" 
                strokeWidth={2} 
                dot={{ r: 2, fill: "var(--color-expenses)", strokeWidth:0 }}
                activeDot={{ r: 4, strokeWidth: 1, stroke: "var(--background)" }}
            />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

