"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { userService } from "../../../services/user.service";
import { useAuthStore } from "../../../store/useAuthStore";
import { toast } from "../../../components/ui/Toast";
import Input from "../../../components/ui/Input";
import AddressBook from "../../../components/profile/AddressBook";
import WishlistGrid from "../../../components/profile/WishlistGrid";

type Tab = "info" | "addresses" | "wishlist" | "password";

const TABS: { key: Tab; label: string }[] = [
  { key: "info", label: "My Info" },
  { key: "addresses", label: "Addresses" },
  { key: "wishlist", label: "Wishlist" },
  { key: "password", label: "Change Password" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const [tab, setTab] = useState<Tab>("info");

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  // ── My Info state ──
  const [username, setUsername] = useState(user?.username ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  async function handleSaveInfo(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const updated = await userService.updateProfile({
        username,
        phone,
        address,
      });
      // Keep the access token, just refresh the cached user object
      if (user) {
        setAuth(
          {
            ...user,
            ...updated,
            phone: updated.phone ?? "",
            address: updated.address ?? "",
            avatar_url: updated.avatar_url ?? "",
          },
          useAuthStore.getState().accessToken!,
        );
      }
      toast.success("Profile updated.");
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Change Password state ──
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error("New passwords don't match.");
      return;
    }
    setSavingPw(true);
    try {
      await userService.changePassword({
        current_password: currentPw,
        new_password: newPw,
      });
      toast.success("Password changed.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      toast.error("Failed to change password. Check your current password.");
    } finally {
      setSavingPw(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold">Profile</h1>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
              tab === t.key
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* My Info */}
      {tab === "info" && (
        <form
          onSubmit={handleSaveInfo}
          className="flex max-w-md flex-col gap-4"
        >
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
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={10}
            hint="10 digits"
          />
          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={70}
            hint="Max 70 characters"
          />
          <button
            type="submit"
            disabled={savingInfo}
            className="self-start rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {savingInfo ? "Saving…" : "Save Changes"}
          </button>
        </form>
      )}

      {/* Addresses */}
      {tab === "addresses" && <AddressBook />}

      {/* Wishlist */}
      {tab === "wishlist" && <WishlistGrid />}

      {/* Change Password */}
      {tab === "password" && (
        <form
          onSubmit={handleChangePassword}
          className="flex max-w-md flex-col gap-4"
        >
          <Input
            label="Current Password"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
          />
          <Input
            label="New Password"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            minLength={8}
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
            className="self-start rounded-lg bg-black px-6 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {savingPw ? "Updating…" : "Update Password"}
          </button>
        </form>
      )}
    </div>
  );
}
