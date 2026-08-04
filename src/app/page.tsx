"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { formatINR, formatPercent, formatDate } from "@/lib/format"
import { ASSET_CLASS_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"

const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]

function cssColor(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback
  return (
    getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback
  )
}

const RANGES = [
  { key: "6M", days: 180 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: Infinity },
] as const

type RangeKey = (typeof RANGES)[number]["key"]

interface AnalyticsData {
  analytics: {
    totalValue: number
    totalInvested: number
    totalPnl: number
    totalPnlPercent: number
    xirr: number
    holdingsCount: number
    allocation: { assetClass: string; label: string; value: number; pct: number }[]
    opportunities: { severity: string; title: string; detail: string }[]
    staleCount: number
  }
}

interface HoldingsData {
  holdings: {
    holdingId: string
    name: string
    symbol: string
    assetClass: string
    valueInr: number
    pnlInr: number
    pnlPercent: number
    priceDate: string | null
  }[]
}

function NetWorthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">
        {formatINR(Number(payload[0]?.value ?? 0))}
      </p>
    </div>
  )
}

function AllocationTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name?: string; value?: number }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border bg-popover px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{payload[0]?.name}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatINR(Number(payload[0]?.value ?? 0))}
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData["analytics"] | null>(null)
  const [holdings, setHoldings] = useState<HoldingsData["holdings"]>([])
  const [snapshots, setSnapshots] = useState<
    { date: string; totalValueInr: number }[]
  >([])
  const [range, setRange] = useState<RangeKey>("ALL")
  const [activeIndex, setActiveIndex] = useState(-1)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [a, h, s] = await Promise.all([
      fetch("/api/analytics").then((r) => r.json()),
      fetch("/api/holdings").then((r) => r.json()),
      fetch("/api/snapshots").then((r) => r.json()),
    ])
    setAnalytics(a.analytics)
    setHoldings(h.holdings)
    setSnapshots(s.snapshots)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/refresh")
      const data = await res.json()
      if (data.ok) {
        toast.success(`Refreshed: ${data.quotesUpdated} quotes, ${data.navUpdated} NAVs`)
        await load()
      } else {
        toast.error(data.error ?? "Refresh failed")
      }
    } catch {
      toast.error("Refresh failed")
    } finally {
      setRefreshing(false)
    }
  }

  const green = cssColor("--chart-1", "#00c805")
  const gridColor = cssColor("--border", "rgba(255, 255, 255, 0.1)")
  const tickFill = cssColor("--muted-foreground", "#a1a1aa")
  const chartColors = CHART_VARS.map((v, i) =>
    cssColor(v, ["#00c805", "#0a8f2f", "#4f8cff", "#f0b90b", "#ff5d5d"][i]),
  )

  const cutoffDays = RANGES.find((r) => r.key === range)?.days ?? Infinity
  const maxDateMs = snapshots.reduce(
    (m, s) => Math.max(m, new Date(s.date).getTime()),
    0,
  )
  const cutoffMs = cutoffDays === Infinity ? 0 : maxDateMs - cutoffDays * 86400000
  const filteredSnapshots = snapshots.filter(
    (s) => new Date(s.date).getTime() >= cutoffMs,
  )

  const chartData = filteredSnapshots.map((s) => ({
    date: formatDate(s.date),
    value: Math.round(s.totalValueInr),
  }))

  const allocationData = (analytics?.allocation ?? []).map((a) => ({
    name: a.label,
    value: Math.round(a.value),
    pct: a.pct,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight pb-2">Portfolio Overview</h1>
          <p className="text-sm text-muted-foreground">
            Net worth snapshot and portfolio overview.
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh prices
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Net Worth"
          value={analytics ? formatINR(analytics.totalValue) : undefined}
          sub="current value"
        />
        <StatCard
          label="Invested"
          value={analytics ? formatINR(analytics.totalInvested) : undefined}
          sub="total invested"
        />
        <StatCard
          label="Overall P&L"
          value={analytics ? formatINR(analytics.totalPnl) : undefined}
          sub={
            analytics
              ? `${formatPercent(analytics.totalPnlPercent)} on invested`
              : undefined
          }
          positive={analytics ? analytics.totalPnl >= 0 : undefined}
        />
        <StatCard
          label="Portfolio XIRR"
          value={analytics ? formatPercent(analytics.xirr * 100) : undefined}
          sub={`${analytics?.holdingsCount ?? 0} holding(s)`}
          positive={analytics ? analytics.xirr >= 0 : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Net Worth History</CardTitle>
            <div className="flex items-center gap-1 bg-muted p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={cn(
                    "px-2 py-1 text-xs font-medium transition-colors",
                    range === r.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.key}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {snapshots.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No history yet. Refresh prices to record your first daily snapshot.
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No snapshots in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="value" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: tickFill }}
                    stroke={gridColor}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: tickFill }}
                    stroke={gridColor}
                    tickFormatter={(v: number) => formatINR(v, true)}
                  />
                  <Tooltip content={<NetWorthTooltip />} cursor={{ stroke: gridColor }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={green}
                    strokeWidth={2}
                    fill="url(#value)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {allocationData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No holdings yet.
              </div>
            ) : (
              <div className="flex h-64 items-center">
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={0}
                      strokeWidth={0}
                      onMouseLeave={() => setActiveIndex(-1)}
                    >
                      {allocationData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={chartColors[i % chartColors.length]}
                          fillOpacity={activeIndex === -1 || activeIndex === i ? 1 : 0.35}
                          stroke={cssColor("--background", "#0e0e13")}
                          onMouseEnter={() => setActiveIndex(i)}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<AllocationTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {allocationData.map((a, i) => (
                    <div key={a.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0"
                        style={{ backgroundColor: chartColors[i % chartColors.length] }}
                      />
                      <span className="truncate text-muted-foreground">{a.name}</span>
                      <span className="ml-auto tabular-nums text-xs text-muted-foreground">
                        {a.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Holdings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {holdings.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No holdings yet. Import a statement or add one manually.
            </div>
          ) : (
            <div className="divide-y">
              {holdings.slice(0, 6).map((h) => (
                <div
                  key={h.holdingId}
                  className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-accent/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ASSET_CLASS_LABELS[h.assetClass as keyof typeof ASSET_CLASS_LABELS] ??
                        h.assetClass}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{formatINR(h.valueInr)}</p>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        h.pnlInr >= 0 ? "text-positive" : "text-negative",
                      )}
                    >
                      {formatINR(h.pnlInr)} ({formatPercent(h.pnlPercent)})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string
  value?: string
  sub?: string
  positive?: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value ? (
          <>
            <p
              className={cn(
                "text-3xl font-semibold tracking-tight tabular-nums",
                positive === true && "text-positive",
                positive === false && "text-negative",
              )}
            >
              {value}
            </p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </>
        ) : (
          <>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </>
        )}
      </CardContent>
    </Card>
  )
}
