"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { voucherAdminService } from "../../../services/staff/voucher.service";
import { formatDate } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";

type Tab = "vouchers" | "discounts";

const emptyVoucherForm = {
  code: "",
  type: "percent" as "percent" | "fixed",
  value: "",
  max_discount: "",
  min_amount: "",
  start_date: "",
  end_date: "",
  usage_limit: "",
  description: "",
};

const emptyDiscountForm = {
  voucher_code: "",
  voucher_type: "percent",
  voucher_value: "",
  start_date: "",
  end_date: "",
};

export default function StaffVouchersPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("vouchers");

  // Voucher state
  const { data: vouchers = [] } = useQuery({
    queryKey: ["staff-vouchers"],
    queryFn: () => voucherAdminService.listVouchers(),
  });
  const [voucherForm, setVoucherForm] = useState(emptyVoucherForm);
  const [addingVoucher, setAddingVoucher] = useState(false);

  // Discount state
  const { data: discounts = [] } = useQuery({
    queryKey: ["staff-discounts"],
    queryFn: () => voucherAdminService.listDiscounts(),
  });
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);
  const [assignForm, setAssignForm] = useState({
    discount_id: "",
    product_id: "",
    variant_id: "",
  });
  const [deletingDiscountId, setDeletingDiscountId] = useState<number | null>(
    null,
  );

  const createVoucherMutation = useMutation({
    mutationFn: () =>
      voucherAdminService.createVoucher({
        code: voucherForm.code,
        type: voucherForm.type,
        value: Number(voucherForm.value),
        max_discount: Number(voucherForm.max_discount),
        min_amount: Number(voucherForm.min_amount),
        start_date: voucherForm.start_date,
        end_date: voucherForm.end_date,
        usage_limit: Number(voucherForm.usage_limit),
        description: voucherForm.description,
      }),
    onSuccess: () => {
      toast.success("Voucher created.");
      setVoucherForm(emptyVoucherForm);
      setAddingVoucher(false);
      queryClient.invalidateQueries({ queryKey: ["staff-vouchers"] });
    },
    onError: () => toast.error("Failed to create voucher."),
  });
  const savingVoucher = createVoucherMutation.isPending;

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault();
    createVoucherMutation.mutate();
  }

  const createDiscountMutation = useMutation({
    mutationFn: () =>
      voucherAdminService.createDiscount({
        voucher_code: discountForm.voucher_code,
        voucher_type: discountForm.voucher_type,
        voucher_value: Number(discountForm.voucher_value),
        start_date: discountForm.start_date,
        end_date: discountForm.end_date,
      }),
    onSuccess: () => {
      toast.success("Discount created.");
      setDiscountForm(emptyDiscountForm);
      queryClient.invalidateQueries({ queryKey: ["staff-discounts"] });
    },
    onError: () => toast.error("Failed to create discount."),
  });
  const savingDiscount = createDiscountMutation.isPending;

  async function handleCreateDiscount(e: React.FormEvent) {
    e.preventDefault();
    createDiscountMutation.mutate();
  }

  const assignDiscountMutation = useMutation({
    mutationFn: () =>
      voucherAdminService.assignDiscount(Number(assignForm.discount_id), {
        product_id: Number(assignForm.product_id),
        variant_id: Number(assignForm.variant_id),
      }),
    onSuccess: () => {
      toast.success("Discount assigned.");
      setAssignForm({ discount_id: "", product_id: "", variant_id: "" });
    },
    onError: () => toast.error("Failed to assign discount."),
  });
  const assigningDiscount = assignDiscountMutation.isPending;

  async function handleAssignDiscount(e: React.FormEvent) {
    e.preventDefault();
    assignDiscountMutation.mutate();
  }

  const deleteDiscountMutation = useMutation({
    mutationFn: (discount_id: number) =>
      voucherAdminService.deleteDiscount(discount_id),
    onMutate: (discount_id) => setDeletingDiscountId(discount_id),
    onSuccess: () => {
      toast.success("Discount deleted.");
      queryClient.invalidateQueries({ queryKey: ["staff-discounts"] });
    },
    onError: () => toast.error("Failed to delete discount."),
    onSettled: () => setDeletingDiscountId(null),
  });

  function handleDeleteDiscount(discount_id: number) {
    if (!confirm("Delete this discount? This cannot be undone.")) return;
    deleteDiscountMutation.mutate(discount_id);
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Vouchers & Discounts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create promo codes and assign discounts to product variants.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {(["vouchers", "discounts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize hover:cursor-pointer",
              tab === t
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Vouchers tab */}
      {tab === "vouchers" && (
        <div className="flex flex-col gap-5">
          <button
            onClick={() => setAddingVoucher((v) => !v)}
            className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg"
          >
            {addingVoucher ? "Cancel" : "+ New Voucher"}
          </button>

          {addingVoucher && (
            <form
              onSubmit={handleCreateVoucher}
              className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl"
            >
              <Input
                label="Code"
                value={voucherForm.code}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, code: e.target.value })
                }
                required
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Type
                </label>
                <select
                  value={voucherForm.type}
                  onChange={(e) =>
                    setVoucherForm({
                      ...voucherForm,
                      type: e.target.value as "percent" | "fixed",
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="percent" className="text-slate-900">
                    Percent
                  </option>
                  <option value="fixed" className="text-slate-900">
                    Fixed
                  </option>
                </select>
              </div>
              <Input
                label="Value"
                type="number"
                value={voucherForm.value}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, value: e.target.value })
                }
                required
              />
              <Input
                label="Max Discount"
                type="number"
                value={voucherForm.max_discount}
                onChange={(e) =>
                  setVoucherForm({
                    ...voucherForm,
                    max_discount: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Min Order Amount"
                type="number"
                value={voucherForm.min_amount}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, min_amount: e.target.value })
                }
                required
              />
              <Input
                label="Usage Limit"
                type="number"
                value={voucherForm.usage_limit}
                onChange={(e) =>
                  setVoucherForm({
                    ...voucherForm,
                    usage_limit: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Start Date"
                type="date"
                value={voucherForm.start_date}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, start_date: e.target.value })
                }
                required
              />
              <Input
                label="End Date"
                type="date"
                value={voucherForm.end_date}
                onChange={(e) =>
                  setVoucherForm({ ...voucherForm, end_date: e.target.value })
                }
                required
              />
              <div className="col-span-2">
                <Input
                  label="Description"
                  value={voucherForm.description}
                  onChange={(e) =>
                    setVoucherForm({
                      ...voucherForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <button
                type="submit"
                disabled={savingVoucher}
                className="col-span-2 self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
              >
                {savingVoucher ? "Saving…" : "Create Voucher"}
              </button>
            </form>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <DataTable
              columns={[
                { key: "code", header: "Code" },
                { key: "type", header: "Type" },
                { key: "value", header: "Value" },
                {
                  key: "usage_count",
                  header: "Used",
                  render: (r) => `${r.usage_count}/${r.usage_limit}`,
                },
                {
                  key: "start_date",
                  header: "Start",
                  render: (r) => formatDate(r.start_date as string),
                },
                {
                  key: "end_date",
                  header: "End",
                  render: (r) => formatDate(r.end_date as string),
                },
              ]}
              rows={vouchers as unknown as Record<string, unknown>[]}
              rowKey={(r) => r.voucher_id as number}
              emptyMessage="No vouchers yet."
            />
          </div>
        </div>
      )}

      {/* Discounts tab */}
      {tab === "discounts" && (
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <DataTable
              columns={[
                { key: "discount_id", header: "ID", className: "w-16" },
                { key: "voucher_code", header: "Code" },
                { key: "voucher_type", header: "Type" },
                { key: "voucher_value", header: "Value" },
                {
                  key: "start_date",
                  header: "Start",
                  render: (r) => formatDate(r.start_date as string),
                },
                {
                  key: "end_date",
                  header: "End",
                  render: (r) => formatDate(r.end_date as string),
                },
                {
                  key: "actions",
                  header: "",
                  className: "w-24",
                  render: (r) => {
                    const id = r.discount_id as number;
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDiscount(id);
                        }}
                        disabled={deletingDiscountId === id}
                        className="text-xs font-medium text-red-500 hover:cursor-pointer hover:underline disabled:opacity-50"
                      >
                        {deletingDiscountId === id ? "…" : "Delete"}
                      </button>
                    );
                  },
                },
              ]}
              rows={discounts as unknown as Record<string, unknown>[]}
              rowKey={(r) => r.discount_id as number}
              emptyMessage="No discounts yet. Create one below, then assign it to a variant."
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Create discount */}
            <form
              onSubmit={handleCreateDiscount}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="font-medium text-sm text-slate-900">
                Create Discount
              </p>
              <Input
                label="Internal Code"
                value={discountForm.voucher_code}
                onChange={(e) =>
                  setDiscountForm({
                    ...discountForm,
                    voucher_code: e.target.value,
                  })
                }
                required
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Type
                </label>
                <select
                  value={discountForm.voucher_type}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      voucher_type: e.target.value,
                    })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="percent" className="text-slate-900">
                    Percent
                  </option>
                  <option value="fixed" className="text-slate-900">
                    Fixed
                  </option>
                </select>
              </div>
              <Input
                label="Value"
                type="number"
                value={discountForm.voucher_value}
                onChange={(e) =>
                  setDiscountForm({
                    ...discountForm,
                    voucher_value: e.target.value,
                  })
                }
                required
              />
              <Input
                label="Start Date"
                type="date"
                value={discountForm.start_date}
                onChange={(e) =>
                  setDiscountForm({
                    ...discountForm,
                    start_date: e.target.value,
                  })
                }
                required
              />
              <Input
                label="End Date"
                type="date"
                value={discountForm.end_date}
                onChange={(e) =>
                  setDiscountForm({ ...discountForm, end_date: e.target.value })
                }
                required
              />
              <button
                type="submit"
                disabled={savingDiscount}
                className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
              >
                {savingDiscount ? "Creating…" : "Create"}
              </button>
            </form>

            {/* Assign discount */}
            <form
              onSubmit={handleAssignDiscount}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="font-medium text-sm text-slate-900">
                Assign Discount to Variant
              </p>
              <Input
                label="Discount ID"
                type="number"
                value={assignForm.discount_id}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, discount_id: e.target.value })
                }
                required
              />
              <Input
                label="Product ID"
                type="number"
                value={assignForm.product_id}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, product_id: e.target.value })
                }
                required
              />
              <Input
                label="Variant ID"
                type="number"
                value={assignForm.variant_id}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, variant_id: e.target.value })
                }
                required
              />
              <button
                type="submit"
                disabled={assigningDiscount}
                className="self-start rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:cursor-pointer active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
              >
                {assigningDiscount ? "Assigning…" : "Assign"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
