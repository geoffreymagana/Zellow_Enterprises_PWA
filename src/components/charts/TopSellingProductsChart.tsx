
"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"

import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export interface ProductSalesData {
  name: string;
  totalRevenue: number;
  totalQuantity: number;
}

interface TopSellingProductsChartProps {
  data: ProductSalesData[];
}

const chartConfig = {
  totalRevenue: {
    label: "Total Revenue",
    color: "hsl(var(--chart-1))",
  },
  totalQuantity: {
    label: "Total Quantity Sold",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

export function TopSellingProductsChart({ data }: TopSellingProductsChartProps) {
  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No product sales data available.
        </div>
    );
  }
  // Sort data by revenue for display if not already sorted
  const sortedData = [...data].sort((a,b) => a.totalRevenue - b.totalRevenue);


  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-full w-full"> {/* Changed min-h to aspect-auto h-full */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
            accessibilityLayer
            data={sortedData}
            layout="vertical"
            margin={{
            left: 5, 
            right: 30, 
            top: 5,
            bottom: 5,
            }}
        >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis 
                type="number" 
                dataKey="totalRevenue" 
                tickFormatter={(value) => formatCurrency(value as number)}
                tickLine={true}
                axisLine={false}
                tickMargin={5}
                className="text-xs"
            />
            <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            tickMargin={5}
            width={100} 
            className="text-xs truncate"
            interval={0} 
            />
            <Tooltip 
                cursor={{ fill: "hsl(var(--muted))" }} 
                content={<ChartTooltipContent 
                    formatter={(value, name, props) => {
                        if (name === "totalRevenue") {
                            return (
                                <div className="flex flex-col text-xs min-w-[150px]">
                                    <span className="font-medium">{props.payload.name}</span>
                                    <span className="font-bold text-foreground">{formatCurrency(value as number)}</span>
                                    <span className="text-muted-foreground">Qty: {props.payload.totalQuantity}</span>
                                </div>
                            )
                        }
                         return null;
                    }}
                    hideLabel 
                />}
            />
            <Bar dataKey="totalRevenue" fill="var(--color-totalRevenue)" radius={4}>
            <LabelList
                dataKey="totalRevenue"
                position="right"
                offset={8}
                className="fill-foreground text-xs"
                formatter={(value: number) => formatCurrency(value)}
            />
            </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

    