import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Phone,
  MessageCircle,
  Mail,
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  X,
  Clock,
  Upload,
  Calendar,
  User,
  Pencil,
  Plus,
} from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { 
  GET_PATIENTS, 
  GET_PATIENT,
  UPDATE_PATIENT,
  CREATE_DOCUMENT,
  UPDATE_DOCUMENT_STATUS,
  CREATE_POST_OP,
  UPDATE_POST_OP_STATUS
} from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contato',
  QUALIFIED: 'Qualificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

const documentTypeLabels: Record<string, string> = {
  CONTRACT: 'Contrato',
  TERM: 'Termo',
  EXAM: 'Exame',
  OTHER: 'Outro',
};

const documentStatusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  SIGNED: 'Assinado',
  UPLOADED: 'Enviado',
};

const Patients = () => {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: patientsData, loading: loadingPatients } = useQuery(GET_PATIENTS, {
    fetchPolicy: 'network-only',
  });

  const { data: patientData, loading: loadingPatient, refetch: refetchPatient } = useQuery(GET_PATIENT, {
    variables: { id: selectedPatientId },
    skip: !selectedPatientId,
    fetchPolicy: 'network-only',
  });

  const [updatePatient, { loading: updatingPatient }] = useMutation(UPDATE_PATIENT);
  const [createDocument, { loading: creatingDoc }] = useMutation(CREATE_DOCUMENT);
  const [updateDocumentStatus] = useMutation(UPDATE_DOCUMENT_STATUS);
  const [createPostOp, { loading: creatingPostOp }] = useMutation(CREATE_POST_OP);
  const [updatePostOpStatus] = useMutation(UPDATE_POST_OP_STATUS);

  const [editPatientDialogOpen, setEditPatientDialogOpen] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({ dateOfBirth: "", medicalRecord: "", address: "" });

  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });

  const [newPostOpDialogOpen, setNewPostOpDialogOpen] = useState(false);
  const [newPostOpForm, setNewPostOpForm] = useState({ description: "", type: "RETURN", date: new Date().toISOString().split('T')[0] });

  const patients = patientsData?.patients || [];
  const patient = patientData?.patient;

  // Handlers
  const openEditPatient = () => {
    if (!patient) return;
    setEditPatientForm({
      dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : "",
      medicalRecord: patient.medicalRecord || "",
      address: patient.address || ""
    });
    setEditPatientDialogOpen(true);
  };

  const handleUpdatePatient = async () => {
    try {
      await updatePatient({ variables: { input: { id: patient.id, ...editPatientForm } } });
      toast.success("Dados atualizados com sucesso!");
      setEditPatientDialogOpen(false);
      refetchPatient();
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar");
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocForm.name || !newDocForm.date) return toast.error("Preencha nome e data");
    try {
      await createDocument({ variables: { input: { patientId: patient.id, ...newDocForm, date: new Date(newDocForm.date).toISOString() } } });
      toast.success("Documento adicionado!");
      setNewDocDialogOpen(false);
      setNewDocForm({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });
      refetchPatient();
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar documento");
    }
  };

  const handleCreatePostOp = async () => {
    if (!newPostOpForm.description || !newPostOpForm.date) return toast.error("Preencha descrição e data");
    try {
      await createPostOp({ variables: { input: { patientId: patient.id, ...newPostOpForm, date: new Date(newPostOpForm.date).toISOString() } } });
      toast.success("Pós-operatório agendado!");
      setNewPostOpDialogOpen(false);
      setNewPostOpForm({ description: "", type: "RETURN", date: new Date().toISOString().split('T')[0] });
      refetchPatient();
    } catch (e: any) {
      toast.error(e.message || "Erro ao agendar pós-op");
    }
  };

  const filteredPatients = patients.filter((p: any) =>
    p.lead?.name.toLowerCase().includes(search.toLowerCase()) ||
    p.lead?.cpf?.includes(search) ||
    p.lead?.phone?.includes(search)
  );

  const contactIcon = (type: string) => {
    switch (type) {
      case 'WHATSAPP': return <MessageCircle className="h-4 w-4 text-green-500" />;
      case 'CALL': return <Phone className="h-4 w-4 text-blue-500" />;
      case 'EMAIL': return <Mail className="h-4 w-4 text-purple-500" />;
      default: return null;
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'READ': 
      case 'ANSWERED': 
      case 'SIGNED':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'DELIVERED': 
      case 'SENT':
        return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'FAILED': 
      case 'MISSED':
        return <X className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (loadingPatients) {
    return (
      <AppLayout title="Pacientes">
        <div className="flex gap-6">
          <div className="w-1/3 space-y-2">
            <Skeleton className="h-10 w-full" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="flex-1 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Pacientes">
      <div className="flex gap-6">
        {/* Patient List */}
        <div className="w-1/3 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="space-y-2">
            {filteredPatients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum paciente encontrado
              </p>
            )}
            {filteredPatients.map((p: any) => (
              <Card
                key={p.id}
                className={cn(
                  "cursor-pointer hover:shadow-md transition-shadow",
                  selectedPatientId === p.id && "border-primary"
                )}
                onClick={() => setSelectedPatientId(p.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.lead?.name}</p>
                      <p className="text-xs text-muted-foreground">{p.lead?.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Patient Details */}
        <div className="flex-1 space-y-4">
          {!selectedPatientId ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Selecione um paciente para ver os detalhes</p>
              </CardContent>
            </Card>
          ) : loadingPatient ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : patient ? (
            <>
              {/* Patient Info Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Dados Pessoais</CardTitle>
                  <Button variant="ghost" size="sm" onClick={openEditPatient}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {patient.lead?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{patient.lead?.name}</p>
                      <p className="text-sm text-muted-foreground">CPF: {patient.lead?.cpf}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Telefone</span>
                      <p>{patient.lead?.phone}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">E-mail</span>
                      <p>{patient.lead?.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data de Nascimento</span>
                      <p>{patient.dateOfBirth ? format(new Date(patient.dateOfBirth), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prontuário</span>
                      <p>{patient.medicalRecord || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Endereço</span>
                      <p>{patient.address || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="contacts" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="contacts" className="flex-1">Contatos</TabsTrigger>
                  <TabsTrigger value="documents" className="flex-1">Documentos</TabsTrigger>
                  <TabsTrigger value="postop" className="flex-1">Pós-Operatório</TabsTrigger>
                </TabsList>

                <TabsContent value="contacts" className="space-y-2 mt-4">
                  {patient.lead?.contacts?.length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Nenhum contato registrado
                      </CardContent>
                    </Card>
                  )}
                  {patient.lead?.contacts?.map((contact: any) => (
                    <Card key={contact.id}>
                      <CardContent className="p-3 flex items-start gap-3">
                        {contactIcon(contact.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">
                              {contact.direction === 'INBOUND' ? 'Recebido' : 'Enviado'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(contact.date), 'dd/MM/yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{contact.message}</p>
                        </div>
                        {statusIcon(contact.status)}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="documents" className="space-y-4 mt-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setNewDocDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Documento
                    </Button>
                  </div>
                  {patient.documents?.length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Nenhum documento registrado
                      </CardContent>
                    </Card>
                  )}
                  {patient.documents?.map((doc: any) => (
                    <Card key={doc.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {documentTypeLabels[doc.type]} • {format(new Date(doc.date), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={doc.status === 'SIGNED' ? 'default' : doc.status === 'UPLOADED' ? 'secondary' : 'outline'}>
                            {documentStatusLabels[doc.status]}
                          </Badge>
                          {doc.status === 'PENDING' && (
                            <div className="flex flex-col gap-1 ml-2">
                              {doc.type === 'CONTRACT' || doc.type === 'TERM' ? (
                                <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={async () => {
                                  try {
                                    await updateDocumentStatus({ variables: { id: doc.id, status: 'SIGNED' } });
                                    toast.success("Documento assinado!");
                                    refetchPatient();
                                  } catch (e: any) { toast.error(e.message); }
                                }}>
                                  Marcar Assinado
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-8 text-xs px-2" onClick={async () => {
                                  try {
                                    await updateDocumentStatus({ variables: { id: doc.id, status: 'UPLOADED' } });
                                    toast.success("Documento enviado!");
                                    refetchPatient();
                                  } catch (e: any) { toast.error(e.message); }
                                }}>
                                  Marcar Enviado
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="postop" className="space-y-4 mt-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setNewPostOpDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Agendar Retorno
                    </Button>
                  </div>
                  {patient.postOps?.length === 0 && (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        Nenhum retorno agendado
                      </CardContent>
                    </Card>
                  )}
                  {patient.postOps?.map((postOp: any) => (
                    <Card key={postOp.id}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{postOp.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(postOp.date), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={postOp.status === 'COMPLETED' ? 'default' : postOp.status === 'SCHEDULED' ? 'secondary' : 'outline'}>
                            {postOp.status === 'COMPLETED' ? 'Concluído' : postOp.status === 'SCHEDULED' ? 'Agendado' : 'Pendente'}
                          </Badge>
                          {postOp.status !== 'COMPLETED' && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Marcar como Concluído" onClick={async () => {
                              try {
                                await updatePostOpStatus({ variables: { id: postOp.id, status: 'COMPLETED' }});
                                toast.success("Pós-operatório concluído!");
                                refetchPatient();
                              } catch(e: any) { toast.error(e.message); }
                            }}>
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Erro ao carregar dados do paciente</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Patient Dialog */}
      <Dialog open={editPatientDialogOpen} onOpenChange={setEditPatientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={editPatientForm.dateOfBirth} onChange={e => setEditPatientForm(f => ({...f, dateOfBirth: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Prontuário</Label>
              <Input value={editPatientForm.medicalRecord} onChange={e => setEditPatientForm(f => ({...f, medicalRecord: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={editPatientForm.address} onChange={e => setEditPatientForm(f => ({...f, address: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditPatientDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdatePatient} disabled={updatingPatient}>{updatingPatient ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Document Dialog */}
      <Dialog open={newDocDialogOpen} onOpenChange={setNewDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Documento *</Label>
              <Input value={newDocForm.name} onChange={e => setNewDocForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={newDocForm.type} onValueChange={v => setNewDocForm(f => ({...f, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRACT">Contrato</SelectItem>
                  <SelectItem value="TERM">Termo</SelectItem>
                  <SelectItem value="EXAM">Exame</SelectItem>
                  <SelectItem value="OTHER">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Emissão *</Label>
              <Input type="date" value={newDocForm.date} onChange={e => setNewDocForm(f => ({...f, date: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewDocDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateDocument} disabled={creatingDoc}>{creatingDoc ? "Adicionando..." : "Adicionar Documento"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New PostOp Dialog */}
      <Dialog open={newPostOpDialogOpen} onOpenChange={setNewPostOpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Pós-Operatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={newPostOpForm.description} onChange={e => setNewPostOpForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={newPostOpForm.type} onValueChange={v => setNewPostOpForm(f => ({...f, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETURN">Retorno</SelectItem>
                  <SelectItem value="REPAIR">Reparo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Agendada *</Label>
              <Input type="date" value={newPostOpForm.date} onChange={e => setNewPostOpForm(f => ({...f, date: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewPostOpDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePostOp} disabled={creatingPostOp}>{creatingPostOp ? "Agendando..." : "Agendar Retorno"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Patients;
