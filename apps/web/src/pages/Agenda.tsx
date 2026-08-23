import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PROCEDURES } from "@/lib/constants";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RiskPill } from "@crmed/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Trash, Search, Loader2, AlertTriangle, Stethoscope } from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_APPOINTMENTS_BY_DATE, GET_SURGEONS, GET_PATIENTS, CREATE_APPOINTMENT, UPDATE_APPOINTMENT, DELETE_APPOINTMENT, UPDATE_APPOINTMENT_STATUS } from "@/lib/queries";
import { validatePhone, sanitizeInput, checkSurgeonAvailability } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { showUndoableToast } from "@/hooks/useUndoableToast";
import { buildExplicitScheduledAt } from "@/lib/dateUtils";
import { format, addDays, subDays, parse, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TimePicker } from "@/components/ui/time-picker";

const statusLabels: Record<string, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não Compareceu",
  ATTENTION_REQUIRED: "Requer Atenção",
  RESCHEDULED: "Reagendado",
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  CONFIRMED: "bg-green-500",
  COMPLETED: "bg-gray-500",
  CANCELLED: "bg-red-500",
  NO_SHOW: "bg-yellow-500",
  ATTENTION_REQUIRED: "bg-orange-500",
  RESCHEDULED: "bg-purple-500",
};

const Agenda = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [currentDate, setCurrentDate] = useState(() => {
    const d = searchParams.get("date");
    if (d && !isNaN(new Date(d).getTime())) return d;
    return format(new Date(), 'yyyy-MM-dd');
  });
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
  const [previousAppointmentState, setPreviousAppointmentState] = useState<any>(null);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    procedure: '',
    notes: '',
    status: '',
  });
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [debouncedPatientSearch, setDebouncedPatientSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPatientSearch(patientSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const dateObj = new Date(currentDate + "T12:00:00");
  const dateLabel = format(dateObj, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { data: appointmentsData, loading: loadingAppointments, refetch: refetchAppointments } = useQuery(GET_APPOINTMENTS_BY_DATE, {
    variables: { date: currentDate },
    fetchPolicy: 'cache-and-network',
  });

  const { data: surgeonsData, loading: loadingSurgeons } = useQuery(GET_SURGEONS, {
    fetchPolicy: 'cache-first',
  });

  const { data: patientsData, loading: loadingPatients } = useQuery(GET_PATIENTS, {
    variables: { 
      first: 500, 
      where: { search: debouncedPatientSearch || undefined } 
    },
    fetchPolicy: 'cache-and-network',
  });

  const [createAppointment] = useMutation(CREATE_APPOINTMENT);
  const [updateAppointment] = useMutation(UPDATE_APPOINTMENT);
  const [updateAppointmentStatus] = useMutation(UPDATE_APPOINTMENT_STATUS);
  const [deleteAppointment, { loading: deleting }] = useMutation(DELETE_APPOINTMENT);

  const appointments = appointmentsData?.appointmentsByDate || [];
  const surgeons = surgeonsData?.surgeons || [];
  const patients = patientsData?.patients?.edges?.map((edge: any) => edge.node) || [];

  const timeSlots = React.useMemo(() => {
    let maxHour = 18; // Default cutoff

    // Check existing appointments on this day
    appointments.forEach((apt: any) => {
      const h = new Date(apt.scheduledAt).getHours();
      if (h > maxHour) maxHour = h;
    });

    // Check surgeons' schedules
    const dayOfWeek = dateObj.getDay();
    surgeons.forEach((surgeon: any) => {
      surgeon.availability?.forEach((a: any) => {
        if (a.dayOfWeek === dayOfWeek && a.isActive) {
          const h = parseInt(a.endTime.split(':')[0], 10);
          if (h > maxHour) maxHour = h;
        }
      });
      surgeon.extraAvailability?.forEach((ea: any) => {
        if (format(new Date(ea.date), 'yyyy-MM-dd') === currentDate && ea.isActive) {
          const h = parseInt(ea.endTime.split(':')[0], 10);
          if (h > maxHour) maxHour = h;
        }
      });
    });

    if (maxHour > 23) maxHour = 23; // Hard cap

    const slots: string[] = [];
    for (let hour = 8; hour <= maxHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === maxHour && minute > 0 && maxHour === 23) continue;
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, [appointments, surgeons, currentDate, dateObj]);

  // Auto-open appointment sheet if linked from another page
  useEffect(() => {
    const apptId = searchParams.get("appointmentId");
    if (apptId && appointments.length > 0 && !sheetOpen) {
      const appt = appointments.find((a: any) => a.id === apptId);
      if (appt) {
        const time = format(new Date(appt.scheduledAt), 'HH:mm');
        openNewAppointment(appt.surgeon?.id, time, appt);
        // Clear the param so it doesn't reopen if closed
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("appointmentId");
        setSearchParams(newParams, { replace: true });
        // Scroll the time-ruler to the appointment's slot
        setTimeout(() => {
          document.getElementById(`time-slot-${time}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 150);
      }
    }
  }, [appointments, searchParams, setSearchParams, sheetOpen]);

  const updateDateAndUrl = (newDate: string) => {
    setCurrentDate(newDate);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("date", newDate);
    setSearchParams(newParams, { replace: true });
  };

  const prevDay = () => {
    const newDate = format(subDays(dateObj, 1), 'yyyy-MM-dd');
    updateDateAndUrl(newDate);
  };
  
  const nextDay = () => {
    const newDate = format(addDays(dateObj, 1), 'yyyy-MM-dd');
    updateDateAndUrl(newDate);
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      updateDateAndUrl(format(date, 'yyyy-MM-dd'));
      setCalendarOpen(false);
    }
  };

  const getAppointment = (surgeonId: string, time: string) => {
    const [slotHour, slotMinute] = time.split(':').map(Number);
    const slotTimeMinutes = slotHour * 60 + slotMinute;
    
    return appointments.find((a: any) => {
      if (a.surgeon?.id !== surgeonId) return false;
      const aptDate = new Date(a.scheduledAt);
      const aptTimeMinutes = aptDate.getHours() * 60 + aptDate.getMinutes();
      // Match if the appointment falls within this 30-minute block
      return aptTimeMinutes >= slotTimeMinutes && aptTimeMinutes < slotTimeMinutes + 30;
    });
  };

  const openNewAppointment = (surgeonId: string, time: string, apt?: any) => {
    setSelectedSlot({ doctorId: surgeonId, time, date: currentDate });
    if (apt) {
      setEditingAppointmentId(apt.id);
      setSelectedPatientId(apt.patient?.id || null);
      const apptState = {
        patientName: apt.patient?.lead?.name || apt.patient?.name || '',
        patientPhone: apt.patient?.lead?.phone || apt.patient?.phone || '',
        procedure: apt.procedure || '',
        notes: apt.notes || '',
        status: apt.status || 'SCHEDULED',
      };
      setNewAppointment(apptState);
      setPreviousAppointmentState({
        ...apptState,
        patientId: apt.patient?.id,
        surgeonId: apt.surgeon?.id,
        scheduledAt: apt.scheduledAt,
      });
    } else {
      setEditingAppointmentId(null);
      setSelectedPatientId(null);
      setNewAppointment({ patientName: '', patientPhone: '', procedure: '', notes: '', status: '' });
      setPreviousAppointmentState(null);
    }
    setSheetOpen(true);
  };

  const handleSaveAppointment = async () => {
    if (!selectedSlot) {
      toast.error('Selecione um horário');
      return;
    }

    if (!selectedSlot.doctorId) {
      toast.error('Selecione o cirurgião');
      return;
    }

    if (!selectedSlot.date) {
      toast.error('Selecione a data');
      return;
    }

    if (!selectedSlot.time) {
      toast.error('Selecione o horário');
      return;
    }

    // RN: Validação de Horário Permitido (Hospital Padrão 18:00)
    const surgeon = surgeons.find((s: any) => s.id === selectedSlot.doctorId);
    if (!checkSurgeonAvailability(surgeon, selectedSlot.date, selectedSlot.time)) {
      toast.error("Horário não permitido: O hospital/médico não atende neste horário (Limite padrão 18:00). Verifique as configurações de agenda.");
      return;
    }

    const timeParts = selectedSlot.time.split(':');
    const minute = parseInt(timeParts[1], 10);
    if (minute % 5 !== 0) {
      toast.error('Minutos devem ser múltiplos de 5');
      return;
    }

    const appointmentDate = new Date(`${selectedSlot.date}T${selectedSlot.time}:00`);
    if (appointmentDate < new Date()) {
      toast.error('Não é possível criar ou mover agendamentos para datas passadas');
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
              scheduledAt: buildExplicitScheduledAt(selectedSlot.date, selectedSlot.time),
              notes: sanitizedNotes,
            },
          },
        });
        if (newAppointment.status && previousAppointmentState && newAppointment.status !== previousAppointmentState.status) {
          await updateAppointmentStatus({
            variables: {
              input: {
                id: editingAppointmentId,
                status: newAppointment.status,
              }
            }
          });
        }
      } else {
        if (!selectedPatientId) {
          toast.error('Selecione um paciente');
          return;
        }
        const res = await createAppointment({
          variables: {
            input: {
              patientId: selectedPatientId,
              surgeonId: selectedSlot.doctorId,
              procedure: sanitizedProcedure,
              scheduledAt: buildExplicitScheduledAt(selectedSlot.date, selectedSlot.time),
              notes: sanitizedNotes,
            },
          },
        });
        if (res.errors && res.errors.length > 0) {
          throw new Error(res.errors[0].message);
        }
      }
      await refetchAppointments();
      showUndoableToast(
        "Agendamento salvo!",
        async () => {
          if (previousAppointmentState && editingAppointmentId) {
            await updateAppointment({
              variables: {
                input: {
                  id: editingAppointmentId,
                  patientId: previousAppointmentState.patientId,
                  surgeonId: previousAppointmentState.surgeonId,
                  procedure: previousAppointmentState.procedure,
                  scheduledAt: previousAppointmentState.scheduledAt,
                  notes: previousAppointmentState.notes,
                },
              },
            });
            if (previousAppointmentState.status && previousAppointmentState.status !== newAppointment.status) {
              await updateAppointmentStatus({
                variables: {
                  input: {
                    id: editingAppointmentId,
                    status: previousAppointmentState.status,
                  }
                }
              });
            }
            await refetchAppointments();
          }
        },
        "Desfazer"
      );
      setSheetOpen(false);
      setEditingAppointmentId(null);
      setNewAppointment({ patientName: '', patientPhone: '', procedure: '', notes: '', status: '' });
      setSelectedPatientId(null);
      setPreviousAppointmentState(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar agendamento.');
    }
  };

  const openDeleteDialog = (appointmentId: string) => {
    setAppointmentToDelete(appointmentId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAppointment = async () => {
    if (!appointmentToDelete) return;
    if (deleteConfirmText.toLowerCase() !== 'deletar') {
      toast.error('Digite "deletar" para confirmar a exclusão');
      return;
    }
    
    try {
      await deleteAppointment({
        variables: { input: { id: appointmentToDelete, confirmed: true } },
      });
      await refetchAppointments();
      toast.success("Agendamento excluído!");
      setSheetOpen(false);
      setEditingAppointmentId(null);
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
      setDeleteConfirmText("");
    } catch (error: any) {
      toast.error(`Erro: ${error.message || 'Erro ao excluir agendamento.'}`);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteConfirmText("");
  };

  const isInitialLoad = (loadingSurgeons || loadingAppointments) && !appointmentsData && !surgeonsData;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button variant="outline" size="icon" onClick={prevDay} className="shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex-1 min-w-0 sm:flex-none sm:w-[340px] justify-start capitalize font-normal text-xs sm:text-sm px-2 sm:px-4">
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{dateLabel}</span>
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

          <Button variant="outline" size="icon" onClick={nextDay} className="shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button 
          onClick={() => {
            if (dateObj >= startOfDay(new Date())) {
              setNewConsultDate(dateObj);
            } else {
              setNewConsultDate(new Date());
            }
            setNewConsultDialogOpen(true);
          }} 
          className="w-full sm:w-auto shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Consulta
        </Button>
      </div>

      {/* 
        Layout de dois eixos sticky:
        - O wrapper externo é `relative` para conter os filhos sticky.
        - A régua de horários: `sticky left-0 z-30` (maior prioridade) — passa por cima dos cards de médicos.
        - Os cards de médicos: `sticky top-0 z-10` — grudam no topo ao rolar verticalmente, mas ficam abaixo da régua.
        - A régua também tem um espaçador `sticky top-0` para alinhar com os cabeçalhos ao rolar.
      */}
      <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
        <div className="relative overflow-x-auto snap-x snap-mandatory scroll-smooth p-2 md:p-4">
          <div className="flex gap-3 md:gap-4 min-w-max items-start">

            {/* Régua de horários — sticky left E maior z-index */}
            <div className="sticky left-[-8px] md:left-[-16px] z-30 shrink-0 w-[68px] md:w-[96px] bg-card border-r shadow-[2px_0_8px_-2px_rgba(0,0,0,0.1)] -ml-2 md:-ml-4 pl-2 md:pl-4 -my-2 md:-my-4 py-2 md:py-4">
              {/* Espaçador sticky no topo que acompanha o cabeçalho dos médicos */}
              <div className="sticky top-0 z-30 bg-card mb-3 md:mb-4 pointer-events-none opacity-0">
                <Card className="shadow-sm overflow-hidden">
                  <CardHeader className="p-2 md:p-3">
                    <CardTitle className="text-xs md:text-sm">Spacer</CardTitle>
                    <p className="text-[10px] md:text-xs">Spacer</p>
                  </CardHeader>
                </Card>
              </div>
              <div className="space-y-1.5 md:space-y-2">
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    id={`time-slot-${time}`}
                    className="h-16 md:h-20 flex items-center justify-center text-xs md:text-sm font-medium text-muted-foreground border-b"
                  >
                    {time}
                  </div>
                ))}
              </div>
            </div>

            {surgeons.map((surgeon: any) => (
              <div key={surgeon.id} className="min-w-[200px] md:min-w-[220px] flex-1 snap-center">
                {/* Card do médico — sticky top, mas z-index menor que a régua */}
                <Card className="mb-3 md:mb-4 sticky top-0 z-10 shadow-sm overflow-hidden">
                  <CardHeader className="p-2 md:p-3 bg-secondary/50">
                    <CardTitle className="text-xs md:text-sm truncate">{surgeon.name}</CardTitle>
                    <p className="text-[10px] md:text-xs text-muted-foreground truncate">{surgeon.specialty}</p>
                  </CardHeader>
                </Card>
                <div className="space-y-1.5 md:space-y-2">
                  {timeSlots.map((time) => {
                    const appointment = getAppointment(surgeon.id, time);
                    return (
                      <div
                        key={time}
                        className={cn(
                          "h-16 md:h-20 border rounded-lg p-2 md:p-3 transition-colors duration-300 border-l-4",
                          appointment 
                            ? "bg-primary/5 hover:bg-primary/10 border-primary cursor-pointer shadow-sm" 
                            : "bg-muted/10 hover:bg-muted/30 cursor-pointer border-dashed border-border border-l-border"
                        )}
                        onClick={() => openNewAppointment(surgeon.id, time, appointment)}
                      >
                        {appointment ? (
                          <div className="h-full flex flex-col justify-center gap-0.5 md:gap-1">
                            <p className="text-xs md:text-sm font-semibold truncate text-foreground">
                              {format(new Date(appointment.scheduledAt), 'HH:mm')} • {appointment.patient?.lead?.name || appointment.patient?.name || 'Paciente'}
                            </p>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] md:text-xs text-muted-foreground truncate font-medium">{appointment.procedure}</span>
                              <div className="flex items-center gap-1">
                                {appointment.riskScore != null && appointment.riskLevel != null && (
                                  <RiskPill 
                                    score={appointment.riskScore} 
                                    level={appointment.riskLevel} 
                                    minimal={true}
                                  />
                                )}
                                <Badge className={cn("h-4 text-[8px] md:text-[9px] px-1 md:px-1.5 shrink-0", statusColors[appointment.status] || 'bg-gray-500')}>
                                  {statusLabels[appointment.status] || appointment.status}
                                </Badge>
                              </div>
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
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingAppointmentId ? 'Detalhes da Consulta' : 'Nova Consulta'}</SheetTitle>
            <SheetDescription>
              {selectedSlot?.date ? format(parse(selectedSlot.date, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM", { locale: ptBR }) : ''} às {selectedSlot?.time}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 py-6">
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
                <TimePicker 
                  value={selectedSlot?.time || "08:00"} 
                  onChange={(val) => setSelectedSlot((prev: any) => ({ ...prev, time: val }))} 
                />
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
              {selectedSlot?.doctorId && surgeons.find((s: any) => s.id === selectedSlot.doctorId)?.procedures?.length > 0 && (
                <div className="pt-1.5 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" /> Habilitado para:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const procs = surgeons.find((s: any) => s.id === selectedSlot.doctorId)?.procedures || [];
                      const displayProcs = procs.slice(0, 4);
                      const hiddenCount = procs.length - 4;
                      return (
                        <>
                          {displayProcs.map((proc: string) => (
                            <Badge key={proc} variant="outline" className="text-[9px] py-0 h-4 bg-muted/30">{proc}</Badge>
                          ))}
                          {hiddenCount > 0 && (
                            <TooltipProvider delayDuration={0}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-help">
                                    <Badge variant="outline" className="text-[9px] py-0 h-4 bg-muted/30 font-bold">+{hiddenCount}</Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="z-[100]">
                                  <div className="text-xs space-y-1">
                                    {procs.slice(4).map((p: string) => <div key={p}>{p}</div>)}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Aviso de Horário não permitido */}
            {selectedSlot && !checkSurgeonAvailability(surgeons.find((s: any) => s.id === selectedSlot.doctorId), selectedSlot.date, selectedSlot.time) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-red-700">Horário Bloqueado</p>
                  <p className="text-[10px] text-red-600 leading-tight">
                    O hospital/médico não atende neste horário (Limite padrão: 18:00). 
                    Para agendar aqui, você deve liberar este médico em <strong>Configurações → Agenda</strong>.
                  </p>
                </div>
              </div>
            )}
            
            {editingAppointmentId ? (
              <div className="space-y-2">
                <Label>Paciente</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{newAppointment.patientName}</p>
                  <p className="text-sm text-muted-foreground">{newAppointment.patientPhone}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="patientId">Paciente</Label>
                  {loadingPatients && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                
                {/* Busca rápida integrada */}
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por nome, CPF ou tel..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/30"
                  />
                </div>

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
                  <SelectTrigger className="h-10">
                    <SelectValue>
                      {selectedPatientId ? (
                        newAppointment.patientName
                      ) : (
                        <span className="text-muted-foreground">Selecione o paciente...</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {/* Mantém o item selecionado visível mesmo que não bata na busca atual para evitar "vazio" visual */}
                    {selectedPatientId && !patients.some((p: any) => p.id === selectedPatientId) && (
                      <SelectItem value={selectedPatientId} className="text-xs opacity-50">
                        {newAppointment.patientName} (atual)
                      </SelectItem>
                    )}
                    
                    {patients?.length === 0 && !selectedPatientId ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        Nenhum paciente encontrado para "{patientSearch}"
                      </div>
                    ) : (
                      patients?.map((patient: any) => (
                        <SelectItem key={patient.id} value={patient.id} className="text-xs">
                          <div className="flex flex-col">
                            <span className="font-medium">{patient.lead?.name || patient.name || 'Paciente'}</span>
                            <span className="text-[10px] opacity-70">{patient.lead?.phone || 'sem telefone'} • {patient.lead?.cpf || 'sem CPF'}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {patients.length >= 500 && !patientSearch && (
                  <p className="text-[10px] text-muted-foreground mt-1">Exibindo os primeiros 500. Use a busca para filtrar.</p>
                )}
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
                  {PROCEDURES.map(proc => (
                    <SelectItem key={proc} value={proc}>{proc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {editingAppointmentId && (
              <div className="space-y-2">
                <Label htmlFor="status">Status do Agendamento</Label>
                <Select
                  value={newAppointment.status}
                  onValueChange={(value) => setNewAppointment({ ...newAppointment, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", statusColors[key] || "bg-gray-500")} />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <DialogDescription>
              Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita. Digite "deletar" abaixo.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="deletar"
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
              <TimePicker 
                value={newConsultTime} 
                onChange={setNewConsultTime} 
              />
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
