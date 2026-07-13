import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation } from "@apollo/client";
import { useAuth } from "@/lib/auth";
import { GET_SURGEONS, CREATE_SURGEON, UPDATE_SURGEON, TOGGLE_SURGEON_STATUS, GET_APPOINTMENTS_BY_SURGEON } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, UserX, UserCheck, Loader2, Stethoscope, Calendar, Clock, MapPin, Mail, Phone, FileText, IdCard, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCPF, formatPhone, sanitizeInput } from "@/lib/validation";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  CONFIRMED: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  ATTENTION_REQUIRED: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  COMPLETED: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  CANCELLED: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  NO_SHOW: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  RESCHEDULED: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
};

const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  ATTENTION_REQUIRED: "Requer Atenção",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não Compareceu",
  RESCHEDULED: "Reagendado",
};

export default function Surgeons() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, loading, refetch } = useQuery(GET_SURGEONS, {
    variables: { includeInactive: true },
    fetchPolicy: "cache-and-network"
  });

  const [createSurgeon, { loading: creating }] = useMutation(CREATE_SURGEON);
  const [updateSurgeon, { loading: updating }] = useMutation(UPDATE_SURGEON);
  const [toggleStatus, { loading: toggling }] = useMutation(TOGGLE_SURGEON_STATUS);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const initialForm = {
    name: "", specialty: "", crm: "", cpf: "", rg: "", 
    address: "", email: "", phone: "", password: ""
  };
  
  const [formData, setFormData] = useState(initialForm);
  const [editData, setEditData] = useState<any>(null);

  const urlSurgeonId = searchParams.get("surgeonId");
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string | null>(urlSurgeonId);
  const [search, setSearch] = useState("");
  
  const updateUrl = useCallback((updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) newParams.delete(key);
      else newParams.set(key, value);
    });
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (urlSurgeonId !== selectedSurgeonId) {
      setSelectedSurgeonId(urlSurgeonId);
    }
  }, [urlSurgeonId, selectedSurgeonId]);

  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [surgeonToToggle, setSurgeonToToggle] = useState<{id: string, name: string, active: boolean} | null>(null);
  
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  const { data: apptsData, loading: apptsLoading } = useQuery(GET_APPOINTMENTS_BY_SURGEON, {
    variables: { surgeonId: selectedSurgeonId, startDate: todayStart, endDate: todayEnd },
    skip: !selectedSurgeonId,
    fetchPolicy: 'cache-and-network'
  });

  const selectedSurgeon = data?.surgeons?.find((s: any) => s.id === selectedSurgeonId);
  const todayAppointments = apptsData?.appointmentsBySurgeon || [];

  const handleCreate = async () => {
    if (!formData.name || !formData.email || !formData.crm || !formData.specialty || !formData.password || !formData.phone) {
      toast.error("Preencha todos os campos obrigatórios (*).");
      return;
    }
    
    try {
      await createSurgeon({
        variables: {
          input: {
            ...formData,
            cpf: sanitizeInput(formData.cpf),
            phone: sanitizeInput(formData.phone),
          }
        }
      });
      toast.success("Médico cadastrado com sucesso! O acesso já foi gerado.");
      setIsCreateOpen(false);
      setFormData(initialForm);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar médico.");
    }
  };

  const handleEdit = async () => {
    if (!editData) return;
    try {
      await updateSurgeon({
        variables: {
          input: {
            id: editData.id,
            name: editData.name,
            specialty: editData.specialty,
            crm: editData.crm,
            cpf: sanitizeInput(editData.cpf || ""),
            rg: editData.rg,
            address: editData.address,
            email: editData.email,
            phone: sanitizeInput(editData.phone || ""),
          }
        }
      });
      toast.success("Dados atualizados com sucesso!");
      setIsEditOpen(false);
      setEditData(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar dados.");
    }
  };

  const handleToggleStatus = async () => {
    if (!surgeonToToggle) return;
    try {
      await toggleStatus({ variables: { id: surgeonToToggle.id } });
      toast.success(`Médico ${surgeonToToggle.active ? 'desativado' : 'reativado'} com sucesso.`);
      setToggleDialogOpen(false);
      setSurgeonToToggle(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status do médico.");
    }
  };

  const surgeons = data?.surgeons || [];
  const filteredSurgeons = surgeons.filter((s: any) => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.specialty.toLowerCase().includes(search.toLowerCase()) ||
    s.crm.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Corpo Clínico">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        
        {/* Coluna Esquerda: Lista de Médicos */}
        <div className={cn(
          "space-y-4 w-full lg:w-1/3 lg:shrink-0",
          selectedSurgeonId && "hidden lg:block"
        )}>
          {/* Cabeçalho da Lista + Busca/Novo */}
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar médico..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="ml-2">
                <Plus className="mr-1 h-4 w-4" /> Novo
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {loading ? (
               <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredSurgeons.length === 0 ? (
              <div className="py-12 text-center bg-muted/20 rounded-lg border-2 border-dashed text-sm text-muted-foreground">Nenhum médico encontrado</div>
            ) : (
              filteredSurgeons.map((s: any) => (
                <Card 
                  key={s.id} 
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50", 
                    selectedSurgeonId === s.id && "border-primary ring-1 ring-primary/20 bg-primary/5",
                    !s.isActive && "opacity-60 grayscale-[0.5]"
                  )}
                  onClick={() => { setSelectedSurgeonId(s.id); updateUrl({ surgeonId: s.id }); }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border-2",
                          s.isActive ? (selectedSurgeonId === s.id ? "bg-primary/20 border-primary/30" : "bg-primary/5 border-primary/10") : "bg-muted border-muted-foreground/10"
                        )}>
                          <Stethoscope className={cn("h-5 w-5", s.isActive ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{s.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] font-semibold py-0 h-4 bg-muted/30 truncate">{s.specialty}</Badge>
                            <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                              CRM <span className="font-mono font-medium text-foreground">{s.crm}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      {!s.isActive && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 uppercase font-black tracking-tighter">Inativo</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Coluna Direita: Detalhes do Médico */}
        <div className={cn(
          "flex-1 min-w-0 bg-card border rounded-xl shadow-sm overflow-hidden",
          !selectedSurgeonId && "hidden lg:flex items-center justify-center bg-muted/20 border-dashed"
        )}>
          {!selectedSurgeonId ? (
            <div className="text-center p-10">
              <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">Selecione um médico para ver os detalhes</p>
            </div>
          ) : (
            selectedSurgeon && (
              <div className="flex flex-col h-full bg-background relative overflow-y-auto max-h-[calc(100vh-140px)]">
                {/* Back button — mobile only */}
                <Button variant="ghost" size="sm" className="lg:hidden absolute top-4 left-4 z-10 gap-1.5 text-muted-foreground" onClick={() => { setSelectedSurgeonId(null); updateUrl({ surgeonId: null }); }}>
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>

                <div className="p-6 pt-12 lg:pt-6 pb-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Stethoscope className="h-8 w-8" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-semibold tracking-tight">{selectedSurgeon.name}</h2>
                          {!selectedSurgeon.isActive && <span className="bg-destructive/10 text-destructive text-[10px] px-2 py-0.5 rounded-full font-bold">INATIVO</span>}
                        </div>
                        <p className="text-muted-foreground text-sm mt-1">
                          {selectedSurgeon.specialty} • CRM: {selectedSurgeon.crm}
                        </p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                          setEditData({ ...selectedSurgeon });
                          setIsEditOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" /> Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className={cn("gap-2", selectedSurgeon.isActive ? "text-destructive border-destructive/20 hover:bg-destructive/10" : "text-green-600 border-green-600/20 hover:bg-green-600/10")}
                          onClick={() => {
                            setSurgeonToToggle({ id: selectedSurgeon.id, name: selectedSurgeon.name, active: selectedSurgeon.isActive });
                            setToggleDialogOpen(true);
                          }}
                          disabled={toggling}
                        >
                          {selectedSurgeon.isActive ? <><UserX className="h-4 w-4" /> Desativar</> : <><UserCheck className="h-4 w-4" /> Reativar</>}
                        </Button>
                      </div>
                    )}
                  </div>

                  <Tabs defaultValue="overview" className="mt-8">
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                      <TabsTrigger value="agenda">Agenda Hoje</TabsTrigger>
                      <TabsTrigger value="schedule">Disponibilidade</TabsTrigger>
                    </TabsList>
                    
                    <div className="mt-6 pb-6">
                      <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-lg bg-muted/30 border space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><IdCard className="h-3 w-3"/> CPF</p>
                            <p className="text-sm font-medium">{formatCPF(selectedSurgeon.cpf) || "Não informado"}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/30 border space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3"/> RG</p>
                            <p className="text-sm font-medium">{selectedSurgeon.rg || "Não informado"}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/30 border space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/> Telefone</p>
                            <p className="text-sm font-medium">{formatPhone(selectedSurgeon.phone) || "Não informado"}</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/30 border space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3"/> E-mail / Login</p>
                            <p className="text-sm font-medium">{selectedSurgeon.email || "Não informado"}</p>
                          </div>
                          <div className="col-span-2 p-4 rounded-lg bg-muted/30 border space-y-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3"/> Endereço</p>
                            <p className="text-sm font-medium">{selectedSurgeon.address || "Não informado"}</p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="agenda" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" /> Consultas de Hoje
                          </h3>
                          <span className="text-sm text-muted-foreground font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</span>
                        </div>
                        
                        {apptsLoading ? (
                          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : todayAppointments.length === 0 ? (
                          <div className="text-center p-10 bg-muted/20 border border-dashed rounded-xl">
                            <p className="text-muted-foreground">Nenhuma consulta agendada para hoje.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {todayAppointments.map((apt: any) => (
                              <div 
                                key={apt.id} 
                                className="flex gap-4 p-4 border rounded-xl bg-card hover:border-primary/30 hover:bg-muted/10 transition-colors cursor-pointer group"
                                onClick={() => {
                                  const aptDate = format(new Date(apt.scheduledAt), 'yyyy-MM-dd');
                                  navigate(`/schedule?date=${aptDate}&appointmentId=${apt.id}`);
                                }}
                              >
                                <div className="flex flex-col items-center justify-center bg-muted/30 px-3 py-1 rounded-md shrink-0 group-hover:bg-primary/10 transition-colors">
                                  <span className="font-bold text-lg">{format(new Date(apt.scheduledAt), "HH:mm")}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{apt.patient?.lead?.name || 'Paciente'}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{apt.procedure}</p>
                                </div>
                                <div className="shrink-0 flex items-center">
                                  <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full border", statusColors[apt.status])}>
                                    {statusLabels[apt.status] || apt.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="schedule" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-3">
                          <h3 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Horários Fixos Semanais</h3>
                          {selectedSurgeon.availability?.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4 bg-muted/20 border border-dashed rounded-lg">Sem horários customizados. Atende no Perfil Padrão.</p>
                          ) : (
                            <div className="grid gap-2">
                              {selectedSurgeon.availability?.map((av: any) => (
                                <div key={av.dayOfWeek} className="flex justify-between items-center p-3 border rounded-lg bg-card">
                                  <span className="font-medium text-sm">{daysOfWeek[av.dayOfWeek]}</span>
                                  <span className="text-sm bg-primary/10 text-primary font-mono px-2 py-0.5 rounded">{av.startTime} - {av.endTime}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <h3 className="font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Plantões / Exceções</h3>
                          {selectedSurgeon.extraAvailability?.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4 bg-muted/20 border border-dashed rounded-lg">Nenhum plantão extra agendado.</p>
                          ) : (
                            <div className="grid gap-2">
                              {selectedSurgeon.extraAvailability?.map((ea: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-card">
                                  <span className="font-medium text-sm">{format(new Date(ea.date), 'dd/MM/yyyy')}</span>
                                  <span className="text-sm bg-green-500/10 text-green-700 font-mono px-2 py-0.5 rounded">{ea.startTime} - {ea.endTime}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <h3 className="font-semibold flex items-center gap-2 text-destructive"><UserX className="h-4 w-4" /> Férias / Bloqueios</h3>
                          {selectedSurgeon.blocks?.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4 bg-muted/20 border border-dashed rounded-lg">Nenhum bloqueio registrado.</p>
                          ) : (
                            <div className="grid gap-2">
                              {selectedSurgeon.blocks?.map((block: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg bg-destructive/5">
                                  <span className="text-sm font-medium">{format(new Date(block.startDate), 'dd/MM/yyyy')} a {format(new Date(block.endDate), 'dd/MM/yyyy')}</span>
                                  <span className="text-[10px] uppercase font-bold text-destructive">Bloqueado</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal Criar Médico */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Médico</DialogTitle>
            <DialogDescription>
              Cadastre os dados pessoais do cirurgião. O acesso ao sistema será gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2 col-span-2">
              <Label>Nome Completo *</Label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Especialidade *</Label>
              <Input placeholder="Ex: Cirurgia Plástica" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>CRM *</Label>
              <Input value={formData.crm} onChange={e => setFormData({...formData, crm: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={formatCPF(formData.cpf)} maxLength={14} onChange={e => setFormData({...formData, cpf: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Endereço Completo</Label>
              <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-2 mt-4 border-t pt-4">
              <h4 className="font-semibold text-sm">Dados de Acesso e Contato</h4>
            </div>
            <div className="space-y-2">
              <Label>Telefone (WhatsApp) *</Label>
              <Input value={formatPhone(formData.phone)} maxLength={15} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Senha Inicial de Acesso *</Label>
              <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Cadastrar Médico
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Médico */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Médico</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2 col-span-2">
                <Label>Nome Completo</Label>
                <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Especialidade</Label>
                <Input value={editData.specialty} onChange={e => setEditData({...editData, specialty: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CRM</Label>
                <Input value={editData.crm} onChange={e => setEditData({...editData, crm: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={formatCPF(editData.cpf || "")} maxLength={14} onChange={e => setEditData({...editData, cpf: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <Input value={editData.rg || ""} onChange={e => setEditData({...editData, rg: e.target.value})} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Endereço Completo</Label>
                <Input value={editData.address || ""} onChange={e => setEditData({...editData, address: e.target.value})} />
              </div>
              <div className="space-y-2 col-span-2 mt-4 border-t pt-4">
                <h4 className="font-semibold text-sm">Contatos</h4>
              </div>
              <div className="space-y-2">
                <Label>Telefone (WhatsApp)</Label>
                <Input value={formatPhone(editData.phone || "")} maxLength={15} onChange={e => setEditData({...editData, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>E-mail (Login)</Label>
                <Input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updating}>
              {updating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      {/* Confirmação de Status (Ativar/Desativar) */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {surgeonToToggle?.active ? "Desativar Profissional?" : "Reativar Profissional?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {surgeonToToggle?.active 
                ? `Ao desativar ${surgeonToToggle?.name}, ele não poderá mais logar no sistema e não aparecerá para novos agendamentos. O histórico de consultas será preservado.`
                : `Deseja reativar o acesso de ${surgeonToToggle?.name} ao sistema?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleToggleStatus}
              className={surgeonToToggle?.active ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-green-600 text-white hover:bg-green-700"}
            >
              {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : (surgeonToToggle?.active ? "Confirmar Desativação" : "Confirmar Reativação")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
