"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { formatINR, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Analytics {
  totalValue: number
  totalInvested: number
  totalPnl: number
  totalPnlPercent: number
  xirr: number
  holdingsCount: number
  allocation: { assetClass: string; label: string; value: number; pct: number }[]
  accountAllocation: { label: string; value: number; pct: number }[]
  concentration: {
    hhi: number
    topHoldingWeight: number
    top5Weight: number
    topHolding: { name: string; pct: number } | null
  }
  opportunities: { severity: string; title: string; detail: string; metric?: number }[]
  staleCount: number
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d.analytics))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Deterministic portfolio insights computed from your data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Value" value={data ? formatINR(data.totalValue) : undefined} />
        <MetricCard
          label="Total P&L"
          value={data ? formatINR(data.totalPnl) : undefined}
          sub={data ? formatPercent(data.totalPnlPercent) : undefined}
          positive={data ? data.totalPnl >= 0 : undefined}
        />
        <MetricCard
          label="XIRR"
          value={data ? formatPercent(data.xirr * 100) : undefined}
          positive={data ? data.xirr >= 0 : undefined}
        />
        <MetricCard
          label="Holdings"
          value={data ? String(data.holdingsCount) : undefined}
          sub={data ? `${data.staleCount} stale` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Allocation by Asset Class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data ? (
              <Skeleton className="h-32" />
            ) : data.allocation.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              data.allocation.map((a) => (
                <div key={a.assetClass} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{a.label}</span>
                    <span className="text-muted-foreground">
                      {formatINR(a.value)} · {formatPercent(a.pct)}
                    </span>
                  </div>
                  <Progress value={a.pct} max={100} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Concentration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <Row label="HHI (Herfindahl)" value={data.concentration.hhi.toFixed(4)} />
                <Row
                  label="Top holding"
                  value={
                    data.concentration.topHolding
                      ? `${data.concentration.topHolding.name} · ${formatPercent(
                          data.concentration.topHolding.pct * 100,
                        )}`
                      : "—"
                  }
                />
                <Row
                  label="Top 5 weight"
                  value={formatPercent(data.concentration.top5Weight * 100)}
                />
                <p className="pt-2 text-xs text-muted-foreground">
                  Higher HHI means your returns depend on fewer positions. A value under
                  0.2 generally indicates good diversification.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Opportunities & Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data ? (
            <Skeleton className="h-32" />
          ) : data.opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags right now.</p>
          ) : (
            data.opportunities.map((o, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border p-3"
              >
                <Badge variant={SEVERITY_STYLE[o.severity] as "default" | "secondary" | "destructive" | "outline"}>
                  {o.severity}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{o.title}</p>
                  <p className="text-sm text-muted-foreground">{o.detail}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
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
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
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
            <Skeleton className="h-8 w-24" />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
