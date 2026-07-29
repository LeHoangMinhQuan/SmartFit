import Image from "next/image";
import Link from "next/link";
import NewArrivalsSection from "@/components/landing/NewArrivalsSection";
import TopSellingSection from "@/components/landing/TopSellingSection";
import FeaturedCategoriesSection from "@/components/landing/FeaturedCategoriesSection";

export default function Home() {
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
      <NewArrivalsSection />

      {/* TOP SELLINGS */}
      <TopSellingSection />

      {/* BROWSE BY CATEGORY (was "Browse By dress style") */}
      <FeaturedCategoriesSection />

      {/* REST OF PAGE (Top Selling, etc.) */}
      {/* ... Add grids for ProductCards here ... */}
    </div>
  );
}
