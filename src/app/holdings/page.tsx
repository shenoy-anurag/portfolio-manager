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
import { Badge } from "@/components/ui/badge"
import { ManualEntryDialog } from "@/components/manual-entry-dialog"
import type { HoldingToEdit } from "@/components/manual-entry-dialog"
import { formatINR, formatPercent, formatDate } from "@/lib/format"
import { ASSET_CLASS_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface HoldingRow {
  holdingId: string
  symbol: string
  name: string
  assetClass: string
  accountName: string
  accountType: string
  brokerName: string
  source: string
  currency: string
  quantity: number
  avgCost: number
  purchaseDate: string | null
  price: number
  priceDate: string | null
  valueInr: number
  pnlInr: number
  pnlPercent: number
}

export default function HoldingsPage() {
  const [rows, setRows] = useState<HoldingRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editingHolding, setEditingHolding] = useState<HoldingToEdit | null>(null)

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
    setEditingHolding(h)
    setEditOpen(true)
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
        <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">
          No holdings yet. Head to Import to upload a statement or add entries manually.
        </div>
      ) : (
        <div className="border">
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
                      <span className="text-sm">{h.quantity.toLocaleString("en-IN")}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm">{formatINR(h.avgCost)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">{formatINR(h.price)}</span>
                      {h.priceDate && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(h.priceDate)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatINR(h.valueInr)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          h.pnlInr >= 0 ? "text-positive" : "text-negative",
                        )}
                      >
                        {formatINR(h.pnlInr)}
                      </span>
                      <p
                        className={cn(
                          "text-xs tabular-nums",
                          h.pnlInr >= 0 ? "text-positive" : "text-negative",
                        )}
                      >
                        {formatPercent(h.pnlPercent)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(h)}>
                          Edit
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(h)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ManualEntryDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditingHolding(null)
        }}
        onDone={load}
        holding={editingHolding}
      />
    </div>
  )
}
