"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cartService } from "../../../services/cart.service";
import { orderService } from "../../../services/order.service";
import { paymentService } from "../../../services/payment.service";
import { userService } from "../../../services/user.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { useCartStore } from "../../../store/useCartStore";
import { formatPrice } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import Spinner from "../../../components/ui/Spinner";
import AddressForm, {
  type AddressFormValues,
} from "../../../components/checkout/AddressForm";
import ShippingSelector from "../../../components/checkout/ShippingSelector";
import VoucherInput from "../../../components/checkout/VoucherInput";
import { ShoppingBag, CreditCard } from "lucide-react";
import type { CartItem, UserAddress } from "../../../interfaces";
import type { VoucherValidationResult } from "../../../services/voucher.service";

type Step = "address" | "shipping" | "payment";

// VNPay payment_method_id — adjust to match your seed data
const VNPAY_METHOD_ID = 1;

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, clearItems } = useCartStore();

  const [step, setStep] = useState<Step>("address");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  // Address step state
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [newAddress, setNewAddress] = useState<Partial<AddressFormValues>>({});
  const [useNew, setUseNew] = useState(false);

  // Shipping step state
  const [shippingServiceId, setShippingServiceId] = useState<number | null>(
    null,
  );
  const [shippingFee, setShippingFee] = useState(0);

  // Payment step state
  const [voucher, setVoucher] = useState<VoucherValidationResult | null>(null);

  // Redirect guests away
  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
  }, [user, router]);

  // Load cart + addresses on mount
  useEffect(() => {
    if (!user) return;
    Promise.all([cartService.getCart(), userService.getAddresses()])
      .then(([cart, addrs]) => {
        setCartItems(cart.items);
        setCartTotal(cart.total);
        const addressList = Array.isArray(addrs) ? addrs : [];
        setAddresses(addressList);
        const def = addressList.find((a) => a.is_default);
        if (def) setSelectedAddressId(def.address_id);
      })
      .catch(() => toast.error("Failed to load checkout data."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAddress =
    !useNew && selectedAddressId
      ? (addresses.find((a) => a.address_id === selectedAddressId) ?? null)
      : null;

  // Server-computed — avoids re-summing item subtotals (and the string-
  // concatenation bug that came with it, since subtotal is a Postgres
  // decimal string) on every render.
  const subtotal = cartTotal;
  const discount = voucher?.discount_amount ?? 0;
  const total = Math.max(0, subtotal + shippingFee - discount);

  async function handlePlaceOrder() {
    if (!activeAddress && !useNew) {
      toast.error("Select or enter a delivery address.");
      return;
    }
    if (!shippingServiceId) {
      toast.error("Select a shipping method.");
      return;
    }

    const addr = activeAddress ?? newAddress;
    if (!addr.address_line || !addr.ward_id) {
      toast.error("Address is incomplete.");
      return;
    }

    setPlacing(true);
    try {
      const { order_id } = await orderService.createOrder({
        payment_method_id: VNPAY_METHOD_ID,
        shipping_address: addr.address_line,
        ward_id: addr.ward_id,
        ...(voucher ? { voucher_id: voucher.voucher_id } : {}),
      });

      const { paymentUrl } = await paymentService.createVNPayUrl(order_id);

      // Clear local cart
      clearItems();

      // Redirect to VNPay
      window.location.href = paymentUrl;
    } catch {
      toast.error("Failed to place order. Please try again.");
      setPlacing(false);
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center rounded-3xl bg-white shadow-sm border border-slate-200">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
            <ShoppingBag className="h-7 w-7 text-indigo-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nothing to checkout
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Your cart is currently empty.
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-6xl px-6 py-10 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* ─── Left Column (Steps) ────────────────────────────────────── */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* ── Step 1: Address ── */}
            <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  1. Delivery Address
                </h2>
                {step !== "address" && activeAddress && (
                  <button
                    onClick={() => setStep("address")}
                    className="text-sm font-medium text-indigo-500 hover:text-indigo-600 transition"
                  >
                    Change
                  </button>
                )}
              </div>

              {step === "address" ? (
                <div className="flex flex-col gap-4">
                  {addresses.map((a) => (
                    <label
                      key={a.address_id}
                      className={`flex cursor-pointer items-start gap-4 rounded-xl border bg-white p-4 transition-colors ${
                        !useNew && selectedAddressId === a.address_id
                          ? "border-indigo-500 shadow-sm"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={!useNew && selectedAddressId === a.address_id}
                        onChange={() => {
                          setSelectedAddressId(a.address_id);
                          setUseNew(false);
                        }}
                        className="mt-1 h-4 w-4 shrink-0 text-indigo-600 accent-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex flex-col">
                        {a.label && (
                          <span className="font-semibold text-slate-900">
                            {a.label}
                          </span>
                        )}
                        <span className="text-sm text-slate-600">
                          {a.address_line}
                        </span>
                      </div>
                    </label>
                  ))}

                  <label
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border border-dashed p-4 transition-colors ${
                      useNew
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-300 hover:border-slate-400 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={useNew}
                      onChange={() => setUseNew(true)}
                      className="h-4 w-4 text-indigo-600 accent-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Enter a new address
                    </span>
                  </label>

                  {useNew && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <AddressForm
                        value={newAddress}
                        onChange={setNewAddress}
                      />
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!useNew && !selectedAddressId) {
                        toast.error("Select an address to continue.");
                        return;
                      }
                      setStep("shipping");
                    }}
                    className="mt-2 self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Continue to Shipping
                  </button>
                </div>
              ) : (
                activeAddress && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    {activeAddress.label && (
                      <span className="font-semibold text-slate-900">
                        {activeAddress.label} —{" "}
                      </span>
                    )}
                    {activeAddress.address_line}
                  </div>
                )
              )}
            </section>

            {/* ── Step 2: Shipping ── */}
            {(step === "shipping" || step === "payment") && (
              <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">
                    2. Shipping Method
                  </h2>
                  {step === "payment" && (
                    <button
                      onClick={() => setStep("shipping")}
                      className="text-sm font-medium text-indigo-500 hover:text-indigo-600 transition"
                    >
                      Change
                    </button>
                  )}
                </div>

                {step === "shipping" ? (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <ShippingSelector
                        toDistrictId={
                          activeAddress?.district_id ??
                          newAddress.district_id ??
                          null
                        }
                        toWardCode={
                          activeAddress?.ward_id.toString() ??
                          newAddress.ward_id?.toString() ??
                          null
                        }
                        selectedServiceId={shippingServiceId}
                        onSelect={(id, fee) => {
                          setShippingServiceId(id);
                          setShippingFee(fee);
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (!shippingServiceId) {
                          toast.error("Select a shipping method to continue.");
                          return;
                        }
                        setStep("payment");
                      }}
                      className="mt-2 self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Continue to Payment
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    Shipping fee:{" "}
                    <span className="font-medium text-slate-900">
                      {formatPrice(shippingFee)}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* ── Step 3: Voucher + Payment ── */}
            {step === "payment" && (
              <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  3. Voucher & Payment
                </h2>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <VoucherInput
                    orderAmount={subtotal}
                    applied={voucher}
                    onApply={setVoucher}
                    onRemove={() => setVoucher(null)}
                  />
                </div>

                <div className="flex items-start gap-4 rounded-xl border border-indigo-100 bg-indigo-50 p-5">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                  <div className="text-sm text-indigo-900">
                    <span className="font-semibold block mb-1">
                      Secure Payment via VNPay
                    </span>
                    <span className="text-indigo-700/80">
                      After placing your order, you will be securely redirected
                      to VNPay to complete your purchase.
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ─── Right Column (Order Summary) ───────────────────────────── */}
          <aside className="lg:col-span-1">
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Order Summary
              </h2>

              <div className="flex flex-col gap-3 text-sm">
                {cartItems.map((i) => (
                  <div
                    key={`${i.product_id}-${i.variant_id}`}
                    className="flex justify-between text-slate-500"
                  >
                    <span className="max-w-[180px] truncate">
                      {i.product_name ?? `#${i.product_id}`} × {i.quantity}
                    </span>
                    <span className="shrink-0">{formatPrice(i.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="my-5 border-t border-slate-200" />

              <div className="flex flex-col gap-2.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-900">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Shipping</span>
                  <span className="font-medium text-slate-900">
                    {shippingFee ? formatPrice(shippingFee) : "—"}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between font-medium text-emerald-600">
                    <span>Voucher Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
              </div>

              <div className="my-5 border-t border-slate-200" />

              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              {step === "payment" && (
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {placing ? (
                    <>
                      <Spinner size="sm" /> Processing...
                    </>
                  ) : (
                    "Place Order & Pay"
                  )}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
