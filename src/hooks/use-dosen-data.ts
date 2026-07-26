import { useCallback, useEffect, useState } from "react";
import { supabase, type KknGroup, type Profile } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type DosenData = {
  group: KknGroup | null;
  students: Profile[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useDosenData(): DosenData {
  const { profile } = useAuth();
  const [group, setGroup] = useState<KknGroup | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!profile || profile.role !== "dosen") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data: groupData, error: groupErr } = await supabase
      .from("kkn_groups")
      .select("id, name, location, dosen_id, created_at")
      .eq("dosen_id", profile.id)
      .maybeSingle();

    if (groupErr) {
      setError(groupErr.message);
      setLoading(false);
      return;
    }

    setGroup(groupData as KknGroup | null);

    if (!groupData) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const { data: studentData, error: studentErr } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, student_id, group_id, created_at"
      )
      .eq("group_id", groupData.id)
      .eq("role", "mahasiswa")
      .order("full_name", { ascending: true });

    if (studentErr) {
      setError(studentErr.message);
    } else {
      setStudents((studentData as Profile[]) ?? []);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { group, students, loading, error, reload };
}
