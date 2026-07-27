import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  QrCode,
  Users,
  ClipboardList,
  ScanLine,
  History,
  LogOut,
  Bell,
  Settings as SettingsIcon,
  Search,
  LayoutGrid,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  HelpCircle,
  ChevronsUpDown,
  Calendar,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  SidebarProvider,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const dosenNav: NavItem[] = [
  { to: "/", label: "Ringkasan", icon: LayoutDashboard },
  { to: "/students", label: "Mahasiswa", icon: Users },
  { to: "/sessions", label: "Sesi Absensi", icon: QrCode },
  { to: "/recap", label: "Rekap Kehadiran", icon: ClipboardList },
];

const mahasiswaNav: NavItem[] = [
  { to: "/", label: "Ringkasan", icon: LayoutDashboard },
  { to: "/scan", label: "Pindai QR", icon: ScanLine },
  { to: "/history", label: "Riwayat Absen", icon: History },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell() {
  const { profile, signOut } = useAuth();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarSearch, setSidebarSearch] = useState("");

  const navItems = useMemo<NavItem[]>(() => {
    if (!profile) return [];
    return profile.role === "dosen" ? dosenNav : mahasiswaNav;
  }, [profile]);

  const filteredNavItems = useMemo(() => {
    if (!sidebarSearch.trim()) return navItems;
    const q = sidebarSearch.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [navItems, sidebarSearch]);

  const currentPageTitle = useMemo(() => {
    if (location.pathname === "/settings") return "Pengaturan";
    if (location.pathname === "/support") return "Help & Support";
    const match = navItems.find((item) =>
      item.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.to)
    );
    return match ? match.label : "Dashboard";
  }, [navItems, location.pathname]);

  async function handleSignOut() {
    await signOut();
    toast.success("Anda telah keluar dari sistem.");
    navigate("/login", { replace: true });
  }

  if (!profile) return null;

  const roleLabel =
    profile.role === "dosen" ? "Dosen Pembimbing" : "Mahasiswa";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="p-3 space-y-2">
          {/* Header Brand */}
          <div className="flex items-center gap-2.5 px-1 py-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white p-0.5 shadow-2xs ring-1 ring-border/50">
              <img
                src="/logokkn.png"
                alt="Logo KKN"
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-bold tracking-tight text-foreground">
                AbsensiKKN
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Search bar directly below AbsensiKKN / Dosen Pembimbing */}
          <div className="relative group-data-[collapsible=icon]:hidden pt-1">
            <Search className="absolute left-2.5 top-3.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search anything ⌘K"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="pl-8 text-xs h-8 bg-muted/40 border-muted-foreground/20 rounded-lg focus-visible:bg-background"
            />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] tracking-wider uppercase text-muted-foreground font-semibold">
              MAIN NAVIGATION
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredNavItems.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={false}
                      tooltip={item.label}
                    >
                      <NavLink to={item.to} end={item.to === "/"}>
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={cn(
                                isActive && "text-sidebar-accent-foreground font-bold"
                              )}
                            />
                            <span>{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* SUPPORT Group matching reference screenshot */}
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel className="text-[10px] tracking-wider uppercase text-muted-foreground font-semibold">
              SUPPORT
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => toast.success("Terima kasih! Masukan Anda membantu pengembangan aplikasi.")}
                    tooltip="Feedback"
                  >
                    <MessageSquare />
                    <span>Feedback</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Help & Support">
                    <NavLink to="/support">
                      {({ isActive }) => (
                        <>
                          <HelpCircle className={cn(isActive && "text-sidebar-accent-foreground font-bold")} />
                          <span>Help & Support</span>
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Pengaturan">
                    <NavLink to="/settings">
                      {({ isActive }) => (
                        <>
                          <SettingsIcon className={cn(isActive && "text-sidebar-accent-foreground font-bold")} />
                          <span>Settings</span>
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Sidebar Footer User Pill matching reference screenshot */}
        <SidebarFooter className="p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="border border-border/60 bg-muted/30 hover:bg-muted/60 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl transition-all"
                  >
                    <div className="relative">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs font-bold bg-muted text-foreground">
                          {initials(profile.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                    </div>

                    <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden min-w-0">
                      <span className="truncate font-bold text-foreground">
                        {profile.full_name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {profile.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="size-4 text-muted-foreground shrink-0 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="end"
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl p-1 shadow-xl"
                >
                  <DropdownMenuLabel className="p-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-xs">{profile.full_name}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {roleLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs cursor-pointer"
                    onClick={() => navigate("/settings")}
                  >
                    <SettingsIcon className="size-4" />
                    Pengaturan Akun
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-4" />
                    Keluar Akun
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 max-w-full overflow-x-hidden">
        {/* Kravio Top Header Navigation matching exact screenshot */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Left Breadcrumb Navigation: [LayoutGrid Icon] Overview / Dashboard */}
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1.5 h-4" />
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <LayoutGrid className="size-4 text-muted-foreground/80" />
              <span>Ringkasan</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-semibold text-foreground">{currentPageTitle}</span>
            </div>
          </div>

          {/* Right Action Icons: Notification Bell, Settings, Mode Toggle */}
          <div className="flex items-center gap-2">
            {/* Notification Bell Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative size-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Notifikasi Sistem"
                >
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex size-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2.5 bg-rose-500 ring-2 ring-background"></span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-xl rounded-xl">
                <div className="flex items-center justify-between border-b p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-primary" />
                    <span className="font-bold text-xs text-foreground">Notifikasi Sistem</span>
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                        {unreadCount} Baru
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Tandai dibaca
                    </button>
                  )}
                </div>

                <div className="p-1 space-y-1 text-xs max-h-80 overflow-y-auto divide-y divide-border/30">
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground space-y-1">
                      <Bell className="size-6 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold text-foreground">Belum Ada Notifikasi</p>
                      <p className="text-[11px]">Notifikasi absensi &amp; sesi KKN akan muncul di sini.</p>
                    </div>
                  ) : (
                    notifications.map((item) => {
                      const Icon =
                        item.type === "session_scheduled"
                          ? Calendar
                          : item.type === "session_created"
                            ? QrCode
                            : item.type === "status_updated"
                              ? CheckCircle2
                              : UserCheck;

                      const iconColor =
                        item.type === "session_scheduled"
                          ? "text-purple-500 bg-purple-500/10"
                          : item.type === "session_created"
                            ? "text-sky-500 bg-sky-500/10"
                            : item.type === "status_updated"
                              ? "text-emerald-500 bg-emerald-500/10"
                              : "text-amber-500 bg-amber-500/10";

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            markAsRead(item.id);
                            if (item.link) navigate(item.link);
                          }}
                          className={cn(
                            "flex items-start gap-3 p-2.5 rounded-lg transition-colors cursor-pointer group",
                            !item.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", iconColor)}>
                            <Icon className="size-4" />
                          </div>
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={cn("text-xs truncate", !item.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                                {item.title}
                              </p>
                              {!item.isRead && (
                                <span className="size-1.5 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.message}
                            </p>
                            <span className="text-[10px] text-muted-foreground font-mono inline-block mt-0.5">
                              {item.timeAgo}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Settings Quick Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/settings")}
                  className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <SettingsIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 shadow-lg rounded-xl p-1">
                <DropdownMenuLabel className="text-xs font-semibold p-2">Pengaturan Sistem</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs cursor-pointer"
                  onClick={() => navigate("/settings")}
                >
                  <AlertCircle className="size-3.5" />
                  Ke Halaman Pengaturan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Dark Mode Toggle */}
            <ModeToggle />
          </div>
        </header>

        <div className="flex-1 min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
