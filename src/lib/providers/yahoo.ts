const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function yahooFetch(url: string, retries = 2): Promise<Response> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (res.status === 429 || res.status === 403) {
      await sleep(1500 * (attempt + 1))
      continue
    }
    return res
  }
  throw new Error(`Yahoo rate limited after ${retries} retries`)
}

export interface YahooQuote {
  symbol: string
  price: number
  previousClose?: number
  changePercent?: number
  name?: string
  currency?: string
  time?: number
}

export interface YahooHistoricalPoint {
  date: string
  close: number
}

interface YahooChartMeta {
  regularMarketPrice?: number
  chartPreviousClose?: number
  previousClose?: number
  regularMarketChangePercent?: number
  shortName?: string
  longName?: string
  currency?: string
  regularMarketTime?: number
}

interface YahooChartResult {
  meta?: YahooChartMeta
}

function parseChartResult(json: { chart?: { result?: YahooChartResult[] } }, symbol: string): YahooQuote | null {
  const result = json?.chart?.result?.[0]
  if (!result) return null
  const meta = result.meta ?? {}
  const price = meta.regularMarketPrice ?? meta.chartPreviousClose
  if (typeof price !== 'number' || !Number.isFinite(price)) return null
  return {
    symbol,
    price,
    previousClose: meta.chartPreviousClose ?? meta.previousClose,
    changePercent: meta.regularMarketChangePercent,
    name: meta.shortName ?? meta.longName,
    currency: meta.currency,
    time: meta.regularMarketTime,
  }
}

export async function fetchQuote(symbol: string): Promise<YahooQuote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=5d`
  const res = await yahooFetch(url)
  if (!res.ok) return null
  const json = await res.json()
  return parseChartResult(json, symbol)
}

export async function fetchQuotes(symbols: string[]): Promise<YahooQuote[]> {
  const unique = [...new Set(symbols)]
  const quotes: YahooQuote[] = []
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10)
    const results = await Promise.allSettled(chunk.map((s) => fetchQuote(s)))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) quotes.push(r.value)
    }
    if (i + 10 < unique.length) await sleep(400)
  }
  return quotes
}

export async function fetchHistory(
  symbol: string,
  range: '1mo' | '3mo' | '1y' = '1y',
): Promise<YahooHistoricalPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1d&range=${range}`
  const res = await yahooFetch(url)
  if (!res.ok) return []
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) return []
  const ts: number[] = result.timestamp ?? []
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? []
  const points: YahooHistoricalPoint[] = []
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i]
    if (typeof c === 'number' && Number.isFinite(c)) {
      points.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c })
    }
  }
  return points
}
