import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_MESSAGE_TEMPLATES,
  CREATE_MESSAGE_TEMPLATE,
  UPDATE_MESSAGE_TEMPLATE,
  DELETE_MESSAGE_TEMPLATE,
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
import { User, Bell, Users, MessageSquare, Plus, MoreVertical, Pencil, Trash2, Mail, Phone as PhoneIcon, Eye } from "lucide-react";

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
  const { user } = useAuth();

  // Template state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<TemplateForm>(initialTemplateForm);
  const [editTemplate, setEditTemplate] = useState<TemplateForm>(initialTemplateForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // GraphQL
  const { data: templatesData, loading: templatesLoading, refetch: refetchTemplates } = useQuery(GET_MESSAGE_TEMPLATES);
  const [createTemplate, { loading: creating }] = useMutation(CREATE_MESSAGE_TEMPLATE);
  const [updateTemplate, { loading: updating }] = useMutation(UPDATE_MESSAGE_TEMPLATE);
  const [deleteTemplate, { loading: deleting }] = useMutation(DELETE_MESSAGE_TEMPLATE);

  const templates: MessageTemplate[] = templatesData?.messageTemplates || [];

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

  return (
    <AppLayout title="Configurações">
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="profile" className="flex-1">
            <User className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1">
            <Bell className="h-4 w-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="users" className="flex-1">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-1">
            <MessageSquare className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
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
                  <Input id="name" defaultValue={user?.name} />
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
                  <Input id="password" type="password" placeholder="••••••••" />
                </div>
              </div>

              <div className="flex justify-end">
                <Button>Salvar Alterações</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificações</CardTitle>
              <CardDescription>
                Escolha como você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificações de novos leads</p>
                    <p className="text-sm text-muted-foreground">Receba alertas quando um novo lead for cadastrado</p>
                  </div>
                  <Button variant="outline">Ativar</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Lembretes de consulta</p>
                    <p className="text-sm text-muted-foreground">Receba lembretes antes das consultas agendadas</p>
                  </div>
                  <Button>Ativo</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">E-mails de resumo diário</p>
                    <p className="text-sm text-muted-foreground">Receba um resumo das atividades do dia</p>
                  </div>
                  <Button variant="outline">Ativar</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Notificações de conversão</p>
                    <p className="text-sm text-muted-foreground">Seja avisado quando um lead for convertido em paciente</p>
                  </div>
                  <Button>Ativo</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
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
                  <Button>Novo Usuário</Button>
                </div>
                <div className="border rounded-lg">
                  <div className="grid grid-cols-4 gap-4 p-4 border-b bg-muted/30 font-medium text-sm">
                    <div>Nome</div>
                    <div>E-mail</div>
                    <div>Cargo</div>
                    <div>Status</div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 border-b items-center">
                    <div className="font-medium">Administrador</div>
                    <div className="text-sm text-muted-foreground">admin@hsr.com.br</div>
                    <div><Badge>Administrador</Badge></div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 border-b items-center">
                    <div className="font-medium">Maria Souza</div>
                    <div className="text-sm text-muted-foreground">maria@hsr.com.br</div>
                    <div><Badge variant="outline">Call Center</Badge></div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 items-center">
                    <div className="font-medium">João Silva</div>
                    <div className="text-sm text-muted-foreground">joao@hsr.com.br</div>
                    <div><Badge variant="outline">Recepção</Badge></div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
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
            <Button onClick={handleUpdate} disabled={updating}>
              {updating ? "Salvando..." : "Salvar"}
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
    </AppLayout>
  );
};

export default Settings;
