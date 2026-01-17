import type React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  isLoading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  const variantStyles = {
    primary:
      "bg-purple-500 text-text-primary hover:bg-purple-600 active:bg-purple-700 focus-visible:outline-purple-500 shadow-md hover:shadow-lg hover:shadow-purple-500/20",
    secondary:
      "bg-bg-elevated text-text-secondary hover:bg-border-secondary active:bg-border-primary border border-border-primary focus-visible:outline-purple-500",
    ghost:
      "text-text-secondary hover:bg-bg-elevated active:bg-bg-tertiary focus-visible:outline-purple-500",
    danger:
      "bg-red-500 text-text-primary hover:bg-red-600 active:bg-red-700 focus-visible:outline-red-500 shadow-md hover:shadow-lg hover:shadow-red-500/20",
    success:
      "bg-success text-text-primary hover:bg-success-dark active:opacity-90 focus-visible:outline-success shadow-md",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm rounded-md",
    md: "px-4 py-2 text-base rounded-lg",
    lg: "px-6 py-3 text-lg rounded-xl",
  };

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <button
      type="button"
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <title>Loading</title>
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
