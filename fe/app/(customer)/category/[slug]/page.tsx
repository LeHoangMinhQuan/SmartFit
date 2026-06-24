"use client";
import { useState } from "react";
// import ProductCard from "@/components/ProductCard";

export default function CategoryPage({ params }: { params: { slug: string } }) {
  // Dummy state for filters
  const [priceRange, setPriceRange] = useState(200);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-gray-200 mb-6 text-sm capitalize">
        <span>Home</span> &gt;{" "}
        <span className="text-gray-200 font-medium">
          {params.slug || "Casual"}
        </span>
      </div>
      {/* line break */}
      <div className="border-t border-gray-200 my-6"></div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left: Filters Sidebar */}
        <div className="hidden md:block w-1/4 border border-gray-200 rounded-2xl p-6 h-fit sticky top-24">
          <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold">Filters</h2>
            {/* Filter Icon */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="black"
              strokeWidth="2"
            >
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
          </div>

          {/* Categories */}
          <div className="flex flex-col gap-3 text-gray-500 mb-6 border-b border-gray-200 pb-6">
            {["T-shirts", "Shorts", "Shirts", "Hoodie", "Jeans"].map((cat) => (
              <div
                key={cat}
                className="flex justify-between cursor-pointer text-gray-200 hover:opacity-80 transition-colors"
              >
                <span>{cat}</span> <span>&gt;</span>
              </div>
            ))}
          </div>

          {/* Price Range */}
          <div className="mb-6 border-b border-gray-200 pb-6">
            <h3 className="font-bold mb-4">Price</h3>
            <input
              type="range"
              min="50"
              max="200"
              value={priceRange}
              onChange={(e) => setPriceRange(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-2 text-sm font-medium">
              <span>$50</span>
              <span>${priceRange}</span>
            </div>
          </div>

          {/* Colors */}
          <div className="flex flex-col gap-3 mb-6 border-b border-gray-200 pb-6">
            <h3>Colors</h3>
            <div className="flex flex-wrap gap-3">
              {[
                "bg-red-500",
                "bg-blue-500",
                "bg-yellow-400",
                "bg-green-500",
                "bg-black",
                "bg-pink-500",
                "bg-purple-500",
              ].map((color, i) => (
                <button
                  key={i}
                  className={`w-8 h-8 rounded-full ${color} border border- hover:border-black transition-colors hover:cursor-pointer`}
                ></button>
              ))}
            </div>
          </div>

          <button className="w-full bg-black text-gray-200 py-4 rounded-full border-1 border-white font-medium hover:bg-white hover:text-black hover:cursor-pointer transition-colors">
            Apply Filter
          </button>
        </div>

        {/* Right: Product Grid */}
        <div className="w-full md:w-3/4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold capitalize text-black">
              {params.slug || "Casual"}
            </h1>
            <div className="text-sm text-gray-300 flex items-center gap-2">
              Showing 1-10 of 100 Products
              <span className="hidden sm:inline">
                | Sort by:{" "}
                <strong className="text-gray-300 cursor-pointer">
                  Most Popular
                  <span className="ml-1">&#9660;</span>
                </strong>
              </span>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {/* Map your ProductCard component here. Using placeholders for layout vision */}
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((item) => (
              <div
                key={item}
                className="bg-gray-50 rounded-2xl aspect-[4/5] p-4 flex items-center justify-center text-gray-400"
              >
                Product {item}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-10 border-t border-gray-200 pt-6">
            <button className="border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-white hover:text-black transition-colors hover:cursor-pointer">
              ← Previous
            </button>
            <div className="flex gap-2 text-sm font-medium">
              <button className="w-8 h-8 rounded-lg bg-black text-gray-200 flex items-center justify-center">
                1
              </button>
              <button className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center">
                2
              </button>
              <button className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center">
                3
              </button>
              <span className="flex items-center">...</span>
              <button className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center">
                10
              </button>
            </div>
            <button className="border border-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-white hover:text-black transition-colors hover:cursor-pointer">
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
