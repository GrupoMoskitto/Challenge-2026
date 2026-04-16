import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, CardListSkeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { showUndoableToast } from "@/hooks/useUndoableToast";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_MESSAGE_TEMPLATES,
  CREATE_MESSAGE_TEMPLATE,
  UPDATE_MESSAGE_TEMPLATE,
  DELETE_MESSAGE_TEMPLATE,
  TEST_MESSAGE_TEMPLATE,
  GET_USERS,
  GET_EVOLUTION_API_INSTANCES,
  GET_TEST_PHONE_LAST_DIGITS,
  CREATE_USER,
  TOGGLE_USER_STATUS,
  UPDATE_USER,
  UPDATE_PROFILE,
} from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Bell, Users, MessageSquare, Plus, MoreVertical, Pencil, Trash2, Mail, Phone as PhoneIcon, Eye, Plug, X, Check, Loader2 } from "lucide-react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SURGEON: "Cirurgião",
  CALL_CENTER: "Call Center",
  RECEPTION: "Recepção",
  SALES: "Vendas",
};

const channelLabels: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "E-mail",
};

const channelColors: Record<string, string> = {
  WHATSAPP: "bg-green-500/10 text-green-600 border-green-200",
  SMS: "bg-blue-500/10 text-blue-600 border-blue-200",
  EMAIL: "bg-purple-500/10 text-purple-600 border-purple-200",
};

interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  content: string;
  triggerDays: number;
}

interface TemplateForm {
  name: string;
  channel: string;
  content: string;
  triggerDays: number;
}

const initialTemplateForm: TemplateForm = {
  name: "",
  channel: "WHATSAPP",
  content: "",
  triggerDays: 0,
};

function getTriggerLabel(days: number): string {
  if (days < 0) return "Na captura do lead";
  if (days === 0) return "No dia da consulta";
  if (days === 1) return "1 dia antes";
  return `${days} dias antes`;
}

function highlightVariables(content: string) {
  const parts = content.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <Badge key={i} variant="secondary" className="text-xs font-mono mx-0.5 px-1.5 py-0">
          {part}
        </Badge>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const availableTabs = ["profile", ...(isAdmin ? ["integrations", "users", "templates"] : [])];
  const defaultTab = isAdmin ? "profile" : "profile";
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && availableTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);
    setSearchParams(newParams, { replace: true });
  };

  // Template state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [testingTemplate, setTestingTemplate] = useState<MessageTemplate | null>(null);

  const [newTemplate, setNewTemplate] = useState<TemplateForm>(initialTemplateForm);
  const [editTemplate, setEditTemplate] = useState<TemplateForm>(initialTemplateForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // User management state
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>("RECEPTION");
  const [deactivatingUserId, setDeactivatingUserId] = useState<string | null>(null);
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "RECEPTION", password: "" });
  const [profileForm, setProfileForm] = useState({ name: user?.name || "", password: "" });

  const [selectedInstance, setSelectedInstance] = useState<string>("");

  // GraphQL
  const { data: templatesData, loading: templatesLoading, refetch: refetchTemplates, error: templatesError } = useQuery(GET_MESSAGE_TEMPLATES);
  const { data: usersData, loading: usersLoading, refetch: refetchUsers, error: usersError } = useQuery(GET_USERS, { skip: !isAdmin });
  const { data: evoData, loading: evoLoading, error: evoError } = useQuery(GET_EVOLUTION_API_INSTANCES, { skip: !isAdmin });
  const { data: testPhoneData } = useQuery(GET_TEST_PHONE_LAST_DIGITS, { skip: !isAdmin });

  useEffect(() => {
    if (templatesError) toast.error("Erro ao carregar templates: " + templatesError.message);
  }, [templatesError]);

  useEffect(() => {
    if (usersError && isAdmin) toast.error("Erro ao carregar usuários: " + usersError.message);
  }, [usersError, isAdmin]);

  useEffect(() => {
    if (evoError && isAdmin) toast.error("Erro ao carregar integrações: " + evoError.message);
  }, [evoError, isAdmin]);

  const [createTemplate, { loading: creating }] = useMutation(CREATE_MESSAGE_TEMPLATE);
  const [updateTemplate, { loading: updating }] = useMutation(UPDATE_MESSAGE_TEMPLATE);
  const [deleteTemplate, { loading: deleting }] = useMutation(DELETE_MESSAGE_TEMPLATE);
  const [testTemplate, { loading: testing }] = useMutation(TEST_MESSAGE_TEMPLATE);
  
  const [createUser, { loading: creatingUser }] = useMutation(CREATE_USER);
  const [toggleUserStatus] = useMutation(TOGGLE_USER_STATUS);
  const [updateUser, { loading: updatingUser }] = useMutation(UPDATE_USER as any);
  const [updateProfile, { loading: updatingProfile }] = useMutation(UPDATE_PROFILE);

  const templates: MessageTemplate[] = templatesData?.messageTemplates || [];
  const systemUsers = usersData?.users?.edges?.map((e: any) => e.node) || [];
  const evolutionInstances: any[] = evoData?.evolutionApiInstances || [];

  const handleUpdateProfile = async () => {
    try {
      await updateProfile({
        variables: {
          input: {
            name: profileForm.name || undefined,
            password: profileForm.password || undefined,
          }
        }
      });
      showUndoableToast(
        "Perfil atualizado!",
        async () => { /* re-fetch not needed for profile */ },
        "Desfazer"
      );
      setProfileForm({ ...profileForm, password: "" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar perfil");
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    try {
      await createUser({
        variables: { input: newUserForm }
      });
      showUndoableToast(
        "Usuário criado!",
        async () => { await refetchUsers(); },
        "Desfazer"
      );
      setCreateUserDialogOpen(false);
      setNewUserForm({ name: "", email: "", role: "RECEPTION", password: "" });
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    }
  };

  const handleToggleUserStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleUserStatus({ variables: { id } });
      showUndoableToast(
        `Usuário ${currentStatus ? 'desativado' : 'ativado'}!`,
        async () => { await refetchUsers(); },
        "Desfazer"
      );
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status do usuário");
    }
  };

  const handleUpdateUserRole = async () => {
    if (!editingUser) return;
    try {
      await updateUser({
        variables: { id: editingUser.id, input: { role: editUserRole } }
      });
      toast.success("Permissões atualizadas com sucesso!");
      setEditUserDialogOpen(false);
      refetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar usuário");
    }
  };

  const validateForm = (form: TemplateForm): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Nome é obrigatório";
    if (!form.content.trim()) errors.content = "Conteúdo é obrigatório";
    if (!form.channel) errors.channel = "Canal é obrigatório";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm(newTemplate)) return;
    try {
      await createTemplate({
        variables: {
          input: {
            name: newTemplate.name.trim(),
            channel: newTemplate.channel,
            content: newTemplate.content.trim(),
            triggerDays: newTemplate.triggerDays,
          },
        },
      });
      refetchTemplates();
      setCreateDialogOpen(false);
      setNewTemplate(initialTemplateForm);
      setFormErrors({});
    } catch (error: any) {
      setFormErrors({ submit: error.message || "Erro ao criar template" });
    }
  };

  const handleEditClick = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditTemplate({
      name: template.name,
      channel: template.channel,
      content: template.content,
      triggerDays: template.triggerDays,
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !validateForm(editTemplate)) return;
    try {
      await updateTemplate({
        variables: {
          input: {
            id: editingTemplate.id,
            name: editTemplate.name.trim(),
            channel: editTemplate.channel,
            content: editTemplate.content.trim(),
            triggerDays: editTemplate.triggerDays,
          },
        },
      });
      refetchTemplates();
      setEditDialogOpen(false);
      setEditingTemplate(null);
      setEditTemplate(initialTemplateForm);
      setFormErrors({});
    } catch (error: any) {
      setFormErrors({ submit: error.message || "Erro ao atualizar template" });
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeletingTemplateId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingTemplateId) return;
    try {
      await deleteTemplate({ variables: { id: deletingTemplateId } });
      refetchTemplates();
      setDeleteDialogOpen(false);
      setDeletingTemplateId(null);
    } catch (error: any) {
      console.error("Error deleting template:", error);
    }
  };

  const handlePreview = (template: MessageTemplate) => {
    setPreviewTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleTestClick = (template: MessageTemplate) => {
    setTestingTemplate(template);
    // Auto-select first connected instance if available
    const firstConnected = evolutionInstances.find(i => i.connected)?.instanceName || evolutionInstances[0]?.instanceName || "";
    setSelectedInstance(firstConnected);
    setTestDialogOpen(true);
  };

  const handleRunTest = async () => {
    if (!testingTemplate || !selectedInstance) return;
    try {
      await testTemplate({
        variables: {
          templateId: testingTemplate.id,
          instanceName: selectedInstance,
        }
      });
      toast.success("Teste disparado! Verifique o número permitido no ambiente.");
      setTestDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao disparar teste");
    }
  };

  const renderTemplateForm = (form: TemplateForm, setForm: (f: TemplateForm) => void) => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="template-name">Nome do Template *</Label>
        <Input
          id="template-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Lembrete 3 dias"
        />
        {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Canal *</Label>
          <Select
            value={form.channel}
            onValueChange={(value) => setForm({ ...form, channel: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="EMAIL">E-mail</SelectItem>
            </SelectContent>
          </Select>
          {formErrors.channel && <p className="text-xs text-red-500">{formErrors.channel}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="template-trigger">Dias de Disparo</Label>
          <Input
            id="template-trigger"
            type="number"
            value={form.triggerDays}
            onChange={(e) => setForm({ ...form, triggerDays: parseInt(e.target.value) || 0 })}
            min={-1}
          />
          <p className="text-xs text-muted-foreground">
            {getTriggerLabel(form.triggerDays)}
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="template-content">Conteúdo da Mensagem *</Label>
        <Textarea
          id="template-content"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="Olá {nome}, sua consulta com {medico} está agendada para {data} às {hora}..."
          rows={5}
          className="resize-none font-mono text-sm"
        />
        {formErrors.content && <p className="text-xs text-red-500">{formErrors.content}</p>}
        <p className="text-xs text-muted-foreground">
          Variáveis disponíveis: <code className="bg-muted px-1 rounded">{"{nome}"}</code>{" "}
          <code className="bg-muted px-1 rounded">{"{procedimento}"}</code>{" "}
          <code className="bg-muted px-1 rounded">{"{medico}"}</code>{" "}
          <code className="bg-muted px-1 rounded">{"{data}"}</code>{" "}
          <code className="bg-muted px-1 rounded">{"{hora}"}</code>
        </p>
      </div>

      {formErrors.submit && (
        <p className="text-sm text-red-500">{formErrors.submit}</p>
      )}
    </div>
  );

  if (authLoading) {
    return (
      <AppLayout title="Configurações">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configurações">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="profile" className="flex-1">
            <User className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="integrations" className="flex-1">
              <Plug className="h-4 w-4 mr-2" />
              Integrações
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="users" className="flex-1">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="templates" className="flex-1">
              <MessageSquare className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          )}
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Perfil</CardTitle>
                  <CardDescription>
                    Gerencie suas informações pessoais e preferências
                  </CardDescription>
                </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user?.name}</h3>
                  <p className="text-muted-foreground">{user?.email}</p>
                  <Badge variant="outline" className="mt-2">
                    {user ? roleLabels[user.role] || user.role : 'Carregando...'}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" defaultValue={user?.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Cargo</Label>
                  <Input id="role" value={user ? roleLabels[user.role] || user.role : ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Nova Senha</Label>
                  <Input id="password" type="password" placeholder="Mínimo 6 caracteres (Opcional)" value={profileForm.password} onChange={e => setProfileForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleUpdateProfile} disabled={updatingProfile || (profileForm.name === user?.name && !profileForm.password)} className="min-w-[160px]">
                  {updatingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
              </Card>
            </motion.div>
          )}

          {isAdmin && activeTab === "integrations" && (
            <motion.div
              key="integrations"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Integrações</CardTitle>
                  <CardDescription>
                    Gerencie as conexões ativas com a Evolution API
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
              {evoLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : evolutionInstances.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                  Nenhuma instância encontrada na Evolution API.
                </div>
              ) : (
                evolutionInstances.map((inst: any) => (
                  <div key={inst.instanceName} className="border rounded-lg p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${inst.connected ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                        <PhoneIcon className={`h-6 w-6 ${inst.connected ? 'text-green-500' : 'text-destructive'}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-base">Instância: {inst.instanceName}</h4>
                        <p className="text-sm text-muted-foreground">
                          Status: <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs">{inst.state}</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      {inst.connected ? (
                        <Badge className="bg-green-500">Conectado</Badge>
                      ) : (
                        <Badge variant="destructive">Desconectado</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
</Card>
            </motion.div>
          )}

          {isAdmin && activeTab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>
                    Adicione e gerencie usuários do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Gerencie os usuários que têm acesso ao sistema
                      </p>
                  <Button onClick={() => setCreateUserDialogOpen(true)}>Novo Usuário</Button>
                </div>
                <div className="border rounded-lg">
                  <div className="grid grid-cols-5 gap-4 p-4 border-b bg-muted/30 font-medium text-sm">
                    <div>Nome</div>
                    <div>E-mail</div>
                    <div>Cargo</div>
                    <div>Status</div>
                    <div>Ações</div>
                  </div>
                  {usersLoading ? (
                    <div className="p-4 flex flex-col gap-3">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    systemUsers.map((u: any) => (
                      <div key={u.id} className="grid grid-cols-5 gap-4 p-4 border-b items-center last:border-b-0">
                        <div className="font-medium truncate pr-2">{u.name}</div>
                        <div className="text-sm text-muted-foreground truncate pr-2">{u.email}</div>
                        <div>
                          <Badge variant={u.role === 'ADMIN' ? 'default' : 'outline'}>
                            {roleLabels[u.role] || u.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={u.isActive ? 'secondary' : 'destructive'}>
                            {u.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { setEditingUser({ id: u.id, name: u.name, email: u.email, role: u.role }); setEditUserRole(u.role); setEditUserDialogOpen(true); }}
                            className="h-8 w-8 p-0"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {user?.id !== u.id && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => { if (u.isActive) { setDeactivatingUserId(u.id); setConfirmDeactivateOpen(true); } else { handleToggleUserStatus(u.id, u.isActive); }}}
                              className="h-8 w-8 p-0"
                              title={u.isActive ? "Desativar" : "Ativar"}
                            >
                              {u.isActive ? <X className="h-4 w-4 text-red-500" /> : <Check className="h-4 w-4 text-green-500" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
              </Card>
            </motion.div>
          )}

          {isAdmin && activeTab === "templates" && (
            <motion.div
              key="templates"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Templates de Mensagens</CardTitle>
                  <CardDescription>
                    Gerencie os modelos de mensagens automatizadas para envio aos pacientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {templates.length} template{templates.length !== 1 ? "s" : ""} configurado{templates.length !== 1 ? "s" : ""}
                      </p>
                      <Button onClick={() => { setNewTemplate(initialTemplateForm); setFormErrors({}); setCreateDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Template
                  </Button>
                </div>

                {templatesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-4 w-full" />
                            <div className="flex gap-2">
                              <Skeleton className="h-5 w-20" />
                              <Skeleton className="h-5 w-24" />
                            </div>
                          </div>
                          <Skeleton className="h-8 w-8" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : templates.length === 0 ? (
                  <div className="border rounded-lg p-8 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Nenhum template cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Crie seu primeiro template para automatizar o envio de mensagens
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="border rounded-lg p-4 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-sm">{template.name}</h4>
                              <Badge
                                variant="outline"
                                className={`text-xs ${channelColors[template.channel] || ""}`}
                              >
                                {channelLabels[template.channel] || template.channel}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {getTriggerLabel(template.triggerDays)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {highlightVariables(template.content)}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePreview(template)} className="cursor-pointer">
                                <Eye className="h-4 w-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              {user?.role === 'ADMIN' && (
                                <DropdownMenuItem onClick={() => handleTestClick(template)} className="cursor-pointer">
                                  <Plug className="h-4 w-4 mr-2" />
                                  Teste de Disparo
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEditClick(template)} className="cursor-pointer">
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(template.id)}
                                className="text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Novo Template</DialogTitle>
            <DialogDescription>
              Crie um novo modelo de mensagem automatizada
            </DialogDescription>
          </DialogHeader>
          {renderTemplateForm(newTemplate, setNewTemplate)}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Criando..." : "Criar Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              Atualize o modelo de mensagem
            </DialogDescription>
          </DialogHeader>
          {renderTemplateForm(editTemplate, setEditTemplate)}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updating} className="min-w-[120px]">
              {updating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Template Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Template Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewTemplate?.name}
              <Badge
                variant="outline"
                className={`text-xs ${channelColors[previewTemplate?.channel || ""] || ""}`}
              >
                {channelLabels[previewTemplate?.channel || ""] || previewTemplate?.channel}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {previewTemplate ? getTriggerLabel(previewTemplate.triggerDays) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 mt-2">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {previewTemplate ? highlightVariables(previewTemplate.content) : ""}
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Adicione um novo colaborador ao sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={newUserForm.name} onChange={e => setNewUserForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={newUserForm.email} onChange={e => setNewUserForm(f => ({...f, email: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Select value={newUserForm.role} onValueChange={val => setNewUserForm(f => ({...f, role: val}))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Senha Inicial *</Label>
              <Input type="password" value={newUserForm.password} onChange={e => setNewUserForm(f => ({...f, password: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser ? "Criando..." : "Criar Usuário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as permissões do colaborador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editingUser?.name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editingUser?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={editUserRole} onValueChange={val => setEditUserRole(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateUserRole} disabled={updatingUser}>
              {updatingUser ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Deactivate User Dialog */}
      <Dialog open={confirmDeactivateOpen} onOpenChange={setConfirmDeactivateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar Desativação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desativar este usuário? Ele perderá acesso ao sistema imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setConfirmDeactivateOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if (deactivatingUserId) { handleToggleUserStatus(deactivatingUserId, true); setDeactivatingUserId(null); } setConfirmDeactivateOpen(false); }}>
              Confirmar Desativação
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Template Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Teste de Disparo</DialogTitle>
            <DialogDescription>
              Envie uma mensagem de teste do template <strong>{testingTemplate?.name}</strong> para o número pré-aprovado{testPhoneData?.testPhoneLastDigits ? ` (...${testPhoneData.testPhoneLastDigits})` : ''} no ambiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-md text-xs border">
              <p className="font-semibold mb-1 uppercase tracking-wider opacity-70">Aviso RN05 Sandbox:</p>
              A mensagem será enviada apenas para o número pré-aprovado{testPhoneData?.testPhoneLastDigits ? ` (...${testPhoneData.testPhoneLastDigits})` : ''} definido em <code>DEV_ALLOWED_PHONE</code> para evitar disparos acidentais.
            </div>
            <div className="space-y-2">
              <Label>Escolha a Instância WhatsApp</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma instância" />
                </SelectTrigger>
                <SelectContent>
                  {evolutionInstances.map((inst: any) => (
                    <SelectItem key={inst.instanceName} value={inst.instanceName}>
                      {inst.instanceName} ({inst.connected ? 'Ativa' : 'Offline'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRunTest} disabled={testing || !selectedInstance}>
              {testing ? "Disparando..." : "Enviar Teste"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Settings;
