import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, User, LogOut, Settings, ChevronDown, X, Check, CheckCheck, Plus, Trash2, Menu, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { usePatientModal } from "@/components/PatientModalContext";
import { serverLogout } from "@/lib/apollo";
import { useQuery, useMutation, gql } from "@apollo/client";
import { MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_READ, DELETE_NOTIFICATION, DELETE_ALL_NOTIFICATIONS } from "@/lib/queries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TopBarProps {
  title: string;
  /** Called to open the mobile navigation drawer */
  onMenuToggle?: () => void;
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SURGEON: "Cirurgião",
  CALL_CENTER: "Call Center",
  RECEPTION: "Recepção",
  SALES: "Vendas",
};

const notificationTypeLabels: Record<string, string> = {
  REMINDER_30D: "Lembrete — 30 dias",
  REMINDER_7D: "Lembrete — 7 dias",
  CONFIRMATION_48H: "Confirmação — 48 horas",
  POST_OP_CONFIRMATION: "Confirmação Pós-Op",
  LAST_ATTEMPT: "Última tentativa",
  NEW_LEAD: "Novo Lead via WhatsApp",
  APPOINTMENT_CONFIRMED: "Confirmação de Agendamento",
  SYSTEM_ERROR: "Erro de Sistema",
  NO_RESPONSE_48H: "SEM RESPOSTA (CRÍTICO)",
};

const NOTIFICATIONS_QUERY = gql`
  query GetNotificationsTopBar {
    notifications(first: 30) {
      id
      type
      status
      createdAt
      lead {
        id
        name
        procedure
      }
      appointment {
        id
        procedure
        scheduledAt
        patient {
          id
          lead {
            name
          }
        }
        surgeon {
          name
        }
      }
    }
    unreadNotificationsCount
  }
`;

export function TopBar({ title, onMenuToggle }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCreatePatientModal } = usePatientModal();

  const { data: notifData, refetch: refetchNotifs } = useQuery(NOTIFICATIONS_QUERY, {
    fetchPolicy: 'cache-and-network',
    pollInterval: 30000,
  });

  const [markAsRead] = useMutation(MARK_NOTIFICATION_AS_READ, {
    onCompleted: () => refetchNotifs(),
  });
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ, {
    onCompleted: () => refetchNotifs(),
  });
  const [deleteNotif] = useMutation(DELETE_NOTIFICATION, {
    onCompleted: () => refetchNotifs(),
  });
  const [deleteAllNotifs] = useMutation(DELETE_ALL_NOTIFICATIONS, {
    onCompleted: () => refetchNotifs(),
  });

  const unreadCount = notifData?.unreadNotificationsCount || 0;
  const notifications = [...(notifData?.notifications || [])]
    .filter(n => n.status !== 'PENDING') // Hide notifications that haven't been delivered
    .sort((a, b) => {
      if (a.type === 'NO_RESPONSE_48H' && b.type !== 'NO_RESPONSE_48H') return -1;
      if (a.type !== 'NO_RESPONSE_48H' && b.type === 'NO_RESPONSE_48H') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchData, loading: searchLoading } = useQuery(gql`
    query GlobalSearch($search: String!) {
      leads(search: $search, first: 5) {
        edges {
          node {
            id
            name
            phone
            cpf
            status
          }
        }
      }
      patients(first: 5, where: { search: $search }) {
        edges {
          node {
            id
            lead {
              name
              phone
              cpf
            }
          }
        }
      }
    }
  `, {
    skip: debouncedSearch.length < 2,
    fetchPolicy: 'cache-and-network',
    variables: { search: debouncedSearch },
  });

  const searchResults = {
    leads: searchData?.leads?.edges?.map((e: any) => e.node) || [],
    patients: searchData?.patients?.edges?.map((e: any) => e.node) || [],
  };

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setShowSearchResults(value.length >= 2);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setShowSearchResults(false);
  }, []);

  const handleResultClick = (type: 'lead' | 'patient') => {
    clearSearch();
    if (type === 'lead') {
      navigate(`/leads?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/patients?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    await serverLogout();
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const handleProfile = () => {
    navigate('/settings');
  };

  const handleMarkAsRead = (id: string) => {
    markAsRead({ variables: { id } });
  };

  const handleMarkAllRead = () => {
    markAllRead();
  };

  const handleDeleteNotif = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotif({ variables: { id } });
  };

  const handleDeleteAllNotifs = () => {
    deleteAllNotifs();
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-3 md:px-6 shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="lg:hidden flex items-center justify-center h-10 w-10 rounded-md hover:bg-accent transition-colors shrink-0"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </button>
        )}
        <h1 className="text-base md:text-lg font-semibold text-foreground truncate">{title}</h1>
      </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={() => openCreatePatientModal()}
            className="hidden md:flex bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Novo Paciente
          </button>
          <div className="flex-1 relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente, CPF, telefone..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => debouncedSearch.length >= 2 && setShowSearchResults(true)}
              onBlur={() => setTimeout(() => setShowSearchResults(false), 300)}
              className="pl-9 pr-8 w-full h-9 bg-background"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {showSearchResults && (
              <div className="absolute top-full mt-1 w-80 bg-background border rounded-md shadow-lg z-50 max-h-80 overflow-auto">
                {searchLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Buscando...</div>
                ) : searchResults.leads.length === 0 && searchResults.patients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Nenhum resultado encontrado</div>
                ) : (
                  <>
                    {searchResults.leads.length > 0 && (
                      <div className="p-2">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1">Leads</div>
                        {searchResults.leads.map((lead: any) => (
                          <div
                            key={lead.id}
                            className="px-2 py-2 hover:bg-accent rounded cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleResultClick('lead')}
                          >
                            <div className="text-sm font-medium">{lead.name}</div>
                            <div className="text-xs text-muted-foreground">{lead.phone} • {lead.cpf}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.patients.length > 0 && (
                      <div className="p-2 border-t">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1">Pacientes</div>
                        {searchResults.patients.map((patient: any) => (
                          <div
                            key={patient.id}
                            className="px-2 py-2 hover:bg-accent rounded cursor-pointer"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleResultClick('patient')}
                          >
                            <div className="text-sm font-medium">{patient.lead?.name}</div>
                            <div className="text-xs text-muted-foreground">{patient.lead?.phone} • {patient.lead?.cpf}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96">
            <DropdownMenuLabel className="flex items-center justify-between py-3">
              <span className="font-semibold cursor-default select-none">Notificações</span>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary gap-1 px-2"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="h-3 w-3" />
                    Marcar lidas
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 gap-1 px-2"
                    onClick={handleDeleteAllNotifs}
                  >
                    <Trash2 className="h-3 w-3" />
                    Apagar tudo
                  </Button>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {notifications.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhuma notificação
              </div>
            ) : (
              <ScrollArea className="h-[380px]">
                {notifications.map((notif: any) => {
                  const isRead = notif.status === 'READ';
                  const isCritical = notif.type === 'NO_RESPONSE_48H' || notif.type === 'APPOINTMENT_CANCELLED';
                  const is48h = notif.type === 'CONFIRMATION_48H';
                  const isConfirm = notif.type === 'APPOINTMENT_CONFIRMED';
                  const isNewLead = notif.type === 'NEW_LEAD';
                  const isReschedule = notif.type === 'APPOINTMENT_RESCHEDULE';
                  const apt = notif.appointment;
                  const lead = notif.lead;
                  
                  const displayName = lead?.name || apt?.patient?.lead?.name || 'Paciente/Lead não encontrado';
                  const procedure = lead?.procedure || apt?.procedure;
                  
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-3 py-3 border-b last:border-b-0 transition-all ${
                        isRead ? 'opacity-50 hover:bg-muted/40 dark:hover:bg-muted/20' : 
                        isCritical ? 'bg-red-50/70 hover:bg-red-100/80 dark:bg-red-950/15 dark:hover:bg-red-950/25 border-l-4 border-l-red-500 animate-pulse' :
                        isConfirm ? 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/15 dark:hover:bg-emerald-950/25 border-l-4 border-l-emerald-500' :
                        is48h ? 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/15 dark:hover:bg-amber-950/25 border-l-4 border-l-amber-500' :
                        isNewLead ? 'bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/15 dark:hover:bg-blue-950/25 border-l-4 border-l-blue-500' :
                        isReschedule ? 'bg-orange-50/70 hover:bg-orange-100/80 dark:bg-orange-950/15 dark:hover:bg-orange-950/25 border-l-4 border-l-orange-500' :
                        'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15'
                      }`}
                    >
                      <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${
                        isRead ? 'bg-muted-foreground/30' : 
                        isCritical ? 'bg-red-600 dark:bg-red-400' : 
                        isConfirm ? 'bg-emerald-600 dark:bg-emerald-400' :
                        is48h ? 'bg-amber-600 dark:bg-amber-400 animate-pulse' :
                        isNewLead ? 'bg-blue-600 dark:bg-blue-400' :
                        isReschedule ? 'bg-orange-600 dark:bg-orange-400' :
                        'bg-primary'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div 
                          className={`text-sm font-bold truncate cursor-pointer hover:underline transition-colors ${
                            isCritical ? 'text-red-800 dark:text-red-200' : 
                            isConfirm ? 'text-emerald-800 dark:text-emerald-200' :
                            is48h ? 'text-amber-800 dark:text-amber-200' :
                            isNewLead ? 'text-blue-800 dark:text-blue-200' :
                            isReschedule ? 'text-orange-800 dark:text-orange-200' :
                            'hover:text-primary text-foreground'
                          }`}
                          onClick={() => {
                            if (apt?.patient?.id) {
                              navigate(`/patients?patientId=${apt.patient.id}`);
                            } else if (lead?.id) {
                              navigate(`/leads`);
                            }
                          }}
                        >
                          {isCritical && <AlertTriangle className="h-3 w-3 inline mr-1 text-red-600 dark:text-red-400" />}
                          {isConfirm && <CheckCheck className="h-3 w-3 inline mr-1 text-emerald-600 dark:text-emerald-400" />}
                          {displayName}
                        </div>
                        <div className={`text-xs ${
                          isCritical ? 'text-red-600 dark:text-red-400 font-semibold' : 
                          isConfirm ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 
                          is48h ? 'text-amber-600 dark:text-amber-400 font-medium' : 
                          isNewLead ? 'text-blue-600 dark:text-blue-400 font-medium' : 
                          isReschedule ? 'text-orange-600 dark:text-orange-400 font-medium' : 
                          'text-muted-foreground'
                        }`}>
                          {notificationTypeLabels[notif.type] || notif.type}
                          {procedure && ` • ${procedure}`}
                        </div>
                        {apt?.scheduledAt && (
                          <div className={`text-xs mt-0.5 font-medium ${
                            isCritical ? 'text-red-700 dark:text-red-300' : 
                            isConfirm ? 'text-emerald-700 dark:text-emerald-300' : 
                            is48h ? 'text-amber-700 dark:text-amber-300' : 
                            'text-primary dark:text-primary-foreground'
                          }`}>
                            {format(new Date(apt.scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground/60 mt-0.5">
                          {format(new Date(notif.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 shrink-0 ${
                              isCritical ? 'text-red-600 hover:bg-red-200/50 dark:text-red-400 dark:hover:bg-red-950/50' : 
                              isConfirm ? 'text-emerald-600 hover:bg-emerald-200/50 dark:text-emerald-400 dark:hover:bg-emerald-950/50' :
                              is48h ? 'text-amber-600 hover:bg-amber-200/50 dark:text-amber-400 dark:hover:bg-amber-950/50' :
                              isNewLead ? 'text-blue-600 hover:bg-blue-200/50 dark:text-blue-400 dark:hover:bg-blue-950/50' :
                              isReschedule ? 'text-orange-600 hover:bg-orange-200/50 dark:text-orange-400 dark:hover:bg-orange-950/50' :
                              'text-muted-foreground hover:text-primary hover:bg-primary/10'
                            }`}
                            title="Marcar como lida"
                            onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.id); }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400`}
                          title="Excluir notificação"
                          onClick={(e) => handleDeleteNotif(notif.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium leading-none">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground">{user ? roleLabels[user.role] || user.role : 'Carregando...'}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleProfile}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
