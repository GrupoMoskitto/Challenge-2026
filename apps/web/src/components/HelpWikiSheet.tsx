import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Upload,
  CalendarDays,
  UserCircle,
  Stethoscope,
  Settings,
  MessageCircle,
  FileText,
  BookOpen,
  HelpCircle,
  ChevronRight,
  AlertCircle,
  Info,
  CheckCircle2,
  ArrowRight,
  Star,
  Shield,
  Zap,
  Clock,
  CheckCheck,
  MessageSquare,
  XCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WikiSection {
  id: string;
  title: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  staffOnly?: boolean;
  badge?: "avançado" | "admin";
  content: React.ReactNode;
}

interface HelpWikiSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: string;
}

// ─── Helper sub-components ──────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl font-bold text-foreground mb-4 pb-2 border-b border-border flex items-center gap-2">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-foreground mt-6 mb-2">
      {children}
    </h3>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 my-3">
      <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
      <p className="text-sm text-blue-700 dark:text-blue-300">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 my-3">
      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-700 dark:text-amber-300">{children}</p>
    </div>
  );
}

function Success({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3 my-3">
      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
      <p className="text-sm text-green-700 dark:text-green-300">{children}</p>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2 my-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-sm text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {i + 1}
          </span>
          <span className="leading-5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function StatusTable({
  rows,
}: {
  rows: { status: string; label: string; color: string; desc: string }[];
}) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-36">
              Status
            </th>
            <th className="text-left py-2 pr-3 font-medium text-muted-foreground">
              Significado
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.status} className="border-b border-border/50">
              <td className="py-2 pr-3 align-middle">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap",
                    r.color
                  )}
                >
                  {r.label}
                </span>
              </td>
              <td className="py-2 text-muted-foreground">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeTag({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
      {children}
    </code>
  );
}

// ─── Wiki Sections Content ───────────────────────────────────────────────────

const overviewContent = (
  <div>
    <SectionHeading>
      <BookOpen className="h-5 w-5 text-primary" />
      Visão Geral do CRMed
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      O <strong>CRMed</strong> é o sistema de gestão clínica e relacionamento do
      Hospital São Rafael. Ele cobre todo o ciclo do paciente: da captura inicial
      como lead até o acompanhamento pós-operatório.
    </p>

    <SubHeading>Mapa da Plataforma</SubHeading>
    <div className="grid grid-cols-1 gap-2 my-3">
      {([
        {
          Icon: LayoutDashboard,
          page: "Início (Dashboard)",
          desc: "Visão geral de KPIs, gráficos e métricas",
          roles: "Todos",
        },
        {
          Icon: Users,
          page: "Leads",
          desc: "Kanban de potenciais pacientes e importação CSV",
          roles: "Todos",
        },
        {
          Icon: CalendarDays,
          page: "Agenda",
          desc: "Grade de consultas diária por médico",
          roles: "Todos",
        },
        {
          Icon: UserCircle,
          page: "Pacientes",
          desc: "Prontuários, documentos e pós-operatório",
          roles: "Todos",
        },
        {
          Icon: Stethoscope,
          page: "Corpo Clínico",
          desc: "Cadastro e agenda dos cirurgiões",
          roles: "Todos (staff)",
        },
        {
          Icon: Settings,
          page: "Configurações",
          desc: "Usuários, WhatsApp, templates e agenda",
          roles: "Apenas ADMIN",
        },
      ] as { Icon: React.ElementType; page: string; desc: string; roles: string }[]).map((item) => (
        <div
          key={item.page}
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <item.Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{item.page}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {item.roles}
          </Badge>
        </div>
      ))}
    </div>

    <SubHeading>Navegação</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Use a <strong>barra lateral esquerda</strong> para navegar entre as
      páginas. Ela pode ser recolhida clicando na seta no rodapé. No celular,
      acesse o menu pelo botão de hambúrguer no topo.
    </p>

    <Tip>
      Use o botão <strong>Sol/Lua</strong> na sidebar para alternar entre Modo
      Claro e Modo Escuro conforme sua preferência.
    </Tip>
  </div>
);

const dashboardContent = (
  <div>
    <SectionHeading>
      <LayoutDashboard className="h-5 w-5 text-primary" />
      Dashboard — Início
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      A página inicial apresenta uma visão consolidada da operação. Use-a para
      monitorar o desempenho diário e identificar gargalos rapidamente.
    </p>

    <SubHeading>Cartões de KPI</SubHeading>
    <div className="grid grid-cols-2 gap-2 my-3">
      {[
        { kpi: "Total de Leads", desc: "Todos os leads ativos no sistema" },
        {
          kpi: "Taxa de Conversão",
          desc: "% de leads que viraram pacientes",
        },
        { kpi: "Consultas Hoje", desc: "Agendamentos para o dia atual" },
        { kpi: "Leads em Risco", desc: "Leads sem interação há mais de 24h" },
      ].map((k) => (
        <div
          key={k.kpi}
          className="p-3 rounded-lg bg-muted/50 border border-border/50"
        >
          <p className="text-xs font-semibold text-foreground">{k.kpi}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{k.desc}</p>
        </div>
      ))}
    </div>

    <SubHeading>Gráficos Disponíveis</SubHeading>
    <ul className="space-y-1.5 text-sm text-muted-foreground my-2">
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Funil de Conversão:</strong> Quantos leads estão em cada
          status
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Leads por Semana:</strong> Evolução temporal de novos leads
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Procedimentos Mais Buscados:</strong> Distribuição por tipo de
          cirurgia
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Risco de No-Show:</strong> Pacientes com maior probabilidade
          de falta
        </span>
      </li>
    </ul>

    <SubHeading>Próximas Consultas</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      A seção inferior lista as consultas agendadas para os próximos dias.
      Clique em qualquer consulta para ver detalhes ou ir diretamente para a
      Agenda.
    </p>

    <Tip>
      Os dados do Dashboard são atualizados em tempo real. Se notar algum número
      desatualizado, recarregue a página.
    </Tip>
  </div>
);

const leadsContent = (
  <div>
    <SectionHeading>
      <Users className="h-5 w-5 text-primary" />
      Gerenciando Leads
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      Um <strong>lead</strong> é uma pessoa interessada em um procedimento que
      ainda não é paciente. A página de Leads organiza todos eles em um board
      Kanban.
    </p>

    <SubHeading>Criar um Lead Manualmente</SubHeading>
    <StepList
      steps={[
        'Clique no botão "+ Novo Lead" no canto superior direito',
        "Preencha: Nome, Telefone (com DDD), Procedimento de interesse e Origem",
        'Ative "Automação WhatsApp" se quiser que o sistema envie mensagens automáticas',
        'Clique em "Criar Lead"',
      ]}
    />
    <Tip>
      O campo <strong>CPF</strong> é opcional na criação, mas necessário para
      converter o lead em paciente. Preencha sempre que possível.
    </Tip>

    <SubHeading>Campos do Lead</SubHeading>
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">
              Campo
            </th>
            <th className="text-left py-1.5 font-medium text-muted-foreground">
              Descrição
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {[
            { campo: "Nome", desc: "Nome completo do interessado" },
            { campo: "Telefone", desc: "Número WhatsApp (ex: 71 99999-0000)" },
            { campo: "E-mail", desc: "E-mail para contato (opcional)" },
            { campo: "CPF", desc: "Necessário para conversão em paciente" },
            {
              campo: "Origem",
              desc: "Canal de captação (Instagram, Google Ads, etc.)",
            },
            {
              campo: "Procedimento",
              desc: "Tipo de cirurgia ou consulta desejada",
            },
            { campo: "Notas", desc: "Observações internas livres" },
            {
              campo: "WhatsApp Ativo",
              desc: "Liga/desliga automação de mensagens",
            },
          ].map((r) => (
            <tr key={r.campo}>
              <td className="py-1.5 pr-3 font-medium text-foreground text-xs">
                {r.campo}
              </td>
              <td className="py-1.5 text-muted-foreground text-xs">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <SubHeading>Busca e Filtros</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Use a barra de busca para encontrar leads por <strong>nome ou telefone</strong> (busca em tempo real). Clique em{" "}
      <strong>Filtros</strong> para refinar por:
    </p>
    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
      <li className="flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-primary" />
        Origem (Instagram, TikTok, Google Ads…)
      </li>
      <li className="flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-primary" />
        Procedimento de interesse
      </li>
      <li className="flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-primary" />
        WhatsApp ativo / inativo
      </li>
      <li className="flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-primary" />
        Já convertido em paciente
      </li>
      <li className="flex items-center gap-2">
        <ChevronRight className="h-3 w-3 text-primary" />
        Com consulta agendada
      </li>
    </ul>

    <SubHeading>Exportar Leads</SubHeading>
    <StepList
      steps={[
        'Clique no botão "Exportar" (ícone de download)',
        "Um arquivo CSV será gerado com todos os leads visíveis",
        "O download iniciará automaticamente",
      ]}
    />
  </div>
);

const kanbanContent = (
  <div>
    <SectionHeading>
      <KanbanSquare className="h-5 w-5 text-primary" />
      Kanban & Drag-and-drop
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      Os leads são organizados em um board Kanban com 5 colunas representando
      as etapas do funil de vendas.
    </p>

    <SubHeading>As 5 Colunas</SubHeading>
    <div className="space-y-2 my-3">
      {[
        {
          label: "Novo",
          color: "bg-gray-500",
          desc: "Lead recém-capturado, ainda sem contato",
        },
        {
          label: "Contato",
          color: "bg-blue-500",
          desc: "Primeiro contato realizado (ligação, WhatsApp)",
        },
        {
          label: "Qualificado",
          color: "bg-yellow-500",
          desc: "Lead demonstrou interesse concreto e está sendo nutrido",
        },
        {
          label: "Convertido",
          color: "bg-green-500",
          desc: "Lead virou paciente (consulta ou cirurgia agendada)",
        },
        {
          label: "Perdido",
          color: "bg-red-500",
          desc: "Lead desistiu ou não respondeu mais",
        },
      ].map((col) => (
        <div
          key={col.label}
          className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50"
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full shrink-0",
              col.color
            )}
          />
          <span className="text-sm font-medium text-foreground w-24 shrink-0">
            {col.label}
          </span>
          <span className="text-xs text-muted-foreground">{col.desc}</span>
        </div>
      ))}
    </div>

    <SubHeading>Como Mover um Lead</SubHeading>
    <StepList
      steps={[
        "Clique e segure o card do lead",
        "Arraste-o para a coluna desejada",
        "Solte — o status é atualizado automaticamente",
      ]}
    />
    <Tip>
      O histórico de mudanças de status fica registrado na aba{" "}
      <strong>Timeline</strong> do lead, acessível pelo menu (⋮) do card.
    </Tip>

    <SubHeading>Menu de Ações do Card (⋮)</SubHeading>
    <ul className="space-y-1.5 text-sm text-muted-foreground my-2">
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Editar Lead:</strong> Alterar nome, telefone, procedimento e
          demais dados
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Ver Histórico:</strong> Timeline de contatos via WhatsApp e
          mudanças de status
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Converter em Paciente:</strong> Cria o prontuário do paciente
        </span>
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Excluir Lead:</strong> Remove permanentemente (requer
          confirmação)
        </span>
      </li>
    </ul>

    <Warning>
      A exclusão de leads é permanente. Se o lead não deve mais ser contatado,
      prefira movê-lo para a coluna <strong>Perdido</strong>.
    </Warning>
  </div>
);

const csvImportContent = (
  <div>
    <SectionHeading>
      <Upload className="h-5 w-5 text-primary" />
      Importar Leads via CSV
    </SectionHeading>
    <div className="flex items-center gap-2 mb-4">
      <Badge className="bg-orange-500/10 text-orange-600 border-orange-300 dark:text-orange-400 flex items-center gap-1.5">
        <Zap className="h-3 w-3" />
        Fluxo Avançado
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      A importação via CSV permite criar dezenas ou centenas de leads de uma só
      vez a partir de uma planilha do Excel ou Google Sheets.
    </p>

    <SubHeading>Formato do Arquivo CSV</SubHeading>
    <p className="text-sm text-muted-foreground mb-2">
      O arquivo deve ter as seguintes colunas (em qualquer ordem):
    </p>
    <div className="bg-muted rounded-lg p-3 my-2 font-mono text-xs overflow-x-auto">
      <p className="text-muted-foreground">
        name,phone,email,cpf,origin,procedure,notes
      </p>
      <p className="text-foreground">
        "Maria Souza","71 99999-1111","maria@email.com","","Instagram","Rinoplastia",""
      </p>
      <p className="text-foreground">
        "João Costa","71 98888-2222","","123.456.789-00","Google Ads","Lipoaspiração","Urgente"
      </p>
    </div>

    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground text-xs">
              Coluna
            </th>
            <th className="text-left py-1.5 pr-2 font-medium text-muted-foreground text-xs">
              Obrigatório
            </th>
            <th className="text-left py-1.5 font-medium text-muted-foreground text-xs">
              Valores aceitos
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {[
            { col: "name", req: "Sim", vals: "Texto livre" },
            { col: "phone", req: "Sim", vals: "Ex: 71 99999-0000" },
            { col: "email", req: "Não", vals: "E-mail válido" },
            { col: "cpf", req: "Não", vals: "Com ou sem formatação" },
            {
              col: "origin",
              req: "Não",
              vals: "Instagram, TikTok, Google Ads, Indicação, Site, Facebook, WhatsApp, Outro",
            },
            {
              col: "procedure",
              req: "Não",
              vals: "Rinoplastia, Lipoaspiração, Mamoplastia…",
            },
            { col: "notes", req: "Não", vals: "Texto livre" },
          ].map((r) => (
            <tr key={r.col}>
              <td className="py-1.5 pr-2">
                <CodeTag>{r.col}</CodeTag>
              </td>
              <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                {r.req === "Sim" ? (
                  <span className="text-red-500 font-medium">Sim</span>
                ) : (
                  <span>Não</span>
                )}
              </td>
              <td className="py-1.5 text-xs text-muted-foreground">{r.vals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <SubHeading>Como Exportar do Excel / Google Sheets</SubHeading>
    <p className="text-sm font-medium text-foreground mb-1">Excel:</p>
    <StepList
      steps={[
        "Arquivo → Salvar Como",
        'Escolha o formato "CSV UTF-8 (delimitado por vírgulas)"',
        'Clique em "Salvar"',
      ]}
    />
    <p className="text-sm font-medium text-foreground mb-1 mt-3">
      Google Sheets:
    </p>
    <StepList
      steps={[
        "Arquivo → Fazer download",
        'Escolha "Valores separados por vírgula (.csv)"',
      ]}
    />

    <SubHeading>Passo a Passo da Importação</SubHeading>
    <StepList
      steps={[
        'Na página de Leads, clique no botão "Importar" (ícone de upload)',
        "Arraste o arquivo CSV para a área indicada, ou clique para selecionar",
        'Clique em "Importar Leads"',
        "Aguarde a confirmação de sucesso",
      ]}
    />

    <Success>
      O sistema detecta automaticamente o delimitador do arquivo (vírgula,
      ponto-e-vírgula ou tab). Não é necessário ajustar nada.
    </Success>

    <Warning>
      Leads com o mesmo telefone de um lead já existente não serão
      duplicados — o sistema bloqueia automaticamente (Regra RN01).
    </Warning>
  </div>
);

const agendaContent = (
  <div>
    <SectionHeading>
      <CalendarDays className="h-5 w-5 text-primary" />
      Agenda & Consultas
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      A Agenda exibe uma grade diária de consultas organizada por médico. O
      horário de funcionamento padrão é das <strong>08:00 às 18:00</strong>, mas a
      grade se expande automaticamente até as 23:00 se houver consultas
      agendadas fora desse intervalo.
    </p>

    <SubHeading>Navegar entre Datas</SubHeading>
    <ul className="space-y-1.5 text-sm text-muted-foreground my-2">
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        Use as <strong>setas ← →</strong> para avançar ou voltar um dia
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        Clique na <strong>data</strong> para abrir um calendário e ir a qualquer
        dia
      </li>
      <li className="flex items-start gap-2">
        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        Clique em <strong>"Hoje"</strong> para voltar ao dia atual
      </li>
    </ul>

    <SubHeading>Criar uma Nova Consulta</SubHeading>
    <StepList
      steps={[
        'Clique no botão "+ Nova Consulta" ou em um slot vazio na grade',
        "Selecione o médico responsável",
        "Escolha a data e o horário",
        "Busque e selecione o paciente (pesquisa por nome)",
        "Selecione o procedimento",
        "Adicione notas se necessário",
        'Clique em "Agendar"',
      ]}
    />
    <Tip>
      É possível criar uma consulta para um paciente que ainda não está
      cadastrado preenchendo apenas o nome e telefone diretamente no formulário.
    </Tip>

    <SubHeading>Atualizar Status de uma Consulta</SubHeading>
    <p className="text-sm text-muted-foreground mb-2">
      Clique em qualquer consulta na grade para abrir o painel lateral. Lá você
      pode alterar o status:
    </p>
    <StatusTable
      rows={[
        {
          status: "SCHEDULED",
          label: "Agendado",
          color: "bg-blue-500",
          desc: "Consulta marcada, aguardando confirmação",
        },
        {
          status: "CONFIRMED",
          label: "Confirmado",
          color: "bg-green-500",
          desc: "Paciente confirmou presença",
        },
        {
          status: "COMPLETED",
          label: "Concluído",
          color: "bg-gray-500",
          desc: "Consulta realizada com sucesso",
        },
        {
          status: "CANCELLED",
          label: "Cancelado",
          color: "bg-red-500",
          desc: "Consulta foi cancelada",
        },
        {
          status: "NO_SHOW",
          label: "Não Compareceu",
          color: "bg-yellow-500",
          desc: "Paciente faltou sem avisar",
        },
        {
          status: "ATTENTION_REQUIRED",
          label: "Requer Atenção",
          color: "bg-orange-500",
          desc: "Caso que precisa de acompanhamento especial",
        },
        {
          status: "RESCHEDULED",
          label: "Reagendado",
          color: "bg-purple-500",
          desc: "Consulta foi remarcada para outra data",
        },
      ]}
    />

    <Warning>
      Consultas só podem ser agendadas das 08:00 às 18:00, exceto quando há uma
      autorização especial configurada no sistema.
    </Warning>
  </div>
);

const patientsContent = (
  <div>
    <SectionHeading>
      <UserCircle className="h-5 w-5 text-primary" />
      Pacientes
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      Um <strong>paciente</strong> é um lead que foi convertido e possui um
      prontuário clínico completo com documentos, histórico de consultas e
      acompanhamento pós-operatório.
    </p>

    <SubHeading>Lead → Paciente: Como Converter</SubHeading>
    <StepList
      steps={[
        "Na página de Leads, localize o card do lead",
        'Clique no menu (⋮) do card e selecione "Converter em Paciente"',
        "Confirme os dados no modal de criação",
        "O lead passa automaticamente para o status Convertido",
        "O paciente agora aparece na página de Pacientes",
      ]}
    />
    <Tip>
      O CPF é obrigatório para converter um lead em paciente. Certifique-se de
      que ele está preenchido antes de tentar a conversão.
    </Tip>

    <SubHeading>Abas do Perfil do Paciente</SubHeading>
    <div className="space-y-2 my-3">
      {[
        {
          tab: "Dados Pessoais",
          desc: "Nome, CPF, data de nascimento, telefone, e-mail e endereço",
        },
        {
          tab: "Documentos",
          desc: "Upload de contratos, exames e outros documentos (PDF/imagem)",
        },
        {
          tab: "Pós-operatório",
          desc: "Registros de retorno e acompanhamento pós-cirurgia",
        },
        {
          tab: "Consultas",
          desc: "Histórico completo de agendamentos do paciente",
        },
        {
          tab: "Histórico",
          desc: "Auditoria de todas as alterações no prontuário",
        },
      ].map((t) => (
        <div
          key={t.tab}
          className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50"
        >
          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 mt-0.5">
            {t.tab}
          </span>
          <span className="text-xs text-muted-foreground">{t.desc}</span>
        </div>
      ))}
    </div>

    <SubHeading>Fazer Upload de Documento</SubHeading>
    <StepList
      steps={[
        "Abra o perfil do paciente e vá para a aba Documentos",
        'Clique em "+ Adicionar Documento"',
        "Selecione o tipo: Contrato, Exame ou Outro",
        "Escolha o arquivo (PDF, JPG, PNG)",
        'Clique em "Enviar"',
      ]}
    />

    <SubHeading>Registrar Retorno Pós-operatório</SubHeading>
    <StepList
      steps={[
        "Acesse a aba Pós-operatório no perfil do paciente",
        'Clique em "+ Novo Retorno"',
        "Preencha: data, notas clínicas e observações",
        'Salve clicando em "Registrar"',
      ]}
    />
  </div>
);

const surgeonsContent = (
  <div>
    <SectionHeading>
      <Stethoscope className="h-5 w-5 text-primary" />
      Corpo Clínico
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      A página de Corpo Clínico lista todos os cirurgiões cadastrados. Cada
      cirurgião tem um perfil completo com CRM, especialidade e agenda
      individual.
    </p>

    <SubHeading>Cadastrar um Novo Médico</SubHeading>
    <div className="flex items-center gap-2 mb-2">
      <Badge className="bg-red-500/10 text-red-600 border-red-300 dark:text-red-400 text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Apenas ADMIN
      </Badge>
    </div>
    <StepList
      steps={[
        'Clique em "+ Novo Médico"',
        "Preencha: Nome completo, CRM, Especialidade",
        "Preencha os dados de acesso ao sistema: E-mail e Senha temporária",
        "O médico receberá acesso ao sistema com o papel de Cirurgião",
        'Clique em "Cadastrar"',
      ]}
    />

    <SubHeading>Visualizar Agenda do Médico</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Na lista de cirurgiões, clique no card de qualquer médico para ver sua
      agenda completa com todos os agendamentos futuros e passados.
    </p>

    <SubHeading>Ativar / Desativar Médico</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Médicos inativos não aparecem como opção ao agendar novas consultas. Para
      ativar ou desativar, use o botão de status no canto do card do médico.
    </p>

    <Warning>
      Desativar um médico não cancela as consultas já agendadas. Verifique a
      agenda antes de desativar.
    </Warning>

    <SubHeading>Filtrar por Status</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Use a busca no topo para encontrar um médico por nome. A lista exibe por
      padrão ativos e inativos — você pode filtrar pelo toggle de status.
    </p>
  </div>
);

const settingsContent = (
  <div>
    <SectionHeading>
      <Settings className="h-5 w-5 text-primary" />
      Configurações do Sistema
    </SectionHeading>
    <div className="flex items-center gap-2 mb-4">
      <Badge className="bg-red-500/10 text-red-600 border-red-300 dark:text-red-400 text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Apenas ADMIN
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      As Configurações são o painel de controle central do sistema. Estão
      divididas em abas por área.
    </p>

    <SubHeading>Aba: Perfil</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Altere seu nome, e-mail e senha de acesso. Disponível para todos os
      usuários.
    </p>

    <SubHeading>Aba: Usuários</SubHeading>
    <StepList
      steps={[
        'Clique em "+ Novo Usuário"',
        "Preencha nome, e-mail e senha",
        "Selecione o papel (role) do usuário",
        'Clique em "Criar"',
      ]}
    />
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground text-xs">
              Papel
            </th>
            <th className="text-left py-1.5 font-medium text-muted-foreground text-xs">
              Permissões
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {[
            {
              role: "ADMIN",
              desc: "Acesso total — usuários, configurações, WhatsApp",
            },
            {
              role: "Cirurgião",
              desc: "Agenda, pacientes e sua própria área",
            },
            {
              role: "Recepção",
              desc: "Agendamentos, leads e pacientes",
            },
            {
              role: "Vendas",
              desc: "Leads e conversão em pacientes",
            },
            {
              role: "Call Center",
              desc: "Leads e contato inicial",
            },
          ].map((r) => (
            <tr key={r.role}>
              <td className="py-1.5 pr-3 text-xs font-medium text-foreground">
                {r.role}
              </td>
              <td className="py-1.5 text-xs text-muted-foreground">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <SubHeading>Aba: Agenda Médica</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Configure os horários de atendimento de cada médico: dias da semana,
      horários disponíveis, bloqueios pontuais e exceções de horário estendido.
    </p>
    <Tip>
      Para permitir agendamentos fora do horário padrão (08:00–18:00), adicione
      uma <strong>Exceção de Horário</strong> para o médico e dia específico.
    </Tip>
  </div>
);

const whatsappContent = (
  <div>
    <SectionHeading>
      <MessageCircle className="h-5 w-5 text-primary" />
      Automação WhatsApp
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      O CRMed envia mensagens automáticas via WhatsApp para lembrar pacientes de
      consultas e cirurgias agendadas, além de um chatbot de auto-atendimento.
    </p>

    <SubHeading>Ciclo de Lembretes</SubHeading>
    <p className="text-sm text-muted-foreground mb-2">
      O sistema envia 3 lembretes automáticos antes de cada procedimento:
    </p>
    <div className="space-y-2 my-3">
      {[
        {
          quando: "30 dias antes",
          desc: "Lembrete inicial — confirmar interesse e dados",
          color: "border-blue-300 bg-blue-50 dark:bg-blue-950/30",
          dot: "bg-blue-500",
        },
        {
          quando: "7 dias antes",
          desc: "Confirmação de presença e instruções pré-operatórias",
          color: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30",
          dot: "bg-yellow-500",
        },
        {
          quando: "48 horas antes",
          desc: "Lembrete final — horário, local e preparação",
          color: "border-green-300 bg-green-50 dark:bg-green-950/30",
          dot: "bg-green-500",
        },
      ].map((item) => (
        <div
          key={item.quando}
          className={cn("flex items-center gap-3 p-3 rounded-lg border", item.color)}
        >
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", item.dot)} />
          <div>
            <p className="text-sm font-semibold text-foreground">{item.quando}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>

    <SubHeading>Chatbot de Auto-atendimento</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-2">
      Quando um paciente responde ao WhatsApp, o sistema inicia um fluxo
      conversacional automático:
    </p>
    <StepList
      steps={[
        "Paciente envia mensagem → sistema solicita nome ou confirma identidade",
        "Validação LGPD: sistema pede a data de nascimento para acessar dados sensíveis",
        "Paciente pode consultar suas consultas agendadas, confirmar ou reagendar",
        "Se for um lead novo, o sistema captura nome e e-mail automaticamente",
      ]}
    />

    <SubHeading>Ativar / Desativar por Lead</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Cada lead tem um toggle individual de <strong>Automação WhatsApp</strong>.
      Quando desativado, nenhuma mensagem automática é enviada para aquele
      contato.
    </p>

    <SubHeading>Status dos Envios</SubHeading>
    <div className="space-y-2 my-3">
      {([
        { Icon: Clock,        iconClass: "text-muted-foreground", status: "Enviado / Entregue", desc: "Mensagem chegou ao celular" },
        { Icon: CheckCheck,   iconClass: "text-green-500",        status: "Lido",               desc: "Paciente abriu a mensagem" },
        { Icon: MessageSquare,iconClass: "text-blue-500",         status: "Respondido",         desc: "Paciente interagiu com o chatbot" },
        { Icon: XCircle,      iconClass: "text-red-500",          status: "Falhou",             desc: "Erro no envio (número inválido ou sem WhatsApp)" },
      ] as { Icon: React.ElementType; iconClass: string; status: string; desc: string }[]).map((s) => (
        <div key={s.status} className="flex items-center gap-2.5">
          <s.Icon className={cn("h-4 w-4 shrink-0", s.iconClass)} />
          <span className="text-sm font-medium text-foreground">{s.status}:</span>
          <span className="text-sm text-muted-foreground">{s.desc}</span>
        </div>
      ))}
    </div>

    <Warning>
      Para que os lembretes funcionem, é necessário ter uma instância do
      WhatsApp conectada nas Configurações → Aba WhatsApp.
    </Warning>
  </div>
);

const templatesContent = (
  <div>
    <SectionHeading>
      <FileText className="h-5 w-5 text-primary" />
      Templates de Mensagem
    </SectionHeading>
    <div className="flex items-center gap-2 mb-4">
      <Badge className="bg-red-500/10 text-red-600 border-red-300 dark:text-red-400 text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Apenas ADMIN
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      Os templates definem o conteúdo das mensagens automáticas do WhatsApp.
      Eles usam variáveis dinâmicas que são substituídas pelos dados reais do
      paciente no momento do envio.
    </p>

    <SubHeading>Variáveis Disponíveis</SubHeading>
    <div className="grid grid-cols-2 gap-2 my-3">
      {[
        { var: "{{paciente}}", desc: "Nome completo do paciente" },
        { var: "{{procedimento}}", desc: "Tipo de procedimento/cirurgia" },
        { var: "{{medico}}", desc: "Nome do médico responsável" },
        { var: "{{data}}", desc: "Data da consulta (dd/mm/aaaa)" },
        { var: "{{hora}}", desc: "Horário da consulta (HH:MM)" },
        { var: "{{horário}}", desc: "Alternativo para hora" },
      ].map((v) => (
        <div
          key={v.var}
          className="p-2 rounded-lg bg-muted/50 border border-border/50"
        >
          <CodeTag>{v.var}</CodeTag>
          <p className="text-xs text-muted-foreground mt-1">{v.desc}</p>
        </div>
      ))}
    </div>

    <SubHeading>Formatação WhatsApp</SubHeading>
    <div className="space-y-1.5 my-3 text-sm">
      {[
        { sintaxe: "*texto*", resultado: "negrito" },
        { sintaxe: "_texto_", resultado: "itálico" },
        { sintaxe: "~texto~", resultado: "tachado" },
        { sintaxe: "```texto```", resultado: "monoespaçado" },
      ].map((f) => (
        <div key={f.sintaxe} className="flex items-center gap-3">
          <CodeTag>{f.sintaxe}</CodeTag>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{f.resultado}</span>
        </div>
      ))}
    </div>

    <SubHeading>Gatilho por Dias</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-2">
      O campo <strong>Gatilho (dias)</strong> define quando a mensagem é
      enviada em relação ao procedimento:
    </p>
    <div className="space-y-1.5 my-2 text-sm text-muted-foreground">
      {[
        { val: "-1", desc: "Na captura do lead (boas-vindas)" },
        { val: "30", desc: "30 dias antes da cirurgia" },
        { val: "7", desc: "7 dias antes da cirurgia" },
        { val: "0", desc: "No dia da consulta" },
      ].map((t) => (
        <div key={t.val} className="flex items-center gap-2">
          <CodeTag>{t.val}</CodeTag>
          <span>{t.desc}</span>
        </div>
      ))}
    </div>

    <SubHeading>Criar / Editar um Template</SubHeading>
    <StepList
      steps={[
        "Vá em Configurações → Aba Templates",
        'Clique em "+ Novo Template" ou no ícone de edição de um existente',
        "Preencha o nome, canal (WhatsApp), conteúdo e gatilho em dias",
        "Use a prévia para ver como a mensagem ficará com dados reais",
        'Clique em "Salvar"',
      ]}
    />

    <Tip>
      Clique em <strong>"Testar"</strong> antes de salvar para enviar a mensagem
      ao número de teste configurado e validar a formatação.
    </Tip>
  </div>
);

const whatsappConnectContent = (
  <div>
    <SectionHeading>
      <MessageCircle className="h-5 w-5 text-primary" />
      Conectar WhatsApp (Instância)
    </SectionHeading>
    <div className="flex items-center gap-2 mb-4">
      <Badge className="bg-red-500/10 text-red-600 border-red-300 dark:text-red-400 text-xs">
        <Shield className="h-3 w-3 mr-1" />
        Apenas ADMIN
      </Badge>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      Para o sistema enviar e receber mensagens, é necessário conectar um número
      de WhatsApp via QR Code.
    </p>

    <SubHeading>Como Conectar um Número</SubHeading>
    <StepList
      steps={[
        "Vá em Configurações → Aba WhatsApp",
        'Clique em "+ Nova Instância" e dê um nome para ela',
        'Clique em "Conectar" na instância criada',
        "Um QR Code será exibido — escaneie com o WhatsApp do número desejado",
        'No celular: WhatsApp → Menu → "Aparelhos Conectados" → "Conectar um Aparelho"',
        "Aponte a câmera para o QR Code",
        "Aguarde a confirmação de conexão (status ficará Verde)",
      ]}
    />

    <Warning>
      O QR Code expira em 60 segundos. Se não conseguir escanear a tempo,
      clique em "Conectar" novamente para gerar um novo.
    </Warning>

    <SubHeading>Definir Instância Ativa</SubHeading>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Caso haja mais de uma instância conectada, selecione qual será a{" "}
      <strong>instância ativa</strong> — ela será usada para todos os envios
      automáticos do sistema.
    </p>

    <Success>
      Com a instância conectada e ativa, todos os lembretes automáticos e o
      chatbot passam a funcionar imediatamente.
    </Success>
  </div>
);

const glossaryContent = (
  <div>
    <SectionHeading>
      <BookOpen className="h-5 w-5 text-primary" />
      Glossário de Status
    </SectionHeading>
    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
      Referência rápida para todos os status e termos usados na plataforma.
    </p>

    <SubHeading>Status de Leads</SubHeading>
    <StatusTable
      rows={[
        {
          status: "NEW",
          label: "Novo",
          color: "bg-gray-500",
          desc: "Lead recém-captado, sem contato realizado",
        },
        {
          status: "CONTACTED",
          label: "Contato",
          color: "bg-blue-500",
          desc: "Primeiro contato feito (ligação, mensagem)",
        },
        {
          status: "QUALIFIED",
          label: "Qualificado",
          color: "bg-yellow-500",
          desc: "Lead mostrou interesse real em procedimento",
        },
        {
          status: "CONVERTED",
          label: "Convertido",
          color: "bg-green-500",
          desc: "Lead virou paciente com prontuário criado",
        },
        {
          status: "LOST",
          label: "Perdido",
          color: "bg-red-500",
          desc: "Lead não converteu e foi arquivado",
        },
      ]}
    />

    <SubHeading>Status de Consultas</SubHeading>
    <StatusTable
      rows={[
        {
          status: "SCHEDULED",
          label: "Agendado",
          color: "bg-blue-500",
          desc: "Consulta marcada, aguardando confirmação",
        },
        {
          status: "CONFIRMED",
          label: "Confirmado",
          color: "bg-green-500",
          desc: "Paciente confirmou presença",
        },
        {
          status: "COMPLETED",
          label: "Concluído",
          color: "bg-gray-500",
          desc: "Consulta realizada com sucesso",
        },
        {
          status: "CANCELLED",
          label: "Cancelado",
          color: "bg-red-500",
          desc: "Consulta foi cancelada",
        },
        {
          status: "NO_SHOW",
          label: "Não Compareceu",
          color: "bg-yellow-500",
          desc: "Paciente faltou sem aviso prévio",
        },
        {
          status: "ATTENTION_REQUIRED",
          label: "Requer Atenção",
          color: "bg-orange-500",
          desc: "Caso que precisa de acompanhamento especial",
        },
        {
          status: "RESCHEDULED",
          label: "Reagendado",
          color: "bg-purple-500",
          desc: "Consulta remarcada para outra data/hora",
        },
      ]}
    />

    <SubHeading>Status de Documentos</SubHeading>
    <StatusTable
      rows={[
        {
          status: "PENDING",
          label: "Pendente",
          color: "bg-yellow-500",
          desc: "Documento ainda não enviado pelo paciente",
        },
        {
          status: "UPLOADED",
          label: "Enviado",
          color: "bg-blue-500",
          desc: "Arquivo carregado no sistema",
        },
        {
          status: "SIGNED",
          label: "Assinado",
          color: "bg-green-500",
          desc: "Documento assinado e válido",
        },
      ]}
    />

    <SubHeading>Papéis de Usuário</SubHeading>
    <div className="space-y-1.5 my-3 text-sm">
      {[
        { role: "ADMIN", desc: "Acesso irrestrito a todas as áreas" },
        {
          role: "Cirurgião",
          desc: "Acesso a agenda, pacientes e corpo clínico",
        },
        { role: "Recepção", desc: "Agendamentos, leads e pacientes" },
        { role: "Vendas", desc: "Leads e funil de conversão" },
        { role: "Call Center", desc: "Leads e contato inicial" },
      ].map((r) => (
        <div key={r.role} className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs shrink-0 font-mono">
            {r.role}
          </Badge>
          <span className="text-muted-foreground">{r.desc}</span>
        </div>
      ))}
    </div>

    <SubHeading>Origens de Lead</SubHeading>
    <div className="flex flex-wrap gap-1.5 my-2">
      {[
        "Instagram",
        "TikTok",
        "Google Ads",
        "Indicação",
        "Site",
        "Facebook",
        "WhatsApp",
        "Outro",
      ].map((o) => (
        <Badge key={o} variant="secondary" className="text-xs">
          {o}
        </Badge>
      ))}
    </div>
  </div>
);

// ─── All Sections Definition ─────────────────────────────────────────────────

const ALL_SECTIONS: WikiSection[] = [
  {
    id: "overview",
    title: "Visão Geral",
    icon: HelpCircle,
    content: overviewContent,
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    content: dashboardContent,
  },
  {
    id: "leads",
    title: "Gerenciando Leads",
    icon: Users,
    content: leadsContent,
  },
  {
    id: "kanban",
    title: "Kanban & Drag-and-drop",
    icon: KanbanSquare,
    content: kanbanContent,
  },
  {
    id: "csv-import",
    title: "Importar Leads (CSV)",
    icon: Upload,
    badge: "avançado",
    content: csvImportContent,
  },
  {
    id: "agenda",
    title: "Agenda & Consultas",
    icon: CalendarDays,
    content: agendaContent,
  },
  {
    id: "patients",
    title: "Pacientes",
    icon: UserCircle,
    content: patientsContent,
  },
  {
    id: "surgeons",
    title: "Corpo Clínico",
    icon: Stethoscope,
    staffOnly: true,
    content: surgeonsContent,
  },
  {
    id: "settings",
    title: "Configurações",
    icon: Settings,
    adminOnly: true,
    badge: "admin",
    content: settingsContent,
  },
  {
    id: "whatsapp",
    title: "Automação WhatsApp",
    icon: MessageCircle,
    content: whatsappContent,
  },
  {
    id: "whatsapp-connect",
    title: "Conectar WhatsApp",
    icon: MessageCircle,
    adminOnly: true,
    badge: "admin",
    content: whatsappConnectContent,
  },
  {
    id: "templates",
    title: "Templates de Mensagem",
    icon: FileText,
    adminOnly: true,
    badge: "admin",
    content: templatesContent,
  },
  {
    id: "glossary",
    title: "Glossário de Status",
    icon: BookOpen,
    content: glossaryContent,
  },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export function HelpWikiSheet({ open, onOpenChange, userRole }: HelpWikiSheetProps) {
  const [activeSection, setActiveSection] = useState("overview");

  const isAdmin = userRole === "ADMIN";
  const isStaff = ["ADMIN", "SURGEON", "RECEPTION", "SALES", "CALL_CENTER"].includes(
    userRole ?? ""
  );

  const visibleSections = ALL_SECTIONS.filter((s) => {
    if (s.adminOnly && !isAdmin) return false;
    if (s.staffOnly && !isStaff) return false;
    return true;
  });

  const currentSection = visibleSections.find((s) => s.id === activeSection)
    ?? visibleSections[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="help-wiki-dialog"
        className="w-[95vw] max-w-5xl h-[92vh] max-h-[92vh] p-0 flex flex-col overflow-hidden gap-0 rounded-2xl"
      >
        {/* Header */}
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold leading-tight">
                Como usar o CRMed
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Guia completo da plataforma — selecione uma seção no menu ao lado
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body: nav sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Nav sidebar — visible only on md+ */}
          <nav
            className="hidden md:block w-56 shrink-0 border-r border-border overflow-y-auto py-3 px-2 space-y-0.5 bg-muted/30"
            aria-label="Seções da wiki"
          >
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === currentSection.id;
              return (
                <button
                  key={section.id}
                  id={`wiki-nav-${section.id}`}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 leading-tight text-sm">
                    {section.title}
                  </span>
                  {section.badge === "admin" && (
                    <Star className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  {section.badge === "avançado" && (
                    <span className="shrink-0 text-[10px] font-bold text-orange-500">
                      ADV
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Content area */}
          <main
            className="flex-1 overflow-y-auto flex flex-col min-w-0"
            aria-live="polite"
          >
            {/* Mobile section selector — visible only below md */}
            <div className="md:hidden shrink-0 px-4 pt-4 pb-3 border-b border-border bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Seção
              </p>
              <Select value={activeSection} onValueChange={setActiveSection}>
                <SelectTrigger id="wiki-section-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleSections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      <span className="flex items-center gap-2">
                        {section.title}
                        {section.badge === "admin" && (
                          <Star className="h-3 w-3 text-amber-500" />
                        )}
                        {section.badge === "avançado" && (
                          <span className="text-[10px] font-bold text-orange-500">ADV</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section content */}
            <div className="flex-1 px-4 py-5 sm:px-8 sm:py-7 md:px-10 md:py-8">
              {currentSection.content}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
