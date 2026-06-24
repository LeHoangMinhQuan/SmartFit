import clsx from "clsx";
import { ButtonProps, ButtonVariant } from "@/interfaces";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-black text-white border border-black hover:bg-gray-800 active:scale-[0.98]",
  secondary:
    "bg-white text-black border border-gray-300 hover:bg-gray-100 active:scale-[0.98]",
  default: "bg-transparent text-black hover:bg-black/5 active:scale-[0.98]",
};

export default function Button({
  label,
  variant = "default",
  className,
  onClick,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-6 py-3 rounded-full font-medium transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-black/20",
        variantStyles[variant],
        className,
      )}
    >
      {label}
    </button>
  );
}
