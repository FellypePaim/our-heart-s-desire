import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "panel_admin" | "reseller" | "user";

interface UserRole {
  role: AppRole;
  tenant_id: string | null;
  is_active: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: UserRole[];
  isSuperAdmin: boolean;
  currentTenantId: string | null;
  impersonating: { userId: string; tenantId: string | null; sessionId: string } | null;
  setImpersonating: (imp: { userId: string; tenantId: string | null; sessionId: string } | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  roles: [],
  isSuperAdmin: false,
  currentTenantId: null,
  impersonating: null,
  setImpersonating: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [impersonating, setImpersonating] = useState<{ userId: string; tenantId: string | null; sessionId: string } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    
    const fetchRoles = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, tenant_id, is_active")
        .eq("user_id", session.user.id);

      if (!error && data) {
        setRoles(data as UserRole[]);
      }
      setLoading(false);
    };

    fetchRoles();
  }, [session?.user?.id]);

  const signOut = async () => {
    setImpersonating(null);
    await supabase.auth.signOut();
  };

  const isSuperAdmin = roles.some((r) => r.role === "super_admin" && r.is_active);
  const currentTenantId = roles.find((r) => r.tenant_id && r.is_active)?.tenant_id ?? null;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        roles,
        isSuperAdmin,
        currentTenantId,
        impersonating,
        setImpersonating,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
