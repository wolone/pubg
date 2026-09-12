import { Gamepad2Icon } from "lucide-react"
import Link from "next/link"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function SiteHeader({
  title = "战绩查询",
  active = "stats",
}: {
  title?: string
  active?: "stats" | "replay"
}) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gamepad2Icon />
          </span>
          <span className="grid min-w-0 text-left leading-tight">
            <span className="truncate text-sm font-semibold">PUBG Insight</span>
            <span className="truncate text-xs text-muted-foreground">
              官方战绩与比赛回放
            </span>
          </span>
        </Link>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <h1 className="hidden text-sm font-medium sm:block">{title}</h1>
        <nav
          className="ml-auto hidden items-center gap-1 md:flex"
          aria-label="主导航"
        >
          <Link
            href="/"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
              active === "stats" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            战绩查询
          </Link>
          <Link
            href="/#matches"
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground",
              active === "replay"
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            比赛回放
          </Link>
        </nav>
      </div>
    </header>
  )
}
