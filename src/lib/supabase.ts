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

export type Role = "dosen" | "mahasiswa"

export type Profile = {
  id: string
  email: string
  full_name: string
  role: Role
  student_id: string | null
  group_id: string | null
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
