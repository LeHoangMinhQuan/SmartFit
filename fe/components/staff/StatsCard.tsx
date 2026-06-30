import { clsx } from "clsx";

interface StatsCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: "up" | "down" | "neutral";
}

export default function StatsCard({
  label,
  value,
  hint,
  trend,
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 p-5">
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
