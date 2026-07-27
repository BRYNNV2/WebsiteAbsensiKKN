import { useEffect, useState, useCallback } from "react";
import { supabase, type QrSession } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type SystemNotification = {
  id: string;
  title: string;
  message: string;
  timeAgo: string;
  createdAt: string;
  type: "session_created" | "session_scheduled" | "attendance_scanned" | "status_updated" | "system";
  link?: string;
  isRead: boolean;
};

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("kkn_read_notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fetchNotifications = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }

    try {
      const items: SystemNotification[] = [];
      const userReadSet = new Set(readIds);

      // Determine group_id
      let groupId = profile.group_id;
      if (!groupId && profile.role === "dosen") {
        const { data: g } = await supabase
          .from("kkn_groups")
          .select("id")
          .eq("dosen_id", profile.id)
          .maybeSingle();
        groupId = g?.id ?? null;
      }

      if (groupId) {
        // Fetch recent sessions in group
        const { data: sessions } = await supabase
          .from("qr_sessions")
          .select("*")
          .eq("group_id", groupId)
          .order("starts_at", { ascending: false })
          .limit(10);

        if (sessions && sessions.length > 0) {
          const now = new Date();
          const sessionIds = sessions.map((s) => s.id);

          // For Mahasiswa: Notifications when session created or scheduled
          if (profile.role === "mahasiswa") {
            sessions.forEach((s: QrSession) => {
              const startDate = new Date(s.starts_at);
              const isToday = startDate.toDateString() === now.toDateString();
              const isFuture = startDate > now;

              if (isFuture) {
                items.push({
                  id: `sess_sched_${s.id}`,
                  title: "📅 Sesi Absensi Terjadwal",
                  message: `Dosen telah menjadwalkan "${s.title}" untuk ${startDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}.`,
                  timeAgo: getRelativeTime(s.created_at),
                  createdAt: s.created_at,
                  type: "session_scheduled",
                  link: "/history",
                  isRead: userReadSet.has(`sess_sched_${s.id}`),
                });
              } else if (isToday) {
                items.push({
                  id: `sess_today_${s.id}`,
                  title: "📋 Sesi Absensi Hari Ini",
                  message: `Sesi "${s.title}" aktif hari ini. Silakan pindai QR untuk absensi.`,
                  timeAgo: getRelativeTime(s.created_at),
                  createdAt: s.created_at,
                  type: "session_created",
                  link: "/scan",
                  isRead: userReadSet.has(`sess_today_${s.id}`),
                });
              } else {
                items.push({
                  id: `sess_new_${s.id}`,
                  title: "📋 Sesi Absensi Baru",
                  message: `Dosen menambahkan sesi "${s.title}".`,
                  timeAgo: getRelativeTime(s.created_at),
                  createdAt: s.created_at,
                  type: "session_created",
                  link: "/history",
                  isRead: userReadSet.has(`sess_new_${s.id}`),
                });
              }
            });

            // Fetch records for this student
            const { data: myRecords } = await supabase
              .from("attendance_records")
              .select("id, session_id, status, scanned_at, created_at")
              .eq("student_id", profile.id)
              .order("created_at", { ascending: false })
              .limit(6);

            if (myRecords) {
              myRecords.forEach((rec) => {
                const s = sessions.find((x) => x.id === rec.session_id);
                const sTitle = s?.title ?? "Sesi Absensi";
                const statusLabel =
                  rec.status === "hadir"
                    ? "Hadir"
                    : rec.status === "terlambat"
                      ? "Terlambat"
                      : rec.status === "izin"
                        ? "Izin"
                        : rec.status === "sakit"
                          ? "Sakit"
                          : "Alpha";
                items.push({
                  id: `rec_st_${rec.id}`,
                  title: "✅ Status Absensi Tercatat",
                  message: `Status kehadiran Anda untuk "${sTitle}" tercatat sebagai ${statusLabel}.`,
                  timeAgo: getRelativeTime(rec.created_at || rec.scanned_at),
                  createdAt: rec.created_at || rec.scanned_at,
                  type: "status_updated",
                  link: "/history",
                  isRead: userReadSet.has(`rec_st_${rec.id}`),
                });
              });
            }
          }

          // For Dosen: Notifications when students scan attendance or sessions run
          if (profile.role === "dosen") {
            sessions.forEach((s: QrSession) => {
              const startDate = new Date(s.starts_at);
              if (startDate.toDateString() === now.toDateString()) {
                items.push({
                  id: `dosen_sess_${s.id}`,
                  title: "📌 Sesi KKN Hari Ini",
                  message: `Sesi "${s.title}" aktif dan siap dipindai mahasiswa.`,
                  timeAgo: getRelativeTime(s.created_at),
                  createdAt: s.created_at,
                  type: "session_scheduled",
                  link: "/sessions",
                  isRead: userReadSet.has(`dosen_sess_${s.id}`),
                });
              }
            });

            // Fetch student scan activities in group sessions
            const { data: groupRecords } = await supabase
              .from("attendance_records")
              .select("id, session_id, student_id, status, scanned_at, created_at")
              .in("session_id", sessionIds)
              .order("created_at", { ascending: false })
              .limit(8);

            if (groupRecords && groupRecords.length > 0) {
              const studentIds = [...new Set(groupRecords.map((r) => r.student_id))];
              const { data: stProfiles } = await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", studentIds);

              const stMap = new Map(stProfiles?.map((p) => [p.id, p.full_name]) ?? []);

              groupRecords.forEach((rec) => {
                const stName = stMap.get(rec.student_id) ?? "Mahasiswa";
                const s = sessions.find((x) => x.id === rec.session_id);
                const sTitle = s?.title ?? "Sesi Absensi";
                const statusLabel =
                  rec.status === "hadir"
                    ? "Hadir"
                    : rec.status === "terlambat"
                      ? "Telat"
                      : rec.status === "izin"
                        ? "Izin"
                        : rec.status === "sakit"
                          ? "Sakit"
                          : "Alpha";

                items.push({
                  id: `dosen_rec_${rec.id}`,
                  title: "📱 Mahasiswa Melakukan Absensi",
                  message: `${stName} mencatat kehadiran (${statusLabel}) pada "${sTitle}".`,
                  timeAgo: getRelativeTime(rec.created_at || rec.scanned_at),
                  createdAt: rec.created_at || rec.scanned_at,
                  type: "attendance_scanned",
                  link: "/dashboard",
                  isRead: userReadSet.has(`dosen_rec_${rec.id}`),
                });
              });
            }
          }
        }
      }

      // Sort by newest created_at date
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(items.slice(0, 10));
    } catch (e) {
      console.error("Error fetching notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [profile, readIds]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const newReadSet = new Set([...readIds, ...allIds]);
    const updated = Array.from(newReadSet);
    setReadIds(updated);
    localStorage.setItem("kkn_read_notifications", JSON.stringify(updated));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      localStorage.setItem("kkn_read_notifications", JSON.stringify(updated));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    markAsRead,
    refetch: fetchNotifications,
  };
}

function getRelativeTime(isoString: string): string {
  if (!isoString) return "Baru saja";
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  return `${days}h lalu`;
}
