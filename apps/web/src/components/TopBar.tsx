import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, User, LogOut, Settings, ChevronDown, Check, X } from "lucide-react";
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
import { removeAuthToken } from "@/lib/apollo";
import { useQuery, gql } from "@apollo/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'appointment' | 'lead' | 'reminder';
}

const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    appointments(status: SCHEDULED) {
      id
      procedure
      scheduledAt
      patient {
        name
      }
    }
  }
`;

export function TopBar({ title }: TopBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', title: 'Nova consulta agendada', message: 'Ana Beatriz agendou para amanhã às 08:00', time: '5 minutos', read: false, type: 'appointment' },
    { id: '2', title: 'Lead convertido', message: 'Juliana Ferreira assinou contrato', time: '1 hora', read: false, type: 'lead' },
    { id: '3', title: 'Lembrete de consulta', message: '3 consultas para amanhã', time: '2 horas', read: false, type: 'reminder' },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const { data: appointmentsData } = useQuery(GET_NOTIFICATIONS, {
    fetchPolicy: 'cache-and-network',
  });

  const appointments = appointmentsData?.appointments || [];

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

  const handleResultClick = (type: 'lead' | 'patient', id: string) => {
    clearSearch();
    if (type === 'lead') {
      navigate(`/leads?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/patients?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleProfile = () => {
    navigate('/settings');
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente, CPF, telefone..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => debouncedSearch.length >= 2 && setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 300)}
            className="pl-9 pr-8 w-72 h-9 bg-background"
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
                          onClick={() => handleResultClick('lead', lead.id)}
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
                          onClick={() => handleResultClick('patient', patient.id)}
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
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>Notificações</span>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-muted-foreground hover:text-primary"
                  onClick={markAllAsRead}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar todas como lidas
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma notificação
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                {notifications.map((notification) => (
                  <DropdownMenuItem 
                    key={notification.id} 
                    className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className={`font-medium ${!notification.read ? 'text-primary' : ''}`}>
                        {notification.title}
                      </span>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary ml-auto" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{notification.message}</span>
                    <span className="text-xs text-muted-foreground">{notification.time}</span>
                  </DropdownMenuItem>
                ))}
                
                {/* Próximas consultas do banco */}
                {appointments.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                      Próximas Consultas
                    </div>
                    {appointments.slice(0, 3).map((apt: any) => (
                      <DropdownMenuItem 
                        key={apt.id}
                        className="flex flex-col items-start gap-1 py-3"
                      >
                        <span className="font-medium">{apt.patient?.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {apt.procedure} - {format(new Date(apt.scheduledAt), "dd/MM 'às' HH:mm")}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </ScrollArea>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="w-full text-center text-primary cursor-pointer">
                Ver todas as notificações
              </Link>
            </DropdownMenuItem>
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
