import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageCircle, Plus, MoreVertical, Pencil, Trash2, Phone, Mail, Filter } from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_LEADS, UPDATE_LEAD_STATUS, CREATE_LEAD, UPDATE_LEAD, DELETE_LEAD } from "@/lib/queries";
import { validateCPF, validatePhone, validateEmail, sanitizeInput } from "@/lib/validation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusColumns = [
  { status: 'NEW', label: 'Novo', color: 'border-t-gray-500' },
  { status: 'CONTACTED', label: 'Contato', color: 'border-t-blue-500' },
  { status: 'QUALIFIED', label: 'Qualificado', color: 'border-t-yellow-500' },
  { status: 'CONVERTED', label: 'Convertido', color: 'border-t-green-500' },
  { status: 'LOST', label: 'Perdido', color: 'border-t-red-500' },
];

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contato',
  QUALIFIED: 'Qualificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

const filterOrigins = ['Todas', 'Instagram', 'TikTok', 'Google Ads', 'Indicação', 'Site', 'Facebook', 'Outro'];
const filterProcedures = ['Todos', 'Rinoplastia', 'Lipoaspiração', 'Mamoplastia', 'Abdominoplastia', 'Blefaroplastia', 'Otoplastia', 'Lipo HD', 'Outro'];

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  source: string;
  origin: string;
  procedure: string;
  whatsappActive: boolean;
  notes: string;
  status: string;
  createdAt: string;
}

interface NewLeadForm {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  origin: string;
  procedure: string;
  whatsappActive: boolean;
  notes: string;
}

const initialNewLead: NewLeadForm = {
  name: '',
  email: '',
  phone: '',
  cpf: '',
  origin: 'Instagram',
  procedure: '',
  whatsappActive: false,
  notes: '',
};

const origins = ['Instagram', 'TikTok', 'Google Ads', 'Indicação', 'Site', 'Facebook', 'Outro'];
const procedures = ['Rinoplastia', 'Lipoaspiração', 'Mamoplastia', 'Abdominoplastia', 'Blefaroplastia', 'Otoplastia', 'Lipo HD', 'Outro'];

const Leads = () => {
  const [search, setSearch] = useState("");
  const [filterOrigins, setFilterOrigins] = useState<string[]>([]);
  const [filterProcedures, setFilterProcedures] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [newLead, setNewLead] = useState<NewLeadForm>(initialNewLead);
  const [editLead, setEditLead] = useState<NewLeadForm>(initialNewLead);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data, loading, refetch } = useQuery(GET_LEADS, {
    variables: { first: 100 },
    fetchPolicy: 'network-only',
  });

  const [updateStatus] = useMutation(UPDATE_LEAD_STATUS);
  const [createLead, { loading: creating }] = useMutation(CREATE_LEAD);
  const [updateLead, { loading: updating }] = useMutation(UPDATE_LEAD);
  const [deleteLead, { loading: deleting }] = useMutation(DELETE_LEAD);

  const allLeads: Lead[] = data?.leads?.edges?.map((e: any) => e.node) || [];

  const hasActiveFilters = filterOrigins.length > 0 || filterProcedures.length > 0 || search;

  const filteredLeads = allLeads.filter(
    (lead) =>
      (search === "" ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.cpf.includes(search) ||
        lead.phone.includes(search)) &&
      (filterOrigins.length === 0 || filterOrigins.includes(lead.origin || "")) &&
      (filterProcedures.length === 0 || filterProcedures.includes(lead.procedure || ""))
  );

  const toggleOrigin = (origin: string) => {
    setFilterOrigins(prev => 
      prev.includes(origin) ? prev.filter(o => o !== origin) : [...prev, origin]
    );
  };

  const toggleProcedure = (procedure: string) => {
    setFilterProcedures(prev => 
      prev.includes(procedure) ? prev.filter(p => p !== procedure) : [...prev, procedure]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setFilterOrigins([]);
    setFilterProcedures([]);
  };

  const handleDragStart = (leadId: string, e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    
    if (!draggedLead) return;
    
    console.log('Dropping lead:', draggedLead, 'to status:', status);
    
    try {
      const result = await updateStatus({
        variables: {
          input: {
            id: draggedLead,
            status,
          },
        },
      });
      console.log('Update result:', result);
      console.log('Updated lead:', result.data?.updateLeadStatus);
      if (result.data?.updateLeadStatus) {
        refetch();
      }
    } catch (error: any) {
      console.error('Error updating lead status:', error);
      if (error.networkError) {
        console.error('Network error:', error.networkError);
      }
      if (error.graphQLErrors) {
        console.error('GraphQL errors:', error.graphQLErrors);
      }
      alert(error.message || 'Erro ao atualizar status');
    }
    setDraggedLead(null);
  };

  const validateNewLead = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!newLead.name || newLead.name.length < 2) {
      errors.name = 'Nome é obrigatório';
    }
    
    if (!newLead.email || !validateEmail(newLead.email)) {
      errors.email = 'E-mail inválido';
    }
    
    if (!newLead.phone || !validatePhone(newLead.phone)) {
      errors.phone = 'Telefone inválido';
    }
    
    if (!newLead.cpf || !validateCPF(newLead.cpf)) {
      errors.cpf = 'CPF inválido';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateLead = async () => {
    if (!validateNewLead()) return;

    try {
      await createLead({
        variables: {
          input: {
            name: sanitizeInput(newLead.name),
            email: sanitizeInput(newLead.email),
            phone: sanitizeInput(newLead.phone),
            cpf: sanitizeInput(newLead.cpf),
            source: newLead.origin,
            origin: newLead.origin,
            procedure: newLead.procedure || undefined,
            whatsappActive: newLead.whatsappActive,
            notes: sanitizeInput(newLead.notes),
          },
        },
      });
      
      refetch();
      setDialogOpen(false);
      setNewLead(initialNewLead);
      setFormErrors({});
    } catch (error: any) {
      console.error('Error creating lead:', error);
      setFormErrors({ submit: error.message || 'Erro ao criar lead' });
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    setEditLead({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      cpf: lead.cpf,
      origin: lead.origin || 'Instagram',
      procedure: lead.procedure || '',
      whatsappActive: lead.whatsappActive,
      notes: lead.notes,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!editingLead) return;

    const errors: Record<string, string> = {};
    if (!editLead.name || editLead.name.length < 2) {
      errors.name = 'Nome é obrigatório';
    }
    if (!editLead.email || !validateEmail(editLead.email)) {
      errors.email = 'E-mail inválido';
    }
    if (!editLead.phone || !validatePhone(editLead.phone)) {
      errors.phone = 'Telefone inválido';
    }
    if (!editLead.cpf || !validateCPF(editLead.cpf)) {
      errors.cpf = 'CPF inválido';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      await updateLead({
        variables: {
          input: {
            id: editingLead.id,
            name: sanitizeInput(editLead.name),
            email: sanitizeInput(editLead.email),
            phone: sanitizeInput(editLead.phone),
            cpf: sanitizeInput(editLead.cpf),
            source: editLead.origin,
            origin: editLead.origin,
            procedure: editLead.procedure || undefined,
            whatsappActive: editLead.whatsappActive,
            notes: sanitizeInput(editLead.notes),
          },
        },
      });
      
      refetch();
      setEditDialogOpen(false);
      setEditingLead(null);
      setEditLead(initialNewLead);
      setFormErrors({});
    } catch (error: any) {
      console.error('Error updating lead:', error);
      setFormErrors({ submit: error.message || 'Erro ao atualizar lead' });
    }
  };

  const handleDeleteClick = (leadId: string) => {
    setDeletingLeadId(leadId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteLead = async () => {
    if (!deletingLeadId) return;

    try {
      await deleteLead({ variables: { id: deletingLeadId } });
      refetch();
      setDeleteDialogOpen(false);
      setDeletingLeadId(null);
    } catch (error: any) {
      console.error('Error deleting lead:', error);
      setFormErrors({ submit: error.message || 'Erro ao excluir lead' });
    }
  };

  const getLeadsByStatus = (status: string) => 
    filteredLeads.filter((l) => l.status === status);

  if (loading) {
    return (
      <AppLayout title="Gestão de Leads">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-32 ml-auto" />
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gestão de Leads">
      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          />
        </div>
        
        <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
          <DropdownMenuTrigger asChild>
            <Button variant={hasActiveFilters ? "default" : "outline"} className={hasActiveFilters ? "bg-blue-600 hover:bg-blue-700" : ""}>
              <Filter className="h-4 w-4 mr-2" />
              Filtros {hasActiveFilters && `( ${filterOrigins.length + filterProcedures.length} )`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="p-3 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500">Origem</Label>
                <div className="flex flex-wrap gap-1">
                  {origins.map((origin) => (
                    <Button
                      key={origin}
                      variant={filterOrigins.includes(origin) ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => toggleOrigin(origin)}
                    >
                      {origin}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-500">Procedimento</Label>
                <div className="flex flex-wrap gap-1">
                  {procedures.map((proc) => (
                    <Button
                      key={proc}
                      variant={filterProcedures.includes(proc) ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => toggleProcedure(proc)}
                    >
                      {proc}
                    </Button>
                  ))}
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-slate-500">
                  Limpar filtros
                </Button>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 ml-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Novo Lead</DialogTitle>
              <DialogDescription>
                Preencha os dados para cadastrar um novo lead
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  placeholder="Nome completo"
                />
                {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                  {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="(71) 99999-9999"
                  />
                  {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={newLead.cpf}
                  onChange={(e) => setNewLead({ ...newLead, cpf: e.target.value })}
                  placeholder="123.456.789-00"
                />
                {formErrors.cpf && <p className="text-xs text-red-500">{formErrors.cpf}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Origem</Label>
                  <Select
                    value={newLead.origin}
                    onValueChange={(value) => setNewLead({ ...newLead, origin: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {origins.map((origin) => (
                        <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label>Procedimento</Label>
                  <Select
                    value={newLead.procedure}
                    onValueChange={(value) => setNewLead({ ...newLead, procedure: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {procedures.map((proc) => (
                        <SelectItem key={proc} value={proc}>{proc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>
              
              {formErrors.submit && (
                <p className="text-sm text-red-500">{formErrors.submit}</p>
              )}
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateLead} disabled={creating}>
                  {creating ? 'Criando...' : 'Criar Lead'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-4">
        {statusColumns.map(({ status, label, color }) => (
          <div
            key={status}
            className={cn(
              "flex flex-col rounded-lg transition-all duration-200",
              dragOverColumn === status ? "ring-2 ring-primary ring-opacity-50 bg-primary/5" : ""
            )}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={(e) => handleDragLeave(e)}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column Header */}
            <div className={cn("flex items-center justify-between p-3 rounded-t-lg border-t-4 bg-slate-100 dark:bg-slate-800", color)}>
              <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{label}</span>
              <Badge variant="secondary" className="text-xs bg-slate-200 dark:bg-slate-700">
                {getLeadsByStatus(status).length}
              </Badge>
            </div>

            {/* Column Content */}
            <div className={cn(
              "flex-1 p-2 space-y-2 rounded-b-lg min-h-[300px] transition-colors duration-200",
              dragOverColumn === status ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-900/50"
            )}>
              {getLeadsByStatus(status).map((lead) => (
                <Card
                  key={lead.id}
                  className={cn(
                    "p-3 cursor-move transition-all duration-200 border-l-4",
                    draggedLead === lead.id ? "opacity-50 scale-95" : "hover:shadow-md hover:-translate-y-0.5",
                    status === 'NEW' && "border-l-slate-500",
                    status === 'CONTACTED' && "border-l-blue-500",
                    status === 'QUALIFIED' && "border-l-yellow-500",
                    status === 'CONVERTED' && "border-l-green-500",
                    status === 'LOST' && "border-l-red-500"
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(lead.id, e)}
                  onDragEnd={() => setDraggedLead(null)}
                >
                  <CardContent className="p-0">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-sm truncate flex-1 text-slate-800 dark:text-slate-100">{lead.name}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-700" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(lead); }} className="cursor-pointer">
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-500 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <Phone className="h-3 w-3" />
                      <span>{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{lead.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {lead.whatsappActive && (
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      )}
                      {lead.procedure && (
                        <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-800">
                          {lead.procedure}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Lead Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>
              Atualize os dados do lead
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={editLead.name}
                onChange={(e) => setEditLead({ ...editLead, name: e.target.value })}
                placeholder="Nome completo"
              />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-email">E-mail *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editLead.email}
                  onChange={(e) => setEditLead({ ...editLead, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
                {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Telefone *</Label>
                <Input
                  id="edit-phone"
                  value={editLead.phone}
                  onChange={(e) => setEditLead({ ...editLead, phone: e.target.value })}
                  placeholder="(71) 99999-9999"
                />
                {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-cpf">CPF *</Label>
              <Input
                id="edit-cpf"
                value={editLead.cpf}
                onChange={(e) => setEditLead({ ...editLead, cpf: e.target.value })}
                placeholder="123.456.789-00"
              />
              {formErrors.cpf && <p className="text-xs text-red-500">{formErrors.cpf}</p>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Origem</Label>
                <Select
                  value={editLead.origin}
                  onValueChange={(value) => setEditLead({ ...editLead, origin: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {origins.map((origin) => (
                      <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label>Procedimento</Label>
                <Select
                  value={editLead.procedure}
                  onValueChange={(value) => setEditLead({ ...editLead, procedure: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedures.map((proc) => (
                      <SelectItem key={proc} value={proc}>{proc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Observações</Label>
              <Input
                id="edit-notes"
                value={editLead.notes}
                onChange={(e) => setEditLead({ ...editLead, notes: e.target.value })}
                placeholder="Observações adicionais..."
              />
            </div>
            
            {formErrors.submit && (
              <p className="text-sm text-red-500">{formErrors.submit}</p>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateLead} disabled={updating}>
                {updating ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteLead} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Leads;
