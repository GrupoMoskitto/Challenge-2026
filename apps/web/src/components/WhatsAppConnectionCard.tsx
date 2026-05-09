import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, 
  QrCode, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CONNECT_EVOLUTION_INSTANCE, CREATE_EVOLUTION_INSTANCE } from '@/lib/queries';

type ConnectionStatus = 'idle' | 'loading' | 'pending_qr' | 'connected' | 'expired' | 'error';

interface WhatsAppConnectionCardProps {
  instanceName: string;
  onConnected?: () => void;
  className?: string;
}

interface ConnectResult {
  connectEvolutionInstance: {
    qrCode: string | null;
    pairingCode: string | null;
    connected: boolean;
  };
}

function QRSkeleton() {
  return (
    <div className="w-[160px] h-[160px] mx-auto">
      <Skeleton className="w-full h-full rounded-lg" />
    </div>
  );
}

function SpinningCircle({ className }: { className?: string }) {
  return (
    <motion.svg
      className={className}
      viewBox="0 0 24 24"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray="31.4 31.4"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

export function WhatsAppConnectionCard({
  instanceName,
  onConnected,
  className
}: WhatsAppConnectionCardProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoRequested, setAutoRequested] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);

  const [connectInstance, { loading: connecting }] = useMutation<ConnectResult>(CONNECT_EVOLUTION_INSTANCE);

  const isLoading = connecting;

  const handleConnect = useCallback(async () => {
    setStatus(prev => (prev === 'pending_qr' || prev === 'expired' || prev === 'connected') ? prev : 'loading');
    setErrorMessage(null);

    try {
      const result = await connectInstance({
        variables: { name: instanceName },
        context: { timeout: 10000 }
      });

      if (result.errors?.length) {
        setStatus('error');
        setErrorMessage(result.errors[0].message);
        return;
      }

      if (result.data?.connectEvolutionInstance) {
        const { qrCode: newQrCode, connected } = result.data.connectEvolutionInstance;

        if (connected) {
          setStatus('connected');
          onConnected?.();
          toast.success('WhatsApp conectado!');
        } else if (newQrCode) {
          setQrCode(newQrCode);
          setStatus('pending_qr');
          toast.info('Escaneie o QR Code com seu WhatsApp');
        } else {
          setStatus('error');
          setErrorMessage('QR code não disponível');
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setStatus('error');
      setErrorMessage(error.message || 'Erro ao conectar');
      toast.error(error.message || 'Erro ao conectar instância');
    }
  }, [instanceName, connectInstance, onConnected]);

  const handleManualRefresh = useCallback(() => {
    if (isLoading) return;
    setSpinRotation(prev => prev + 720);
    handleConnect();
  }, [handleConnect, isLoading]);

  // Auto-conectar ao abrir o dialog
  useEffect(() => {
    if (status === 'idle' && !autoRequested) {
      setAutoRequested(true);
      setTimeout(() => handleConnect(), 300);
    }
  }, [status, autoRequested, handleConnect]);

  // Verificar conexões a cada 5 segundos
  useEffect(() => {
    if (status !== 'pending_qr') return;

    const interval = setInterval(async () => {
      try {
        const result = await connectInstance({
          variables: { name: instanceName },
          fetchPolicy: 'network-only'
        });

        if (result.data?.connectEvolutionInstance?.connected) {
          setStatus('connected');
          setQrCode(null);
          onConnected?.();
          toast.success('WhatsApp conectado!');
        }
      } catch {
        // Erro ao verificar, ignore
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, instanceName, connectInstance, onConnected]);

  // Timeout de 45 segundos para QR code
  useEffect(() => {
    if (status !== 'pending_qr') return;

    const timeout = setTimeout(() => {
      setStatus('expired');
    }, 45000);

    return () => clearTimeout(timeout);
  }, [status]);

  const getStatusLabel = () => {
    switch (status) {
      case 'idle': return 'Pendente';
      case 'loading': return 'Carregando...';
      case 'pending_qr': return 'Aguardando';
      case 'connected': return 'Conectado';
      case 'expired': return 'Expirado';
      case 'error': return 'Erro';
      default: return status;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'loading': return 'bg-blue-500';
      case 'pending_qr': return 'bg-yellow-500';
      case 'error': 
      case 'expired': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className={cn("w-full max-w-sm mx-auto border-2 h-[520px] flex flex-col", className)}>
      <CardHeader className="pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              status === 'connected' ? "bg-green-100" : "bg-gray-100"
            )}>
              <MessageCircle className={cn(
                "w-5 h-5",
                status === 'connected' ? "text-green-600" : "text-gray-500"
              )} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">WhatsApp</CardTitle>
              <p className="text-xs text-muted-foreground">{instanceName}</p>
            </div>
          </div>
          <Badge className={cn(getStatusColor(), "text-white shrink-0")}>
            {getStatusLabel()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 flex-1 flex flex-col justify-between">
        {/* Área fixa do QR Code - sempre mesma altura */}
        <div className="h-[180px] flex items-center justify-center shrink-0">
          <AnimatePresence mode="wait">
            {status === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-[160px] h-[160px]"
              >
                <Skeleton className="w-full h-full rounded-lg" />
              </motion.div>
            )}

            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-[160px] h-[160px] border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center"
              >
                <Smartphone className="w-8 h-8 text-gray-300" />
                <p className="text-xs text-gray-400 mt-2">Aguardando comando</p>
              </motion.div>
            )}

            {(status === 'pending_qr' || status === 'expired') && qrCode && (
              <motion.div
                key="qr"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white p-2 rounded-lg border"
              >
                <img src={qrCode} alt="QR Code" className="w-[150px] h-[150px]" />
              </motion.div>
            )}

            {(status === 'pending_qr' || status === 'expired') && !qrCode && (
              <QRSkeleton />
            )}

            {status === 'connected' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="w-[140px] h-[140px] rounded-full bg-green-100 flex items-center justify-center"
              >
                <CheckCircle2 className="w-16 h-16 text-green-600" />
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-[140px] h-[140px] rounded-full bg-red-100 flex items-center justify-center"
              >
                <AlertCircle className="w-16 h-16 text-red-600" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* área de conteúdo variável - com altura mínima para manter estável */}
        <div className="flex-1 flex flex-col justify-end">
          <AnimatePresence mode="wait">
            {/* Estado: Idle */}
            {status === 'idle' && (
              <motion.div
                key="idle-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground text-center">
                  Clique no botão abaixo para gerar o QR Code
                </p>
                <Button className="w-full" onClick={handleConnect} disabled={isLoading}>
                  {isLoading ? <SpinningCircle className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  {isLoading ? 'Gerando...' : 'Gerar QR Code'}
                </Button>
              </motion.div>
            )}

            {/* Estado: Loading */}
            {status === 'loading' && (
              <motion.div
                key="loading-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground text-center font-medium">
                  Verificando conexão...
                </p>
                <div className="flex justify-center">
                  <SpinningCircle className="w-8 h-8 animate-spin" />
                </div>
              </motion.div>
            )}

            {/* Estado: QR Code / Pendente */}
            {(status === 'pending_qr' || status === 'expired') && (
              <motion.div
                key="qr-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 p-3 rounded-lg border border-border/50">
                  <p className="font-semibold text-foreground mb-1">Como conectar:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Abra o WhatsApp no celular</li>
                    <li>Configurações {'>'} Dispositivos conectados</li>
                    <li>Conectar um dispositivo</li>
                    <li>Escaneie o QR Code</li>
                  </ol>
                </div>
                
                {status === 'expired' && (
                  <p className="text-xs text-center text-red-500 font-medium bg-red-50 py-1.5 rounded-md border border-red-100">
                    QR Code expirou. Gere outro.
                  </p>
                )}
                
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-muted-foreground flex items-center">
                    <span className="relative flex h-2 w-2 mr-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Aguardando leitura...
                  </span>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" 
                    onClick={handleManualRefresh} 
                    disabled={isLoading}
                    title="Atualizar QR Code"
                  >
                    <motion.div
                      animate={{ rotate: spinRotation }}
                      transition={{ duration: 0.7, ease: "easeInOut" }}
                      className="flex items-center justify-center"
                    >
                      <RefreshCw className={cn("w-4 h-4", isLoading && spinRotation === 0 && "text-blue-500")} />
                    </motion.div>
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Estado: Conectado */}
            {status === 'connected' && (
              <motion.div
                key="connected-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <p className="text-sm text-green-600 font-medium text-center">
                  WhatsApp conectado com sucesso!
                </p>
                <Button variant="outline" className="w-full" onClick={handleConnect} disabled={isLoading}>
                  {isLoading ? <SpinningCircle className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {isLoading ? 'Verificando...' : 'Verificar Status'}
                </Button>
              </motion.div>
            )}

            {/* Estado: Erro */}
            {status === 'error' && (
              <motion.div
                key="error-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <p className="text-sm text-red-500 text-center">
                  {errorMessage || 'Erro ao conectar. Tente novamente.'}
                </p>
                <Button className="w-full" onClick={handleConnect} disabled={isLoading}>
                  {isLoading ? <SpinningCircle className="w-4 h-4" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Tentar Novamente
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}