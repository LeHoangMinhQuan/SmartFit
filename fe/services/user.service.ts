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
  label?: string; // VARCHAR(20)
  is_default?: boolean;
}

export const userService = {
  getProfile: () => api.get<User>("/api/users/me").then((r) => r.data),

  updateProfile: (body: UpdateProfileBody) =>
    api.patch<User>("/api/users/me", body).then((r) => r.data),

  changePassword: (body: ChangePasswordBody) =>
    api.patch("/api/users/me/password", body).then((r) => r.data),

  deleteAccount: () => api.delete("/api/users/me").then((r) => r.data),

  // Addresses
  getAddresses: () =>
    api.get<UserAddress[]>("/api/users/me/addresses").then((r) => r.data),

  addAddress: (body: AddAddressBody) =>
    api
      .post<{ address_id: number }>("/api/users/me/addresses", body)
      .then((r) => r.data),

  updateAddress: (address_id: number, body: Partial<AddAddressBody>) =>
    api.put(`/api/users/me/addresses/${address_id}`, body).then((r) => r.data),

  deleteAddress: (address_id: number) =>
    api.delete(`/api/users/me/addresses/${address_id}`).then((r) => r.data),

  setDefaultAddress: (address_id: number) =>
    api
      .patch(`/api/users/me/addresses/${address_id}/default`)
      .then((r) => r.data),
};
