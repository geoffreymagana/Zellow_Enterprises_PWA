
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status specific variants
        statusAmber: "border-transparent bg-[#FF9800] text-white",
        statusYellow: "border-transparent bg-[#FFC107] text-black",
        statusLightBlue: "border-transparent bg-[#03A9F4] text-white", // For Delivery: Assigned
        statusBlue: "border-transparent bg-[#2196F3] text-white",    // For Delivery: Out for Delivery
        statusPurple: "border-transparent bg-[#9C27B0] text-white",
        statusGreen: "border-transparent bg-[#4CAF50] text-white",
        statusRed: "border-transparent bg-[#F44336] text-white",
        statusIndigo: "border-transparent bg-[#3F51B5] text-white",
        statusOrange: "border-transparent bg-[#FFB74D] text-black", // For Order: Awaiting Assignment
        statusGrey: "border-transparent bg-[#9E9E9E] text-white",   // For Payment: Refunded
        statusOrderAssigned: "border-transparent bg-[#29B6F6] text-white", // Specific for Order: Assigned

      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

