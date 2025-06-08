
"use client"

import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react"
import { AreaChart, Area, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Text } from "recharts" // Added Text for custom tick
import { CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { format, isSameDay, startOfMonth, endOfMonth, isToday as dateIsToday } from 'date-fns'; // Added date-fns functions

export interface DailyDataPoint {
  day: string; // Format "MMM dd"
  revenue: number;
  expenses: number;
  dateObject: Date; // Store the actual date object for comparisons
}

interface MonthlyRevenueExpensesChartProps {
  dailyData: DailyDataPoint[];
  overallCumulativeNetProfit: number;
  latestMonthNetChange: number;
  latestMonthLabel: string;
  targetMonthDate: Date; // Date object representing the month being displayed
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
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const formatCurrencyWithDecimals = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};

// Custom Tooltip Content
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

// Custom XAxis Tick Component
const CustomizedXAxisTick = (props: any) => {
  const { x, y, payload, dailyData, targetMonthDate } = props;
  const tickDateStr = payload.value; // This is "MMM dd"

  // Find the corresponding dateObject for the current tick
  const currentTickDataPoint = dailyData.find((data: DailyDataPoint) => data.day === tickDateStr);
  if (!currentTickDataPoint) return null; // Should not happen if dataKey="day"

  const tickDate = currentTickDataPoint.dateObject;

  const firstDayOfMonth = startOfMonth(targetMonthDate);
  const lastDayOfData = dailyData[dailyData.length - 1]?.dateObject;
  const isCurrentCalendarDay = dateIsToday(tickDate);
  const isTargetMonthCurrentCalendarMonth = dateIsToday(targetMonthDate) || (targetMonthDate.getFullYear() === new Date().getFullYear() && targetMonthDate.getMonth() === new Date().getMonth());
  
  const hasData = currentTickDataPoint.revenue > 0 || currentTickDataPoint.expenses > 0;

  const shouldRender = 
    isSameDay(tickDate, firstDayOfMonth) ||
    (lastDayOfData && isSameDay(tickDate, lastDayOfData)) ||
    (isCurrentCalendarDay && isTargetMonthCurrentCalendarMonth) ||
    hasData;

  if (shouldRender) {
    return (
      <Text x={x} y={y} dy={16} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
        {tickDateStr.split(' ')[1]} {/* Show only day number */}
      </Text>
    );
  }
  return null;
};


export function MonthlyRevenueExpensesChart({ dailyData, overallCumulativeNetProfit, latestMonthNetChange, latestMonthLabel, targetMonthDate }: MonthlyRevenueExpensesChartProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No daily data available for the selected month.
        </div>
    );
  }

  let processedData = [...dailyData];
  // Ensure the chart can draw even with one data point or for a full month with sparse data
  if (dailyData.length === 1) {
    const singleDate = dailyData[0].dateObject;
    const dayBefore = new Date(singleDate); dayBefore.setDate(singleDate.getDate() -1);
    const dayAfter = new Date(singleDate); dayAfter.setDate(singleDate.getDate() + 1);
    processedData = [
      { day: format(dayBefore, "MMM dd"), dateObject: dayBefore, revenue: 0, expenses: 0 },
      ...dailyData,
      { day: format(dayAfter, "MMM dd"), dateObject: dayAfter, revenue: 0, expenses: 0 },
    ];
  } else if (dailyData.length > 1) {
     // To ensure lines connect to axis from start/end if first/last day has no data but intermediate days do.
     // This logic might need more refinement if the "dailyData" prop already guarantees full month coverage.
     // For now, assuming `dailyData` passed in is what we work with for plotting.
  }


  return (
    <div className="flex flex-col h-full w-full">
        <div className="flex-shrink-0 px-1 pb-2 pt-0">
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

        <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    accessibilityLayer
                    data={processedData}
                    margin={{
                        left: 10,
                        right: 15, 
                        top: 5,
                        bottom: 5,
                    }}
                >
                    <defs>
                        <linearGradient id="fillRevenueDailyChart" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartConfig.revenue.color} stopOpacity={0.7}/>
                            <stop offset="95%" stopColor={chartConfig.revenue.color} stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="fillExpensesDailyChart" x1="0" y1="0" x2="0" y2="1">
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
                        interval={0} // Let custom tick component decide rendering
                        tick={<CustomizedXAxisTick dailyData={dailyData} targetMonthDate={targetMonthDate} />}
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
                        fill="url(#fillRevenueDailyChart)"
                        stroke={chartConfig.revenue.color} 
                        strokeWidth={2} 
                        dot={{ r: 2, fill: chartConfig.revenue.color, strokeWidth:0 }}
                        activeDot={{ r: 4, strokeWidth: 1, stroke: "hsl(var(--background))" }}
                        name={chartConfig.revenue.label}
                    />
                    <Area 
                        dataKey="expenses" 
                        type="monotone" 
                        fill="url(#fillExpensesDailyChart)"
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
