
"use client"

import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react"
import { AreaChart, CartesianGrid, Area, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts" // Changed LineChart to AreaChart, Line to Area

import {
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip as RechartsTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { format } from "date-fns"

export interface MonthlyDataPoint {
  month: string; 
  revenue: number;
  expenses: number;
  netProfit: number;
  cumulativeNetProfit: number;
}

interface MonthlyRevenueExpensesChartProps {
  data: MonthlyDataPoint[];
}

const chartConfig = {
  revenue: {
    label: "Monthly Revenue", // Updated label
    color: "hsl(var(--chart-2))", // Greenish
  },
  expenses: {
    label: "Monthly Expenses", // Updated label
    color: "hsl(var(--destructive))", // Red
  },
} satisfies ChartConfig

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const formatCurrencyWithDecimals = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

export function MonthlyRevenueExpensesChart({ data: rawData }: MonthlyRevenueExpensesChartProps) {
  if (!rawData || rawData.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No data available for the revenue vs expenses chart.
        </div>
    );
  }

  let processedData = [...rawData];
  if (rawData.length === 1) {
    const singleMonth = rawData[0].month.split(" ")[0]; // Get "Jan" from "Jan 2024"
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const singleMonthIndex = monthNames.indexOf(singleMonth);
    const prevMonthLabel = singleMonthIndex > 0 ? monthNames[singleMonthIndex - 1] : "Prev";

    processedData = [
      { month: prevMonthLabel, revenue: 0, expenses: 0, netProfit: 0, cumulativeNetProfit: 0 },
      ...rawData,
    ];
  }

  const latestMonthData = rawData[rawData.length - 1];
  const totalBalance = latestMonthData.cumulativeNetProfit;
  const latestMonthNetChange = latestMonthData.netProfit;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
        <div className="flex items-start justify-between gap-4 px-1 pb-2 pt-0">
            <div className="grid gap-1">
            <CardTitle className="text-2xl sm:text-3xl flex items-baseline gap-1">
                {formatCurrency(totalBalance)}
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
                {latestMonthData.month.split(" ")[0]} {/* Display only month name */}
                </span>
            </div>
            </div>
        </div>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart // Changed from ComposedChart to AreaChart for simplicity with areas
            accessibilityLayer
            data={processedData}
            margin={{
            left: -10, 
            right: 12,
            top: 5,
            }}
        >
            <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.1}/>
                </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
            dataKey="month"
            tickLine={true}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)} // Already "Jan", "Feb", etc.
            />
            <YAxis
            tickLine={true}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => formatCurrency(value as number)}
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
            <Legend verticalAlign="top" height={40}/>
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" strokeWidth={1.5}/>
            <Area 
                dataKey="revenue" 
                type="monotone" 
                fill="url(#fillRevenue)"
                stroke="var(--color-revenue)" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: "var(--color-revenue)", strokeWidth:0 }}
                activeDot={{ r: 5, strokeWidth: 1, stroke: "var(--background)" }}
                stackId="1" // Optional: if you want to stack, but for overlap this is fine
            />
            <Area 
                dataKey="expenses" 
                type="monotone" 
                fill="url(#fillExpenses)"
                stroke="var(--color-expenses)" 
                strokeWidth={2.5} 
                dot={{ r: 3, fill: "var(--color-expenses)", strokeWidth:0 }}
                activeDot={{ r: 5, strokeWidth: 1, stroke: "var(--background)" }}
                stackId="2" // Optional
            />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
