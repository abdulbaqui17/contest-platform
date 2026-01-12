import * as React from "react"
import { cn } from "../../lib/utils"

const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("shrink-0 bg-zinc-800 h-[1px] w-full", className)}
    {...props}
  />
))
Separator.displayName = "Separator"

export { Separator }
