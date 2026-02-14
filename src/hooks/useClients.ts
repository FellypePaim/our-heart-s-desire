import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Client } from "@/lib/supabase-types";
import { useAuth } from "./useAuth";

export function useClients() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("expiration_date", { ascending: true });

      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });
}
