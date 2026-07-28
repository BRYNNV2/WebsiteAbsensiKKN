import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRef = useRef<Profile | null>(null);

  async function loadProfile(userId: string, force = false) {
    // Jika profil sudah ter-load untuk user yang sama dan tidak ada instruksi paksa, cegah re-fetch berulang saat Alt-Tab / fokus jendela!
    if (!force && profileRef.current?.id === userId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, student_id, group_id, created_at"
      )
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) {
      profileRef.current = null;
      setProfile(null);
      setSession(null);
      await supabase.auth.signOut();
      return;
    }
    const pData = data as Profile;
    profileRef.current = pData;
    setProfile(pData);
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        return;
      }
      if (sess?.user) {
        if (profileRef.current?.id !== sess.user.id) {
          (async () => {
            await loadProfile(sess.user.id);
            if (mounted) setLoading(false);
          })();
        } else {
          if (mounted) setLoading(false);
        }
      } else {
        profileRef.current = null;
        setProfile(null);
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        profileRef.current = null;
        setProfile(null);
      },
      refreshProfile: async () => {
        if (session?.user) await loadProfile(session.user.id, true);
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
