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
  default: "border-slate-200 bg-white",
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
    // BUG FIX: min-w-0 lets this grid cell actually shrink below its
    // content's intrinsic width. Grid tracks (Tailwind's grid-cols-* uses
    // minmax(0, 1fr)) could already shrink fine, but the label/value text
    // had no wrap/truncate handling — a formatted price like
    // "1.234.567 ₫" (Intl.NumberFormat's non-breaking space before the
    // currency symbol) is a single unbreakable token, so as the card
    // narrowed the text just kept its natural width and spilled out past
    // the card's border/padding instead of shrinking with it.
    <div
      className={clsx(
        "min-w-0 rounded-xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl",
        variantStyles[variant],
      )}
    >
      <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-900">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-bold text-slate-900">
        {value}
      </p>
      {hint && (
        <p
          className={clsx(
            "mt-1 truncate text-xs",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-600",
            (!trend || trend === "neutral") && "text-slate-900",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
