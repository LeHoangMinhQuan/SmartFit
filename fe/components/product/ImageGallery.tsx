"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { ProductImage } from "../../interfaces";

interface ImageGalleryProps {
  images: ProductImage[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400">
        No image
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-50">
        <img
          src={images[active].s3_url}
          alt={`Product image ${active + 1}`}
          className="h-full w-full object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.image_id}
              onClick={() => setActive(i)}
              className={clsx(
                "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                i === active
                  ? "border-black"
                  : "border-transparent hover:border-gray-300",
              )}
            >
              <img
                src={img.s3_url}
                alt={`Thumbnail ${i + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
