import LandingImg from "@/app/assets/images/landing_img.jpg";
import Carousel from "@/components/Carousel";
import Image from "next/image";

// Add this dummy data at the top of your file or in a separate constants file
const NEW_ARRIVALS = [
  {
    id: "1",
    name: "T-shirt with Tape Details",
    price: 120,
    rating: 4.5,
    // imageUrl: '/public/images/landing_img.jpg',
  },
  {
    id: "2",
    name: "Skinny Fit Jeans",
    price: 240,
    originalPrice: 260,
    discount: 20,
    rating: 3.5,
    // imageUrl: "/jeans1.png",
  },
  {
    id: "3",
    name: "Checkered Shirt",
    price: 180,
    rating: 4.5,
    // imageUrl: "/shirt1.png",
  },
  {
    id: "4",
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    // imageUrl: "/tshirt2.png",
  },
  {
    id: "5",
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    // imageUrl: "/tshirt2.png",
  },
  {
    id: "6",
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    // imageUrl: "/tshirt2.png",
  },
  {
    id: "7",
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    // imageUrl: "/tshirt2.png",
  },
  {
    id: "8",
    name: "Sleeve Striped T-shirt",
    price: 130,
    originalPrice: 160,
    discount: 30,
    rating: 4.5,
    // imageUrl: "/tshirt2.png",
  },
];

const STYLES = [
  {
    name: "Casual",
    imageUrl: "/style-casual.png",
    colSpan: "col-span-1 md:col-span-4",
  },
  {
    name: "Formal",
    imageUrl: "/style-formal.png",
    colSpan: "col-span-1 md:col-span-8",
  },
  {
    name: "Party",
    imageUrl: "/style-party.png",
    colSpan: "col-span-1 md:col-span-8",
  },
  {
    name: "Gym",
    imageUrl: "/style-gym.png",
    colSpan: "col-span-1 md:col-span-4",
  },
];

export default function Home() {
  return (
    <div className="w-full">
      {/* HERO SECTION */}
      <section className="bg-[#F2F0F1] pt-10 md:pt-24">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center md:justify-between gap-10 md:gap-20">
          {/* Left Content */}
          <div className="md:w-1/2 z-10 pb-10">
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
            <button className="bg-black text-white px-10 py-4 rounded-full font-medium hover:bg-gray-800 transition-colors w-full md:w-auto">
              Shop Now
            </button>

            {/* Stats */}
            <div className="flex flex-wrap gap-8 mt-12">
              <div>
                <h4 className="text-3xl font-bold">200+</h4>
                <p className="text-gray-500 text-sm">International Brands</p>
              </div>
              <div className="hidden md:block w-px bg-gray-300"></div>
              <div>
                <h4 className="text-3xl font-bold">2,000+</h4>
                <p className="text-gray-500 text-sm">High-Quality Products</p>
              </div>
              <div className="hidden md:block w-px bg-gray-300"></div>
              <div>
                <h4 className="text-3xl font-bold">30,000+</h4>
                <p className="text-gray-500 text-sm">Happy Customers</p>
              </div>
            </div>
          </div>

          {/* Right Image */}
          <div className="md:w-1/2 relative h-[500px] w-full">
            <div className="absolute inset-0 rounded-t-3xl flex items-center justify-center">
              <Image
                src={LandingImg}
                alt="Models"
                height={0}
                width={0}
                className="h-full w-auto object-cover object-center transition-transform group-hover:scale-105"
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

      {/* BROWSE BY DRESS STYLE */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="bg-[#F0F0F0] rounded-[40px] p-8 md:p-16">
          <h2 className="text-3xl md:text-5xl font-black text-center uppercase mb-12">
            Browse By dress style
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 h-auto md:h-[600px]">
            {STYLES.map((style) => (
              <div
                key={style.name}
                className={`relative bg-white rounded-3xl overflow-hidden group cursor-pointer ${style.colSpan}`}
              >
                <div className="absolute top-6 left-8 z-10">
                  <h3 className="text-2xl font-bold">{style.name}</h3>
                </div>
                {/* <Image src={style.imageUrl} alt={style.name} fill className="object-cover object-right-top transition-transform group-hover:scale-105" /> */}
                <div className="absolute inset-0 bg-gray-200"></div>{" "}
                {/* Placeholder */}
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* REST OF PAGE (Top Selling, etc.) */}
      {/* ... Add grids for ProductCards here ... */}
    </div>
  );
}
