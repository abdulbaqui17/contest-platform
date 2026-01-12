import * as React from "react"
import { cn } from "../../lib/utils"
import { Check } from "lucide-react"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, ...props }, ref) => (
    <div className="relative inline-flex items-center">
      <input
        type="checkbox"
        ref={ref}
        checked={checked}
        className="sr-only peer"
        {...props}
      />
      <div
        className={cn(
          "h-5 w-5 rounded border border-zinc-600 bg-zinc-800 flex items-center justify-center cursor-pointer transition-colors",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-900",
          checked && "bg-purple-600 border-purple-600",
          className
        )}
        onClick={() => {
          const input = ref as React.RefObject<HTMLInputElement>
          if (input?.current) {
            input.current.click()
          }
        }}
      >
        {checked && <Check className="h-3 w-3 text-white" />}
      </div>
    </div>
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
