import { clsx } from "clsx";

type CardVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "revenue"
  | "users"
  | "delivered"
  | "pending";

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
  revenue:
    "bg-gradient-to-br from-emerald-300/70 via-green-300/60 to-teal-300/70 backdrop-blur-xl border border-white/30 shadow-xl shadow-emerald-500/10",
  users:
    "bg-gradient-to-br from-blue-300/70 via-cyan-300/60 to-sky-300/70 backdrop-blur-xl border border-white/30 shadow-xl shadow-blue-500/10",
  delivered:
    "bg-gradient-to-br from-violet-300/70 via-fuchsia-300/60 to-pink-300/70 backdrop-blur-xl border border-white/30 shadow-xl shadow-violet-500/10",
  pending:
    "bg-gradient-to-br from-orange-300/70 via-amber-300/60 to-yellow-300/70 backdrop-blur-xl border border-white/30 shadow-xl shadow-orange-500/10",
};

export default function StatsCard({
  label,
  value,
  hint,
  trend,
  variant = "default",
}: StatsCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-5 hover:shadow-xl hover:-translate-y-1",
        variantStyles[variant],
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-900">
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
