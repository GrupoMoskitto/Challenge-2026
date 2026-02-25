import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { User, Mail, Shield, Bell, Users, MessageSquare } from "lucide-react";

const roleLabels: Record<string, string> = {
  ADMIN: "Administrador",
  SURGEON: "Cirurgião",
  CALL_CENTER: "Call Center",
  RECEPTION: "Recepção",
  SALES: "Vendas",
};

const Settings = () => {
  const { user } = useAuth();

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
                Gerencie os modelos de mensagens automatizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Configure mensagens automáticas para envio aos pacientes
                  </p>
                  <Button>Novo Template</Button>
                </div>
                <div className="border rounded-lg">
                  <div className="grid grid-cols-4 gap-4 p-4 border-b bg-muted/30 font-medium text-sm">
                    <div>Nome</div>
                    <div>Canal</div>
                    <div>Disparo</div>
                    <div>Status</div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 border-b items-center">
                    <div className="font-medium">Boas-vindas Lead</div>
                    <div><Badge variant="outline">WhatsApp</Badge></div>
                    <div className="text-sm text-muted-foreground">Na captura</div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 border-b items-center">
                    <div className="font-medium">Lembrete 4 dias</div>
                    <div><Badge variant="outline">WhatsApp</Badge></div>
                    <div className="text-sm text-muted-foreground">4 dias antes</div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 border-b items-center">
                    <div className="font-medium">Lembrete 2 dias</div>
                    <div><Badge variant="outline">WhatsApp</Badge></div>
                    <div className="text-sm text-muted-foreground">2 dias antes</div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-4 items-center">
                    <div className="font-medium">Lembrete 1 dia</div>
                    <div><Badge variant="outline">WhatsApp</Badge></div>
                    <div className="text-sm text-muted-foreground">1 dia antes</div>
                    <div><Badge variant="secondary">Ativo</Badge></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Settings;
