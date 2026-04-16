import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton, CardListSkeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  Phone,
  MessageCircle,
  Mail,
  FileText,
  Check,
  X,
  Clock,
  Calendar,
  User,
  Pencil,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  XCircle,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation } from "@apollo/client";
import { 
  GET_PATIENTS, 
  GET_PATIENT,
  UPDATE_PATIENT,
  CREATE_DOCUMENT,
  UPDATE_DOCUMENT_STATUS,
  CREATE_POST_OP,
  UPDATE_POST_OP_STATUS,
  CREATE_PATIENT,
  GET_LEADS,
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

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-500',
  CONTACTED: 'bg-yellow-500',
  QUALIFIED: 'bg-purple-500',
  CONVERTED: 'bg-green-500',
  LOST: 'bg-red-500',
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

const auditActionLabels: Record<string, string> = {
  CREATED: 'Criado',
  UPDATED: 'Atualizado',
  STATUS_CHANGE: 'Status alterado',
};

const PAGE_SIZE = 20;

const Patients = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "contacts");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["contacts", "documents", "postop", "history"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", value);
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: patientsData, previousData: prevPatientsData, loading: loadingPatients, error: patientsError, refetch: refetchPatients } = useQuery(GET_PATIENTS, {
    variables: { 
      first: PAGE_SIZE,
      where: {
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : {}),
      }
    },
    fetchPolicy: 'cache-and-network',
  });

  // Use previous data while loading new search results to prevent flickering
  const effectivePatientsData = patientsData || prevPatientsData;

  // Derive pagination from data instead of separate state (avoids stale values)
  const totalCount = effectivePatientsData?.patients?.totalCount ?? 0;
  const hasNextPage = effectivePatientsData?.patients?.pageInfo?.hasNextPage ?? false;
  const endCursor = effectivePatientsData?.patients?.pageInfo?.endCursor ?? null;

  // Detect if this is a re-fetch (not initial load) — used for subtle loading indicator
  const isSearching = loadingPatients && !!effectivePatientsData;

  // Debug error
  useEffect(() => {
    if (patientsError) {
      console.error('Patients query error:', patientsError);
    }
  }, [patientsError]);

  const loadMore = async () => {
    if (!endCursor || !hasNextPage) return;
    await refetchPatients({
      first: PAGE_SIZE,
      after: endCursor,
      where: {
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter && { status: statusFilter }),
      }
    });
  };

  const { data: patientData, previousData: prevPatientData, loading: loadingPatient, refetch: refetchPatient } = useQuery(GET_PATIENT, {
    variables: { id: selectedPatientId },
    skip: !selectedPatientId,
    fetchPolicy: 'cache-and-network',
  });

  // Keep previous patient visible while loading new one
  const effectivePatientData = patientData || prevPatientData;

  const { data: leadsData } = useQuery(GET_LEADS, {
    variables: { status: 'CONVERTED' },
    fetchPolicy: 'cache-first',
  });

  const [updatePatient, { loading: updatingPatient }] = useMutation(UPDATE_PATIENT);
  const [createPatient, { loading: creatingPatient }] = useMutation(CREATE_PATIENT);
  const [createDocument, { loading: creatingDoc }] = useMutation(CREATE_DOCUMENT);
  const [updateDocumentStatus] = useMutation(UPDATE_DOCUMENT_STATUS);
  const [createPostOp, { loading: creatingPostOp }] = useMutation(CREATE_POST_OP);
  const [updatePostOpStatus] = useMutation(UPDATE_POST_OP_STATUS);

  const [editPatientDialogOpen, setEditPatientDialogOpen] = useState(false);
  const [editPatientForm, setEditPatientForm] = useState({ 
    dateOfBirth: "", 
    medicalRecord: "", 
    address: "",
    sex: "",
    weight: "",
    height: "",
    howMet: "",
    reason: "" 
  });

  const [newDocDialogOpen, setNewDocDialogOpen] = useState(false);
  const [newDocForm, setNewDocForm] = useState({ name: "", type: "CONTRACT", date: new Date().toISOString().split('T')[0] });

  const [newPostOpDialogOpen, setNewPostOpDialogOpen] = useState(false);
  const [newPostOpForm, setNewPostOpForm] = useState({ description: "", type: "RETURN", date: new Date().toISOString().split('T')[0] });

  const [createPatientDialogOpen, setCreatePatientDialogOpen] = useState(false);
  const [createPatientForm, setCreatePatientForm] = useState({ 
    leadId: "", 
    dateOfBirth: "", 
    medicalRecord: "", 
    address: "",
    sex: "",
    weight: "",
    height: "",
    howMet: ""
  });

  const patients = effectivePatientsData?.patients?.edges?.map((e: any) => e.node) || [];
  const patient = effectivePatientData?.patient;
  const convertedLeads = leadsData?.leads?.edges?.map((e: any) => e.node) || [];
  const availableLeadsForConversion = convertedLeads.filter((lead: any) => !lead.patient);

  const openEditPatient = () => {
    if (!patient) return;
    setEditPatientForm({
      dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : "",
      medicalRecord: patient.medicalRecord || "",
      address: patient.address || "",
      sex: patient.sex || "",
      weight: patient.weight?.toString() || "",
      height: patient.height?.toString() || "",
      howMet: patient.howMet || "",
      reason: "",
    });
    setEditPatientDialogOpen(true);
  };

  const handleUpdatePatient = async () => {
    try {
      await updatePatient({ 
        variables: { 
          input: { 
            id: patient.id, 
            dateOfBirth: editPatientForm.dateOfBirth ? new Date(editPatientForm.dateOfBirth).toISOString() : undefined,
            medicalRecord: editPatientForm.medicalRecord || undefined,
            address: editPatientForm.address || undefined,
            sex: editPatientForm.sex || undefined,
            weight: editPatientForm.weight ? parseFloat(editPatientForm.weight) : undefined,
            height: editPatientForm.height ? parseFloat(editPatientForm.height) : undefined,
            howMet: editPatientForm.howMet || undefined,
            reason: editPatientForm.reason || undefined,
          } 
        } 
      });
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

  const handleCreatePatient = async () => {
    if (!createPatientForm.leadId || !createPatientForm.dateOfBirth) {
      return toast.error("Selecione um lead e informe a data de nascimento");
    }
    try {
      const result = await createPatient({ 
        variables: { 
          input: {
            leadId: createPatientForm.leadId,
            dateOfBirth: new Date(createPatientForm.dateOfBirth).toISOString(),
            medicalRecord: createPatientForm.medicalRecord || undefined,
            address: createPatientForm.address || undefined,
            sex: createPatientForm.sex || undefined,
            weight: createPatientForm.weight ? parseFloat(createPatientForm.weight) : undefined,
            height: createPatientForm.height ? parseFloat(createPatientForm.height) : undefined,
            howMet: createPatientForm.howMet || undefined,
          }
        } 
      });
      toast.success("Paciente criado com sucesso!");
      setCreatePatientDialogOpen(false);
      setCreatePatientForm({ leadId: "", dateOfBirth: "", medicalRecord: "", address: "", sex: "", weight: "", height: "", howMet: "" });
      refetchPatients();
      if (result.data?.createPatient?.id) {
        setSelectedPatientId(result.data.createPatient.id);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar paciente");
    }
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value === "ALL" ? "" : value);
  }, []);

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

  const isInitialLoad = loadingPatients && !patientsData;

  if (isInitialLoad) {
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
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-9"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              )}
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setCreatePatientDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>

          {showFilters && (
            <Card className="p-3">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status do Lead</Label>
                  <Select value={statusFilter || "ALL"} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="NEW">Novo</SelectItem>
                      <SelectItem value="CONTACTED">Contato</SelectItem>
                      <SelectItem value="QUALIFIED">Qualificado</SelectItem>
                      <SelectItem value="CONVERTED">Convertido</SelectItem>
                      <SelectItem value="LOST">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalCount} pacientes</span>
          </div>

          <div className={cn("space-y-2 transition-opacity duration-200", isSearching && "opacity-60")}>
            {patients.length === 0 && !loadingPatients ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum paciente encontrado
              </p>
            ) : patients.length === 0 && loadingPatients ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            ) : (
              patients.map((p: any) => (
                <Card
                  key={p.id}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all duration-200",
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{p.lead?.name}</p>
                          <div className={cn("w-2 h-2 rounded-full", statusColors[p.lead?.status] || "bg-gray-400")} title={statusLabels[p.lead?.status]} />
                        </div>
                        <p className="text-xs text-muted-foreground">{p.lead?.phone}</p>
                        {p.bmi && (
                          <p className="text-xs text-muted-foreground mt-1">
                            IMC: {p.bmi} • {p.weight}kg • {p.height}cm
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingPatients}>
                <ChevronRight className="h-4 w-4 mr-1" />
                Carregar mais
              </Button>
            </div>
          )}
        </div>

        {/* Patient Details */}
        <div className="flex-1 space-y-4">
          {!selectedPatientId ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Selecione um paciente para ver os detalhes</p>
              </CardContent>
            </Card>
          ) : loadingPatient && !effectivePatientData?.patient ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : loadingPatient && effectivePatientData?.patient ? (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                </CardContent>
              </Card>
              <Tabs value={activeTab} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="contacts" className="flex-1">Contatos</TabsTrigger>
                  <TabsTrigger value="documents" className="flex-1">Documentos</TabsTrigger>
                  <TabsTrigger value="postop" className="flex-1">Pós-Operatório</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
                </TabsList>
                <div className="mt-4">
                  {activeTab === "contacts" && <CardListSkeleton count={3} />}
                  {activeTab === "documents" && <CardListSkeleton count={2} />}
                  {activeTab === "postop" && <CardListSkeleton count={2} />}
                  {activeTab === "history" && <CardListSkeleton count={3} />}
                </div>
              </Tabs>
            </div>
          ) : patient ? (
            <div className={cn("space-y-4 transition-opacity duration-200", loadingPatient && "opacity-60")}>
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
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="contacts" className="flex-1">Contatos</TabsTrigger>
                  <TabsTrigger value="documents" className="flex-1">Documentos</TabsTrigger>
                  <TabsTrigger value="postop" className="flex-1">Pós-Operatório</TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  {activeTab === "contacts" && (
                    <motion.div
                      key="contacts"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 mt-4"
                    >
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
                    </motion.div>
                  )}

                  {activeTab === "documents" && (
                    <motion.div
                      key="documents"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 mt-4"
                    >
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
                    </motion.div>
                  )}

                  {activeTab === "postop" && (
                    <motion.div
                      key="postop"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4 mt-4"
                    >
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
                    </motion.div>
                  )}

                  {activeTab === "history" && (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 mt-4"
                    >
                      {patient.auditLogs?.length === 0 ? (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground">
                            Nenhum registro de auditoria
                          </CardContent>
                        </Card>
                      ) : (
                        patient.auditLogs?.map((log: any) => (
                          <Card key={log.id}>
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                  log.action === 'CREATED' ? "bg-green-500/20" : "bg-blue-500/20"
                                )}>
                                  {log.action === 'CREATED' ? (
                                    <Plus className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <History className="h-4 w-4 text-blue-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium">
                                      {auditActionLabels[log.action] || log.action}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm')}
                                    </span>
                                  </div>
                                  {log.reason && (
                                    <p className="text-xs text-muted-foreground mb-1">{log.reason}</p>
                                  )}
                                  {log.newValue && (
                                    <p className="text-xs bg-muted p-2 rounded font-mono truncate">
                                      {log.newValue.length > 100 ? log.newValue.substring(0, 100) + '...' : log.newValue}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Tabs>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Erro ao carregar dados do paciente</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Patient Dialog */}
      <Dialog open={createPatientDialogOpen} onOpenChange={setCreatePatientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter Lead em Paciente</DialogTitle>
            <DialogDescription>
              Selecione um lead convertido para criar o registro de paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lead *</Label>
              <Select value={createPatientForm.leadId} onValueChange={v => setCreatePatientForm(f => ({...f, leadId: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um lead" />
                </SelectTrigger>
                <SelectContent>
                  {availableLeadsForConversion.map((lead: any) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name} - {lead.cpf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <Input type="date" value={createPatientForm.dateOfBirth} onChange={e => setCreatePatientForm(f => ({...f, dateOfBirth: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Prontuário</Label>
              <Input value={createPatientForm.medicalRecord} onChange={e => setCreatePatientForm(f => ({...f, medicalRecord: e.target.value}))} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={createPatientForm.address} onChange={e => setCreatePatientForm(f => ({...f, address: e.target.value}))} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={createPatientForm.sex} onValueChange={v => setCreatePatientForm(f => ({...f, sex: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={createPatientForm.weight} 
                  onChange={e => setCreatePatientForm(f => ({...f, weight: e.target.value}))} 
                  placeholder="Ex: 70.5" 
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (cm)</Label>
                <Input 
                  type="number" 
                  value={createPatientForm.height} 
                  onChange={e => setCreatePatientForm(f => ({...f, height: e.target.value}))} 
                  placeholder="Ex: 170" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Como nos conheceu?</Label>
              <Select value={createPatientForm.howMet} onValueChange={v => setCreatePatientForm(f => ({...f, howMet: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreatePatientDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreatePatient} disabled={creatingPatient} className="min-w-[140px]">{creatingPatient ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Paciente"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={editPatientDialogOpen} onOpenChange={setEditPatientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {editPatientForm.dateOfBirth ? new Date(editPatientForm.dateOfBirth).toLocaleDateString('pt-BR') : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editPatientForm.dateOfBirth ? new Date(editPatientForm.dateOfBirth) : undefined}
                    onSelect={(date) => setEditPatientForm(f => ({...f, dateOfBirth: date?.toISOString().split('T')[0] || ""}))}
                    className="rounded-md"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Prontuário</Label>
              <Input value={editPatientForm.medicalRecord} onChange={e => setEditPatientForm(f => ({...f, medicalRecord: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={editPatientForm.address} onChange={e => setEditPatientForm(f => ({...f, address: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={editPatientForm.sex} onValueChange={v => setEditPatientForm(f => ({...f, sex: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  value={editPatientForm.weight} 
                  onChange={e => setEditPatientForm(f => ({...f, weight: e.target.value}))} 
                  placeholder="Ex: 70.5" 
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (cm)</Label>
                <Input 
                  type="number" 
                  value={editPatientForm.height} 
                  onChange={e => setEditPatientForm(f => ({...f, height: e.target.value}))} 
                  placeholder="Ex: 170" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Como nos conheceu?</Label>
              <Select value={editPatientForm.howMet} onValueChange={v => setEditPatientForm(f => ({...f, howMet: v}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Facebook Ads">Facebook Ads</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Motivo da alteração</Label>
              <Input value={editPatientForm.reason} onChange={e => setEditPatientForm(f => ({...f, reason: e.target.value}))} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditPatientDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdatePatient} disabled={updatingPatient} className="min-w-[120px]">{updatingPatient ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}</Button>
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
            <Button onClick={handleCreateDocument} disabled={creatingDoc} className="min-w-[180px]">{creatingDoc ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adicionando...</> : "Adicionar Documento"}</Button>
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
            <Button onClick={handleCreatePostOp} disabled={creatingPostOp} className="min-w-[160px]">{creatingPostOp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Agendando...</> : "Agendar Retorno"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Patients;
