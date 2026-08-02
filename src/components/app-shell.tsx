"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import SvgIcon from "@/components/icons/svg-icon";

const NAV = [
  { href: "/", label: "Portfolio Overview" },
  { href: "/holdings", label: "Holdings" },
  { href: "/import", label: "Import" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
]

const SWIPE_THRESHOLD = 50

function isInteractive(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true
  return Boolean(
    target.closest("a, button, input, textarea, select, [role='button'], [data-no-swipe]"),
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const mobileNavRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null)

  const activeIndex = NAV.findIndex((item) => pathname === item.href)

  useEffect(() => {
    const active = mobileNavRef.current?.querySelector<HTMLElement>("[data-active='true']")
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })
  }, [pathname])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, target: e.target }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const { x, y, target } = touchStart.current
    touchStart.current = null

    if (isInteractive(target)) return

    const dx = e.changedTouches[0].clientX - x
    const dy = e.changedTouches[0].clientY - y
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return

    const nextIndex = activeIndex + (dx < 0 ? 1 : -1)
    if (nextIndex >= 0 && nextIndex < NAV.length) {
      router.push(NAV[nextIndex].href)
    }
  }

  return (
    <div className="flex min-h-screen flex-col mx-auto w-full lg:px-16 md:px-12 px-4">
      <nav className="sticky top-0 z-50 pb-8 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 font-bold">
        <div className="flex h-10 items-center gap-1.5 px-2 md:h-14 md:gap-2 md:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Portfolio Manager">
            <SvgIcon className="h-6 w-6" icon={"LogoIcon"} />
            <span className="hidden text-sm font-bold md:inline">Portfolio Manager</span>
          </Link>

          <div className="ml-2 hidden items-center gap-1 md:flex font-bold">
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground",
                    active && "text-primary",
                  )}
                >
                  {item.label}
                  {/* {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 bg-primary" />
                  )} */}
                </Link>
              )
            })}
          </div>

          <div
            ref={mobileNavRef}
            className="flex flex-1 items-center gap-1 overflow-x-auto py-1 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  className={cn(
                    "shrink-0 whitespace-nowrap px-3 py-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground",
                    active && "text-primary",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </nav>

      <main
        className="flex-1"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </main>
    </div>
  )
}
