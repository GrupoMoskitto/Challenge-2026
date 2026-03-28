<!--
================================================================================
                    HOSPITAL SAO RAFAEL - CRMed
              Sistema de Relacionamento e Performance Clinica
================================================================================
-->
<div align="center">

![Hospital Sao Rafael](assets/logo.svg)

# Pull Request
**Sistema:** CRMed - CRM de Performance Clinica

---

</div>

## Descricao

<!-- Descreva brevemente o que este PR faz e por que. Inclua o numero da tarefa se aplicavel. -->

<br/>

## Tipo de Mudanca

<!-- Marque todas que se aplicam -->

| Tipo | Descricao |
|:----:|-----------|
| Bug | Correcao de defeito |
| Feature | Nova funcionalidade |
| UI | Alteracao de interface |
| Perf | Melhoria de performance |
| Refactor | Refatoracao de codigo |
| Deps | Alteracao de dependencias |
| Security | Correcao de seguranca |
| Docs | Documentacao |
| Tests | Adicao/atualizacao de testes |
| DevOps | CI/CD, infraestrutura |

<br/>

## Links Relacionados

<!-- Adicione links relevantes -->

- **Task:** [MOSK-XXXX]
- **Wiki:** [Documentacao]
- **Issue:** [GitHub Issue]

<br/>

## Screenshots / Demonstracao

<!-- Adicione screenshots antes/depois, GIFs ou screencasts se aplicavel -->

| Antes | Depois |
|:-----:|:------:|
| _Vazio_ | _Vazio_ |

<br/>

## Checklist de Revisao

### Padroes de Codigo
- [ ] Branch no formato `MOSK-XXXX/tipo/tarefa`
- [ ] Commits seguem [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] TypeScript strict mode habilitado
- [ ] Sem `any` injustificado
- [ ] Codigo segue convencoes do projeto (AGENTS.md)

### Regras de Negocio (RNs)
> Marque apenas se **modificou** a funcionalidade. O CI executa testes automaticos.

| RN | Regra | Modificado? |
|:--:|-------|:-----------:|
| **RN01** | Duplicidade Zero - CPF, e-mail e telefone unicos | [ ] |
| **RN03** | Hierarquia - RECEPTION nao altera CONVERTED/LOST | [ ] |
| **RN05** | Ciclo de Notificacoes WhatsApp preservado | [ ] |
| **RN06** | Auditoria - AuditLogs em todas alteracoes | [ ] |

### Qualidade de Codigo
- [ ] Testes unitarios passando (`pnpm test`)
- [ ] Build sem erros (`pnpm build`)
- [ ] Lint passando (`pnpm lint`)
- [ ] Cobertura de testes adequada (se aplicavel)

### Seguranca
- [ ] **Sem credenciais ou secrets** expostos no codigo
- [ ] Inputs validados antes do processamento
- [ ] Queries parametrizadas (uso de Prisma)

### Documentacao
- [ ] README atualizado (se necessario)
- [ ] Schema Prisma alterado - migrations geradas
- [ ] Variaveis de ambiente documentadas (se novas)

<br/>

## Como Testar Localmente

<!-- Descreva os passos para testar esta mudanca -->

```bash
# 1. Instalar dependencias
pnpm install

# 2. Executar testes
pnpm test

# 3. Iniciar desenvolvimento
pnpm dev
```

<br/>

## Notas Adicionais

<!-- Informacoes extras para o revisor: decisoes de design, trade-offs, etc. -->

<br/>

---

<div align="center">

**Hospital Sao Rafael**  
*CRM de Performance Clinica - Desenvolvido pela equipe de tecnologia*

</div>
