import Link from "next/link";

export default function Login() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8 p-8 border border-gray-200 rounded-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
          <p className="text-gray-500">Sign in to your SHOP.CO account</p>
        </div>

        <form className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter your password"
                  className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-gray-500">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 accent-black"
              />
              Remember me
            </label>
            <a href="#" className="font-medium hover:text-gray-700">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white py-4 rounded-full font-medium hover:bg-gray-800 transition-colors"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <button className="border border-gray-200 py-3 rounded-xl flex justify-center hover:bg-gray-50 transition">
              <span className="font-bold text-blue-600">G</span>{" "}
              {/* Google Icon Placeholder */}
            </button>
            <button className="border border-gray-200 py-3 rounded-xl flex justify-center hover:bg-gray-50 transition">
              <span className="font-bold text-blue-800">f</span>{" "}
              {/* Facebook Icon Placeholder */}
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          Don&apost have an account?{" "}
          <Link
            href="/register"
            className="font-bold text-black hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
