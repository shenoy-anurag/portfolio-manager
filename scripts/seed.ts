import { prisma } from '@/lib/db'
import { ensureInstalled, setSetting } from '@/lib/settings'
import { SETTING_KEYS } from '@/lib/constants'

async function main() {
  await ensureInstalled()
  await setSetting(SETTING_KEYS.installedAt, new Date().toISOString())

  const zerodha = await prisma.broker.upsert({
    where: { name: 'Zerodha' },
    create: { name: 'Zerodha', kind: 'imported' },
    update: {},
  })
  const cams = await prisma.broker.upsert({
    where: { name: 'CAMS' },
    create: { name: 'CAMS', kind: 'imported' },
    update: {},
  })
  const manual = await prisma.broker.upsert({
    where: { name: 'Manual' },
    create: { name: 'Manual', kind: 'manual' },
    update: {},
  })

  async function upsertInstrument(data: {
    symbol: string
    name: string
    assetClass: 'equity' | 'mf_equity' | 'ppf' | 'fd'
    source: 'yahoo' | 'amfi' | 'manual'
    currency: string
    amfiCode?: string
    interestRate?: number
  }) {
    return prisma.instrument.upsert({
      where: { source_symbol: { source: data.source, symbol: data.symbol } },
      create: data,
      update: { name: data.name, assetClass: data.assetClass, amfiCode: data.amfiCode },
    })
  }

  const reliance = await upsertInstrument({
    symbol: 'RELIANCE.NS',
    name: 'Reliance Industries',
    assetClass: 'equity',
    source: 'yahoo',
    currency: 'INR',
  })
  const hdfcBank = await upsertInstrument({
    symbol: 'HDFCBANK.NS',
    name: 'HDFC Bank',
    assetClass: 'equity',
    source: 'yahoo',
    currency: 'INR',
  })
  const midcap = await upsertInstrument({
    symbol: 'HDFC Mid Cap Fund - Growth Option - Direct Plan',
    name: 'HDFC Mid Cap Fund - Growth Option - Direct Plan',
    assetClass: 'mf_equity',
    source: 'amfi',
    currency: 'INR',
    amfiCode: '118989',
  })
  const ppf = await upsertInstrument({
    symbol: 'PPF-ACC-12345',
    name: 'PPF Account 12345',
    assetClass: 'ppf',
    source: 'manual',
    currency: 'INR',
    interestRate: 7.1,
  })
  const fd = await upsertInstrument({
    symbol: 'FD-SBI-01',
    name: 'SBI Fixed Deposit',
    assetClass: 'fd',
    source: 'manual',
    currency: 'INR',
    interestRate: 6.5,
  })

  const demat = await prisma.account.upsert({
    where: { brokerId_type_name: { brokerId: zerodha.id, type: 'demat', name: 'Zerodha Demat' } },
    create: { brokerId: zerodha.id, name: 'Zerodha Demat', type: 'demat', currency: 'INR', params: {} },
    update: {},
  })
  const mfAcc = await prisma.account.upsert({
    where: { brokerId_type_name: { brokerId: cams.id, type: 'mf', name: 'CAMS Mutual Funds' } },
    create: { brokerId: cams.id, name: 'CAMS Mutual Funds', type: 'mf', currency: 'INR', params: {} },
    update: {},
  })
  const ppfAcc = await prisma.account.upsert({
    where: { brokerId_type_name: { brokerId: manual.id, type: 'ppf', name: 'PPF Account 12345' } },
    create: { brokerId: manual.id, name: 'PPF Account 12345', type: 'ppf', currency: 'INR', params: {} },
    update: {},
  })
  const fdAcc = await prisma.account.upsert({
    where: { brokerId_type_name: { brokerId: manual.id, type: 'fd', name: 'SBI FD' } },
    create: { brokerId: manual.id, name: 'SBI FD', type: 'fd', currency: 'INR', params: {} },
    update: {},
  })

  async function upsertHolding(
    accountId: string,
    instrumentId: string,
    quantity: number,
    avgCost: number,
  ) {
    await prisma.holding.upsert({
      where: { accountId_instrumentId: { accountId, instrumentId } },
      create: { accountId, instrumentId, quantity, avgCost, params: {} },
      update: { quantity, avgCost },
    })
  }

  await upsertHolding(demat.id, reliance.id, 10, 2450)
  await upsertHolding(demat.id, hdfcBank.id, 20, 1500)
  await upsertHolding(mfAcc.id, midcap.id, 1200, 42.5)
  await upsertHolding(ppfAcc.id, ppf.id, 500000, 1)
  await upsertHolding(fdAcc.id, fd.id, 250000, 1)

  const day = new Date()
  day.setHours(0, 0, 0, 0)
  await prisma.snapshot.upsert({
    where: { date: day },
    create: {
      date: day,
      totalValueInr: 1230000,
      investedInr: 1150000,
      breakdown: {
        equity: 300000,
        mf_equity: 100000,
        ppf: 500000,
        fd: 250000,
        other: 80000,
      } as object,
    },
    update: {},
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
