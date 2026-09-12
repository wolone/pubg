"use client"

import * as React from "react"
import {
  ChartNoAxesCombinedIcon,
  CrosshairIcon,
  Gamepad2Icon,
  HistoryIcon,
  LayoutDashboardIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navigation = [
  { title: "战绩概览", href: "#overview", icon: LayoutDashboardIcon },
  { title: "近期比赛", href: "#matches", icon: HistoryIcon },
  { title: "比赛分析", href: "#analysis", icon: ChartNoAxesCombinedIcon },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<a href="#overview" />}>
              <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Gamepad2Icon className="size-4" data-icon="inline-start" />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">PUBG Insight</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  官方战绩与比赛分析
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      render={<a href={item.href} />}
                    >
                      <Icon data-icon="inline-start" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>数据来源</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 text-xs leading-5 text-sidebar-foreground/65">
            <p>数据来自 PUBG 官方 API。</p>
            <p>比赛与遥测数据最多保留 14 天。</p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-sidebar-foreground/65">
          <CrosshairIcon className="size-3.5" />
          <span>只读查询 · 无需登录</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
