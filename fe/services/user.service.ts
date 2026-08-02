import api from "../lib/axios";
import type { User, UserAddress } from "../interfaces";

interface UpdateProfileBody {
  username?: string;
  phone?: string; // CHAR(10)
  address?: string; // VARCHAR(70)
  avatar_url?: string;
}

interface ChangePasswordBody {
  current_password: string;
  new_password: string;
}

interface AddAddressBody {
  address_line: string; // VARCHAR(20) — validate max length before submit
  province_id: number;
  district_id: number;
  ward_id: number;
  phone: string; // CHAR(10) — required, see AddressForm
  label?: string; // VARCHAR(20)
  is_default?: boolean;
}

// Every endpoint below wraps its payload in { data: ... } on the backend
// (see controllers/user.controller.ts — res.json({ data: ... })). These
// calls were previously resolving with `r.data` (the whole { data: ... }
// envelope object) instead of `r.data.data` (the actual payload), so e.g.
// getAddresses() resolved to { data: [...] } rather than [...] — an object,
// not an array — which crashed any caller doing `addresses.map(...)`.
export const userService = {
  getProfile: () =>
    api.get<{ data: User }>("/users/me").then((r) => r.data.data),

  updateProfile: (body: UpdateProfileBody) =>
    api.patch<{ data: User }>("/users/me", body).then((r) => r.data.data),

  changePassword: (body: ChangePasswordBody) =>
    api.patch("/users/me/password", body).then((r) => r.data.data),

  deleteAccount: () => api.delete("/users/me").then((r) => r.data),

  // Addresses
  getAddresses: () =>
    api
      .get<{ data: UserAddress[] }>("/users/me/addresses")
      .then((r) => r.data.data),

  addAddress: (body: AddAddressBody) =>
    api
      .post<{ data: { address_id: number } }>("/users/me/addresses", body)
      .then((r) => r.data.data),

  updateAddress: (address_id: number, body: Partial<AddAddressBody>) =>
    api.put(`/users/me/addresses/${address_id}`, body).then((r) => r.data.data),

  deleteAddress: (address_id: number) =>
    api.delete(`/users/me/addresses/${address_id}`).then((r) => r.data),

  setDefaultAddress: (address_id: number) =>
    api
      .patch(`/users/me/addresses/${address_id}/default`)
      .then((r) => r.data.data),
};
