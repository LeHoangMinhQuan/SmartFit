"use client"; // Needs to be a client component for interactivity (quantity, tabs)
import { useState } from "react";
// import Image from "next/image";

export default function ProductDetail() {
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("Large");
  const [selectedColor, setSelectedColor] = useState("bg-[#314F4A]"); // Example hex

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-gray-500 mb-6 flex gap-2 text-sm">
        <span>Home</span> &gt; <span>Shop</span> &gt; <span>Men</span> &gt;{" "}
        <span className="text-black font-medium">T-shirts</span>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        {/* Left: Image Gallery */}
        <div className="md:w-1/2 flex flex-col-reverse md:flex-row gap-4">
          {/* Thumbnails */}
          <div className="flex md:flex-col gap-4 w-full md:w-[150px]">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="bg-[#F0EEED] rounded-2xl aspect-square relative cursor-pointer border-2 border-transparent hover:border-black"
              >
                {/* <Image src={`/thumb${item}.png`} fill alt="thumbnail" className="object-cover" /> */}
              </div>
            ))}
          </div>
          {/* Main Image */}
          <div className="bg-[#F0EEED] rounded-2xl flex-1 aspect-[4/5] relative">
            {/* <Image src={`/main-product.png`} fill alt="Product" className="object-cover" /> */}
          </div>
        </div>

        {/* Right: Product Details */}
        <div className="md:w-1/2 pt-4">
          <h1 className="text-4xl font-black uppercase mb-2">
            One Life Graphic T-Shirt
          </h1>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400">★★★★☆</span>
            <span className="text-sm text-gray-500">4.5/5</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="font-bold text-3xl">$260</span>
            <span className="text-gray-400 font-bold text-3xl line-through">
              $300
            </span>
            <span className="bg-red-100 text-red-500 text-sm font-bold px-3 py-1 rounded-full">
              -40%
            </span>
          </div>

          <p className="text-gray-500 mb-8 border-b border-gray-200 pb-8">
            This graphic t-shirt which is perfect for any occasion. Crafted from
            a soft and breathable fabric, it offers superior comfort and style.
          </p>

          {/* Select Colors */}
          <div className="mb-6">
            <span className="text-gray-500 mb-3 block">Select Colors</span>
            <div className="flex gap-3">
              {["bg-[#314F4A]", "bg-[#31343D]", "bg-[#4F4631]"].map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-9 h-9 rounded-full ${color} flex items-center justify-center`}
                >
                  {selectedColor === color && (
                    <span className="text-white text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Choose Size */}
          <div className="mb-8 border-b border-gray-200 pb-8">
            <span className="text-gray-500 mb-3 block">Choose Size</span>
            <div className="flex flex-wrap gap-3">
              {["Small", "Medium", "Large", "X-Large"].map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-6 py-3 rounded-full font-medium transition-colors ${selectedSize === size ? "bg-black text-white" : "bg-[#F0F0F0] text-gray-500 hover:bg-gray-200"}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Add to Cart Action */}
          <div className="flex gap-4">
            {/* Quantity Selector */}
            <div className="bg-[#F0F0F0] rounded-full flex items-center px-4 py-3 w-1/3 justify-between">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-2xl font-medium w-8"
              >
                -
              </button>
              <span className="font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="text-2xl font-medium w-8"
              >
                +
              </button>
            </div>
            {/* CTA */}
            <button className="bg-black text-white rounded-full flex-1 py-3 font-medium hover:bg-gray-800 transition-colors">
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
