import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase environment variables are missing. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/**
 * Helper untuk melakukan eksekusi Supabase query dengan mekanisme Retry & Error Catching
 * saat trafik tinggi atau banyak pengguna menyimpan data bersamaan (High Concurrency).
 */
export async function safeSupabaseCall<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  retries = 2,
  delayMs = 800
): Promise<{ data: T | null; error: any }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await queryFn()
      if (!res.error) return res

      const status = res.error?.status
      const msg = String(res.error?.message || "").toLowerCase()

      const isRetryable =
        status === 503 ||
        status === 504 ||
        status === 429 ||
        status === 413 ||
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("lock") ||
        msg.includes("timeout") ||
        msg.includes("connection")

      if (!isRetryable || attempt === retries) {
        return res
      }
    } catch (err: any) {
      if (attempt === retries) {
        return { data: null, error: err }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
  }
  return { data: null, error: new Error("Metode gagal setelah beberapa kali percobaan.") }
}

export type Role = "dosen" | "mahasiswa"

export type Profile = {
  id: string
  email: string
  full_name: string
  role: Role
  student_id: string | null
  group_id: string | null
  avatar_url?: string | null
  phone?: string | null
  nip?: string | null
  department?: string | null
  created_at: string
}

export type KknGroup = {
  id: string
  name: string
  location: string | null
  dosen_id: string
  created_at: string
}

export type QrSession = {
  id: string
  group_id: string
  title: string
  meeting_date: string
  starts_at: string
  ends_at: string
  location: string | null
  token: string
  created_by: string
  created_at: string
}

export type AttendanceStatus = "hadir" | "terlambat" | "izin" | "sakit" | "absen"

export type AttendanceRecord = {
  id: string
  session_id: string
  student_id: string
  status: AttendanceStatus
  scanned_at: string
  created_at: string
}

export type WorkProgram = {
  id: string
  group_id: string
  title: string
  code: string
  day_name: string // "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"
  date: string // YYYY-MM-DD
  starts_at: string // HH:mm
  ends_at: string // HH:mm
  category: string // e.g. "Bidang Kesehatan & Lingkungan", "Bidang Pendidikan"
  location: string // e.g. "Balai Desa", "Posko 1"
  description: string | null
  created_by: string
  created_at: string
}

export type FeedbackCategory = 'Saran & Masukan' | 'Laporan Kendala' | 'Pertanyaan' | 'Apresiasi & Ulasan'

export type FeedbackItem = {
  id: string
  user_id: string
  group_id: string | null
  category: string
  rating: number
  title: string
  content: string
  status: 'pending' | 'in_review' | 'resolved'
  response: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
  user_name?: string
  user_role?: string
}
