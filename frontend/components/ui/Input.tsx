import type React from "react";

type InputVariant = "default" | "danger";

const base =
  "w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors";

const focusStyles: Record<InputVariant, string> = {
  default: "focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40",
  danger: "focus:border-red-500 focus:ring-1 focus:ring-red-500/40",
};

type InputProps = {
  variant?: InputVariant;
} & React.InputHTMLAttributes<HTMLInputElement>;

type TextareaProps = {
  variant?: InputVariant;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Input({
  variant = "default",
  className = "",
  ...props
}: InputProps) {
  return (
    <input
      className={`${base} ${focusStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  variant = "default",
  className = "",
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={`${base} ${focusStyles[variant]} resize-none ${className}`}
      {...props}
    />
  );
}
