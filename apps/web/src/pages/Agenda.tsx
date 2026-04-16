import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash } from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_APPOINTMENTS_BY_DATE, GET_SURGEONS, GET_LEADS, GET_PATIENTS, CREATE_APPOINTMENT, UPDATE_APPOINTMENT, DELETE_APPOINTMENT } from "@/lib/queries";
import { validatePhone, sanitizeInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, addDays, subDays, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 8; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não Compareceu",
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  CONFIRMED: "bg-green-500",
  COMPLETED: "bg-gray-500",
  CANCELLED: "bg-red-500",
  NO_SHOW: "bg-yellow-500",
};

const Agenda = () => {
  const [currentDate, setCurrentDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [newConsultCalendarOpen, setNewConsultCalendarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newConsultDialogOpen, setNewConsultDialogOpen] = useState(false);
  const [newConsultDate, setNewConsultDate] = useState<Date>(new Date());
  const [newConsultTime, setNewConsultTime] = useState("09:00");
  const [selectedSlot, setSelectedSlot] = useState<{ doctorId: string; time: string; date: string } | null>(null);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    procedure: '',
    notes: '',
  });
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const dateObj = new Date(currentDate + "T12:00:00");
  const dateLabel = format(dateObj, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { data: appointmentsData, loading: loadingAppointments, refetch: refetchAppointments } = useQuery(GET_APPOINTMENTS_BY_DATE, {
    variables: { date: currentDate },
    fetchPolicy: 'cache-and-network',
  });

  const { data: surgeonsData, loading: loadingSurgeons } = useQuery(GET_SURGEONS, {
    fetchPolicy: 'cache-first',
  });

  const { data: leadsData, loading: loadingLeads } = useQuery(GET_LEADS, {
    variables: { first: 100 },
    fetchPolicy: 'cache-first',
  });

  const { data: patientsData } = useQuery(GET_PATIENTS, {
    variables: { first: 100 },
    fetchPolicy: 'cache-first',
  });

  const [createAppointment] = useMutation(CREATE_APPOINTMENT);
  const [updateAppointment] = useMutation(UPDATE_APPOINTMENT);
  const [deleteAppointment, { loading: deleting }] = useMutation(DELETE_APPOINTMENT);

  const appointments = appointmentsData?.appointmentsByDate || [];
  const surgeons = surgeonsData?.surgeons || [];
  const leads = leadsData?.leads?.edges?.map((edge: any) => edge.node) || [];
  const patients = patientsData?.patients?.edges?.map((edge: any) => edge.node) || [];

  const prevDay = () => {
    const newDate = format(subDays(dateObj, 1), 'yyyy-MM-dd');
    setCurrentDate(newDate);
  };
  
  const nextDay = () => {
    const newDate = format(addDays(dateObj, 1), 'yyyy-MM-dd');
    setCurrentDate(newDate);
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentDate(format(date, 'yyyy-MM-dd'));
      setCalendarOpen(false);
    }
  };

  const getAppointment = (surgeonId: string, time: string) =>
    appointments.find(
      (a: any) => a.surgeon?.id === surgeonId && format(new Date(a.scheduledAt), 'HH:mm') === time
    );

  const openNewAppointment = (surgeonId: string, time: string, apt?: any) => {
    setSelectedSlot({ doctorId: surgeonId, time, date: currentDate });
    if (apt) {
      setEditingAppointmentId(apt.id);
      setSelectedPatientId(apt.patient?.id || null); // Use patient ID, not lead ID
      setNewAppointment({
        patientName: apt.patient?.lead?.name || apt.patient?.name || '',
        patientPhone: apt.patient?.lead?.phone || apt.patient?.phone || '',
        procedure: apt.procedure || '',
        notes: apt.notes || '',
      });
    } else {
      setEditingAppointmentId(null);
      setSelectedPatientId(null);
      setNewAppointment({ patientName: '', patientPhone: '', procedure: '', notes: '' });
    }
    setSheetOpen(true);
  };

  const handleSaveAppointment = async () => {
    if (!selectedSlot) {
      toast.error('Selecione um horário');
      return;
    }

    // Validar cirurgião
    if (!selectedSlot.doctorId) {
      toast.error('Selecione o cirurgião');
      return;
    }

    // Validar data
    if (!selectedSlot.date) {
      toast.error('Selecione a data');
      return;
    }

    // Validar horário
    if (!selectedSlot.time) {
      toast.error('Selecione o horário');
      return;
    }

    // Validar minuto múltiplo de 5 (segurança)
    const timeParts = selectedSlot.time.split(':');
    const minute = parseInt(timeParts[1], 10);
    if (minute % 5 !== 0) {
      toast.error('Minutos devem ser múltiplos de 5 (00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)');
      return;
    }

    const sanitizedName = sanitizeInput(newAppointment.patientName);
    const sanitizedPhone = sanitizeInput(newAppointment.patientPhone);
    const sanitizedProcedure = sanitizeInput(newAppointment.procedure);
    const sanitizedNotes = sanitizeInput(newAppointment.notes);

    if (!sanitizedName || sanitizedName.length < 2) {
      toast.error('Nome do paciente é obrigatório');
      return;
    }

    if (sanitizedPhone && !validatePhone(sanitizedPhone)) {
      toast.error('Telefone inválido');
      return;
    }

    if (!sanitizedProcedure) {
      toast.error('Procedimento é obrigatório');
      return;
    }

    try {
      if (editingAppointmentId) {
        await updateAppointment({
          variables: {
            input: {
              id: editingAppointmentId,
              surgeonId: selectedSlot.doctorId,
              procedure: sanitizedProcedure,
              scheduledAt: `${selectedSlot.date}T${selectedSlot.time}:00`,
              notes: sanitizedNotes,
            },
          },
        });
      } else {
        if (!selectedPatientId) {
          toast.error('Selecione um paciente');
          return;
        }
        await createAppointment({
          variables: {
            input: {
              patientId: selectedPatientId,
              surgeonId: selectedSlot.doctorId,
              procedure: sanitizedProcedure,
              scheduledAt: `${selectedSlot.date}T${selectedSlot.time}:00`,
              notes: sanitizedNotes,
            },
          },
        });
      }
      refetchAppointments();
      setSheetOpen(false);
      setEditingAppointmentId(null);
      setNewAppointment({ patientName: '', patientPhone: '', procedure: '', notes: '' });
      setSelectedPatientId(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Erro ao salvar agendamento.');
    }
  };

  const openDeleteDialog = (appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAppointment = async () => {
    if (!appointmentToDelete) {
      return;
    }

    if (deleteConfirmText.toLowerCase() !== 'deletar') {
      toast.error('Digite "deletar" para confirmar a exclusão');
      return;
    }
    
    try {
      await deleteAppointment({
        variables: { input: { id: appointmentToDelete, confirmed: true } },
      });
      
      refetchAppointments();
      setSheetOpen(false);
      setEditingAppointmentId(null);
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
      setDeleteConfirmText("");
    } catch (error: any) {
      const errorMsg = error?.message || 'Erro ao excluir agendamento.';
      toast.error(`Erro: ${errorMsg}`);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteConfirmText("");
  };

  const isInitialLoad = (loadingSurgeons || loadingAppointments || loadingLeads) && !appointmentsData && !surgeonsData;

  if (isInitialLoad) {
    return (
      <AppLayout title="Agenda Médica">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Agenda Médica">
      {/* Date Navigation */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[280px] justify-start text-center capitalize font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateObj}
                onSelect={handleDateSelect}
                locale={ptBR}
                className="rounded-md"
              />
            </PopoverContent>
          </Popover>
          
          <Button variant="outline" size="icon" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setNewConsultDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Consulta
        </Button>
      </div>

      {/* Schedule Grid */}
      <div className="bg-card border rounded-lg p-2 md:p-4 shadow-sm">
        <div className="grid grid-cols-[80px_repeat(auto-fit,minmax(220px,1fr))] gap-4 overflow-x-auto pb-4 items-start">
          {/* Time Column */}
          <div className="sticky left-0 bg-card z-10">
            {/* Espaçador invisível para alinhar com o topo dos cartões dos médicos */}
            <div className="mb-4 invisible pointer-events-none sticky top-0">
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Horário</CardTitle>
                  <p className="text-xs">Offset</p>
                </CardHeader>
              </Card>
            </div>
            <div className="space-y-2">
              {timeSlots.map((time) => (
                <div key={time} className="h-20 flex items-center justify-center text-sm font-medium text-muted-foreground border-b">
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* Doctor Columns */}
          {surgeons.map((surgeon: any) => (
            <div key={surgeon.id} className="min-w-[220px]">
              <Card className="mb-4 sticky top-0 z-20 shadow-sm">
                <CardHeader className="p-3 bg-secondary/30 rounded-t-lg">
                  <CardTitle className="text-sm truncate">{surgeon.name}</CardTitle>
                  <p className="text-xs text-muted-foreground truncate">{surgeon.specialty}</p>
                </CardHeader>
              </Card>
              <div className="space-y-2">
                {timeSlots.map((time) => {
                  const appointment = getAppointment(surgeon.id, time);
                  return (
                    <div
                      key={time}
                      className={cn(
                        "h-20 border rounded-lg p-3 transition-colors duration-200 border-l-4",
                        appointment 
                          ? "bg-primary/5 hover:bg-primary/10 border-primary cursor-pointer shadow-sm" 
                          : "bg-muted/10 hover:bg-muted/30 cursor-pointer border-dashed border-border border-l-border"
                      )}
                      onClick={() => openNewAppointment(surgeon.id, time, appointment)}
                    >
                      {appointment ? (
                        <div className="h-full flex flex-col justify-center gap-1">
                          <p className="text-sm font-semibold truncate text-foreground">{appointment.patient?.name}</p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground truncate font-medium">{appointment.procedure}</span>
                            <Badge className={cn("h-4 text-[9px] px-1.5", statusColors[appointment.status])}>
                              {statusLabels[appointment.status]}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-xs text-muted-foreground font-medium flex items-center">
                            <Plus className="mr-1 h-3 w-3" /> Adicionar
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Appointment Form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingAppointmentId ? 'Detalhes da Consulta' : 'Nova Consulta'}</SheetTitle>
            <SheetDescription>
              {selectedSlot?.date ? format(parse(selectedSlot.date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM", { locale: ptBR }) : ''} às {selectedSlot?.time}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 py-6">
            {/* Data e Hora - Sempre visível */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedSlot?.date ? format(parse(selectedSlot.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedSlot?.date ? parse(selectedSlot.date, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedSlot((prev: any) => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
                        }
                      }}
                      locale={ptBR}
                      className="rounded-md"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <div className="flex gap-2">
                  <Select 
                    value={selectedSlot?.time ? selectedSlot.time.split(':')[0] : ''}
                    onValueChange={(val) => {
                      const minute = selectedSlot?.time ? selectedSlot.time.split(':')[1] : '00';
                      setSelectedSlot((prev: any) => ({ ...prev, time: `${val}:${minute}` }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 11 }, (_, i) => i + 8).map((hour) => (
                        <SelectItem key={hour} value={hour.toString().padStart(2, '0')}>
                          {hour.toString().padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select 
                    value={selectedSlot?.time ? selectedSlot.time.split(':')[1] : ''}
                    onValueChange={(val) => {
                      const hour = selectedSlot?.time ? selectedSlot.time.split(':')[0] : '08';
                      setSelectedSlot((prev: any) => ({ ...prev, time: `${hour}:${val}` }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Min" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                        <SelectItem key={minute} value={minute.toString().padStart(2, '0')}>{minute.toString().padStart(2, '0')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="surgeonId">Cirurgião</Label>
              <Select
                value={selectedSlot?.doctorId || ""}
                onValueChange={(val) => setSelectedSlot((prev: any) => ({ ...prev, doctorId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cirurgião" />
                </SelectTrigger>
                <SelectContent>
                  {surgeons.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {editingAppointmentId ? (
              <div className="space-y-2">
                <Label>Paciente</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{newAppointment.patientName}</p>
                  <p className="text-sm text-muted-foreground">{newAppointment.patientPhone}</p>
                </div>
                <p className="text-xs text-orange-500">Para alterar o paciente, exclua e crie um novo agendamento.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="patientId">Paciente</Label>
                <Select
                  value={selectedPatientId || ""}
                  onValueChange={(val) => {
                    setSelectedPatientId(val);
                    const patient = patients?.find((p: any) => p.id === val);
                    if (patient) {
                      setNewAppointment({
                        ...newAppointment,
                        patientName: patient.lead?.name || patient.name || '',
                        patientPhone: patient.lead?.phone || patient.phone || '',
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients?.map((patient: any) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.lead?.name || patient.name || 'Paciente'} - {patient.lead?.phone || patient.phone || 'sem telefone'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="procedure">Procedimento / Etapa</Label>
              <Select
                value={newAppointment.procedure}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, procedure: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primeira Consulta">Primeira Consulta</SelectItem>
                  <SelectItem value="Retorno">Retorno</SelectItem>
                  <SelectItem value="Rinoplastia">Rinoplastia</SelectItem>
                  <SelectItem value="Lipoaspiração">Lipoaspiração</SelectItem>
                  <SelectItem value="Mamoplastia">Mamoplastia</SelectItem>
                  <SelectItem value="Abdominoplastia">Abdominoplastia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações Clínicas</Label>
              <Textarea
                id="notes"
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                placeholder="Detalhes ou restrições..."
                className="resize-none h-24"
              />
            </div>
            
            <div className="pt-4 flex gap-3">
              <Button onClick={handleSaveAppointment} className="flex-1">
                {editingAppointmentId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </Button>
              {editingAppointmentId && (
                <Button variant="destructive" size="icon" onClick={() => editingAppointmentId && openDeleteDialog(editingAppointmentId)}>
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.</p>
              <p className="text-sm font-medium">Digite <span className="text-destructive font-bold">deletar</span> para confirmar:</p>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="deletar"
            className="border-2 border-destructive"
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleCloseDeleteDialog}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAppointment} disabled={deleting || !appointmentToDelete || deleteConfirmText.toLowerCase() !== 'deletar'}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newConsultDialogOpen} onOpenChange={setNewConsultDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Consulta</DialogTitle>
            <DialogDescription>
              Selecione a data e horário para a nova consulta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover open={newConsultCalendarOpen} onOpenChange={setNewConsultCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(newConsultDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newConsultDate}
                    onSelect={(date) => {
                      if (date) {
                        setNewConsultDate(date);
                        setNewConsultCalendarOpen(false);
                      }
                    }}
                    locale={ptBR}
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Horário</Label>
              <Select value={newConsultTime} onValueChange={setNewConsultTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewConsultDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => {
                const selectedDateStr = format(newConsultDate, 'yyyy-MM-dd');
                setNewConsultDialogOpen(false);
                setSelectedSlot({ doctorId: surgeons[0]?.id || '', time: newConsultTime, date: selectedDateStr });
                setSheetOpen(true);
              }}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Agenda;
