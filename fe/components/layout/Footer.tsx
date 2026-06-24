import Link from "next/link";

const FOOTER_LINKS = [
  {
    title: "COMPANY",
    links: ["About", "Features", "Works", "Career"],
  },
  {
    title: "HELP",
    links: [
      "Customer Support",
      "Delivery Details",
      "Terms & Conditions",
      "Privacy Policy",
    ],
  },
  {
    title: "FAQ",
    links: ["Account", "Manage Deliveries", "Orders", "Payments"],
  },
  {
    title: "RESOURCES",
    links: [
      "Free eBooks",
      "Development Tutorial",
      "How to - Blog",
      "Youtube Playlist",
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[#F0F0F0] pt-16 pb-8 px-4 mt-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 border-b border-gray-300 pb-12">
          {/* Brand & Socials - spans 2 columns */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="text-3xl font-black uppercase tracking-tighter block mb-6"
            >
              SHOP.CO
            </Link>
            <p className="text-gray-500 mb-8 max-w-sm text-sm leading-relaxed">
              We have clothes that suits your style and which you are proud to
              wear. From women to men.
            </p>
            <div className="flex gap-3">
              {/* Social Icons (using simple letters as placeholders for SVGs) */}
              {["𝕏", "f", "📸", "🐙"].map((icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-black hover:text-white transition-colors"
                >
                  <span className="text-sm">{icon}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Dynamic Link Columns */}
          {FOOTER_LINKS.map((section) => (
            <div key={section.title}>
              <h4 className="font-bold tracking-widest text-sm mb-6 uppercase text-black">
                {section.title}
              </h4>
              <ul className="flex flex-col gap-4 text-gray-500 text-sm">
                {section.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-black transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Copyright Row */}
        <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4">
          <p className="text-gray-500 text-sm">
            Shop.co © 2000-2026, All Rights Reserved
          </p>

          {/* Payment Badges (Placeholders) */}
          <div className="flex gap-2">
            {["Visa", "Mastercard", "PayPal", " Pay", "G Pay"].map((badge) => (
              <div
                key={badge}
                className="bg-white border border-gray-200 px-3 py-1.5 rounded-md text-[10px] font-bold text-gray-600 shadow-sm flex items-center justify-center min-w-[40px]"
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
