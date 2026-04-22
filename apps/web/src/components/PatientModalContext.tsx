import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_LEADS, CREATE_PATIENT, GET_PATIENTS } from "@/lib/queries";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { HistoricalDatePicker } from "@/components/ui/historical-date-picker";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Callbacks = {
  onSuccess?: (patientId: string) => void;
  onCancel?: () => void;
};

type PatientModalContextType = {
  openCreatePatientModal: (leadId?: string, callbacks?: Callbacks) => void;
};

const PatientModalContext = createContext<PatientModalContextType | undefined>(undefined);

export const usePatientModal = () => {
  const context = useContext(PatientModalContext);
  if (!context) throw new Error("usePatientModal must be used within PatientModalProvider");
  return context;
};

const normalizeString = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const likelyFemaleName = (name?: string | null) => {
  if (!name) return false;
  const firstName = normalizeString(name).split(" ")[0];
  return firstName.endsWith("a");
};

const getSexMismatchWarning = (name?: string | null, sex?: string | null) => {
  if (!name || !sex) return null;
  const normalizedSex = normalizeString(sex);
  if (likelyFemaleName(name) && normalizedSex === "masculino") {
    return "Possível inconsistência: nome sugere feminino e sexo está como masculino.";
  }
  return null;
};

const MAX_WEIGHT_KG = 400;
const MAX_HEIGHT_CM = 300;

export const PatientModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [callbacks, setCallbacks] = useState<Callbacks | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [form, setForm] = useState({
    leadId: "",
    dateOfBirth: "",
    medicalRecord: "",
    address: "",
    sex: "",
    weight: "",
    height: "",
    howMet: ""
  });

  const { data: leadsData } = useQuery(GET_LEADS, {
    variables: { search: leadSearch },
    fetchPolicy: 'network-only',
    skip: !isOpen
  });

  const [createPatient, { loading: creating }] = useMutation(CREATE_PATIENT, {
    refetchQueries: [{ query: GET_LEADS }, { query: GET_PATIENTS }],
    awaitRefetchQueries: true,
  });

  const availableLeads = useMemo(() => {
    const allLeads = leadsData?.leads?.edges?.map((e: any) => e.node) || [];
    return allLeads
      .filter((lead: any) => lead.status !== 'CONVERTED' && !lead.patient)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [leadsData]);

  const createSexMismatchWarning = useMemo(() => {
    const selectedLead = availableLeads.find((lead: any) => lead.id === form.leadId);
    return getSexMismatchWarning(selectedLead?.name, form.sex);
  }, [availableLeads, form.leadId, form.sex]);

  const openCreatePatientModal = useCallback((leadId?: string, cbs?: Callbacks) => {
    setForm({
      leadId: leadId || "",
      dateOfBirth: "",
      medicalRecord: "",
      address: "",
      sex: "",
      weight: "",
      height: "",
      howMet: ""
    });
    setCallbacks(cbs || null);
    setLeadSearch("");
    setIsOpen(true);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open && isOpen) {
      callbacks?.onCancel?.();
    }
    setIsOpen(open);
  };

  const handleCreate = async () => {
    if (!form.leadId || !form.dateOfBirth) {
      return toast.error("Selecione um lead e informe a data de nascimento");
    }

    if (form.weight) {
      const w = parseFloat(form.weight.replace(",", "."));
      if (isNaN(w) || w <= 0 || w > MAX_WEIGHT_KG) {
        return toast.error(`Por favor, insira um peso válido e realista (até ${MAX_WEIGHT_KG}kg).`);
      }
    }
    if (form.height) {
      const h = parseFloat(form.height.replace(",", "."));
      if (isNaN(h) || h <= 0 || h > MAX_HEIGHT_CM) {
        return toast.error(`Por favor, insira uma altura válida e realista (em cm, até ${MAX_HEIGHT_CM}cm).`);
      }
    }

    try {
      const result = await createPatient({
        variables: {
          input: {
            leadId: form.leadId,
            dateOfBirth: new Date(form.dateOfBirth).toISOString(),
            medicalRecord: form.medicalRecord || undefined,
            address: form.address || undefined,
            sex: form.sex || undefined,
            weight: form.weight ? parseFloat(form.weight) : undefined,
            height: form.height ? parseFloat(form.height) : undefined,
            howMet: form.howMet || undefined,
          }
        }
      });
      
      if (result.data?.createPatient?.id) {
        toast.success("Paciente criado com sucesso!");
        const newPatientId = result.data.createPatient.id;
        setIsOpen(false);
        callbacks?.onSuccess?.(newPatientId);
        navigate(`/patients?patientId=${newPatientId}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar paciente");
    }
  };

  return (
    <PatientModalContext.Provider value={{ openCreatePatientModal }}>
      {children}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Converter Lead em Paciente</DialogTitle>
             <DialogDescription>
               Selecione um lead não convertido para criar o registro de paciente.
             </DialogDescription>
           </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Lead *</Label>
               <Input
                 value={leadSearch}
                 onChange={(e) => setLeadSearch(e.target.value)}
                 placeholder="Buscar lead por nome..."
               />
               <Select value={form.leadId} onValueChange={v => setForm(f => ({ ...f, leadId: v }))}>
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione um lead" />
                 </SelectTrigger>
                 <SelectContent>
                   {availableLeads.map((lead: any) => (
                     <SelectItem key={lead.id} value={lead.id}>
                       {lead.name} - {lead.cpf}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <HistoricalDatePicker
                value={form.dateOfBirth}
                onChange={(iso) => setForm(f => ({ ...f, dateOfBirth: iso }))}
                minYear={1900}
                maxYear={new Date().getFullYear()}
                locale={ptBR}
                placeholder="Selecione a data"
              />
            </div>
            <div className="space-y-2">
              <Label>Prontuário</Label>
              <Input value={form.medicalRecord} onChange={e => setForm(f => ({ ...f, medicalRecord: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={form.sex} onValueChange={v => setForm(f => ({ ...f, sex: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Masculino">Masculino</SelectItem>
                  <SelectItem value="Feminino">Feminino</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              {createSexMismatchWarning && (
                <p className="text-xs text-amber-500">{createSexMismatchWarning}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  max="300"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="Ex: 70.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Altura (cm)</Label>
                <Input
                  type="number"
                  min="50"
                  max="250"
                  value={form.height}
                  onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                  placeholder="Ex: 170"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Como nos conheceu?</Label>
              <Select value={form.howMet} onValueChange={v => setForm(f => ({ ...f, howMet: v }))}>
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
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating} className="min-w-[140px]">{creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Paciente"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PatientModalContext.Provider>
  );
};
