
"use client"

import { TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis, ComposedChart } from "recharts"

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
  ChartTooltip as RechartsTooltip, // Renamed to avoid conflict if ChartTooltip is used directly
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export interface MonthlyDataPoint {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  cumulativeNetProfit: number;
}

interface CumulativeNetProfitChartProps {
  data: MonthlyDataPoint[];
}

const chartConfig = {
  cumulativeNetProfit: {
    label: "Cumulative Net Profit",
    color: "hsl(var(--chart-1))",
  },
   netProfit: {
    label: "Monthly Net Profit",
    color: "hsl(var(--chart-2))",
  }
} satisfies ChartConfig

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};
const formatCurrencyWithDecimals = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
};


export function CumulativeNetProfitChart({ data }: CumulativeNetProfitChartProps) {
  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No data available for the net profit chart.
        </div>
    );
  }

  const latestMonthData = data[data.length - 1];
  const totalBalance = latestMonthData.cumulativeNetProfit;
  const latestMonthNetChange = latestMonthData.netProfit;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[400px] w-full">
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
      <ComposedChart
        accessibilityLayer
        data={data}
        margin={{
          left: -10, // Adjusted for KES currency symbol
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
          tickFormatter={(value) => value.slice(0, 3)} // Abbreviate month
        />
        <YAxis
          tickLine={true}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => formatCurrency(value as number)}
          
        />
        <defs>
          <linearGradient id="fillCumulativeNetProfit" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-cumulativeNetProfit)"
              stopOpacity={0.8}
            />
            <stop
              offset="95%"
              stopColor="var(--color-cumulativeNetProfit)"
              stopOpacity={0.1}
            />
          </linearGradient>
        </defs>
        <Area
          dataKey="cumulativeNetProfit"
          type="natural"
          fill="url(#fillCumulativeNetProfit)"
          fillOpacity={0.4}
          stroke="var(--color-cumulativeNetProfit)"
          stackId="a"
          strokeWidth={2}
        />
        <Line 
            dataKey="cumulativeNetProfit" 
            type="natural" 
            stroke="var(--color-cumulativeNetProfit)" 
            strokeWidth={2.5} 
            dot={false} 
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <RechartsTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="line" hideLabel />}
            formatter={(value, name) => {
                if (name === "cumulativeNetProfit") {
                    return (
                        <div className="flex min-w-[120px] items-center text-xs text-muted-foreground">
                            Cumulative Profit
                            <div className="ml-auto flex items-baseline gap-0.5">
                            <span className="font-mono font-medium text-foreground">
                                {formatCurrency(value as number)}
                            </span>
                            </div>
                        </div>
                    )
                }
                if (name === "netProfit") {
                     return (
                        <div className="flex min-w-[120px] items-center text-xs text-muted-foreground">
                            Monthly Net
                            <div className="ml-auto flex items-baseline gap-0.5">
                            <span className="font-mono font-medium text-foreground">
                                {formatCurrency(value as number)}
                            </span>
                            </div>
                        </div>
                    )
                }
            }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
