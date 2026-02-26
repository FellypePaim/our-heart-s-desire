import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, User, Camera, Lock, Mail, Smartphone, QrCode, Wifi, WifiOff, Loader2, Trash2, RefreshCw, Hash } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SettingsPage = () => {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // WhatsApp instance state
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("unknown");
  const [pollingActive, setPollingActive] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [linkMethod, setLinkMethod] = useState<"qr" | "code">("qr");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getRoleLabel = () => {
    if (roles.some((r) => r.role === "super_admin" && r.is_active)) return "SuperAdmin";
    if (roles.some((r) => r.role === "panel_admin" && r.is_active)) return "Master";
    if (roles.some((r) => r.role === "reseller" && r.is_active)) return "Revendedor";
    return "Usuário";
  };

  // Fetch profile
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (data) setDisplayName(data.display_name || "");
      return data;
    },
    enabled: !!user,
  });

  // Fetch whatsapp instance status
  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("manage-whatsapp-instance", {
        body: { action: "status" },
      });
      if (error) throw error;

      if (data?.status === "not_created") {
        setConnectionStatus("not_created");
        setQrCode(null);
        return;
      }

      const state = data?.data?.state || data?.data?.status || "unknown";
      setConnectionStatus(state);

      // Check multiple possible QR code field names
      const qr = data?.data?.qrCode || data?.qrCode || data?.data?.qrcode || data?.data?.base64 || null;
      
      if ((state === "connecting" || state === "qr") && qr) {
        setQrCode(qr);
      } else if (state === "connected" || state === "open") {
        setQrCode(null);
        if (pollingActive) {
          setPollingActive(false);
        }
      } else if (state !== "connecting" && state !== "qr") {
        setQrCode(null);
      }
    } catch (e: any) {
      console.error("Status error:", e);
    }
  }, [user, pollingActive]);

  // Initial status check
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling for QR code updates with 2-minute timeout
  useEffect(() => {
    if (pollingActive) {
      pollIntervalRef.current = setInterval(() => {
        // Check timeout (2 minutes)
        if (pollingStartTime && Date.now() - pollingStartTime > 120000) {
          setPollingActive(false);
          setQrCode(null);
          setConnectionStatus("timeout");
          toast({ title: "Tempo esgotado", description: "O QR Code expirou. Tente novamente.", variant: "destructive" });
          return;
        }
        fetchStatus();
      }, 5000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pollingActive, fetchStatus, pollingStartTime]);

  const handleCreateAndConnect = async () => {
    setWhatsappLoading(true);
    try {
      // Step 1: Create instance if needed
      const { data: createData, error: createError } = await supabase.functions.invoke(
        "manage-whatsapp-instance",
        { body: { action: "create" } }
      );
      if (createError) throw createError;
      if (createData?.error) throw new Error(createData.error);

      // Step 2: Connect (triggers QR code)
      const { data: connectData, error: connectError } = await supabase.functions.invoke(
        "manage-whatsapp-instance",
        { body: { action: "connect" } }
      );
      if (connectError) throw connectError;

      // Capture QR code from connect response immediately
      const qr = connectData?.qrCode || connectData?.data?.qrCode || connectData?.data?.qrcode || null;
      if (qr) {
        setQrCode(qr);
        setConnectionStatus("connecting");
      }

      toast({ title: "Instância criada! Escaneie o QR Code abaixo." });
      setPollingStartTime(Date.now());
      setPollingActive(true);
      if (!qr) await fetchStatus();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setWhatsappLoading(true);
    try {
      const { error } = await supabase.functions.invoke("manage-whatsapp-instance", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      setConnectionStatus("disconnected");
      setQrCode(null);
      setPollingActive(false);
      toast({ title: "WhatsApp desconectado!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteConfirmOpen(false);
    setWhatsappLoading(true);
    try {
      const { error } = await supabase.functions.invoke("manage-whatsapp-instance", {
        body: { action: "delete" },
      });
      if (error) throw error;
      setConnectionStatus("not_created");
      setQrCode(null);
      setPollingActive(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp_instance"] });
      toast({ title: "Instância removida!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleReconnect = async () => {
    setWhatsappLoading(true);
    try {
      const { data: connectData, error } = await supabase.functions.invoke("manage-whatsapp-instance", {
        body: { action: "connect" },
      });
      if (error) throw error;
      
      const qr = connectData?.qrCode || connectData?.data?.qrCode || null;
      if (qr) {
        setQrCode(qr);
        setConnectionStatus("connecting");
      }
      
      setPollingStartTime(Date.now());
      setPollingActive(true);
      if (!qr) await fetchStatus();
      toast({ title: "Reconectando... Escaneie o QR Code." });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handlePairingCode = async () => {
    if (!pairingPhone.trim()) {
      toast({ title: "Digite seu número de telefone", variant: "destructive" });
      return;
    }
    setPairingLoading(true);
    setPairingCode(null);
    try {
      // Ensure instance exists first
      const { data: createData, error: createError } = await supabase.functions.invoke(
        "manage-whatsapp-instance",
        { body: { action: "create" } }
      );
      if (createError) throw createError;
      if (createData?.error) throw new Error(createData.error);

      // Request pairing code
      const { data, error } = await supabase.functions.invoke("manage-whatsapp-instance", {
        body: { action: "pairingcode", phone: pairingPhone.replace(/\D/g, "") },
      });
      if (error) throw error;
      
      if (data?.code) {
        setPairingCode(data.code);
        setConnectionStatus("connecting");
        setPollingStartTime(Date.now());
        setPollingActive(true);
        toast({ title: "Código gerado! Digite no seu WhatsApp." });
      } else {
        toast({ title: "Erro", description: "Não foi possível gerar o código. Tente via QR Code.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setPairingLoading(false);
    }
  };

  const handleRetry = () => {
    setQrCode(null);
    setPairingCode(null);
    setConnectionStatus("not_created");
    setPollingActive(false);
    setPollingStartTime(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileLoading(true);
    try {
      if (profile) {
        const { error } = await supabase
          .from("profiles")
          .update({ display_name: displayName.trim() })
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert({ user_id: user.id, display_name: displayName.trim() });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Perfil atualizado!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB", variant: "destructive" });
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
      if (profile) {
        await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
      } else {
        await supabase.from("profiles").insert({ user_id: user.id, avatar_url: avatarUrl, display_name: "" });
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Avatar atualizado!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
    e.target.value = "";
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Senha atualizada!" });
      setNewPassword("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const initials = (displayName || user?.email || "U").slice(0, 2).toUpperCase();

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
      case "open":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1"><Wifi className="h-3 w-3" />Conectado</Badge>;
      case "connecting":
      case "qr":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1"><Loader2 className="h-3 w-3 animate-spin" />Conectando...</Badge>;
      case "disconnected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1"><WifiOff className="h-3 w-3" />Desconectado</Badge>;
      case "not_created":
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><Smartphone className="h-3 w-3" />Não vinculado</Badge>;
      case "timeout":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">⏰ Expirado</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 text-muted-foreground">Verificando...</Badge>;
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 md:h-6 md:w-6" />
          Configurações & Perfil
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie seu perfil e preferências
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Perfil
          </CardTitle>
          <CardDescription>Informações pessoais e avatar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={profile?.avatar_url || ""} alt="Avatar" />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={avatarUploading} className="gap-1.5">
                <Camera className="h-4 w-4" />
                {avatarUploading ? "Enviando..." : "Alterar foto"}
              </Button>
            </div>
            <form onSubmit={handleSaveProfile} className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label>Nome de exibição</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />E-mail</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input value={getRoleLabel()} disabled className="bg-muted" />
              </div>
              <Button type="submit" disabled={profileLoading}>
                {profileLoading ? "Salvando..." : "Salvar Perfil"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Defina uma nova senha para sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
            </div>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? "Salvando..." : "Alterar Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* WhatsApp Integration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            WhatsApp
            {getStatusBadge()}
          </CardTitle>
          <CardDescription>
            Vincule seu WhatsApp para enviar mensagens automáticas via API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Not created / timeout state */}
          {(connectionStatus === "not_created" || connectionStatus === "timeout") && (
            <div className="space-y-4 py-4">
              {connectionStatus === "timeout" && (
                <div className="text-center p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  ⏰ O tempo de vinculação expirou. Tente novamente.
                </div>
              )}
              
              <div className="text-center">
                <p className="font-medium">Vincular WhatsApp</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha como deseja vincular seu WhatsApp
                </p>
              </div>

              {/* Method selector */}
              <div className="flex gap-2 justify-center">
                <Button
                  variant={linkMethod === "qr" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMethod("qr")}
                  className="gap-1.5"
                >
                  <QrCode className="h-4 w-4" />
                  QR Code
                </Button>
                <Button
                  variant={linkMethod === "code" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMethod("code")}
                  className="gap-1.5"
                >
                  <Hash className="h-4 w-4" />
                  Código (celular)
                </Button>
              </div>

              {/* QR Code method */}
              {linkMethod === "qr" && (
                <div className="text-center space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Use um computador ou tablet para escanear o QR Code
                  </p>
                  <Button onClick={handleCreateAndConnect} disabled={whatsappLoading} className="gap-2">
                    {whatsappLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                    {whatsappLoading ? "Gerando QR Code..." : "Gerar QR Code"}
                  </Button>
                </div>
              )}

              {/* Pairing code method */}
              {linkMethod === "code" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Digite o número do seu WhatsApp (com DDD) para receber um código de vinculação
                  </p>
                  <div className="flex gap-2 max-w-sm mx-auto">
                    <Input
                      placeholder="5511999999999"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="text-center"
                    />
                    <Button onClick={handlePairingCode} disabled={pairingLoading} className="gap-1.5 shrink-0">
                      {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
                      {pairingLoading ? "Gerando..." : "Gerar"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connecting state with QR code or pairing code */}
          {(connectionStatus === "connecting" || connectionStatus === "qr") && (
            <div className="text-center space-y-4 py-4">
              {pairingCode ? (
                <>
                  <p className="font-medium">Digite o código no seu WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo → Vincular com número de telefone
                  </p>
                  <div className="inline-block px-8 py-4 bg-card border-2 border-primary rounded-xl shadow-lg">
                    <p className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                      {pairingCode}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O código expira em 2 minutos
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Escaneie o QR Code com seu WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
                  </p>
                  {qrCode ? (
                    <div className="inline-block p-4 bg-white rounded-xl shadow-lg">
                      <img
                        src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Carregando QR Code...
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O QR Code é atualizado automaticamente a cada 5 segundos
                  </p>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Cancelar e tentar novamente
              </Button>
            </div>
          )}

          {/* Connected state */}
          {(connectionStatus === "connected" || connectionStatus === "open") && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <Wifi className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-500">WhatsApp Conectado!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Suas mensagens serão enviadas automaticamente via API.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={fetchStatus} disabled={whatsappLoading} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  Verificar Status
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={whatsappLoading} className="gap-1.5 text-destructive hover:text-destructive">
                  <WifiOff className="h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            </div>
          )}

          {/* Disconnected state (instance exists but not connected) */}
          {connectionStatus === "disconnected" && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <WifiOff className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <p className="font-medium text-red-500">WhatsApp Desconectado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Reconecte escaneando o QR Code novamente.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleReconnect} disabled={whatsappLoading} className="gap-2">
                  {whatsappLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Reconectar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)} disabled={whatsappLoading} className="gap-1.5">
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá desvincular completamente seu WhatsApp do sistema. Você poderá vincular novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
