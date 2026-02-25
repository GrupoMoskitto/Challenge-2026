import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_APPOINTMENTS_BY_DATE, GET_SURGEONS, CREATE_APPOINTMENT } from "@/lib/queries";
import { validatePhone, sanitizeInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { format, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ doctorId: string; time: string; date: string } | null>(null);
  const [newAppointment, setNewAppointment] = useState({
    patientName: '',
    patientPhone: '',
    procedure: '',
    notes: '',
  });

  const dateObj = new Date(currentDate + "T12:00:00");
  const dateLabel = format(dateObj, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const { data: appointmentsData, loading: loadingAppointments, refetch: refetchAppointments } = useQuery(GET_APPOINTMENTS_BY_DATE, {
    variables: { date: currentDate },
    fetchPolicy: 'network-only',
  });

  const { data: surgeonsData, loading: loadingSurgeons } = useQuery(GET_SURGEONS, {
    fetchPolicy: 'network-only',
  });

  const [createAppointment] = useMutation(CREATE_APPOINTMENT);

  const appointments = appointmentsData?.appointmentsByDate || [];
  const surgeons = surgeonsData?.surgeons || [];

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

  const openNewAppointment = (surgeonId: string, time: string) => {
    setSelectedSlot({ doctorId: surgeonId, time, date: currentDate });
    setSheetOpen(true);
  };

  const handleCreateAppointment = async () => {
    if (!selectedSlot) return;

    const sanitizedName = sanitizeInput(newAppointment.patientName);
    const sanitizedPhone = sanitizeInput(newAppointment.patientPhone);
    const sanitizedProcedure = sanitizeInput(newAppointment.procedure);
    const sanitizedNotes = sanitizeInput(newAppointment.notes);

    if (!sanitizedName || sanitizedName.length < 2) {
      alert('Nome do paciente é obrigatório');
      return;
    }

    if (sanitizedPhone && !validatePhone(sanitizedPhone)) {
      alert('Telefone inválido');
      return;
    }

    if (!sanitizedProcedure) {
      alert('Procedimento é obrigatório');
      return;
    }

    try {
      await createAppointment({
        variables: {
          input: {
            patientId: selectedSlot.doctorId,
            surgeonId: selectedSlot.doctorId,
            procedure: sanitizedProcedure,
            scheduledAt: `${selectedSlot.date}T${selectedSlot.time}:00`,
            notes: sanitizedNotes,
          },
        },
      });
      refetchAppointments();
      setSheetOpen(false);
      setNewAppointment({ patientName: '', patientPhone: '', procedure: '', notes: '' });
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  if (loadingSurgeons) {
    return (
      <AppLayout title="Agenda Médica">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Agenda Médica">
      {/* Date Navigation */}
      <div className="flex items-center justify-between mb-6">
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
        <Button onClick={() => {
          setSelectedSlot({ doctorId: surgeons[0]?.id, time: '09:00', date: currentDate });
          setSheetOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Consulta
        </Button>
      </div>

      {/* Schedule Grid */}
      <div className="grid grid-cols-[100px_repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {/* Time Column */}
        <div className="sticky left-0 bg-background z-10">
          {timeSlots.map((time) => (
            <div key={time} className="h-16 flex items-center justify-center text-sm text-muted-foreground border-b">
              {time}
            </div>
          ))}
        </div>

        {/* Doctor Columns */}
        {surgeons.map((surgeon: any) => (
          <div key={surgeon.id} className="min-w-[200px]">
            <Card className="mb-2">
              <CardHeader className="p-3">
                <CardTitle className="text-sm">{surgeon.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{surgeon.specialty}</p>
              </CardHeader>
            </Card>
            <div className="space-y-1">
              {timeSlots.map((time) => {
                const appointment = getAppointment(surgeon.id, time);
                return (
                  <div
                    key={time}
                    className={cn(
                      "h-16 border rounded-lg p-2 transition-colors",
                      appointment 
                        ? "bg-primary/10 border-primary/30 cursor-pointer hover:bg-primary/20" 
                        : "bg-muted/30 hover:bg-muted/50 cursor-pointer border-dashed"
                    )}
                    onClick={() => {
                      if (appointment) {
                        alert(`Paciente: ${appointment.patient?.name}\nProcedimento: ${appointment.procedure}\nStatus: ${statusLabels[appointment.status]}`);
                      } else {
                        openNewAppointment(surgeon.id, time);
                      }
                    }}
                  >
                    {appointment && (
                      <div className="h-full flex flex-col justify-between">
                        <p className="text-sm font-medium truncate">{appointment.patient?.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate">{appointment.procedure}</span>
                          <Badge className={cn("h-5 text-[10px]", statusColors[appointment.status])}>
                            {statusLabels[appointment.status]}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* New Appointment Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nova Consulta</SheetTitle>
            <SheetDescription>
              Agende uma nova consulta para {selectedSlot?.date} às {selectedSlot?.time}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="patientName">Nome do Paciente</Label>
              <Input
                id="patientName"
                value={newAppointment.patientName}
                onChange={(e) => setNewAppointment({ ...newAppointment, patientName: e.target.value })}
                placeholder="Digite o nome do paciente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientPhone">Telefone</Label>
              <Input
                id="patientPhone"
                value={newAppointment.patientPhone}
                onChange={(e) => setNewAppointment({ ...newAppointment, patientPhone: e.target.value })}
                placeholder="(71) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="procedure">Procedimento</Label>
              <Select
                value={newAppointment.procedure}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, procedure: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rinoplastia">Rinoplastia</SelectItem>
                  <SelectItem value="Lipoaspiração">Lipoaspiração</SelectItem>
                  <SelectItem value="Mamoplastia">Mamoplastia</SelectItem>
                  <SelectItem value="Abdominoplastia">Abdominoplastia</SelectItem>
                  <SelectItem value="Blefaroplastia">Blefaroplastia</SelectItem>
                  <SelectItem value="Otoplastia">Otoplastia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                placeholder="Observações adicionais..."
              />
            </div>
            <Button onClick={handleCreateAppointment} className="w-full">
              Agendar Consulta
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default Agenda;
