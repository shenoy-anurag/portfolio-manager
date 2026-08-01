"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { REFRESH_CADENCES } from "@/lib/constants"

interface Settings {
  refreshCadence: string
  refreshTime: string
  concentrationThreshold: number
  yahooEnabled: boolean
  amfiEnabled: boolean
  aiEnabled: boolean
  aiProvider: string
  aiModel: string
  installedAt: string | null
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refreshCadence: settings.refreshCadence,
          refreshTime: settings.refreshTime,
          concentrationThreshold: Number(settings.concentrationThreshold),
          yahooEnabled: settings.yahooEnabled,
          amfiEnabled: settings.amfiEnabled,
          aiEnabled: settings.aiEnabled,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Settings saved")
        setSettings(data.settings)
      } else {
        toast.error(data.error ?? "Save failed")
      }
    } catch {
      toast.error("Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Refresh cadence, data sources and feature toggles.
        </p>
      </div>

      <div className="max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Price refresh</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cadence</Label>
              <Select
                value={settings.refreshCadence}
                onValueChange={(v) => update("refreshCadence", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_CADENCES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Prices refresh automatically while the app is running. Daily mode uses
                the time below (IST).
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-32 space-y-1.5">
                <Label htmlFor="refreshTime">Daily time (IST)</Label>
                <Input
                  id="refreshTime"
                  value={settings.refreshTime}
                  onChange={(e) => update("refreshTime", e.target.value)}
                  placeholder="18:00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Data sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Yahoo Finance"
              description="Indian & US equity quotes via the free Yahoo API."
              checked={settings.yahooEnabled}
              onCheckedChange={(v) => update("yahooEnabled", v)}
            />
            <ToggleRow
              label="AMFI NAV feed"
              description="Mutual fund NAVs from the official daily NAVAll.txt file."
              checked={settings.amfiEnabled}
              onCheckedChange={(v) => update("amfiEnabled", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="conc">Concentration threshold</Label>
              <Input
                id="conc"
                type="number"
                min={0.05}
                max={1}
                step={0.05}
                value={settings.concentrationThreshold}
                onChange={(e) => update("concentrationThreshold", Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                A single holding above this fraction of the portfolio triggers a
                concentration flag.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <ToggleRow
                label="AI-powered assessment (coming soon)"
                description="When enabled, an OpenAI-backed narrative review will be generated on the Analytics page."
                checked={settings.aiEnabled}
                onCheckedChange={(v) => update("aiEnabled", v)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Provider: {settings.aiProvider} · Model: {settings.aiModel}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
