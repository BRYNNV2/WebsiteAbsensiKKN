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
} from "lucide-react";

import { useAuth } from "@/lib/auth";
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

      <SidebarInset>
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
                  className="relative size-8 rounded-full text-muted-foreground hover:text-foreground"
                >
                  <Bell className="size-4" />
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl rounded-xl">
                <div className="flex items-center justify-between border-b p-3">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-primary" />
                    <span className="font-semibold text-xs text-foreground">Notifikasi Sistem</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Terbaru</Badge>
                </div>
                <div className="p-2 space-y-1 text-xs max-h-64 overflow-y-auto">
                  <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-foreground text-xs">Aktivitas Scan Absensi</p>
                      <p className="text-[11px] text-muted-foreground truncate">Mahasiswa baru saja mencatat absensi QR KKN.</p>
                      <span className="text-[10px] text-muted-foreground font-mono">Baru saja</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <UserCheck className="size-4 text-sky-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-foreground text-xs">Sesi Absensi Aktif</p>
                      <p className="text-[11px] text-muted-foreground truncate">Sesi KKN aktif siap dipindai oleh mahasiswa.</p>
                      <span className="text-[10px] text-muted-foreground font-mono">10m lalu</span>
                    </div>
                  </div>
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

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
