"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { voucherAdminService } from "../../../services/staff/voucher.service";
import { formatDate } from "../../../lib/utils";
import { toast } from "../../../components/ui/Toast";
import DataTable from "../../../components/staff/DataTable";
import Input from "../../../components/ui/Input";
import type { Voucher } from "../../../interfaces";

type Tab = "vouchers" | "discounts";

interface DiscountRow {
  discount_id: number;
  voucher_code: string;
  voucher_type: string;
  voucher_value: number;
  start_date: string;
  end_date: string;
}

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
  const [tab, setTab] = useState<Tab>("vouchers");

  // Voucher state
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherForm, setVoucherForm] = useState(emptyVoucherForm);
  const [addingVoucher, setAddingVoucher] = useState(false);
  const [savingVoucher, setSavingVoucher] = useState(false);

  // Discount state
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);
  const [assignForm, setAssignForm] = useState({
    discount_id: "",
    product_id: "",
    variant_id: "",
  });
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [assigningDiscount, setAssigningDiscount] = useState(false);

  useEffect(() => {
    voucherAdminService
      .listVouchers()
      .then(setVouchers)
      .catch(() => {});
  }, []);

  async function handleCreateVoucher(e: React.FormEvent) {
    e.preventDefault();
    setSavingVoucher(true);
    try {
      await voucherAdminService.createVoucher({
        code: voucherForm.code,
        type: voucherForm.type,
        value: Number(voucherForm.value),
        max_discount: Number(voucherForm.max_discount),
        min_amount: Number(voucherForm.min_amount),
        start_date: voucherForm.start_date,
        end_date: voucherForm.end_date,
        usage_limit: Number(voucherForm.usage_limit),
        description: voucherForm.description,
      });
      toast.success("Voucher created.");
      setVoucherForm(emptyVoucherForm);
      setAddingVoucher(false);
      voucherAdminService.listVouchers().then(setVouchers);
    } catch {
      toast.error("Failed to create voucher.");
    } finally {
      setSavingVoucher(false);
    }
  }

  async function handleCreateDiscount(e: React.FormEvent) {
    e.preventDefault();
    setSavingDiscount(true);
    try {
      await voucherAdminService.createDiscount({
        voucher_code: discountForm.voucher_code,
        voucher_type: discountForm.voucher_type,
        voucher_value: Number(discountForm.voucher_value),
        start_date: discountForm.start_date,
        end_date: discountForm.end_date,
      });
      toast.success("Discount created.");
      setDiscountForm(emptyDiscountForm);
    } catch {
      toast.error("Failed to create discount.");
    } finally {
      setSavingDiscount(false);
    }
  }

  async function handleAssignDiscount(e: React.FormEvent) {
    e.preventDefault();
    setAssigningDiscount(true);
    try {
      await voucherAdminService.assignDiscount(Number(assignForm.discount_id), {
        product_id: Number(assignForm.product_id),
        variant_id: Number(assignForm.variant_id),
      });
      toast.success("Discount assigned.");
      setAssignForm({ discount_id: "", product_id: "", variant_id: "" });
    } catch {
      toast.error("Failed to assign discount.");
    } finally {
      setAssigningDiscount(false);
    }
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Vouchers & Discounts</h1>

      <div className="flex gap-1 border-b">
        {(["vouchers", "discounts"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize",
              tab === t
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800",
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
            className="self-start rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            {addingVoucher ? "Cancel" : "+ New Voucher"}
          </button>

          {addingVoucher && (
            <form
              onSubmit={handleCreateVoucher}
              className="grid grid-cols-2 gap-4 rounded-xl border p-5 max-w-2xl"
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
                <label className="text-sm font-medium text-gray-700">
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
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
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
                className="col-span-2 self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
              >
                {savingVoucher ? "Saving…" : "Create Voucher"}
              </button>
            </form>
          )}

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
      )}

      {/* Discounts tab */}
      {tab === "discounts" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Create discount */}
            <form
              onSubmit={handleCreateDiscount}
              className="flex flex-col gap-3 rounded-xl border p-5"
            >
              <p className="font-medium text-sm">Create Discount</p>
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
                <label className="text-sm font-medium text-gray-700">
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
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
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
                className="self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
              >
                {savingDiscount ? "Creating…" : "Create"}
              </button>
            </form>

            {/* Assign discount */}
            <form
              onSubmit={handleAssignDiscount}
              className="flex flex-col gap-3 rounded-xl border p-5"
            >
              <p className="font-medium text-sm">Assign Discount to Variant</p>
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
                className="self-start rounded-lg bg-black px-5 py-2 text-sm text-white disabled:opacity-50"
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
