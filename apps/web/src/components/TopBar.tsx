import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, User, LogOut, Settings, ChevronDown, X, Check, CheckCheck, Plus } from "lucide-react";
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
import { serverLogout } from "@/lib/apollo";
import { useQuery, useMutation, gql } from "@apollo/client";
import { MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_READ } from "@/lib/queries";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
}

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SURGEON: "Cirurgião",
  CALL_CENTER: "Call Center",
  RECEPTION: "Recepção",
  SALES: "Vendas",
};

const notificationTypeLabels: Record<string, string> = {
  CONFIRMATION: "Confirmação de consulta",
  REMINDER_2_DAYS: "Lembrete — 2 dias",
  REMINDER_1_DAY: "Lembrete — 1 dia",
  LAST_ATTEMPT: "Última tentativa de contato",
};

const NOTIFICATIONS_QUERY = gql`
  query GetNotificationsTopBar {
    notifications(first: 30) {
      id
      type
      status
      createdAt
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

export function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const unreadCount = notifData?.unreadNotificationsCount || 0;
  const notifications = notifData?.notifications || [];

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
    navigate('/login');
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

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

        <div className="flex items-center gap-4">
          {/* New Patient Button (Primary Action) */}
          <button className="hidden md:flex bg-primary text-primary-foreground hover:bg-primary/90 rounded-md font-medium items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap transition-colors flex-shrink-0">
            <Plus className="h-4 w-4" />
            Novo Paciente
          </button>
          {/* Search */}
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

        {/* Notifications */}
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
              <span className="font-semibold">Notificações</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary gap-1 -mr-1"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todas como lidas
                </Button>
              )}
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
                  const apt = notif.appointment;
                  return (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-3 py-3 border-b last:border-b-0 transition-colors ${
                        isRead ? 'opacity-55' : 'bg-primary/5 hover:bg-primary/10'
                      }`}
                    >
                      <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${isRead ? 'bg-muted-foreground/30' : 'bg-primary'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {apt?.patient?.lead?.name || 'Paciente não encontrado'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {notificationTypeLabels[notif.type] || notif.type}
                          {apt?.procedure && ` • ${apt.procedure}`}
                        </div>
                        {apt?.scheduledAt && (
                          <div className="text-xs text-primary mt-0.5 font-medium">
                            {format(new Date(apt.scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground/60 mt-0.5">
                          {format(new Date(notif.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      {!isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Marcar como lida"
                          onClick={() => handleMarkAsRead(notif.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
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
