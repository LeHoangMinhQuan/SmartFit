import Carousel from "@/components/Carousel";
import Image from "next/image";
import { ProductCardProps } from "@/interfaces";
import Link from "next/link";
import { categoryService } from "@/services/category.service";


// Add this dummy data at the top of your file or in a separate constants file
const NEW_ARRIVALS: ProductCardProps[] = [
  {
    id: 1,
    name: "T-shirt with Tape Details",
    price: 80,
    originalPrice: 100,
    discount: 20,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 2,
    name: "Skinny Fit Jeans",
    price: 240,
    originalPrice: 260,
    discount: 20,
    rating: 3.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 3,
    name: "Checkered Shirt",
    price: 180,
    originalPrice: 200,
    discount: 10,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 4,
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 5,
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 6,
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 7,
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
  {
    id: 8,
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    imageUrl: "/images/landing_img.jpg",
  },
];

const STYLES = [
  {
    name: "Casual",
    imageUrl: "/images/style-casual.png",
    colSpan: "col-span-1 md:col-span-4",
  },
  {
    name: "Formal",
    imageUrl: "/images/style-formal.png",
    colSpan: "col-span-1 md:col-span-8",
  },
  {
    name: "Party",
    imageUrl: "/images/style-party.png",
    colSpan: "col-span-1 md:col-span-8",
  },
  {
    name: "Gym",
    imageUrl: "/images/style-gym.png",
    colSpan: "col-span-1 md:col-span-4",
  },
];

export default async function Home() {
  const featuredCategories = await categoryService.getFeaturedCategories();

  return (
    <div className="w-full">
      {/* HERO SECTION */}
      <section className="bg-[#F2F0F1]">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center md:justify-between gap-10 md:gap-20">
          {/* Left Content */}
          <div className="md:w-1/2 z-10 pb-10 pt-10 md:pt-24">
            <h1 className="text-4xl md:text-6xl font-black text-black uppercase leading-[1.1] mb-6">
              Find clothes
              <br />
              that matches
              <br />
              your style
            </h1>
            <p className="text-gray-500 mb-8 max-w-md">
              Browse through our diverse range of meticulously crafted garments,
              designed to bring out your individuality and cater to your sense
              of style.
            </p>
            <Link
              href="/categories/all"
              className="inline-block w-full rounded-full bg-black px-10 py-4 text-center font-medium text-white transition-colors hover:bg-gray-800 md:w-auto"
            >
              Shop Now
            </Link>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mt-12">
              <div>
                <h4 className="text-3xl text-black font-bold">200+</h4>
                <p className="text-gray-500 text-sm">International Brands</p>
              </div>
              <div className="hidden md:block w-px bg-gray-300"></div>
              <div>
                <h4 className="text-3xl text-black font-bold">2,000+</h4>
                <p className="text-gray-500 text-sm">High-Quality Products</p>
              </div>
              <div className="hidden md:block w-px bg-gray-300"></div>
              <div>
                <h4 className="text-3xl text-black font-bold">30,000+</h4>
                <p className="text-gray-500 text-sm">Happy Customers</p>
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className="md:w-1/2 relative h-[500px] w-full">
            <div className="md:w-full relative h-[500px] w-full overflow-hidden rounded-t-3xl">
              <Image
                src="/images/landing_img.jpg"
                alt="Models"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-[center_10%]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* BRAND TICKER */}
      <div className="bg-black py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center md:justify-between items-center gap-6 text-white font-serif text-2xl md:text-4xl">
          <span>VERSACE</span>
          <span>ZARA</span>
          <span>GUCCI</span>
          <span className="font-sans font-bold tracking-widest">PRADA</span>
          <span>Calvin Klein</span>
        </div>
      </div>

      {/* NEW ARRIVALS */}
      <Carousel title="New Arrivals" data={NEW_ARRIVALS} />

      {/* TOP SELLINGS */}
      <Carousel title="Top Selling" data={NEW_ARRIVALS} />

      {/* BROWSE BY CATEGORY (was "Browse By dress style") */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="bg-[#F0F0F0] rounded-[40px] p-8 md:p-16">
          <h2 className="text-3xl text-black md:text-5xl font-black text-center uppercase mb-12">
            Browse By Category
          </h2>

          {featuredCategories.length ===
          0 ? // No categories marked featured yet — section simply doesn't
          // render rather than showing broken/placeholder tiles.
          null : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 h-auto md:h-[600px]">
              {featuredCategories.map((category, i) => (
                <Link
                  key={category.category_id}
                  href={`/category/${encodeURIComponent(category.name)}`}
                  className={`relative bg-white rounded-3xl overflow-hidden group cursor-pointer ${
                    i % 3 === 2
                      ? "col-span-1 md:col-span-8"
                      : "col-span-1 md:col-span-4"
                  }`}
                >
                  <div className="absolute top-6 left-8 z-10">
                    <h3 className="text-2xl text-black font-bold">
                      {category.name}
                    </h3>
                  </div>
                  {category.image_url && (
                    <Image
                      src={category.image_url}
                      alt={category.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover object-right-top transition-transform group-hover:scale-105"
                    />
                  )}
                  {/* bg-gray-200 placeholder overlay removed — it was
                      stacking on top of the image, not behind it, and is
                      no longer needed now that image_url is always a real
                      uploaded S3 asset for any category that reaches here. */}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      {/* REST OF PAGE (Top Selling, etc.) */}
      {/* ... Add grids for ProductCards here ... */}
    </div>
  );
}
