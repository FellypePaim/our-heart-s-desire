import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useWhatsAppInstance() {
  const { user } = useAuth();

  const { data: instance, isLoading } = useQuery({
    queryKey: ["whatsapp_instance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user,
  });

  const hasInstance = !!instance?.instance_key && !!instance?.api_token;

  const sendViaApi = async (phone: string, message: string) => {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: { phone, message },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  return { instance, hasInstance, isLoading, sendViaApi };
}
