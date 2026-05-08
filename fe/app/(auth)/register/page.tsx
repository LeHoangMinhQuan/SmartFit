import Link from "next/link";

export default function Register() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-6 p-8 border border-gray-200 rounded-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-2">Create Account</h2>
          <p className="text-gray-500">Join SHOP.CO and start shopping</p>
        </div>

        <form className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                placeholder="John"
                className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                placeholder="Doe"
                className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="john.doe@example.com"
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Create a strong password"
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
              required
            />
            <div className="text-xs text-gray-400 mt-2 space-y-1">
              <p>• At least 8 characters</p>
              <p>• Upper & lowercase letters</p>
              <p>• At least one number</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Confirm your password"
              className="w-full bg-[#F0F0F0] rounded-xl px-4 py-3 outline-none"
              required
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-sm text-gray-500 mt-4">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 rounded border-gray-300 accent-black"
              required
            />
            <span>
              I agree to the{" "}
              <a href="#" className="font-bold text-black hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="font-bold text-black hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>

          <button
            type="submit"
            className="w-full bg-black text-white py-4 rounded-full font-medium hover:bg-gray-800 transition-colors mt-6"
          >
            Create Account
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-black hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
