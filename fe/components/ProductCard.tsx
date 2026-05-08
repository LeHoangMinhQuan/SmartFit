import Image from "next/image";
import Link from "next/link";
import DefaultImage from "@/app/assets/images/landing_img.jpg";
import Button from "@/components/Button";
import { ProductCardProps } from "@/interfaces";

export default function ProductCard({
  id,
  name,
  price,
  originalPrice,
  discount,
  rating,
  imageUrl,
}: ProductCardProps) {
  return (
    <Link
      href={`/product/${id}`}
      className="group block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300"
    >
      {/* Image */}
      <div className="bg-[#F0EEED] rounded-xl aspect-[4/5] relative overflow-hidden mb-4">
        <Image
          src={imageUrl ?? DefaultImage}
          alt={name}
          fill
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="space-y-2">
        <h3 className="font-semibold text-black text-base md:text-lg line-clamp-2">
          {name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-yellow-400">★★★★★</span>
          <span className="text-gray-500">{rating}/5</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-black text-lg">${price}</span>

          {originalPrice && (
            <span className="text-gray-400 line-through text-sm">
              ${originalPrice}
            </span>
          )}

          {discount && (
            <span className="bg-red-100 text-red-500 text-xs font-semibold px-2 py-0.5 rounded-full">
              -{discount}%
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex justify-end mt-4">
        <Button
          label="View Details"
          variant="primary"
          className="text-sm px-4 py-2"
        ></Button>
      </div>
    </Link>
  );
}
