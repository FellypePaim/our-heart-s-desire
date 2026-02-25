import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, addDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Search, RefreshCw, Calendar, Filter, Crown, Users, ShieldCheck } from "lucide-react";

interface UserPlan {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  planType: string;
  planExpiresAt: string;
  isExpired: boolean;
}

const roleLabels: Record<string, string> = {
  super_admin: "SuperAdmin",
  panel_admin: "Master",
  reseller: "Revendedor",
  user: "Usuário",
};

const roleIcons: Record<string, React.ReactNode> = {
  super_admin: <Crown className="h-3.5 w-3.5" />,
  panel_admin: <ShieldCheck className="h-3.5 w-3.5" />,
  reseller: <Users className="h-3.5 w-3.5" />,
};

const AdminPlans = () => {
  const { isSuperAdmin, loading: authLoading, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [renewOpen, setRenewOpen] = useState(false);
  const [renewUser, setRenewUser] = useState<UserPlan | null>(null);
  const [renewDate, setRenewDate] = useState("");
  const [renewPlanType, setRenewPlanType] = useState("monthly");
  const [renewSaving, setRenewSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: pError } = await supabase.functions.invoke("get-user-profiles");
      if (pError) throw pError;

      const { data: profiles, error: prError } = await supabase
        .from("profiles")
        .select("user_id, plan_type, plan_expires_at");
      if (prError) throw prError;

      const { data: rolesData, error: rError } = await supabase
        .from("user_roles")
        .select("user_id, role, is_active")
        .eq("is_active", true);
      if (rError) throw rError;

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      const planMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const roleMap = new Map((rolesData || []).map((r: any) => [r.user_id, r.role]));

      const allUserIds = new Set([
        ...(profilesData || []).map((p: any) => p.id),
        ...(profiles || []).map((p: any) => p.user_id),
      ]);

      const result: UserPlan[] = [];
      for (const uid of allUserIds) {
        const profile = profileMap.get(uid) as any;
        const plan = planMap.get(uid) as any;
        const role = roleMap.get(uid) as string || "user";

        if (role === "super_admin") continue; // Don't show super admins

        const expiresAt = plan?.plan_expires_at || new Date().toISOString();
        result.push({
          userId: uid,
          email: profile?.email || "—",
          displayName: profile?.name || profile?.email?.split("@")[0] || "—",
          role,
          planType: plan?.plan_type || "trial",
          planExpiresAt: expiresAt,
          isExpired: isPast(new Date(expiresAt)),
        });
      }

      result.sort((a, b) => new Date(a.planExpiresAt).getTime() - new Date(b.planExpiresAt).getTime());
      setUsers(result);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
  }, [isSuperAdmin]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch = !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "expired" && u.isExpired) ||
        (statusFilter === "active" && !u.isExpired);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const openRenew = (u: UserPlan) => {
    setRenewUser(u);
    setRenewDate("");
    setRenewPlanType("monthly");
    setRenewOpen(true);
  };

  const handleRenew = async (daysOrDate: number | string) => {
    if (!renewUser || !user) return;
    setRenewSaving(true);
    try {
      const newExpiry = typeof daysOrDate === "number"
        ? addDays(new Date(), daysOrDate).toISOString()
        : new Date(daysOrDate + "T23:59:59").toISOString();

      const { error } = await supabase
        .from("profiles")
        .update({ plan_type: renewPlanType, plan_expires_at: newExpiry })
        .eq("user_id", renewUser.userId);
      if (error) throw error;

      await logAudit(user.id, "plan_renewed_by_admin", "profile", renewUser.userId, {
        plan_type: renewPlanType,
        expires_at: newExpiry,
        target_email: renewUser.email,
      });

      toast({
        title: "Plano renovado!",
        description: `${renewUser.displayName} agora tem plano "${renewPlanType}" até ${format(new Date(newExpiry), "dd/MM/yyyy", { locale: ptBR })}.`,
      });
      setRenewOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setRenewSaving(false);
    }
  };

  if (!authLoading && !isSuperAdmin) return <Navigate to="/" replace />;

  const stats = {
    total: users.length,
    active: users.filter((u) => !u.isExpired).length,
    expired: users.filter((u) => u.isExpired).length,
    masters: users.filter((u) => u.role === "panel_admin").length,
    resellers: users.filter((u) => u.role === "reseller").length,
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-5 w-5 md:h-6 md:w-6" />
            Gestão de Planos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie planos de Masters e Revendedores
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users },
          { label: "Ativos", value: stats.active, icon: ShieldCheck },
          { label: "Expirados", value: stats.expired, icon: Calendar },
          { label: "Masters", value: stats.masters, icon: ShieldCheck },
          { label: "Revendedores", value: stats.resellers, icon: Users },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            <SelectItem value="panel_admin">Masters</SelectItem>
            <SelectItem value="reseller">Revendedores</SelectItem>
            <SelectItem value="user">Usuários</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {roleIcons[u.role]}
                      {roleLabels[u.role] || u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.planType === "trial" ? "secondary" : "default"}>
                      {u.planType === "trial" ? "Teste" : u.planType === "monthly" ? "Mensal" : u.planType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      {format(new Date(u.planExpiresAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      <p className="text-xs text-muted-foreground">
                        {u.isExpired
                          ? `Expirou ${formatDistanceToNow(new Date(u.planExpiresAt), { locale: ptBR, addSuffix: true })}`
                          : `Expira ${formatDistanceToNow(new Date(u.planExpiresAt), { locale: ptBR, addSuffix: true })}`}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isExpired ? "destructive" : "default"}>
                      {u.isExpired ? "Expirado" : "Ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openRenew(u)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Renovar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Renew Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar Plano</DialogTitle>
            <DialogDescription>
              Renovar plano de <strong>{renewUser?.displayName}</strong> ({renewUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de plano</Label>
              <Select value={renewPlanType} onValueChange={setRenewPlanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal (30 dias)</SelectItem>
                  <SelectItem value="trial">Teste (15 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" disabled={renewSaving} onClick={() => handleRenew(30)}>
                <Calendar className="h-4 w-4" />
                +30 dias
              </Button>
              <Button variant="outline" className="gap-2" disabled={renewSaving} onClick={() => handleRenew(90)}>
                <Calendar className="h-4 w-4" />
                +90 dias
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              ou selecione a data
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex gap-2">
              <Input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} className="flex-1" />
              <Button disabled={!renewDate || renewSaving} onClick={() => handleRenew(renewDate)}>
                {renewSaving ? "Salvando..." : "Renovar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlans;
