
"use client"

import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react"
import { AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis, ComposedChart, Area, Legend, ResponsiveContainer } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip as RechartsTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { format, subMonths } from "date-fns"

export interface MonthlyDataPoint {
  month: string; // Should be like "Jan", "Feb"
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
    label: "Revenue",
    color: "hsl(var(--chart-2))", // Greenish
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))", // Red
  },
  netProfit: { // For tooltip, if needed
    label: "Net Profit",
    color: "hsl(var(--chart-1))",
  }
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
  // Handle single data point: prepend a zero-value point for the previous month
  if (rawData.length === 1) {
    const singleMonth = rawData[0].month; // e.g., "Jan"
    // This is a naive way to get "previous month", better to use date-fns if full date was available
    // For simplicity, if original month is 'Jan', prev is 'Dec', else just 'Prev Month'
    const prevMonthLabel = singleMonth === "Jan" ? "Dec" : (singleMonth === "Feb" ? "Jan" : "Prev");

    processedData = [
      { month: prevMonthLabel, revenue: 0, expenses: 0, netProfit: 0, cumulativeNetProfit: 0 },
      ...rawData,
    ];
  }


  const latestMonthData = rawData[rawData.length - 1]; // Use rawData for latest month figures before prepending
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
                {latestMonthData.month}
                </span>
            </div>
            </div>
        </div>
      <ResponsiveContainer width="100%" height="80%">
        <ComposedChart
            accessibilityLayer
            data={processedData}
            margin={{
            left: -10, 
            right: 12,
            top: 5,
            }}
        >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
            dataKey="month"
            tickLine={true}
            axisLine={false}
            tickMargin={8}
            // tickFormatter={(value) => value.slice(0, 3)} // Already should be like "Jan"
            />
            <YAxis
            tickLine={true}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => formatCurrency(value as number)}
            />
            <Tooltip
                cursor={false}
                content={<ChartTooltipContent 
                    indicator="line" 
                    hideLabel 
                    formatter={(value, name, props) => {
                        const itemConfig = chartConfig[name as keyof typeof chartConfig];
                        return (
                            <div className="flex min-w-[140px] items-center text-xs">
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
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
            <Line 
                dataKey="revenue" 
                type="monotone" 
                stroke="var(--color-revenue)" 
                strokeWidth={2.5} 
                dot={{ r: 4, fill: "var(--color-revenue)", strokeWidth:0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Line 
                dataKey="expenses" 
                type="monotone" 
                stroke="var(--color-expenses)" 
                strokeWidth={2.5} 
                dot={{ r: 4, fill: "var(--color-expenses)", strokeWidth:0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
            />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
