import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  CREATE_EVOLUTION_INSTANCE,
  DELETE_EVOLUTION_INSTANCE,
  CONNECT_EVOLUTION_INSTANCE,
  GET_SURGEONS_SCHEDULE,
  CREATE_AVAILABILITY_SLOT,
  UPDATE_AVAILABILITY_SLOT,
  DELETE_AVAILABILITY_SLOT,
  CREATE_EXTRA_AVAILABILITY,
  DELETE_EXTRA_AVAILABILITY,
  CREATE_SCHEDULE_BLOCK,
  UPDATE_SCHEDULE_BLOCK,
  DELETE_SCHEDULE_BLOCK,
} from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { User, Users, MessageSquare, Plus, MoreVertical, Pencil, Trash2, Phone as PhoneIcon, Eye, Plug, X, Check, Loader2, Calendar as CalendarIcon, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

  const availableTabs = React.useMemo(() => ["profile", ...(isAdmin ? ["integrations", "users", "templates", "schedule"] : [])], [isAdmin]);
  const defaultTab = "profile";
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || defaultTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && availableTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, availableTabs]);

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
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "RECEPTION", password: "" });
  const [profileForm, setProfileForm] = useState({ name: user?.name || "", password: "" });

  const [selectedInstance, setSelectedInstance] = useState<string>("");

  // Schedule management state
  const [selectedSurgeonId, setSelectedSurgeonId] = useState<string | null>(null);
  const [editingAvailId, setEditingAvailId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [availForm, setAvailForm] = useState({ dayOfWeek: 1, startTime: "08:00", endTime: "18:00" });
  const [extraAvailForm, setExtraAvailForm] = useState<{ date: Date | undefined; startTime: string; endTime: string }>({ date: undefined, startTime: "08:00", endTime: "18:00" });
  const [blockForm, setBlockForm] = useState<{ startDate: Date | undefined; startTime: string; endDate: Date | undefined; endTime: string; reason: string }>({ startDate: undefined, startTime: "08:00", endDate: undefined, endTime: "18:00", reason: "" });

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<{ qrCode: string | null, pairingCode: string | null, instanceName: string } | null>(null);

  // GraphQL
  const { data: templatesData, loading: templatesLoading, refetch: refetchTemplates, error: templatesError } = useQuery(GET_MESSAGE_TEMPLATES);
  const { data: usersData, loading: usersLoading, refetch: refetchUsers, error: usersError } = useQuery(GET_USERS, { skip: !isAdmin });
  const { data: evoData, loading: evoLoading, refetch: refetchEvo, error: evoError } = useQuery(GET_EVOLUTION_API_INSTANCES, { skip: !isAdmin });
  const { data: testPhoneData } = useQuery(GET_TEST_PHONE_LAST_DIGITS, { skip: !isAdmin });
  const { data: scheduleData, refetch: refetchSchedule } = useQuery(GET_SURGEONS_SCHEDULE, { skip: !isAdmin });

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
  const [updateUser, { loading: updatingUser }] = useMutation(UPDATE_USER);
  const [updateProfile, { loading: updatingProfile }] = useMutation(UPDATE_PROFILE);
  const [createEvolutionInstance] = useMutation(CREATE_EVOLUTION_INSTANCE, {
    onCompleted: () => {
      setTimeout(() => refetchEvo(), 1000);
    },
    update(cache, { data }) {
      if (!data?.createEvolutionInstance) return;
      cache.modify({
        fields: {
          evolutionApiInstances(existing = []) {
            const alreadyExists = existing.some((inst: any) => {
              const name = inst.instanceName || cache.readField('instanceName', inst);
              return name === data.createEvolutionInstance.instanceName;
            });
            if (alreadyExists) return existing;
            return [...existing, data.createEvolutionInstance];
          }
        }
      });
    }
  });

  const [deleteEvolutionInstance] = useMutation(DELETE_EVOLUTION_INSTANCE, {
    onCompleted: () => {
      setTimeout(() => refetchEvo(), 1000);
    },
    update(cache, { data }, { variables }) {
      if (!data?.deleteEvolutionInstance) return;
      cache.modify({
        fields: {
          evolutionApiInstances(existing = []) {
            return existing.filter((inst: any) => inst.instanceName !== variables?.name);
          }
        }
      });
    }
  });
  const [connectEvolutionInstance] = useMutation(CONNECT_EVOLUTION_INSTANCE);

  // Schedule mutations
  const [createAvail] = useMutation(CREATE_AVAILABILITY_SLOT);
  const [updateAvail] = useMutation(UPDATE_AVAILABILITY_SLOT);
  const [deleteAvail] = useMutation(DELETE_AVAILABILITY_SLOT);
  const [createExtra] = useMutation(CREATE_EXTRA_AVAILABILITY);
  const [deleteExtra] = useMutation(DELETE_EXTRA_AVAILABILITY);
  const [createBlock] = useMutation(CREATE_SCHEDULE_BLOCK);
  const [updateBlock] = useMutation(UPDATE_SCHEDULE_BLOCK);
  const [deleteBlock] = useMutation(DELETE_SCHEDULE_BLOCK);

  const templates: MessageTemplate[] = templatesData?.messageTemplates || [];
  const systemUsers = usersData?.users?.edges?.map((e: any) => e.node) || [];
  const evolutionInstances: any[] = evoData?.evolutionApiInstances || [];
  const surgeons = scheduleData?.surgeons || [];
  const selectedSurgeon = surgeons.find((s: any) => s.id === selectedSurgeonId);

  const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4).toString().padStart(2, '0');
    const m = ((i % 4) * 15).toString().padStart(2, '0');
    return `${h}:${m}`;
  });

  const handleCreateAvail = async () => {
    if (!selectedSurgeonId) return;
    try {
      if (editingAvailId) {
        await updateAvail({ variables: { input: { id: editingAvailId, ...availForm } } });
        toast.success("Horário atualizado");
        setEditingAvailId(null);
      } else {
        await createAvail({ variables: { input: { surgeonId: selectedSurgeonId, ...availForm } } });
        toast.success("Horário adicionado");
      }
      setAvailForm({ dayOfWeek: 1, startTime: "08:00", endTime: "18:00" });
      refetchSchedule();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEditAvail = (slot: any) => {
    setEditingAvailId(slot.id);
    setAvailForm({ dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime });
  };

  const handleDeleteAvail = async (id: string) => {
    try {
      await deleteAvail({ variables: { id } });
      toast.success("Horário removido");
      refetchSchedule();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCreateExtraAvail = async () => {
    if (!selectedSurgeonId || !extraAvailForm.date) return;
    try {
      await createExtra({ variables: { input: { surgeonId: selectedSurgeonId, ...extraAvailForm, date: extraAvailForm.date.toISOString().split('T')[0] } } });
      toast.success("Dia extra adicionado");
      setExtraAvailForm({ date: undefined, startTime: "08:00", endTime: "18:00" });
      refetchSchedule();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteExtraAvail = async (id: string) => {
    try {
      await deleteExtra({ variables: { id } });
      toast.success("Removido");
      refetchSchedule();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCreateBlock = async () => {
    if (!selectedSurgeonId || !blockForm.startDate || !blockForm.endDate) return;
    try {
      const start = new Date(blockForm.startDate);
      const [sh, sm] = blockForm.startTime.split(':');
      start.setHours(parseInt(sh), parseInt(sm), 0, 0);

      const end = new Date(blockForm.endDate);
      const [eh, em] = blockForm.endTime.split(':');
      end.setHours(parseInt(eh), parseInt(em), 0, 0);

      if (editingBlockId) {
        await updateBlock({ variables: { input: { id: editingBlockId, startDate: start.toISOString(), endDate: end.toISOString(), reason: blockForm.reason } } });
        toast.success("Bloqueio atualizado");
        setEditingBlockId(null);
      } else {
        await createBlock({ variables: { input: { surgeonId: selectedSurgeonId, startDate: start.toISOString(), endDate: end.toISOString(), reason: blockForm.reason } } });
        toast.success("Bloqueio criado");
      }
      setBlockForm({ startDate: undefined, startTime: "08:00", endDate: undefined, endTime: "18:00", reason: "" });
      refetchSchedule();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEditBlock = (block: any) => {
    setEditingBlockId(block.id);
    const start = new Date(block.startDate);
    const end = new Date(block.endDate);
    setBlockForm({
      startDate: start,
      startTime: format(start, "HH:mm"),
      endDate: end,
      endTime: format(end, "HH:mm"),
      reason: block.reason || ""
    });
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await deleteBlock({ variables: { id } });
      toast.success("Bloqueio removido");
      refetchSchedule();
    } catch (err: any) { toast.error(err.message); }
  };

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
      toast.success("Perfil atualizado!");
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
      toast.success("Usuário criado!");
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
      toast.success(`Usuário ${currentStatus ? 'desativado' : 'ativado'}!`);
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

  // Evolution API UI State
  const [createInstanceDialogOpen, setCreateInstanceDialogOpen] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [qrCodeData, setQrCodeData] = useState<{ base64: string | null; pairingCode: string | null } | null>(null);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [deleteInstanceDialogOpen, setDeleteInstanceDialogOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null);

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error("O nome da instância não pode ser vazio");
      return;
    }
    try {
      await createEvolutionInstance({ variables: { name: newInstanceName.trim() } });
      toast.success("Instância criada com sucesso!");
      setCreateInstanceDialogOpen(false);
      setNewInstanceName("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar instância");
    }
  };

  const confirmDeleteInstance = (name: string) => {
    setInstanceToDelete(name);
    setDeleteInstanceDialogOpen(true);
  };

  const handleDeleteInstance = async () => {
    if (!instanceToDelete) return;
    try {
      await deleteEvolutionInstance({ variables: { name: instanceToDelete } });
      toast.success("Instância deletada com sucesso!");
      setDeleteInstanceDialogOpen(false);
      setInstanceToDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao deletar instância");
    }
  };

  const handleConnectInstance = async (name: string) => {
    try {
      const { data } = await connectEvolutionInstance({ variables: { name } });
      const { qrCode, pairingCode } = data.connectEvolutionInstance;
      
      if (qrCode) {
        setQrCodeData({ base64: qrCode, pairingCode });
        setQrCodeDialogOpen(true);
      } else {
        toast.info("A instância já pode estar conectada ou não retornou QR Code.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar QR Code");
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
    <div className="space-y-4 py-4">
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

      <div className="grid gap-2 mt-4 pt-4 border-t">
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
          {isAdmin && (
            <TabsTrigger value="schedule" className="flex-1">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Agenda
            </TabsTrigger>
          )}
        </TabsList>

          <TabsContent value="profile">
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
          </TabsContent>

          {isAdmin && (
            <TabsContent value="integrations">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>Integrações</CardTitle>
                    <CardDescription>
                      Gerencie as conexões ativas com a Evolution API
                    </CardDescription>
                  </div>
                  <Button onClick={() => setCreateInstanceDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Instância
                  </Button>
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
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">Desconectado</Badge>
                              <Button variant="outline" size="sm" onClick={() => handleConnectInstance(inst.instanceName)}>
                                Conectar
                              </Button>
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => confirmDeleteInstance(inst.instanceName)}
                          title="Excluir instância"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="users">
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
                                  onClick={() => { if (u.isActive) { setDeactivatingUserId(u.id); setDeactivateConfirmText(""); setConfirmDeactivateOpen(true); } else { handleToggleUserStatus(u.id, u.isActive); }}}
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
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="templates">
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
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Agenda</CardTitle>
                  <CardDescription>
                    Configure os horários de atendimento, plantões extras e bloqueios dos cirurgiões
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-2 max-w-sm">
                    <Label>Selecione o Cirurgião</Label>
                    <Select value={selectedSurgeonId || ""} onValueChange={setSelectedSurgeonId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um médico..." />
                      </SelectTrigger>
                      <SelectContent>
                        {surgeons.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSurgeon && (
                    <div className="grid gap-8 pt-4">
                      {/* Horários Fixos */}
                      <div className="border rounded-xl p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <Clock className="h-5 w-5 text-primary" /> 
                              Horários de Atendimento (Fixos)
                            </h3>
                            <p className="text-sm text-muted-foreground">Define os dias e horários padrão de atendimento semanal</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-card p-4 rounded-lg border shadow-sm mb-6">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Dia da Semana</Label>
                            <Select value={availForm.dayOfWeek.toString()} onValueChange={(v) => setAvailForm({ ...availForm, dayOfWeek: parseInt(v) })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((day, i) => (
                                  <SelectItem key={i} value={i.toString()}>{day}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Início</Label>
                            <Select value={availForm.startTime} onValueChange={(v) => setAvailForm({ ...availForm, startTime: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Fim</Label>
                            <Select value={availForm.endTime} onValueChange={(v) => setAvailForm({ ...availForm, endTime: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleCreateAvail} className="h-10 shadow-lg">
                            {editingAvailId ? "Atualizar Horário" : "Adicionar Horário"}
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Configurações Atuais</h4>
                            {editingAvailId && (
                              <Button variant="link" size="sm" className="text-xs h-6" onClick={() => { setEditingAvailId(null); setAvailForm({ dayOfWeek: 1, startTime: "08:00", endTime: "18:00" }); }}>
                                Cancelar Edição
                              </Button>
                            )}
                          </div>
                          {selectedSurgeon.availability?.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-card/50">
                              <p className="text-sm text-muted-foreground font-medium">Nenhum horário fixo configurado.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {selectedSurgeon.availability?.map((slot: any) => (
                                <div key={slot.id} className={cn("flex items-center justify-between bg-card border p-3 rounded-lg hover:shadow-sm transition-all", editingAvailId === slot.id && "ring-2 ring-primary border-primary/50 bg-primary/5")}>
                                  <div className="flex items-center gap-3">
                                    <div className="bg-primary/10 p-2 rounded-full">
                                      <CalendarIcon className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold">{["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][slot.dayOfWeek]}</p>
                                      <p className="text-xs text-muted-foreground">{slot.startTime} às {slot.endTime}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleEditAvail(slot)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAvail(slot.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Plantões Extras */}
                      <div className="border rounded-xl p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <Plus className="h-5 w-5 text-green-500" /> 
                              Plantões e Dias Extras
                            </h3>
                            <p className="text-sm text-muted-foreground">Adicionar disponibilidade para datas específicas fora do horário fixo</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-card p-4 rounded-lg border shadow-sm mb-6">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Data do Plantão</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn("w-full justify-start text-left font-normal h-10", !extraAvailForm.date && "text-muted-foreground")}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                  {extraAvailForm.date ? format(extraAvailForm.date, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione...</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={extraAvailForm.date}
                                  onSelect={(d) => setExtraAvailForm({ ...extraAvailForm, date: d })}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Início</Label>
                            <Select value={extraAvailForm.startTime} onValueChange={(v) => setExtraAvailForm({ ...extraAvailForm, startTime: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Fim</Label>
                            <Select value={extraAvailForm.endTime} onValueChange={(v) => setExtraAvailForm({ ...extraAvailForm, endTime: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleCreateExtraAvail} variant="outline" className="h-10 border-green-500/50 text-green-600 hover:bg-green-50">Adicionar Plantão</Button>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Plantões Agendados</h4>
                          {selectedSurgeon.extraAvailability?.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-card/50">
                              <p className="text-sm text-muted-foreground font-medium">Nenhum plantão extra configurado.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {selectedSurgeon.extraAvailability?.map((slot: any) => (
                                <div key={slot.id} className="flex items-center justify-between bg-green-500/5 border border-green-500/10 p-3 rounded-lg hover:shadow-sm transition-shadow">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-green-500/20 p-2 rounded-full">
                                      <CalendarIcon className="h-4 w-4 text-green-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold">{format(new Date(slot.date), "dd/MM/yyyy")}</p>
                                      <p className="text-xs text-green-700">{slot.startTime} às {slot.endTime}</p>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteExtraAvail(slot.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloqueios */}
                      <div className="border rounded-xl p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" /> 
                              Bloqueios de Agenda
                            </h3>
                            <p className="text-sm text-muted-foreground">Impedir agendamentos em períodos específicos (férias, congressos, etc.)</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-card p-4 rounded-lg border shadow-sm mb-6">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Data Início</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn("w-full justify-start text-left font-normal h-10", !blockForm.startDate && "text-muted-foreground")}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                  {blockForm.startDate ? format(blockForm.startDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione...</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={blockForm.startDate}
                                  onSelect={(d) => setBlockForm({ ...blockForm, startDate: d })}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Hora Início</Label>
                            <Select value={blockForm.startTime} onValueChange={(v) => setBlockForm({ ...blockForm, startTime: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Data Fim</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={"outline"}
                                  className={cn("w-full justify-start text-left font-normal h-10", !blockForm.endDate && "text-muted-foreground")}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                                  {blockForm.endDate ? format(blockForm.endDate, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione...</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={blockForm.endDate}
                                  onSelect={(d) => setBlockForm({ ...blockForm, endDate: d })}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Hora Fim</Label>
                            <Select value={blockForm.endTime} onValueChange={(v) => setBlockForm({ ...blockForm, endTime: v })}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timeSlots.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 lg:col-span-1">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Motivo</Label>
                            <Input 
                              className="h-10"
                              type="text" 
                              placeholder="Ex: Férias" 
                              value={blockForm.reason} 
                              onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} 
                            />
                          </div>
                          
                          <div className="lg:col-span-5 flex justify-end gap-2">
                            {editingBlockId && (
                              <Button variant="outline" className="h-10 px-8" onClick={() => { setEditingBlockId(null); setBlockForm({ startDate: undefined, startTime: "08:00", endDate: undefined, endTime: "18:00", reason: "" }); }}>
                                Cancelar
                              </Button>
                            )}
                            <Button 
                              onClick={handleCreateBlock} 
                              variant="destructive"
                              className="w-full md:w-auto px-8 shadow-lg"
                            >
                              {editingBlockId ? "Atualizar Bloqueio" : "Adicionar Bloqueio"}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Bloqueios Ativos</h4>
                          {selectedSurgeon.blocks?.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg bg-card/50">
                              <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                              <p className="text-sm text-muted-foreground font-medium">Nenhum bloqueio registrado para este médico.</p>
                            </div>
                          ) : (
                            <div className="grid gap-2">
                              {selectedSurgeon.blocks?.map((block: any) => (
                                <div key={block.id} className={cn("flex items-center justify-between bg-card border p-3 rounded-lg hover:shadow-sm transition-all", editingBlockId === block.id && "ring-2 ring-destructive border-destructive/50 bg-destructive/5")}>
                                  <div className="flex items-center gap-3">
                                    <div className="bg-red-500/10 p-2 rounded-full">
                                      <Clock className="h-4 w-4 text-red-500" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold">
                                        {format(new Date(block.startDate), "dd/MM 'às' HH:mm")} — {format(new Date(block.endDate), "dd/MM 'às' HH:mm")}
                                      </p>
                                      {block.reason && <p className="text-xs text-muted-foreground">{block.reason}</p>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => handleEditBlock(block)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteBlock(block.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
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
            <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground mt-2">
              <p className="font-semibold mb-1">Permissões do Cargo:</p>
              {editUserRole === 'ADMIN' && <p>Acesso total ao sistema, relatórios, configurações e gestão de usuários.</p>}
              {editUserRole === 'SURGEON' && <p>Visualiza sua própria agenda, pacientes e configurações básicas.</p>}
              {editUserRole === 'CALL_CENTER' && <p>Gestão de leads, conversas, agendamentos e cadastros iniciais.</p>}
              {editUserRole === 'RECEPTION' && <p>Gestão de agenda, confirmação de presença e fluxo da clínica.</p>}
              {editUserRole === 'SALES' && <p>Foco em conversão, orçamentos e relatórios de vendas.</p>}
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
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Para confirmar, digite <strong>desativar</strong> abaixo:</Label>
              <Input 
                value={deactivateConfirmText} 
                onChange={(e) => setDeactivateConfirmText(e.target.value)}
                placeholder="desativar"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeactivateOpen(false)}>Cancelar</Button>
              <Button 
                variant="destructive" 
                disabled={deactivateConfirmText !== 'desativar'}
                onClick={() => { if (deactivatingUserId) { handleToggleUserStatus(deactivatingUserId, true); setDeactivatingUserId(null); } setConfirmDeactivateOpen(false); }}>
                Confirmar Desativação
              </Button>
            </div>
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

      {/* Create Instance Dialog */}
      <Dialog open={createInstanceDialogOpen} onOpenChange={setCreateInstanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Instância Evolution API</DialogTitle>
            <DialogDescription>
              Crie uma nova instância para conectar um número de WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Nome da Instância</Label>
              <Input
                id="instance-name"
                placeholder="Ex: whatsapp-atendimento"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">O nome não deve conter espaços.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateInstanceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateInstance}>Criar Instância</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com seu WhatsApp para conectar a instância.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border border-dashed">
            {qrCodeData?.base64 ? (
              <img src={qrCodeData.base64} alt="WhatsApp QR Code" className="w-64 h-64 object-contain rounded" />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">
                Nenhum QR Code retornado.
              </p>
            )}
            {qrCodeData?.pairingCode && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Ou use o código de pareamento:</p>
                <code className="bg-background px-3 py-1.5 rounded-md text-lg font-bold tracking-widest border">
                  {qrCodeData.pairingCode}
                </code>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => {
              setQrCodeDialogOpen(false);
              refetchEvo();
            }}>Concluído</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete Instance Dialog */}
      <Dialog open={deleteInstanceDialogOpen} onOpenChange={setDeleteInstanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Instância</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a instância <strong className="text-foreground">{instanceToDelete}</strong>?
              Esta ação desconectará seu número e interromperá todas as integrações.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteInstanceDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteInstance}>Excluir Instância</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Settings;
