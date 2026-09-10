import {
  forwardRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type InputVariant = "default" | "danger";

const base =
  "w-full px-3 py-2 bg-surface-panel border border-line-soft rounded-sm text-ink-strong placeholder:text-ink-faint focus:outline-none transition-colors";

const focusStyles: Record<InputVariant, string> = {
  default: "focus:border-accent focus:ring-1 focus:ring-accent/40",
  danger: "focus:border-danger focus:ring-1 focus:ring-danger/40",
};

type InputProps = {
  variant?: InputVariant;
} & InputHTMLAttributes<HTMLInputElement>;

type TextareaProps = {
  variant?: InputVariant;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "default", className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`${base} ${focusStyles[variant]} ${className}`}
      {...props}
    />
  );
});

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
