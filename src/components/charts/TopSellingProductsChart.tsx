
"use client"

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts" // Added Cell
import { TrendingUp } from "lucide-react"
import {
  ChartContainer, // Import ChartContainer
  ChartTooltipContent,
  type ChartConfig, // Import ChartConfig
} from "@/components/ui/chart"

export interface ProductSalesData {
  name: string;
  totalRevenue: number;
  totalQuantity: number;
}

interface TopSellingProductsChartProps {
  data: ProductSalesData[]; // Expecting top 5 products
}

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
};

const formatAxisCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return value.toString();
};

const CustomLegendContent = ({ payload }: any) => {
  if (!payload) return null;
  return (
    <ul className="space-y-1">
      {payload.map((entry: any, index: number) => (
        <li key={`item-${index}`} className="flex items-center text-xs">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
            style={{ backgroundColor: entry.color }}
          />
          <span className="truncate max-w-[100px] sm:max-w-[120px]" title={entry.payload.name}>{entry.payload.name}</span>
        </li>
      ))}
    </ul>
  );
};

// Minimal chart config for the tooltip context
const chartConfig = {
  totalRevenue: {
    label: "Total Revenue",
  },
} satisfies ChartConfig;


export function TopSellingProductsChart({ data }: TopSellingProductsChartProps) {
  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground p-4">
            No product sales data available.
        </div>
    );
  }
  
  const sortedData = [...data].sort((a,b) => a.totalRevenue - b.totalRevenue);

  return (
    <div className="h-full w-full flex">
      <ChartContainer config={chartConfig} className="h-full w-full flex-1"> {/* Wrap with ChartContainer */}
        <ResponsiveContainer width="70%" height="100%">
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
              <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis 
                  type="number" 
                  dataKey="totalRevenue" 
                  tickFormatter={(value) => formatAxisCurrency(value as number)}
                  tickLine={true}
                  axisLine={false}
                  tickMargin={5}
                  className="text-xs fill-muted-foreground"
              />
              <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              tickFormatter={() => ''} 
              width={0} 
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
              <Bar dataKey="totalRevenue" radius={4}>
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              <LabelList
                  dataKey="totalRevenue"
                  position="right"
                  offset={8}
                  className="fill-foreground text-[10px]"
                  formatter={(value: number) => formatAxisCurrency(value)}
              />
              </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
      <div className="w-[30%] h-full flex flex-col justify-center items-start pl-3 pr-1 text-xs overflow-y-auto">
         <CustomLegendContent payload={
            sortedData.map((entry, index) => ({
                value: entry.name,
                color: chartColors[index % chartColors.length],
                payload: entry 
            })).reverse() 
        } />
      </div>
    </div>
  )
}
