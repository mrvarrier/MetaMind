import { forwardRef } from "react";
import { clsx } from "clsx";
import { InputProps } from "../../types";

export const Input = forwardRef<HTMLInputElement, InputProps & React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type={type}
          className={clsx(
            "flex h-10 w-full rounded-apple border border-gray-300 bg-white px-3 py-2 text-sm",
            "placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-400",
            "dark:focus:ring-primary-400",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";