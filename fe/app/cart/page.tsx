export default function Cart() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-gray-500 mb-6 text-sm">
        <span>Home</span> &gt;{" "}
        <span className="text-black font-medium">Cart</span>
      </div>

      <h1 className="text-4xl font-black uppercase mb-8">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Cart Items */}
        <div className="lg:w-2/3 border border-gray-200 rounded-2xl p-6 flex flex-col gap-6">
          {/* Example Cart Item */}
          <div className="flex gap-4 border-b border-gray-200 pb-6 last:border-0 last:pb-0">
            <div className="w-24 h-24 bg-[#F0EEED] rounded-xl flex-shrink-0"></div>
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">
                    Gradient Graphic T-shirt
                  </h3>
                  <p className="text-sm text-gray-500">
                    Size: <span className="text-gray-400">Large</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Color: <span className="text-gray-400">White</span>
                  </p>
                </div>
                <button className="text-red-500 hover:text-red-700">
                  {/* Trash Icon */}
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="font-bold text-xl">$145</span>
                <div className="bg-[#F0F0F0] rounded-full flex items-center px-3 py-1 w-28 justify-between">
                  <button className="text-xl font-medium">-</button>
                  <span className="font-medium text-sm">1</span>
                  <button className="text-xl font-medium">+</button>
                </div>
              </div>
            </div>
          </div>
          {/* Add more items here following the same structure */}
        </div>

        {/* Right: Order Summary */}
        <div className="lg:w-1/3 border border-gray-200 rounded-2xl p-6 h-fit sticky top-24">
          <h2 className="text-xl font-bold mb-6">Order Summary</h2>

          <div className="flex flex-col gap-4 text-gray-500 mb-6 border-b border-gray-200 pb-6">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-black">$565</span>
            </div>
            <div className="flex justify-between">
              <span>Discount (-20%)</span>
              <span className="font-bold text-red-500">-$113</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span className="font-bold text-black">$15</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <span className="font-bold text-black">Total</span>
            <span className="font-bold text-2xl text-black">$467</span>
          </div>

          {/* Promo Code */}
          <div className="flex gap-2 mb-6">
            <div className="flex-1 bg-[#F0F0F0] rounded-full flex items-center px-4 py-3">
              {/* Tag Icon */}
              <svg
                width="20"
                height="20"
                className="text-gray-400 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
              </svg>
              <input
                type="text"
                placeholder="Add promo code"
                className="bg-transparent outline-none w-full text-sm"
              />
            </div>
            <button className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800">
              Apply
            </button>
          </div>

          <button className="w-full bg-black text-white py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
            Go to Checkout <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
