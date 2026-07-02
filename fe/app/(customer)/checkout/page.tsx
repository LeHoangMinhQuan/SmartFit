"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { CartItem, UserAddress, Voucher } from "../../../interfaces";

type Step = "address" | "shipping" | "payment";

// VNPay payment_method_id — adjust to match your seed data
const VNPAY_METHOD_ID = 1;
// Your store's district_id for GHN shipping origin — set this to your store's district
// Set NEXT_PUBLIC_STORE_DISTRICT_ID in .env.local — 1469 = District 1, Ho Chi Minh City
const STORE_DISTRICT_ID = Number(
  process.env.NEXT_PUBLIC_STORE_DISTRICT_ID ?? "1469",
);

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items, clearItems } = useCartStore();

  const [step, setStep] = useState<Step>("address");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
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
  const [voucher, setVoucher] = useState<Voucher | null>(null);

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
        setCartItems(cart);
        setAddresses(addrs);
        const def = addrs.find((a) => a.is_default);
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

  const subtotal = cartItems.reduce((s, i) => s + i.subtotal, 0);

  function calcDiscount(): number {
    if (!voucher) return 0;
    if (voucher.type === "percent") {
      return Math.min((subtotal * voucher.value) / 100, voucher.max_discount);
    }
    return voucher.value;
  }

  const discount = calcDiscount();
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

      // Clear local cart — server cart is cleared by the order endpoint
      clearItems();

      // Redirect to VNPay
      window.location.href = paymentUrl;
    } catch {
      toast.error("Failed to place order. Please try again.");
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="py-24 text-center text-gray-500">
        Your cart is empty.{" "}
        <button onClick={() => router.push("/")} className="underline">
          Continue shopping
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">Checkout</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left — steps */}
        <div className="flex flex-col gap-8 lg:col-span-2">
          {/* ── Step 1: Address ── */}
          <section className="flex flex-col gap-4 rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">1. Delivery Address</h2>
              {step !== "address" && activeAddress && (
                <button
                  onClick={() => setStep("address")}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Change
                </button>
              )}
            </div>

            {step === "address" ? (
              <>
                {/* Saved addresses */}
                {addresses.map((a) => (
                  <label
                    key={a.address_id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-gray-400"
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={!useNew && selectedAddressId === a.address_id}
                      onChange={() => {
                        setSelectedAddressId(a.address_id);
                        setUseNew(false);
                      }}
                      className="mt-0.5"
                    />
                    <div className="text-sm">
                      {a.label && <p className="font-medium">{a.label}</p>}
                      <p className="text-gray-600">{a.address_line}</p>
                    </div>
                  </label>
                ))}

                {/* New address toggle */}
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 hover:border-gray-400">
                  <input
                    type="radio"
                    name="address"
                    checked={useNew}
                    onChange={() => setUseNew(true)}
                  />
                  <span className="text-sm text-gray-600">
                    Enter a new address
                  </span>
                </label>

                {useNew && (
                  <AddressForm value={newAddress} onChange={setNewAddress} />
                )}

                <button
                  onClick={() => {
                    if (!useNew && !selectedAddressId) {
                      toast.error("Select an address to continue.");
                      return;
                    }
                    setStep("shipping");
                  }}
                  className="self-end rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800"
                >
                  Continue
                </button>
              </>
            ) : (
              activeAddress && (
                <p className="text-sm text-gray-600">
                  {activeAddress.label ? `${activeAddress.label} — ` : ""}
                  {activeAddress.address_line}
                </p>
              )
            )}
          </section>

          {/* ── Step 2: Shipping ── */}
          {(step === "shipping" || step === "payment") && (
            <section className="flex flex-col gap-4 rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">2. Shipping Method</h2>
                {step === "payment" && (
                  <button
                    onClick={() => setStep("shipping")}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>

              {step === "shipping" ? (
                <>
                  <ShippingSelector
                    fromDistrictId={STORE_DISTRICT_ID}
                    toDistrictId={
                      activeAddress?.district_id ??
                      newAddress.district_id ??
                      null
                    }
                    toWardCode={
                      activeAddress?.ward_id.toString() ?? newAddress.ward_id?.toString() ?? null
                    }
                    selectedServiceId={shippingServiceId}
                    onSelect={(id, fee) => {
                      setShippingServiceId(id);
                      setShippingFee(fee);
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!shippingServiceId) {
                        toast.error("Select a shipping method to continue.");
                        return;
                      }
                      setStep("payment");
                    }}
                    className="self-end rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800"
                  >
                    Continue
                  </button>
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Shipping fee: {formatPrice(shippingFee)}
                </p>
              )}
            </section>
          )}

          {/* ── Step 3: Voucher + Payment ── */}
          {step === "payment" && (
            <section className="flex flex-col gap-4 rounded-xl border p-5">
              <h2 className="font-semibold">3. Voucher & Payment</h2>

              <VoucherInput
                applied={voucher}
                onApply={setVoucher}
                onRemove={() => setVoucher(null)}
              />

              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                Payment method: <span className="font-medium">VNPay</span>
                <br />
                <span className="text-xs text-gray-400">
                  You will be redirected to VNPay to complete payment.
                </span>
              </div>
            </section>
          )}
        </div>

        {/* Right — order summary */}
        <div className="flex flex-col gap-3 rounded-xl border p-5 text-sm self-start sticky top-6">
          <h2 className="font-semibold text-base">Order Summary</h2>

          {cartItems.map((i) => (
            <div
              key={`${i.product_id}-${i.variant_id}`}
              className="flex justify-between gap-2 text-gray-600"
            >
              <span className="truncate">
                {i.product_name ?? `#${i.product_id}`} × {i.quantity}
              </span>
              <span className="shrink-0">{formatPrice(i.subtotal)}</span>
            </div>
          ))}

          <div className="border-t pt-2 flex flex-col gap-1">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>{shippingFee ? formatPrice(shippingFee) : "—"}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Voucher</span>
                <span>-{formatPrice(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 border-t pt-1 mt-1">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          {step === "payment" && (
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="mt-2 w-full rounded-lg bg-black py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {placing ? "Placing order…" : "Place Order & Pay"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
