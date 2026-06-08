"use client";

import { useState } from "react";
import {
  BadgeIndianRupee,
  Receipt,
  AlertTriangle,
  Percent,
  Clock3,
  Wallet,
  Eye,
  EyeOff,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

import {
  useBillingAnalytics,
  useAcademicSessions,
} from "@/lib/hooks";

import { useFilterParams } from "@/lib/use-filter-params";

export default function BillingAnalyticsPage() {
  const [hideAmounts, setHideAmounts] =
    useState(false);

  const {
    getParam,
    setFilter,
  } = useFilterParams();

  const academicYear =
    getParam("academicYear");

  const { data: sessions } =
    useAcademicSessions();

  const {
    data,
    loading,
  } = useBillingAnalytics({
    academicYear,
  });

  const money = (
    value?: number,
  ) => {
    if (hideAmounts) {
      return "₹••••••";
    }

    return `₹${Number(
      value ?? 0,
    ).toLocaleString("en-IN")}`;
  };

  const collectionHealth =
    (data?.collectionRate ?? 0) >= 95
      ? "Excellent"
      : (data?.collectionRate ?? 0) >= 80
      ? "Good"
      : "Attention";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Analytics"
        subtitle="Collections, recoveries, late fees and financial performance"
        action={
          <button
            onClick={() =>
              setHideAmounts(
                !hideAmounts,
              )
            }
            className="
            inline-flex
            items-center
            gap-2
            px-3
            py-2
            rounded-lg
            border
            border-slate-200
            text-sm
            bg-white
            hover:bg-slate-50
            "
          >
            {hideAmounts ? (
              <>
                <Eye className="w-4 h-4" />
                Show Amounts
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4" />
                Hide Amounts
              </>
            )}
          </button>
        }
      />

      {/* FILTERS */}

      <div
        style={{
          background:
            "var(--bg-surface)",
          border:
            "1px solid var(--border-light)",
          borderRadius:
            "var(--radius-lg)",
          boxShadow:
            "var(--shadow-sm)",
        }}
        className="p-4"
      >
        <div className="max-w-sm">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
            Academic Session
          </label>

          <select
            value={academicYear}
            onChange={(e) =>
              setFilter(
                "academicYear",
                e.target.value,
              )
            }
            className="
            w-full
            px-3
            py-2
            border
            rounded-lg
            bg-white
            "
          >
            <option value="">
              All Sessions
            </option>

            {(sessions ?? []).map(
              (s: any) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      {/* PRIMARY */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Invoiced"
          value={money(
            data?.totalInvoiced,
          )}
          icon={
            <Receipt className="w-5 h-5" />
          }
          color="blue"
          loading={loading}
        />

        <StatCard
          label="Collected"
          value={money(
            data?.totalCollected,
          )}
          icon={
            <BadgeIndianRupee className="w-5 h-5" />
          }
          color="green"
          loading={loading}
        />

        <StatCard
          label="Outstanding"
          value={money(
            data?.outstanding,
          )}
          icon={
            <AlertTriangle className="w-5 h-5" />
          }
          color="red"
          loading={loading}
        />

        <StatCard
          label="Collection Rate"
          value={`${Number(
            data?.collectionRate ??
              0,
          ).toFixed(1)}%`}
          icon={
            <Percent className="w-5 h-5" />
          }
          color="purple"
          loading={loading}
        />
      </div>

      {/* LATE FEES */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Late Fee Applied"
          value={money(
            data?.lateFeeApplied,
          )}
          icon={
            <Clock3 className="w-5 h-5" />
          }
          color="amber"
          loading={loading}
        />

        <StatCard
          label="Late Fee Collected"
          value={money(
            data?.lateFeeCollected,
          )}
          icon={
            <BadgeIndianRupee className="w-5 h-5" />
          }
          color="green"
          loading={loading}
        />

        <StatCard
          label="Late Fee Outstanding"
          value={money(
            data?.lateFeeOutstanding,
          )}
          icon={
            <AlertTriangle className="w-5 h-5" />
          }
          color="red"
          loading={loading}
        />

        <StatCard
          label="Late Fee Waived"
          value={money(
            data?.lateFeeWaived,
          )}
          icon={
            <Wallet className="w-5 h-5" />
          }
          color="blue"
          loading={loading}
        />
      </div>

      {/* OTHER */}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Discounts Given"
          value={money(
            data?.discountsGiven,
          )}
          icon={
            <Wallet className="w-5 h-5" />
          }
          color="blue"
          loading={loading}
        />

        <StatCard
          label="Refunds Issued"
          value={money(
            data?.refundsIssued,
          )}
          icon={
            <Wallet className="w-5 h-5" />
          }
          color="red"
          loading={loading}
        />

        <StatCard
          label="Overdue Invoices"
          value={
            data?.overdueInvoices ??
            0
          }
          icon={
            <AlertTriangle className="w-5 h-5" />
          }
          color="red"
          loading={loading}
        />

        <StatCard
          label="Collection Health"
          value={collectionHealth}
          icon={
            <Percent className="w-5 h-5" />
          }
          color={
            collectionHealth ===
            "Excellent"
              ? "green"
              : collectionHealth ===
                "Good"
              ? "amber"
              : "red"
          }
          loading={loading}
        />
      </div>
    </div>
  );
}
