import { Gamepad2Icon } from "lucide-react"

import { Separator } from "@/components/ui/separator"

export function SiteHeader({ title = "战绩概览" }: { title?: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <a href="#overview" className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gamepad2Icon />
          </span>
          <span className="grid min-w-0 text-left leading-tight">
            <span className="truncate text-sm font-semibold">PUBG Insight</span>
            <span className="truncate text-xs text-muted-foreground">
              官方战绩与比赛分析
            </span>
          </span>
        </a>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <h1 className="hidden text-sm font-medium sm:block">{title}</h1>
        <nav
          className="ml-auto hidden items-center gap-1 md:flex"
          aria-label="主导航"
        >
          <a
            href="#overview"
            className="rounded-md px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            首页
          </a>
          <a
            href="#matches"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            近期比赛
          </a>
          <a
            href="#analysis"
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            比赛分析
          </a>
        </nav>
      </div>
    </header>
  )
}
