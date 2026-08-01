"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatINR, formatPercent, formatDate } from "@/lib/format"
import { ASSET_CLASS_LABELS } from "@/lib/constants"

interface HoldingRow {
  holdingId: string
  symbol: string
  name: string
  assetClass: string
  accountName: string
  brokerName: string
  source: string
  currency: string
  quantity: number
  avgCost: number
  price: number
  priceDate: string | null
  valueInr: number
  pnlInr: number
  pnlPercent: number
}

export default function HoldingsPage() {
  const [rows, setRows] = useState<HoldingRow[]>([])
  const [editing, setEditing] = useState<Record<string, { qty: string; cost: string }>>({})

  const load = useCallback(async () => {
    const res = await fetch("/api/holdings")
    const data = await res.json()
    setRows(data.holdings)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const startEdit = (h: HoldingRow) => {
    setEditing((prev) => ({
      ...prev,
      [h.holdingId]: { qty: String(h.quantity), cost: String(h.avgCost) },
    }))
  }

  const save = async (h: HoldingRow) => {
    const draft = editing[h.holdingId]
    if (!draft) return
    const quantity = Number(draft.qty)
    const avgCost = Number(draft.cost)
    if (!Number.isFinite(quantity) || !Number.isFinite(avgCost)) {
      toast.error("Enter valid numbers")
      return
    }
    const res = await fetch(`/api/holdings/${h.holdingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity, avgCost }),
    })
    if (res.ok) {
      toast.success("Holding updated")
      setEditing((prev) => {
        const next = { ...prev }
        delete next[h.holdingId]
        return next
      })
      await load()
    } else {
      const data = await res.json()
      toast.error(data.error ?? "Update failed")
    }
  }

  const remove = async (h: HoldingRow) => {
    if (!window.confirm(`Remove ${h.name}?`)) return
    const res = await fetch(`/api/holdings/${h.holdingId}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Holding removed")
      await load()
    } else {
      const data = await res.json()
      toast.error(data.error ?? "Delete failed")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} holding(s) at current prices.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No holdings yet. Head to Import to upload a statement or add entries manually.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => {
                const draft = editing[h.holdingId]
                return (
                  <TableRow key={h.holdingId}>
                    <TableCell>
                      <p className="font-medium">{h.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.symbol} · {h.brokerName}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{h.accountName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ASSET_CLASS_LABELS[h.assetClass as keyof typeof ASSET_CLASS_LABELS] ??
                          h.assetClass}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {draft ? (
                        <Input
                          className="ml-auto h-8 w-24 text-right"
                          value={draft.qty}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [h.holdingId]: { ...p[h.holdingId], qty: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <span className="text-sm">{h.quantity.toLocaleString("en-IN")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {draft ? (
                        <Input
                          className="ml-auto h-8 w-28 text-right"
                          value={draft.cost}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [h.holdingId]: { ...p[h.holdingId], cost: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <span className="text-sm">{formatINR(h.avgCost)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">{formatINR(h.price)}</span>
                      {h.priceDate && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(h.priceDate)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatINR(h.valueInr)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-sm font-medium ${
                          h.pnlInr >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatINR(h.pnlInr)}
                      </span>
                      <p
                        className={`text-xs ${
                          h.pnlInr >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {formatPercent(h.pnlPercent)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {draft ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="default" onClick={() => save(h)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setEditing((p) => {
                                const next = { ...p }
                                delete next[h.holdingId]
                                return next
                              })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => startEdit(h)}>
                            Edit
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(h)}>
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
