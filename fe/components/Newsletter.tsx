export default function Newsletter() {
  return (
    <div className="max-w-7xl mx-auto px-4 mb-10 relative z-10 -bottom-20">
      <div className="bg-black rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left text */}
        <div className="md:w-1/2">
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase leading-tight">
            Stay upto date about
            <br />
            our latest offers
          </h2>
        </div>

        {/* Right Input Box */}
        <div className="md:w-[400px] flex flex-col gap-3 w-full">
          <div className="bg-white rounded-full flex items-center px-4 py-3 gap-2">
            {/* Mail Icon */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              className="text-gray-400"
              strokeWidth="2"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <input
              type="email"
              placeholder="Enter your email address"
              className="bg-transparent outline-none w-full text-black placeholder-gray-400"
            />
          </div>
          <button className="bg-white text-black font-medium py-3 rounded-full hover:bg-gray-100 transition-colors w-full">
            Subscribe to Newsletter
          </button>
        </div>
      </div>
    </div>
  );
}
