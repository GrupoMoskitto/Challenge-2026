import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  TrendingUp,
  Clock,
  CalendarCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useQuery } from "@apollo/client";
import { GET_DASHBOARD_STATS } from "@/lib/queries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  CONVERTED: "Convertido",
  LOST: "Perdido",
};

const statusColors: Record<string, string> = {
  NEW: "bg-gray-500",
  CONTACTED: "bg-blue-500",
  QUALIFIED: "bg-yellow-500",
  CONVERTED: "bg-green-500",
  LOST: "bg-red-500",
};

const Dashboard = () => {
  const { data, loading, error } = useQuery(GET_DASHBOARD_STATS);

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-10 w-10 rounded-xl mb-3" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </AppLayout>
    );
  }

  const leads = data?.leads?.edges?.map((e: any) => e.node) || [];
  const totalLeads = data?.leads?.totalCount || 0;
  const appointments = data?.appointments || [];
  const surgeons = data?.surgeons || [];

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayAppointments = appointments.filter((a: any) => 
    format(new Date(a.scheduledAt), 'yyyy-MM-dd') === todayStr
  );

  const convertedLeads = leads.filter((l: any) => l.status === 'CONVERTED').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const originCounts = leads.reduce((acc: any, lead: any) => {
    const origin = lead.origin || 'Outro';
    acc[origin] = (acc[origin] || 0) + 1;
    return acc;
  }, {});

  const originColors: Record<string, string> = {
    'Instagram': '#E1306C',
    'TikTok': '#000000',
    'Google Ads': '#4285F4',
    'Indicação': '#25D366',
    'Site': '#FF6F00',
    'Facebook': '#1877F2',
    'Outro': '#6B7280',
  };

  const channelData = Object.entries(originCounts).map(([name, count]) => ({
    name,
    leads: count,
    color: originColors[name] || originColors['Outro'],
  }));

  const kpis = [
    { label: "Novos Leads", value: totalLeads, change: "+12%", icon: Users, trend: "up" },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, change: "Meta: 65%", icon: TrendingUp, trend: "neutral" },
    { label: "Cirurgiões Ativos", value: surgeons.length, change: "Disponíveis", icon: Clock, trend: "up" },
    { label: "Consultas Hoje", value: todayAppointments.length, change: "Hoje", icon: CalendarCheck, trend: "up" },
  ];

  return (
    <AppLayout title="Dashboard">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <kpi.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {kpi.change}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Leads por Canal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {channelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "var(--radius)",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="leads" radius={[6, 6, 0, 0]}>
                      {channelData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nenhum dado disponível
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Próximos Atendimentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultas de Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppointments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma consulta hoje</p>
            )}
            {todayAppointments.map((apt: any) => (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary">
                    {format(new Date(apt.scheduledAt), 'HH:mm')}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{apt.patient?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {apt.surgeon?.name} · {apt.procedure}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {apt.status === 'SCHEDULED' ? 'Agendado' : apt.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
