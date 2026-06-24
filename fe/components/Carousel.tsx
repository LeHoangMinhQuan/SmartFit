"use client";

import { useState } from "react";
import { ProductCardProps } from "@/interfaces";
import ProductCard from "./product/ProductCard";


export default function Carousel({ title, data }: { title: string; data: ProductCardProps[] }) {
  const [showAll, setShowAll] = useState(false);

  const visibleProducts = showAll ? data : data.slice(0, 4); // always slice 4, grid will handle layout

  return (
    <section className="mx-auto md:px-8 md:py-16 lg:px-16 lg:py-24 bg-[#F2F0F1]">
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
