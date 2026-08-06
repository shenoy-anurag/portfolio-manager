"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ASSET_CLASSES = [
  { value: "equity", label: "Indian Equity" },
  { value: "mf_equity", label: "Equity Mutual Funds" },
  { value: "mf_debt", label: "Debt Mutual Funds" },
  { value: "ppf", label: "PPF" },
  { value: "epfo", label: "EPFO" },
  { value: "fd", label: "Fixed Deposit" },
  { value: "us_equity", label: "US Stock" },
  { value: "gold", label: "Gold" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

const ACCOUNT_TYPES = [
  { value: "demat", label: "Demat" },
  { value: "mf", label: "Mutual Funds" },
  { value: "ppf", label: "PPF" },
  { value: "epfo", label: "EPFO" },
  { value: "fd", label: "FD" },
  { value: "us", label: "US Broker" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
]

const DEFAULT_FORM = {
  symbol: "",
  name: "",
  assetClass: "other",
  accountType: "other",
  accountName: "",
  broker: "",
  currency: "INR",
  quantity: "",
  avgCost: "",
  purchaseDate: "",
}

export interface HoldingToEdit {
  holdingId: string
  symbol: string
  name: string
  assetClass: string
  accountType: string
  accountName: string
  brokerName: string
  currency: string
  quantity: number
  avgCost: number
  purchaseDate: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone?: () => void
  holding?: HoldingToEdit | null
}

export function ManualEntryDialog({ open, onOpenChange, onDone, holding }: Props) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)

  const isEdit = Boolean(holding)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(
      holding
        ? {
            symbol: holding.symbol,
            name: holding.name,
            assetClass: holding.assetClass,
            accountType: holding.accountType,
            accountName: holding.accountName,
            broker: holding.brokerName,
            currency: holding.currency,
            quantity: String(holding.quantity),
            avgCost: String(holding.avgCost),
            purchaseDate: holding.purchaseDate ?? "",
          }
        : DEFAULT_FORM,
    )
  }, [open, holding])

  const submit = async () => {
    setSaving(true)
    try {
      const payload = {
        symbol: form.symbol,
        name: form.name,
        assetClass: form.assetClass,
        accountType: form.accountType,
        accountName: form.accountName || undefined,
        broker: form.broker || undefined,
        currency: form.currency,
        quantity: Number(form.quantity),
        avgCost: Number(form.avgCost),
        purchaseDate: form.purchaseDate || undefined,
      }
      const res = await fetch(
        isEdit ? `/api/holdings/${holding!.holdingId}` : "/api/holdings",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )
      const data = await res.json()
      if (data.ok) {
        toast.success(isEdit ? "Holding updated" : "Holding added")
        if (!isEdit) setForm(DEFAULT_FORM)
        onOpenChange(false)
        onDone?.()
      } else {
        toast.error(data.error ?? (isEdit ? "Update failed" : "Failed to add"))
      }
    } catch {
      toast.error(isEdit ? "Update failed" : "Failed to add")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit holding" : "Add holding manually"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Symbol / Code">
            <Input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              placeholder="e.g. RELIANCE, PPF"
            />
          </Field>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Reliance Industries"
            />
          </Field>
          <Field label="Asset class">
            <Select
              value={form.assetClass}
              onValueChange={(v) => setForm({ ...form, assetClass: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Account type">
            <Select
              value={form.accountType}
              onValueChange={(v) => setForm({ ...form, accountType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Account name">
            <Input
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              placeholder="e.g. CAMS Mutual Funds"
            />
          </Field>
          <Field label="Broker / provider">
            <Input
              value={form.broker}
              onChange={(e) => setForm({ ...form, broker: e.target.value })}
              placeholder="e.g. Zerodha, CAMS"
            />
          </Field>
          <Field label="Currency">
            <Select
              value={form.currency}
              onValueChange={(v) => setForm({ ...form, currency: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">INR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantity / balance">
            <Input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Average cost / unit value">
            <Input
              type="number"
              value={form.avgCost}
              onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
            />
          </Field>
          <Field label="Purchase date (optional)">
            <Input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {isEdit ? (saving ? "Saving…" : "Save changes") : saving ? "Adding…" : "Add holding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
