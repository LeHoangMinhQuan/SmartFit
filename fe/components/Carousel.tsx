"use client";

import { useState } from "react";
import { ProductCardProps } from "@/interfaces";
import ProductCard from "./product/ProductCard";
import clsx from "clsx";


interface CarouselProps {
  title: string;
  data: ProductCardProps[];
  isFirst?: boolean;
  isLast?: boolean;
}

export default function Carousel({ title, data, isFirst, isLast }: CarouselProps) {
  const [showAll, setShowAll] = useState(false);

  const visibleProducts = showAll ? data : data.slice(0, 4); // always slice 4, grid will handle layout

  return (
    <section
      className={clsx(
        "mx-auto bg-[#F2F0F1] md:px-8 lg:px-16",
        isLast ? "pt-0" : "md:pt-16 lg:pt-24",
        isFirst ? "pb-0" : "md:pb-16 lg:pb-24",
      )}
    >
      <h2 className="text-3xl text-black md:text-5xl font-black text-center uppercase mb-10">
        {title}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>

      {!showAll && (
        <div className="text-center mt-10">
          <button
            onClick={() => setShowAll(true)}
            className="border text-black border-gray-300 rounded-full px-12 py-3 hover:bg-gray-50 hover:cursor-pointer transition-colors font-medium"
          >
            View All
          </button>
        </div>
      )}
    </section>
  );
}
