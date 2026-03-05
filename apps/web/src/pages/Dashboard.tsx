import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  CalendarCheck,
  Phone,
  DollarSign,
  Activity,
  Download,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
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
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { useQuery } from "@apollo/client";
import { GET_DASHBOARD_STATS, GET_LEADS, GET_APPOINTMENTS } from "@/lib/queries";
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  NEW: "Novo",
  CONTACTED: "Contatado",
  QUALIFIED: "Qualificado",
  CONVERTED: "Convertido",
  LOST: "Perdido",
};

const statusColors: Record<string, string> = {
  NEW: "#6B7280",
  CONTACTED: "#3B82F6",
  QUALIFIED: "#EAB308",
  CONVERTED: "#22C55E",
  LOST: "#EF4444",
};

const originColors: Record<string, string> = {
  'Instagram': '#E1306C',
  'TikTok': '#000000',
  'Google Ads': '#4285F4',
  'Indicação': '#25D366',
  'Site': '#FF6F00',
  'Facebook': '#1877F2',
  'Outro': '#6B7280',
};

const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(';'),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (val instanceof Date) return format(val, 'yyyy-MM-dd HH:mm');
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val ?? '');
    }).join(';'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
};

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  const { data: statsData, loading: statsLoading } = useQuery(GET_DASHBOARD_STATS);
  const { data: leadsData, loading: leadsLoading, refetch: refetchLeads } = useQuery(GET_LEADS, {
    variables: { first: 100 },
    fetchPolicy: 'network-only',
  });
  const { data: appointmentsData, loading: appointmentsLoading } = useQuery(GET_APPOINTMENTS);

  const loading = statsLoading || leadsLoading || appointmentsLoading;

  const leads = useMemo(() => leadsData?.leads?.edges?.map((e: any) => e.node) || [], [leadsData]);
  const appointments = appointmentsData?.appointments || [];
  const surgeons = statsData?.surgeons || [];

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  const dateRange = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return {
      start: subDays(today, days),
      end: today,
    };
  }, [timeRange]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l: any) => {
      const createdAt = new Date(l.createdAt);
      return isWithinInterval(createdAt, { start: dateRange.start, end: dateRange.end });
    });
  }, [leads, dateRange]);

  const todayAppointments = appointments.filter((a: any) => 
    format(new Date(a.scheduledAt), 'yyyy-MM-dd') === todayStr
  );

  const weekStart = startOfWeek(today, { locale: ptBR });
  const weekEnd = endOfWeek(today, { locale: ptBR });
  const weekAppointments = appointments.filter((a: any) => {
    const aptDate = new Date(a.scheduledAt);
    return isWithinInterval(aptDate, { start: weekStart, end: weekEnd });
  });

  const convertedLeads = filteredLeads.filter((l: any) => l.status === 'CONVERTED').length;
  const lostLeads = filteredLeads.filter((l: any) => l.status === 'LOST').length;
  const qualifiedLeads = filteredLeads.filter((l: any) => l.status === 'QUALIFIED').length;
  const contactedLeads = filteredLeads.filter((l: any) => l.status === 'CONTACTED').length;
  const newLeads = filteredLeads.filter((l: any) => l.status === 'NEW').length;

  const totalLeads = filteredLeads.length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
  const lostRate = totalLeads > 0 ? Math.round((lostLeads / totalLeads) * 100) : 0;
  const qualifiedRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

  const originCounts = filteredLeads.reduce((acc: any, lead: any) => {
    const origin = lead.origin || 'Outro';
    acc[origin] = (acc[origin] || 0) + 1;
    return acc;
  }, {});

  const originData = Object.entries(originCounts).map(([name, count]) => ({
    name,
    value: count,
    color: originColors[name] || originColors['Outro'],
  }));

  const procedureCounts = filteredLeads.reduce((acc: any, lead: any) => {
    const proc = lead.procedure || 'Outro';
    acc[proc] = (acc[proc] || 0) + 1;
    return acc;
  }, {});

  const procedureData = Object.entries(procedureCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const statusCounts = filteredLeads.reduce((acc: any, lead: any) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({
    name: statusLabels[name] || name,
    value,
    color: statusColors[name],
  }));

  const leadsByDay = filteredLeads.reduce((acc: any, lead: any) => {
    const day = format(new Date(lead.createdAt), 'dd/MM');
    acc[day] = acc[day] || { leads: 0, converted: 0 };
    acc[day].leads += 1;
    if (lead.status === 'CONVERTED') {
      acc[day].converted += 1;
    }
    return acc;
  }, {});

  const trendData = Object.entries(leadsByDay)
    .sort((a, b) => {
      const [d1, m1, y1] = a[0].split('/');
      const [d2, m2, y2] = b[0].split('/');
      return new Date(`${m1}/${d1}/${y1}`).getTime() - new Date(`${m2}/${d2}/${y2}`).getTime();
    })
    .slice(-14)
    .map(([date, data]) => ({ date, leads: data.leads, converted: data.converted }));

  const surgeonAppointments = surgeons.map((surgeon: any) => {
    const surgeonApts = appointments.filter((a: any) => a.surgeon?.id === surgeon.id);
    return {
      name: surgeon.name.split(' ').slice(1).join(' ') || surgeon.name,
      appointments: surgeonApts.length,
      converted: leads.filter((l: any) => l.preferredDoctor === surgeon.id && l.status === 'CONVERTED').length,
    };
  });

  const recentLeads = [...leads]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const handleExportCSV = () => {
    const exportData = filteredLeads.map((l: any) => ({
      Nome: l.name,
      Email: l.email,
      Telefone: l.phone,
      CPF: l.cpf,
      Origem: l.origin,
      Procedimento: l.procedure,
      Status: statusLabels[l.status] || l.status,
      'Data Criação': l.createdAt,
      'WhatsApp': l.whatsappActive ? 'Sim' : 'Não',
    }));
    exportToCSV(exportData, 'leads');
  };

  const kpis = [
    { 
      label: "Total de Leads", 
      value: totalLeads, 
      subValue: `${filteredLeads.length} no período`,
      icon: Users, 
      trend: "up",
      color: "bg-blue-500",
    },
    { 
      label: "Taxa de Conversão", 
      value: `${conversionRate}%`, 
      subValue: `${convertedLeads} convertidos`,
      icon: TrendingUp, 
      trend: conversionRate >= 20 ? "up" : conversionRate >= 10 ? "neutral" : "down",
      color: "bg-green-500",
    },
    { 
      label: "Taxa de Perda", 
      value: `${lostRate}%`, 
      subValue: `${lostLeads} perdidos`,
      icon: TrendingDown, 
      trend: lostRate <= 15 ? "up" : "down",
      color: "bg-red-500",
    },
    { 
      label: "Consultas Hoje", 
      value: todayAppointments.length, 
      subValue: `${weekAppointments.length} esta semana`,
      icon: CalendarCheck, 
      trend: "neutral",
      color: "bg-purple-500",
    },
    { 
      label: "Leads Qualificados", 
      value: qualifiedLeads, 
      subValue: `${qualifiedRate}% do total`,
      icon: Phone, 
      trend: "up",
      color: "bg-yellow-500",
    },
    { 
      label: "Cirurgiões Ativos", 
      value: surgeons.length, 
      subValue: "Disponíveis",
      icon: Clock, 
      trend: "neutral",
      color: "bg-cyan-500",
    },
  ];

  if (loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-8 w-8 rounded-lg mb-2" />
                  <Skeleton className="h-7 w-16 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Header with export */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range === '7d' ? '7 dias' : range === '30d' ? '30 dias' : '90 dias'}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-lg ${kpi.color} flex items-center justify-center mb-3`}>
                  <kpi.icon className="h-5 w-5 text-white" />
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  {kpi.trend === 'up' && <ArrowUpRight className="h-4 w-4 text-green-500" />}
                  {kpi.trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-500" />}
                </div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.subValue}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-medium">Tendência de Leads</CardTitle>
                <p className="text-sm text-muted-foreground">Evolução dos últimos 14 dias</p>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Leads</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Convertidos</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorConverted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11 }} 
                        stroke="hsl(var(--muted-foreground))" 
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }} 
                        stroke="hsl(var(--muted-foreground))" 
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="leads" 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorLeads)" 
                        name="Leads"
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="converted" 
                        stroke="#22C55E" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorConverted)" 
                        name="Convertidos"
                        dot={{ fill: '#22C55E', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Status dos Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "var(--radius)",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Origin Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Leads por Origem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {originData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={originData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "var(--radius)",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {originData.map((entry, index) => (
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

          {/* Procedure Donut Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Procedimentos mais Procurados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {procedureData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={procedureData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {procedureData.map((entry, index) => (
                          <Cell key={index} fill={`hsl(${index * 40}, 70%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: "var(--radius)",
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Últimos Leads</CardTitle>
              <Badge variant="outline">{filteredLeads.length} total</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLeads.map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{lead.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{lead.origin} · {lead.procedure || 'Sem procedimento'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge style={{ backgroundColor: statusColors[lead.status], color: 'white' }} className="text-xs">
                        {statusLabels[lead.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(lead.createdAt), 'dd/MM')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Today's Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-medium">Consultas de Hoje</CardTitle>
              <Badge variant="outline">{todayAppointments.length} consultas</Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma consulta agendada para hoje
                  </p>
                ) : (
                  todayAppointments.map((apt: any) => (
                    <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{apt.patient?.name || 'Paciente'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(apt.scheduledAt), 'HH:mm')} · {apt.surgeon?.name} · {apt.procedure}
                          </p>
                        </div>
                      </div>
                      <Badge variant={apt.status === 'SCHEDULED' ? 'default' : 'secondary'} className="text-xs">
                        {apt.status === 'SCHEDULED' ? 'Agendado' : apt.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
