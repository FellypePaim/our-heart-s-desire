

## Plano: Sistema de Créditos para Ativação de Revendedores

### Conceito

- SuperAdmin distribui **créditos** para Masters
- Cada crédito = 1 mês de acesso para 1 revendedor
- Master gasta 1 crédito para ativar/renovar um revendedor por 30 dias
- Quando o plano do revendedor expira, o Master precisa gastar outro crédito para renovar

### Mudanças no Banco de Dados

**Nova tabela `credits`:**
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | Master que possui os créditos |
| balance | integer | Saldo atual de créditos |
| created_at / updated_at | timestamptz | Timestamps |

**Nova tabela `credit_transactions`** (histórico):
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | Master afetado |
| amount | integer | +X (recebeu) ou -1 (usou) |
| type | text | 'grant' (SA deu) / 'spend' (ativou revendedor) |
| target_user_id | uuid | Revendedor ativado (quando type=spend) |
| granted_by | uuid | SuperAdmin que concedeu (quando type=grant) |
| created_at | timestamptz | Quando ocorreu |

**RLS:**
- Masters veem apenas seus próprios créditos e transações
- SuperAdmin tem acesso total

### Mudanças no Frontend

1. **AdminPlans (SuperAdmin):** Adicionar botão "Dar Créditos" ao lado de "Renovar" para Masters, com dialog para informar quantidade. Exibir coluna de saldo de créditos na tabela.

2. **Resellers (Master):** No botão "Renovar plano" do revendedor, em vez de definir data manual, gastar 1 crédito do saldo do Master (+30 dias ao revendedor). Mostrar saldo de créditos no topo da página. Bloquear renovação se saldo = 0.

3. **Sidebar/Header:** Exibir badge com saldo de créditos para Masters.

### Fluxo

```text
SuperAdmin ──[concede X créditos]──► Master (balance += X)
                                        │
                                        ▼
Master ──[gasta 1 crédito]──► Revendedor (plan +30 dias)
                                        │
                                        ▼ (30 dias depois)
                              Revendedor expira → Master renova gastando outro crédito
```

### Detalhes Técnicos

- A lógica de "gastar crédito" será uma transação: decrementa `credits.balance`, insere em `credit_transactions`, e atualiza `profiles.plan_expires_at` do revendedor
- Validação server-side via RLS + check de saldo antes de permitir renovação
- Novo hook `useCredits()` para consultar saldo e histórico
- Audit log para todas as operações de crédito

