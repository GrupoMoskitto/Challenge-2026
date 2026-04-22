# CRMed — AWS IAM Least Privilege Policies

Políticas de privilégio mínimo para as Lambda functions e workers do CRMed.

---

## `functions/lead-webhook` — Lead Capture Lambda

Esta function recebe webhooks de formulários externos e cria leads no banco de dados.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:sa-east-1:ACCOUNT_ID:log-group:/aws/lambda/crmed-lead-webhook:*"
    },
    {
      "Sid": "VPCNetworkAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:Vpc": "arn:aws:ec2:sa-east-1:ACCOUNT_ID:vpc/VPC_ID"
        }
      }
    }
  ]
}
```

> **Nota**: Esta Lambda acessa o banco PostgreSQL via VPC. Não precisa de acesso a S3, SQS, ou outros serviços AWS.

---

## `functions/pdf-generator` — PDF Generation Lambda

Esta function gera PDFs (contratos, termos) e os armazena no S3.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:sa-east-1:ACCOUNT_ID:log-group:/aws/lambda/crmed-pdf-generator:*"
    },
    {
      "Sid": "S3ReadTemplates",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::crmed-documents/templates/*"
    },
    {
      "Sid": "S3WriteGeneratedPDFs",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::crmed-documents/generated/*"
    },
    {
      "Sid": "VPCNetworkAccess",
      "Effect": "Allow",
      "Action": [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface"
      ],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ec2:Vpc": "arn:aws:ec2:sa-east-1:ACCOUNT_ID:vpc/VPC_ID"
        }
      }
    }
  ]
}
```

> **Nota**: Acesso S3 restrito ao bucket `crmed-documents` com prefixos separados para templates (leitura) e gerados (escrita). Sem `s3:DeleteObject` — PDFs gerados não devem ser apagados pela Lambda.

---

## `apps/workers` — BullMQ Workers (ECS/Fargate)

Os workers processam filas de mensagens WhatsApp e executam cron jobs.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:sa-east-1:ACCOUNT_ID:log-group:/ecs/crmed-workers:*"
    }
  ]
}
```

> **Nota**: Os workers acessam PostgreSQL e Redis via rede privada (VPC), e a Evolution API via HTTP direto. Não precisam de permissões AWS além de logs. A Evolution API key é injetada como variável de ambiente via Secrets Manager ou Parameter Store — neste caso, adicionar `secretsmanager:GetSecretValue` restrito ao ARN do secret específico.

---

## Variáveis de Ambiente (Secrets Manager)

Para produção, todas as credenciais devem ser armazenadas no AWS Secrets Manager:

| Secret | Usado por |
|---|---|
| `crmed/database-url` | API, Workers, Lambdas |
| `crmed/jwt-secret` | API |
| `crmed/refresh-secret` | API |
| `crmed/evolution-api-key` | API, Workers |
| `crmed/webhook-secret` | Workers |
| `crmed/redis-password` | API, Workers |

Política adicional para o task role do ECS que precisa ler secrets:

```json
{
  "Sid": "ReadSecrets",
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue"
  ],
  "Resource": "arn:aws:secretsmanager:sa-east-1:ACCOUNT_ID:secret:crmed/*"
}
```
