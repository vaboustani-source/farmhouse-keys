import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EVENT_ROLES = new Set(["admin", "owner", "event_director", "planner"]);
const FULL_ACCESS_EVENT_ROLES = new Set(["admin", "owner"]);

export type EventRolesMap = Record<string, string>;

type AuthState = {
  session: Session | null;
  loading: boolean;
  /** True when user is a global admin (users.role='admin') OR has any allowed event_users role. */
  isAuthorized: boolean;
  /** True when user is a global admin or has admin/owner role on any event. */
  hasFullAccess: boolean;
  /** Map of event_id -> role_in_event for this user. */
  eventRoles: EventRolesMap;
  /** Highest-priority role label for display ("Admin" / "Director" / "Planner"). */
  roleLabel: string;
  /** Backwards-compatible alias for hasFullAccess. */
  isAdmin: boolean;
  hasEventAccess: (eventId: string) => boolean;
  hasFullAccessForEvent: (eventId: string) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [globalAdmin, setGlobalAdmin] = useState(false);
  const [eventRoles, setEventRoles] = useState<EventRolesMap>({});
  const [loading, setLoading] = useState(true);

  const loadRoles = async (userId: string) => {
    const [{ data: userRow }, { data: euRows }] = await Promise.all([
      supabase.from("users").select("role").eq("id", userId).maybeSingle(),
      supabase.from("event_users").select("event_id, role_in_event").eq("user_id", userId),
    ]);
    setGlobalAdmin(userRow?.role === "admin");
    const map: EventRolesMap = {};
    for (const r of (euRows ?? []) as Array<{ event_id: string; role_in_event: string }>) {
      map[r.event_id] = r.role_in_event;
    }
    setEventRoles(map);
  };

  const clearRoles = () => {
    setGlobalAdmin(false);
    setEventRoles({});
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer DB call to avoid deadlock inside the listener.
        setTimeout(() => {
          loadRoles(s.user.id);
        }, 0);
      } else {
        clearRoles();
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        await loadRoles(s.user.id);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const eventRoleValues = Object.values(eventRoles);
  const hasAllowedEventRole = eventRoleValues.some((r) => ALLOWED_EVENT_ROLES.has(r));
  const isAuthorized = globalAdmin || hasAllowedEventRole;
  const hasFullAccess =
    globalAdmin || eventRoleValues.some((r) => FULL_ACCESS_EVENT_ROLES.has(r));

  const roleLabel = (() => {
    if (globalAdmin || eventRoleValues.includes("admin") || eventRoleValues.includes("owner")) return "Admin";
    if (eventRoleValues.includes("event_director")) return "Director";
    if (eventRoleValues.includes("planner")) return "Planner";
    return "";
  })();

  const value: AuthState = {
    session,
    loading,
    isAuthorized,
    hasFullAccess,
    eventRoles,
    roleLabel,
    isAdmin: hasFullAccess,
    hasEventAccess: (eventId) => {
      if (globalAdmin) return true;
      const r = eventRoles[eventId];
      return !!r && ALLOWED_EVENT_ROLES.has(r);
    },
    hasFullAccessForEvent: (eventId) => {
      if (globalAdmin) return true;
      const r = eventRoles[eventId];
      return !!r && FULL_ACCESS_EVENT_ROLES.has(r);
    },
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}