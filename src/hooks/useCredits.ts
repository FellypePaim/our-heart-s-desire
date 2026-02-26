import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: balance = 0, isLoading } = useQuery({
    queryKey: ["credits", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("credits")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance ?? 0;
    },
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["credits"] });
  };

  return { balance, isLoading, invalidate };
}

export function useCreditsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["credits", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data, error } = await supabase
        .from("credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.balance ?? 0;
    },
    enabled: !!userId,
  });
}
