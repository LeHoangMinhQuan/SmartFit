"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useMutation } from "@tanstack/react-query";
import { userService } from "../../../services/user.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { toast } from "../../../components/ui/Toast";
import Input from "../../../components/ui/Input";
import AddressBook from "../../../components/profile/AddressBook";
import WishlistGrid from "../../../components/profile/WishlistGrid";
import Spinner from "../../../components/ui/Spinner";
import { User, MapPin, Heart, Key, Loader2 } from "lucide-react";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  isValidVnPhone,
  isValidPassword,
  VN_PHONE_ERROR_MESSAGE,
  PASSWORD_ERROR_MESSAGE,
} from "../../../lib/validators";

type Tab = "info" | "addresses" | "wishlist" | "password";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "info", label: "My Info", icon: User },
  { key: "addresses", label: "Addresses", icon: MapPin },
  { key: "wishlist", label: "Wishlist", icon: Heart },
  { key: "password", label: "Security", icon: Key },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, setAuth, hasHydrated } = useAuthStore();
  const [tab, setTab] = useState<Tab>("info");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/");
  }, [hasHydrated, user, router]);

  // ── My Info state ──
  const [username, setUsername] = useState(user?.username ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const debouncedPhone = useDebounce(phone, 400);
  const phoneError =
    phoneTouched && debouncedPhone && !isValidVnPhone(debouncedPhone)
      ? VN_PHONE_ERROR_MESSAGE
      : undefined;

  const saveInfoMutation = useMutation({
    mutationFn: () => userService.updateProfile({ username, phone }),
    onSuccess: (updated) => {
      // Keep the session, just refresh the cached user object. `updated`
      // is already a full User from the backend — no need to reconstruct
      // individual fields with fallbacks.
      if (user) {
        setAuth({ ...user, ...updated });
      }
      toast.success("Profile updated.");
    },
    onError: () => toast.error("Failed to update profile."),
  });
  const savingInfo = saveInfoMutation.isPending;

  async function handleSaveInfo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phone && !isValidVnPhone(phone)) {
      toast.error(VN_PHONE_ERROR_MESSAGE);
      return;
    }
    saveInfoMutation.mutate();
  }

  // ── Change Password state ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [newPwTouched, setNewPwTouched] = useState(false);
  const debouncedNewPw = useDebounce(newPw, 400);
  const newPwError =
    newPwTouched && debouncedNewPw && !isValidPassword(debouncedNewPw)
      ? PASSWORD_ERROR_MESSAGE
      : undefined;

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      userService.changePassword({
        current_password: currentPw,
        new_password: newPw,
      }),
    onSuccess: () => {
      toast.success("Password changed.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: () =>
      toast.error("Failed to change password. Check your current password."),
  });
  const savingPw = changePasswordMutation.isPending;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPassword(newPw)) {
      toast.error(PASSWORD_ERROR_MESSAGE);
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("New passwords don't match.");
      return;
    }
    changePasswordMutation.mutate();
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Profile
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage your personal information, addresses, and security settings.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex gap-2 overflow-x-auto border-b border-slate-200 pb-px hide-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* My Info */}
            {tab === "info" && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h2 className="mb-6 text-lg font-semibold text-slate-900">
                  Personal Information
                </h2>
                <form onSubmit={handleSaveInfo} className="flex flex-col gap-5">
                  <Input
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <Input
                    label="Email"
                    value={user.email}
                    disabled
                    hint="Email cannot be changed."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Input
                      label="Phone"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setPhoneTouched(true);
                      }}
                      maxLength={10}
                      hint="10 digits"
                      error={phoneError}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingInfo}
                    className="mt-2 flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {savingInfo && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingInfo ? "Saving Changes..." : "Save Changes"}
                  </button>
                </form>
              </section>
            )}

            {/* Addresses */}
            {tab === "addresses" && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h2 className="mb-6 text-lg font-semibold text-slate-900">
                  Address Book
                </h2>
                <AddressBook />
              </section>
            )}

            {/* Wishlist */}
            {tab === "wishlist" && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h2 className="mb-6 text-lg font-semibold text-slate-900">
                  Your Wishlist
                </h2>
                <WishlistGrid />
              </section>
            )}

            {/* Change Password */}
            {tab === "password" && (
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                <h2 className="mb-6 text-lg font-semibold text-slate-900">
                  Security Settings
                </h2>
                <form
                  onSubmit={handleChangePassword}
                  className="flex flex-col gap-5"
                >
                  <Input
                    label="Current Password"
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    required
                  />
                  <div className="my-2 border-t border-slate-200" />
                  <Input
                    label="New Password"
                    type="password"
                    value={newPw}
                    onChange={(e) => {
                      setNewPw(e.target.value);
                      setNewPwTouched(true);
                    }}
                    required
                    minLength={8}
                    hint="8+ characters with upper & lowercase letters and a number."
                    error={newPwError}
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    disabled={savingPw}
                    className="mt-2 flex w-fit items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingPw ? "Updating Password..." : "Update Password"}
                  </button>
                </form>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
