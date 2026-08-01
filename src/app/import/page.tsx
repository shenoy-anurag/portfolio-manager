"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { UploadCloud, Download, FileUp, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ManualEntryDialog } from "@/components/manual-entry-dialog"
import { formatNumber, formatDate } from "@/lib/format"

interface ImportLog {
  id: string
  source: string
  fileName: string
  status: string
  createdAt: string
}

interface ParsedResponse {
  ok: boolean
  kind?: string
  fileName?: string
  error?: string
  preview?: {
    source: string
    fileName: string
    holdings: unknown[]
    transactions: unknown[]
  }
  pex?: unknown
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState("")
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedResponse | null>(null)
  const [committing, setCommitting] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [manualOpen, setManualOpen] = useState(false)

  const loadLogs = useCallback(async () => {
    const res = await fetch("/api/import-logs")
    const data = await res.json()
    setLogs(data.logs)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLogs()
  }, [loadLogs])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setParsing(true)
    setParsed(null)
    const form = new FormData()
    form.append("file", file)
    if (password) form.append("password", password)
    try {
      const res = await fetch("/api/import/preview", { method: "POST", body: form })
      const data = (await res.json()) as ParsedResponse
      if (!data.ok) {
        toast.error(data.error ?? "Failed to parse file")
      } else {
        setParsed(data)
        toast.success(`Parsed ${file.name} (${data.kind})`)
      }
    } catch {
      toast.error("Failed to parse file")
    } finally {
      setParsing(false)
    }
  }

  const commit = async () => {
    if (!parsed) return
    setCommitting(true)
    try {
      const payload =
        parsed.kind === "pex"
          ? { type: "pex", document: parsed.pex }
          : { type: "preview", preview: parsed.preview }
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Import committed successfully")
        setParsed(null)
        if (inputRef.current) inputRef.current.value = ""
        await loadLogs()
      } else {
        toast.error(data.error ?? "Commit failed")
      }
    } catch {
      toast.error("Commit failed")
    } finally {
      setCommitting(false)
    }
  }

  const holdingsCount = parsed?.preview?.holdings.length ?? 0
  const txnCount = parsed?.preview?.transactions.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-muted-foreground">
          Upload a Zerodha holdings export, CAMS CAS statement (Excel/PDF), or a backup
          JSON file.
        </p>
        <Button className="mt-3" onClick={() => setManualOpen(true)}>
          <Plus className="size-4" /> Add holding manually
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upload a statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  ref={inputRef}
                  accept=".xlsx,.xls,.pdf,.json"
                  disabled={parsing || committing}
                  onChange={(e) => onFile(e.target.files?.[0] ?? undefined)}
                />
              </div>
              <div className="w-40 space-y-1.5">
                <Label htmlFor="password">PDF password (optional)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  disabled={parsing || committing}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="For CAMS PDF"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">Zerodha holdings .xlsx</Badge>
              <Badge variant="secondary">CAMS CAS .xlsx</Badge>
              <Badge variant="secondary">CAMS CAS .pdf</Badge>
              <Badge variant="secondary">Portfolio backup .json</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Backup & restore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Download your full portfolio (instruments, accounts, holdings, transactions,
              history) as a single JSON file, or restore it later from the Import tab.
            </p>
            <Button asChild>
              <a href="/api/export" download>
                <Download className="size-4" /> Export portfolio JSON
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {parsing && (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <UploadCloud className="size-4 animate-pulse" />
            Parsing file… this can take a few seconds.
          </CardContent>
        </Card>
      )}

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Preview — {parsed.fileName} (
              <span className="uppercase">{parsed.kind}</span>)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.kind === "pex" ? (
              <p className="text-sm text-muted-foreground">
                Backup file detected. Committing will merge instruments, accounts,
                holdings and transactions idempotently (existing records are kept).
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border p-4">
                    <p className="text-xs text-muted-foreground">Holdings</p>
                    <p className="text-2xl font-semibold">{holdingsCount}</p>
                  </div>
                  <div className="border p-4">
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="text-2xl font-semibold">{txnCount}</p>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto border">
                  <div className="divide-y">
                    {(parsed.preview?.holdings ?? []).slice(0, 20).map((h, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-4 py-2 text-sm"
                      >
                        <span className="truncate pr-2">
                          {(h as { instrument: { name: string } }).instrument.name}
                        </span>
                        <span className="text-muted-foreground">
                          {formatNumber(
                            (h as { quantity: number }).quantity,
                            4,
                          )}{" "}
                          × {formatNumber((h as { avgCost: number }).avgCost)}
                        </span>
                      </div>
                    ))}
                    {(parsed.preview?.holdings ?? []).length > 20 && (
                      <div className="px-4 py-2 text-xs text-muted-foreground">
                        …and {(parsed.preview?.holdings ?? []).length - 20} more
                      </div>
                    )}
                    {(parsed.preview?.transactions ?? []).length > 0 && (
                      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                        {txnCount} transactions will be added (deduplicated by statement
                        details).
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setParsed(null)}>
                Discard
              </Button>
              <Button onClick={commit} disabled={committing}>
                <FileUp className="size-4" />
                {committing ? "Committing…" : "Commit import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Import history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No imports yet.
            </p>
          ) : (
            <div className="divide-y">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-6 py-3">
                  <Badge variant={l.status === "success" ? "default" : "destructive"}>
                    {l.status}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.fileName}</p>
                    <p className="text-xs text-muted-foreground">{l.source}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(l.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ManualEntryDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onDone={loadLogs}
      />
    </div>
  )
}
