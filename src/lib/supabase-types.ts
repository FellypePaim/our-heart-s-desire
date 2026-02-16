// Extended types for our tables
export interface Client {
  id: string;
  user_id: string;
  reseller_id: string | null;
  name: string;
  phone: string | null;
  plan: string | null;
  expiration_date: string;
  notes: string | null;
  is_suspended: boolean | null;
  created_at: string;
  updated_at: string;
  valor: number | null;
  servidor: string | null;
  telas: number | null;
  aplicativo: string | null;
  dispositivo: string | null;
  captacao: string | null;
  forma_pagamento: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface GlobalSetting {
  id: string;
  key: string;
  value: Record<string, any>;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  status_key: string;
  template_text: string;
  created_at: string;
  updated_at: string;
}

export interface MessageLog {
  id: string;
  user_id: string;
  client_id: string;
  status_at_send: string;
  template_used: string | null;
  sent_at: string;
  delivery_status: string;
}

export interface Reseller {
  id: string;
  owner_user_id: string;
  display_name: string;
  status: string;
  limits: { max_clients?: number; max_messages_month?: number };
  created_at: string;
  updated_at: string;
  created_by: string | null;
}
