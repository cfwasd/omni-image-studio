"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, Palette, Image as ImageIcon, Settings, LogOut } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/me", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { label: "创作工作台", href: "/studio", icon: Palette },
    { label: "历史画廊", href: "/gallery", icon: ImageIcon },
    { label: "系统与服务配置", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-violet-500 selection:text-white pb-16 md:pb-0">
      {/* 顶部导航：超宽流式排版 */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-xl">
        <div className="w-full px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/studio" className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                  OmniImage Studio
                </span>
                <span className="text-[10px] text-neutral-400 -mt-0.5">全象生图工作台</span>
              </div>
            </Link>

            {/* Desktop 导航 */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-neutral-800/90 text-white shadow-sm shadow-black/20"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-violet-400" : ""}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
              title="退出登录"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主工作区：展开为超宽流式排版 (从 max-w-7xl 扩大为 w-full px-4 sm:px-8)，彻底解决太窄问题 */}
      <main className="flex-1 w-full px-4 sm:px-8 py-6">{children}</main>

      {/* 移动端底部沉浸 TabBar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-800/80 px-2 py-1 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg min-w-[64px] min-h-[48px] ${
                active ? "text-violet-400" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
