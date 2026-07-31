import { Star, BadgeCheck } from "lucide-react";

interface ReviewCardProps {
  username: string;
  rating: number;
  comment: string;
  date?: string;
}

export default function ReviewCard({
  username,
  rating,
  comment,
  date,
}: ReviewCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md md:p-8">
      {/* Header: Stars & Date */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= rating;
            return (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  isFilled
                    ? "fill-amber-400 text-amber-400"
                    : "fill-slate-100 text-slate-200"
                }`}
              />
            );
          })}
        </div>

        {date && (
          <span className="text-sm font-medium text-slate-400">{date}</span>
        )}
      </div>

      {/* Name and Verified Tick */}
      <div className="flex items-center gap-1.5">
        {/* Added text-slate-900 to fix the transparent text issue */}
        <h4 className="text-lg font-bold text-slate-900">{username}</h4>
        <BadgeCheck
          className="h-5 w-5 text-indigo-500"
          aria-label="Verified Buyer"
        />
      </div>

      {/* Review Text: Removed the literal quotes around the variable */}
      <p className="text-sm leading-relaxed text-slate-600 md:text-base">
        {comment}
      </p>
    </div>
  );
}
