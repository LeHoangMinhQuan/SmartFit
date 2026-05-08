interface ReviewCardProps {
  name: string;
  rating: number;
  text: string;
  date?: string;
}

export default function ReviewCard({
  name,
  rating,
  text,
  date,
}: ReviewCardProps) {
  return (
    <div className="border border-gray-200 rounded-2xl p-6 md:p-8 flex flex-col gap-3">
      {/* Stars */}
      <div className="flex text-yellow-400 text-sm gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < rating ? "★" : "☆"}</span>
        ))}
      </div>

      {/* Name and Verified Tick */}
      <div className="flex items-center gap-2">
        <h4 className="font-bold text-lg">{name}</h4>
        <span className="bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
          ✓
        </span>
      </div>

      {/* Review Text */}
      <p className="text-gray-500 text-sm md:text-base leading-relaxed">
        `{text}`
      </p>

      {/* Optional Date (Used on Product Detail Page) */}
      {date && (
        <p className="text-gray-400 text-sm mt-4 font-medium">
          Posted on {date}
        </p>
      )}
    </div>
  );
}
