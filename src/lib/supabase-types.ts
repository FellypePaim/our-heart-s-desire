// Extended types for our tables - derived from Supabase schema
export interface Client {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  plan: string;
  expiration_date: string;
  notes: string | null;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
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
