
"use client"

import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react"
import { AreaChart, Area, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts"
import { CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils" // For cn utility if needed for custom tooltip

export interface DailyDataPoint {
  day: string; 
  revenue: number;
  expenses: number;
}

interface MonthlyRevenueExpensesChartProps {
  dailyData: DailyDataPoint[];
  overallCumulativeNetProfit: number;
  latestMonthNetChange: number;
  latestMonthLabel: string;
}

// Define chartConfig locally since ChartContainer is removed
const chartConfig = {
  revenue: {
    label: "Monthly Revenue",
    color: "hsl(var(--chart-2))", // Greenish accent
  },
  expenses: {
    label: "Monthly Expenses",
    color: "hsl(var(--destructive))", // Red
  },
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const formatCurrencyWithDecimals = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

// Simplified Custom Tooltip Content
const CustomTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2.5 shadow-sm">
        <div className="grid grid-cols-1 gap-1.5 text-xs">
          <div className="font-medium">{label}</div>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex min-w-[150px] items-center gap-1.5">
              <div
                className="aspect-square w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color || (entry.dataKey === 'revenue' ? chartConfig.revenue.color : chartConfig.expenses.color) }}
              />
              {entry.dataKey === 'revenue' ? chartConfig.revenue.label : chartConfig.expenses.label}
              <div className="ml-auto font-mono font-medium text-foreground">
                {formatCurrency(entry.value as number)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};


export function MonthlyRevenueExpensesChart({ dailyData, overallCumulativeNetProfit, latestMonthNetChange, latestMonthLabel }: MonthlyRevenueExpensesChartProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No daily data available for the selected month.
        </div>
    );
  }

  let processedData = [...dailyData];
  if (dailyData.length === 1) {
    processedData = [
      { day: "Start", revenue: 0, expenses: 0 }, 
      ...dailyData,
    ];
  }


  return (
    <div className="flex flex-col h-full w-full"> {/* Root div with flex-col and h-full */}
        {/* Header Section */}
        <div className="flex-shrink-0 px-1 pb-2 pt-0"> {/* Header takes its own space */}
            <div className="flex items-start justify-between gap-4">
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
        </div>

        {/* Chart Section */}
        <div className="flex-1 min-h-0 w-full"> {/* Chart container takes remaining space */}
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    accessibilityLayer
                    data={processedData}
                    margin={{
                        left: 10, // Increased left margin for Y-axis labels
                        right: 15, 
                        top: 5,
                        bottom: 5,
                    }}
                >
                    <defs>
                        <linearGradient id="fillRevenueDaily" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartConfig.revenue.color} stopOpacity={0.7}/>
                            <stop offset="95%" stopColor={chartConfig.revenue.color} stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="fillExpensesDaily" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartConfig.expenses.color} stopOpacity={0.6}/>
                            <stop offset="95%" stopColor={chartConfig.expenses.color} stopOpacity={0.1}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                    dataKey="day"
                    tickLine={true}
                    axisLine={false}
                    tickMargin={5}
                    className="text-xs fill-muted-foreground"
                    interval={Math.max(0, Math.floor(processedData.length / 7) -1)} 
                    />
                    <YAxis
                    tickLine={true}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => formatCurrency(value as number)}
                    className="text-xs fill-muted-foreground"
                    />
                    <Tooltip
                        cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "3 3" }}
                        content={<CustomTooltipContent />}
                    />
                    <Legend verticalAlign="top" height={30} iconSize={10} wrapperStyle={{fontSize: "10px"}}/>
                    <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1.5} strokeOpacity={0.5}/>
                    <Area 
                        dataKey="revenue" 
                        type="monotone" 
                        fill="url(#fillRevenueDaily)"
                        stroke={chartConfig.revenue.color} 
                        strokeWidth={2} 
                        dot={{ r: 2, fill: chartConfig.revenue.color, strokeWidth:0 }}
                        activeDot={{ r: 4, strokeWidth: 1, stroke: "hsl(var(--background))" }}
                        name={chartConfig.revenue.label}
                    />
                    <Area 
                        dataKey="expenses" 
                        type="monotone" 
                        fill="url(#fillExpensesDaily)"
                        stroke={chartConfig.expenses.color} 
                        strokeWidth={2} 
                        dot={{ r: 2, fill: chartConfig.expenses.color, strokeWidth:0 }}
                        activeDot={{ r: 4, strokeWidth: 1, stroke: "hsl(var(--background))" }}
                        name={chartConfig.expenses.label}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    </div>
  )
}
