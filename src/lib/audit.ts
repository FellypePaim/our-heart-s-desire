import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  userId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, any>
) {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details || {},
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
