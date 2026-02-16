import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ServiceOption {
  id: string;
  created_by: string | null;
  category: string;
  name: string;
  config: Record<string, any>;
  is_global: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Deduplicate: if user has a local override for the same name+category, hide the global one
function deduplicateOptions(options: ServiceOption[], userId?: string): ServiceOption[] {
  if (!userId) return options;
  const localNames = new Set(
    options.filter(o => !o.is_global && o.created_by === userId).map(o => `${o.category}::${o.name}`)
  );
  return options.filter(o => {
    if (o.is_global && localNames.has(`${o.category}::${o.name}`)) return false;
    return true;
  });
}

export function useServiceOptions(category?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["service_options", category, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("service_options")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (category) query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return deduplicateOptions((data || []) as ServiceOption[], user?.id);
    },
    enabled: !!user,
  });
}

export function useAllServiceOptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["service_options_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_options")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return (data || []) as ServiceOption[];
    },
    enabled: !!user,
  });
}

export function useUpsertServiceOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (option: Partial<ServiceOption> & { id?: string }) => {
      if (option.id) {
        const { error } = await supabase
          .from("service_options")
          .update({
            name: option.name,
            config: option.config as any,
            is_active: option.is_active,
          })
          .eq("id", option.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_options").insert({
          category: option.category!,
          name: option.name!,
          config: (option.config || {}) as any,
          created_by: option.created_by || null,
          is_global: option.is_global ?? false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_options"] });
      queryClient.invalidateQueries({ queryKey: ["service_options_all"] });
    },
  });
}

export function useDeleteServiceOption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service_options"] });
      queryClient.invalidateQueries({ queryKey: ["service_options_all"] });
    },
  });
}
