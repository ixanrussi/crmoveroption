import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "user" | "comercial" | "affiliate";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isActive: boolean;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isComercial: boolean;
  isAffiliate: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.functions.invoke<{ roles: AppRole[]; isActive: boolean }>("get-auth-context");

      if (!error && data) {
        setRoles(data.roles ?? []);
        setIsActive(!!data.isActive);
        return;
      }

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 600));
      }
    }

    setRoles([]);
    setIsActive(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setLoading(true);
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          fetchRoles().finally(() => setLoading(false));
        }, 0);
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) await fetchRoles();
      else setRoles([]);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isComercial = roles.includes("comercial");

  return (
    <AuthContext.Provider value={{ session, user, roles, isActive, loading, isSuperAdmin, isAdmin, isComercial, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
