# Segurança e Conformidade

A segurança dos dados médicos e a privacidade dos pacientes são prioridades absolutas no CRMed.

## Modelo RBAC (Role-Based Access Control)

O sistema utiliza roles para controlar o acesso a funcionalidades e dados (conforme **RN03**).

| Role | Permissões |
| :--- | :--- |
| **ADMIN** | Acesso total ao sistema, configurações, usuários e exportação de dados. |
| **SURGEON** | Acesso a prontuários médicos, agenda própria e resultados de exames. |
| **RECEPTION** | Gestão de agendamentos, check-in de pacientes e visualização de agenda. |
| **CALL_CENTER** | Gestão de leads e contatos. Dados sensíveis de pacientes são mascarados (RN07). |
| **SALES** | Gestão de orçamentos e conversão de leads. |

## LGPD (Lei Geral de Proteção de Dados)

1. **Mascaramento de Dados (RN07)**: Usuários com role `CALL_CENTER` visualizam apenas os últimos 3 dígitos do CPF e telefone parcialmente oculto.
2. **Direito ao Esquecimento**: O sistema suporta deleção lógica e física de dados mediante solicitação.
3. **Audit Log (RN06)**: Todas as visualizações e alterações em dados sensíveis são auditadas com carimbo de tempo, ID do usuário e IP de origem.

## Autenticação e Comunicação

- **JWT**: Utilização de `access_token` (curta duração) e `refresh_token` (longa duração, via cookie HttpOnly).
- **Secure Flags**: Em produção, cookies são configurados com flags `Secure`, `HttpOnly` e `SameSite=Strict`.
- **Encryption**: Dados em repouso no PostgreSQL são criptografados (AWS RDS AES-256).
- **HTTPS**: TLS 1.3 obrigatório para todas as comunicações.

## Webhooks
A comunicação com a Evolution API é protegida por:
- **HMAC-SHA256**: Validação de assinatura em cada request.
- **IP Allowlist**: Bloqueio de requisições webhooks fora do range da infraestrutura autorizada.

## Checklist de Produção
- [ ] Ativar WAF (Web Application Firewall).
- [ ] Secrets Manager para todas as variáveis de ambiente sensíveis.
- [ ] IAM Least Privilege para serviços (S3, RDS, Redis).
- [ ] Scanning de vulnerabilidades periódico (SonarQube/Snyk).
