import { clsx } from "clsx";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /**
   * Visual theme. "default" is the original gray/black look used across
   * most of the app (staff pages, vouchers, filters, etc.) — left
   * untouched so existing call sites don't shift. "indigo" matches the
   * slate/indigo language already used by the customer profile page and
   * AddressForm's own <select> elements (rounded-xl, focus:ring-indigo-500,
   * slate-900 semibold labels) — opt in per call site rather than
   * switching the shared default, since this component is reused by
   * pages (staff/*) with a different look.
   */
  variant?: "default" | "indigo";
  /**
   * Adds a show/hide toggle (matching the Eye/EyeOff pattern already used
   * in LoginModal) for type="password" fields. Only meaningful when
   * type="password"; internal state overrides the input's rendered type
   * while leaving `type="password"` on the prop itself untouched, so
   * password managers / autofill still see the field as a password field
   * by default until the user actively reveals it.
   */
  passwordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      className,
      id,
      variant = "default",
      passwordToggle = false,
      type,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const [revealed, setRevealed] = useState(false);
    const isPasswordField = type === "password";
    const showToggle = passwordToggle && isPasswordField;
    const resolvedType = showToggle ? (revealed ? "text" : "password") : type;

    const isIndigo = variant === "indigo";

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className={clsx(
              "text-sm font-medium text-gray-700",
              isIndigo && "font-semibold text-slate-900",
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            className={clsx(
              "w-full text-black outline-none transition placeholder:text-gray-400",
              isIndigo
                ? "rounded-xl border px-4 py-2.5 text-sm text-slate-900"
                : "rounded-md border px-3 py-2 text-sm",
              error
                ? "border-red-400 focus:ring-1 focus:ring-red-400"
                : isIndigo
                  ? "border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  : "border-gray-300 focus:border-black focus:ring-1 focus:ring-black",
              showToggle && "pr-11",
              className,
            )}
            {...props}
          />
          {showToggle && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              tabIndex={-1}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 transition hover:text-gray-700"
            >
              {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {hint && !error && (
          <p
            className={clsx(
              "text-xs",
              isIndigo ? "text-slate-500" : "text-gray-500",
            )}
          >
            {hint}
          </p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";
export default Input;
