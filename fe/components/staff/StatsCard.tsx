import { clsx } from "clsx";

type CardVariant = "default" | "success" | "warning" | "error";

interface StatsCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default: "border-gray-200",
  success: "border-green-200 bg-green-50",
  warning: "border-yellow-200 bg-yellow-50",
  error: "border-red-200 bg-red-50",
};

export default function StatsCard({
  label,
  value,
  hint,
  trend,
  variant = "default",
}: StatsCardProps) {
  return (
    <div className={clsx("rounded-xl border p-5", variantStyles[variant])}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      {hint && (
        <p
          className={clsx(
            "mt-1 text-xs",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-600",
            (!trend || trend === "neutral") && "text-gray-400",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
