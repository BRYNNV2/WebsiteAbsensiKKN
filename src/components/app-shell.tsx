import { useMemo } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  QrCode,
  Users,
  ClipboardList,
  ScanLine,
  History,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

  const navItems = useMemo<NavItem[]>(() => {
    if (!profile) return [];
    return profile.role === "dosen" ? dosenNav : mahasiswaNav;
  }, [profile]);

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
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-semibold tracking-tight">
                AbsensiKKN
              </span>
              <span className="text-xs text-muted-foreground">
                {roleLabel}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
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
                                isActive && "text-sidebar-accent-foreground"
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
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar>
                      <AvatarFallback>
                        {initials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium">
                        {profile.full_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {profile.email}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="end"
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                >
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{profile.full_name}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {roleLabel}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="default"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
                  <UserRound className="size-3.5" />
                  {profile.full_name}
                </span>
              </TooltipTrigger>
              <TooltipContent>{roleLabel}</TooltipContent>
            </Tooltip>
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
