"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartService } from "../../../services/cart.service";
import { orderService } from "../../../services/order.service";
import { paymentService } from "../../../services/payment.service";
import type { PaymentMethod } from "../../../services/payment.service";
import { userService } from "../../../services/user.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { useCartStore } from "../../../store/useCartStore";
import { formatPrice, formatFullAddress } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import Spinner from "../../../components/ui/Spinner";
import AddressForm, {
  type AddressFormValues,
} from "../../../components/checkout/AddressForm";
import ShippingSelector from "../../../components/checkout/ShippingSelector";
import VoucherInput from "../../../components/checkout/VoucherInput";
import { ShoppingBag, CreditCard, Truck } from "lucide-react";
import type { CartItem, UserAddress } from "../../../interfaces";
import {
  isValidVnPhone,
  VN_PHONE_ERROR_MESSAGE,
} from "../../../lib/validators";
import {
  voucherService,
  type VoucherValidationResult,
} from "../../../services/voucher.service";

type Step = "address" | "shipping" | "payment";

// useSearchParams() (read below, for the chatbot's prepare_checkout
// handoff — payment_method_id/voucher_code/address_id query params) opts
// this page out of static prerendering unless it's wrapped in its own
// Suspense boundary — this wrapper is that boundary. The actual page
// logic lives in CheckoutPageInner.
export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      }
    >
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { clearItems } = useCartStore();
  const queryClient = useQueryClient();
  const checkoutQueryKey = ["checkout", user?.user_id];

  // Preferences the chatbot's prepare_checkout tool can hand off via URL
  // (see components/chat/ChatCheckoutRedirect.tsx) — e.g. "use my default
  // address, pay with VNPay, apply voucher SALE10". Read once on mount;
  // this page doesn't need to react to the URL changing after that.
  const [chatPrefs] = useState(() => ({
    paymentMethodId: searchParams.get("payment_method_id"),
    voucherCode: searchParams.get("voucher_code"),
    addressId: searchParams.get("address_id"),
  }));
  const hasChatPrefs = !!(
    chatPrefs.paymentMethodId ||
    chatPrefs.voucherCode ||
    chatPrefs.addressId
  );

  const [step, setStep] = useState<Step>("address");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    number | null
  >(null);

  // Static reference data (2 rows: VNPay, COD) — fetch once, no need to
  // gate behind a specific step.
  const paymentMethodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentService.getPaymentMethods(),
    staleTime: Infinity,
  });
  const paymentMethods: PaymentMethod[] = paymentMethodsQuery.data ?? [];

  // Default to VNPay once methods load, if nothing's been picked yet —
  // keeps the previous behavior (VNPay was the only option) as the
  // default for anyone who doesn't consciously pick COD. A chat-supplied
  // payment_method_id takes priority over that default, same way a
  // customer's own click would.
  useEffect(() => {
    if (selectedPaymentMethodId !== null || !paymentMethods.length) return;
    if (chatPrefs.paymentMethodId) {
      const fromChat = paymentMethods.find(
        (m) => String(m.payment_method_id) === chatPrefs.paymentMethodId,
      );
      if (fromChat) {
        setSelectedPaymentMethodId(fromChat.payment_method_id);
        return;
      }
    }
    const vnpay = paymentMethods.find((m) => m.name.toLowerCase() === "vnpay");
    setSelectedPaymentMethodId(
      vnpay?.payment_method_id ?? paymentMethods[0].payment_method_id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethods.length]);

  const selectedPaymentMethod = paymentMethods.find(
    (m) => m.payment_method_id === selectedPaymentMethodId,
  );
  const isCOD = selectedPaymentMethod?.name.toLowerCase() === "cod";

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

  // Redirect guests away — but only once we know hasHydrated is true.
  // `user` starts out null on every fresh page load (even for a logged-in
  // person) until zustand finishes reading it back from localStorage; acting
  // on that transient null redirects a logged-in user to "/" on refresh.
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/");
      return;
    }
  }, [hasHydrated, user, router]);

  // Load cart + addresses on mount. Also gated on hasHydrated so the query
  // doesn't stay "disabled" (which reports isLoading: false, not "pending")
  // during the brief window before the auth store rehydrates — otherwise
  // the page falls through to the "cart is empty" state before it's ever
  // actually asked the server.
  const { data: checkoutData, isLoading: loading } = useQuery({
    queryKey: checkoutQueryKey,
    queryFn: async () => {
      const [cart, addrs] = await Promise.all([
        cartService.getCart(),
        userService.getAddresses(),
      ]);
      const addressList = Array.isArray(addrs) ? addrs : [];
      return { cart, addresses: addressList };
    },
    enabled: hasHydrated && !!user,
  });

  const cartItems: CartItem[] = checkoutData?.cart.items ?? [];
  const cartTotal = checkoutData?.cart.total ?? 0;
  const addresses: UserAddress[] = checkoutData?.addresses ?? [];

  // Default address selection, applied once addresses load. A
  // chat-supplied address_id (customer said "use my default address") is
  // honored the same way — it should already point at the default one per
  // prepare_checkout's own lookup, but matching by id here rather than
  // re-deriving is_default keeps this in sync even if that ever changes.
  useEffect(() => {
    if (!checkoutData || selectedAddressId != null) return;
    if (chatPrefs.addressId) {
      const fromChat = checkoutData.addresses.find(
        (a) => String(a.address_id) === chatPrefs.addressId,
      );
      if (fromChat) {
        setSelectedAddressId(fromChat.address_id);
        return;
      }
    }
    const def = checkoutData.addresses.find((a) => a.is_default);
    if (def) setSelectedAddressId(def.address_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutData]);

  // Once an address is resolved and the chatbot handed off preferences,
  // skip straight past the "pick an address" step the customer already
  // effectively answered in the conversation — shipping fee still has to
  // be computed against that address (ShippingSelector), which itself
  // auto-advances to "payment" once done, so this doesn't skip anything
  // that actually needs a fee calculation.
  const chatStepAdvanced = useRef(false);

  // Voucher auto-apply, once cart total is known. Runs once — if it fails
  // (invalid/expired code), the customer just sees the normal VoucherInput
  // box and can enter one manually; prepare_checkout (chat.service.ts)
  // already screened obviously-bad codes before ever handing off this URL,
  // so a failure here is mainly a race (voucher expired/used up between
  // the chat turn and now).
  const voucherAutoApplied = useRef(false);
  useEffect(() => {
    if (voucherAutoApplied.current) return;
    if (!chatPrefs.voucherCode || !checkoutData) return;
    voucherAutoApplied.current = true;
    voucherService
      .validateVoucher(chatPrefs.voucherCode, cartTotal)
      .then(setVoucher)
      .catch(() => {
        toast.error(
          `Voucher "${chatPrefs.voucherCode}" couldn't be applied — you can try entering it manually.`,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatPrefs.voucherCode, checkoutData, cartTotal]);

  const activeAddress =
    !useNew && selectedAddressId
      ? (addresses.find((a) => a.address_id === selectedAddressId) ?? null)
      : null;

  useEffect(() => {
    if (chatStepAdvanced.current) return;
    if (!hasChatPrefs || step !== "address") return;
    if (!activeAddress) return;
    chatStepAdvanced.current = true;
    setStep("shipping");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChatPrefs, step, activeAddress]);

  // Server-computed — avoids re-summing item subtotals (and the string-
  // concatenation bug that came with it, since subtotal is a Postgres
  // decimal string) on every render.
  const subtotal = cartTotal;
  const discount = voucher?.discount_amount ?? 0;
  const total = Math.max(0, subtotal + shippingFee - discount);

  // Previously, an address typed into the "new address" form here only
  // ever lived in local component state (newAddress) — it was used to
  // place this one order and then discarded, so it never showed up in
  // the AddressBook and had to be re-typed on every future checkout. This
  // persists it via the same POST /users/me/addresses AddressBook.tsx
  // already uses, the moment the customer confirms it and moves on to
  // the shipping step (not just at final order placement), so it's saved
  // even if they abandon checkout after this step.
  const saveNewAddressMutation = useMutation({
    mutationFn: (addr: AddressFormValues) => userService.addAddress(addr),
    onSuccess: (result) => {
      // Switch over to the now-saved address (so formatFullAddress etc.
      // read from the authoritative server copy, with province/district/
      // ward names included) instead of continuing to use the local,
      // name-less newAddress object.
      setSelectedAddressId(result.address_id);
      setUseNew(false);
      setNewAddress({});
      queryClient.invalidateQueries({ queryKey: checkoutQueryKey });
      setStep("shipping");
    },
    onError: () => {
      // Non-blocking — the customer already has a complete address in
      // `newAddress` and checkout can proceed with it as before; only the
      // "save for next time" part failed, and re-typing it on the next
      // visit is the worst case, not a broken checkout.
      toast.error(
        "Couldn't save this address for next time, but you can continue checkout.",
      );
      setStep("shipping");
    },
  });

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPaymentMethodId) {
        throw new Error("No payment method selected");
      }
      const addr = activeAddress ?? newAddress;
      const { order_id, shipping_setup_failed } =
        await orderService.createOrder({
          payment_method_id: selectedPaymentMethodId,
          shipping_address: formatFullAddress(addr),
          ward_id: addr.ward_id!,
          recipient_phone: addr.phone!,
          shipping_fee: shippingFee,
          ...(voucher ? { voucher_code: voucher.code } : {}),
        });

      // COD: nothing to redirect to for online payment — the order is
      // placed, payment happens on delivery. VNPay: still needs the
      // create-payment-url + redirect step.
      if (isCOD) {
        return {
          order_id,
          paymentUrl: null as string | null,
          shipping_setup_failed,
        };
      }
      const { paymentUrl } = await paymentService.createVNPayUrl(order_id);
      return { order_id, paymentUrl, shipping_setup_failed };
    },
    onSuccess: ({ order_id, paymentUrl, shipping_setup_failed }) => {
      clearItems();
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else if (shipping_setup_failed) {
        // Order genuinely was placed (COD, nothing charged) — but GHN
        // shipment creation failed, so don't claim everything's ready.
        // Staff already got notified server-side and can retry/reach out;
        // this is just making sure the customer isn't told a silent lie.
        toast.error(
          "Order placed, but we hit a snag setting up shipping. Our team has been notified and will follow up shortly.",
        );
        router.push(`/orders/${order_id}`);
      } else {
        toast.success("Order placed! Pay in cash when it arrives.");
        router.push(`/orders/${order_id}`);
      }
    },
    onError: () => toast.error("Failed to place order. Please try again."),
  });
  const placing = placeOrderMutation.isPending;

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
    if (!addr.address_line || !addr.ward_id || !addr.phone) {
      toast.error("Address is incomplete.");
      return;
    }
    if (!isValidVnPhone(addr.phone)) {
      toast.error(VN_PHONE_ERROR_MESSAGE);
      return;
    }

    placeOrderMutation.mutate();
  }

  // ─── Loading state ────────────────────────────────────────────────────────
  if (!hasHydrated || loading) {
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
                          {formatFullAddress(a)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {a.phone}
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
                      if (useNew) {
                        if (
                          !newAddress.address_line ||
                          !newAddress.province_id ||
                          !newAddress.district_id ||
                          !newAddress.ward_id ||
                          !newAddress.phone
                        ) {
                          toast.error("Fill in the full address first.");
                          return;
                        }
                        if (!isValidVnPhone(newAddress.phone)) {
                          toast.error(VN_PHONE_ERROR_MESSAGE);
                          return;
                        }
                        saveNewAddressMutation.mutate(
                          newAddress as AddressFormValues,
                        );
                        return;
                      }
                      setStep("shipping");
                    }}
                    disabled={saveNewAddressMutation.isPending}
                    className="mt-2 self-end rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saveNewAddressMutation.isPending
                      ? "Saving address…"
                      : "Continue to Shipping"}
                  </button>
                </div>
              ) : (
                (activeAddress || (useNew && newAddress.address_line)) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    {activeAddress?.label && (
                      <span className="font-semibold text-slate-900">
                        {activeAddress.label} —{" "}
                      </span>
                    )}
                    {formatFullAddress(activeAddress ?? newAddress)}
                    {(activeAddress ?? newAddress).phone && (
                      <div className="mt-1 text-slate-500">
                        {(activeAddress ?? newAddress).phone}
                      </div>
                    )}
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
                          // Shipping is auto-selected (see ShippingSelector —
                          // GHN's tiers are a weight/size classification, not
                          // a customer choice like "standard vs express"),
                          // so there's nothing left for the customer to
                          // decide here — advance straight to payment
                          // instead of making them click a button to
                          // confirm a choice they didn't actually make.
                          setStep("payment");
                        }}
                      />
                    </div>
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

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Payment Method
                  </h3>
                  <div className="flex flex-col gap-3">
                    {paymentMethods.map((method) => {
                      const selected =
                        method.payment_method_id === selectedPaymentMethodId;
                      const isMethodCOD = method.name.toLowerCase() === "cod";
                      return (
                        <button
                          key={method.payment_method_id}
                          type="button"
                          onClick={() =>
                            setSelectedPaymentMethodId(method.payment_method_id)
                          }
                          className={`flex items-start gap-4 rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-indigo-400 bg-indigo-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          {isMethodCOD ? (
                            <Truck
                              className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? "text-indigo-500" : "text-slate-400"}`}
                            />
                          ) : (
                            <CreditCard
                              className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? "text-indigo-500" : "text-slate-400"}`}
                            />
                          )}
                          <div className="text-sm">
                            <span className="block font-semibold text-slate-900">
                              {isMethodCOD
                                ? "Cash on Delivery"
                                : `Secure Payment via ${method.name}`}
                            </span>
                            <span className="text-slate-500">
                              {isMethodCOD
                                ? "Pay in cash when your order arrives."
                                : `After placing your order, you will be securely redirected to ${method.name} to complete your purchase.`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
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
                  disabled={placing || !selectedPaymentMethodId}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {placing ? (
                    <>
                      <Spinner size="sm" /> Processing...
                    </>
                  ) : isCOD ? (
                    "Place Order"
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
