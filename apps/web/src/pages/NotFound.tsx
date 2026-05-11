import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden selection:bg-primary/30">
      {/* Efeito de Fundo (Glow) baseado na cor primária */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Container Principal (Glassmorphism) */}
      <div className="relative z-10 w-full max-w-lg p-8 sm:p-12 text-center bg-card/60 backdrop-blur-md border border-border/80 rounded-2xl shadow-xl animate-in fade-in zoom-in-95 duration-700 ease-out">
        
        {/* Logo */}
        <div className="mb-8">
          <img 
            src="/logo.svg" 
            alt="Logo do Sistema" 
            className="h-16 w-auto mx-auto opacity-90 drop-shadow-md"
          />
        </div>

        {/* 404 Title */}
        <h1 className="text-[7rem] sm:text-[8rem] leading-none font-black tracking-tighter mb-2 bg-gradient-to-br from-primary/70 via-primary to-primary/90 bg-clip-text text-transparent drop-shadow-sm select-none">
          404
        </h1>

        {/* Mensagem e Copywriting */}
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 tracking-tight">
          Página não encontrada
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto mb-10 text-sm sm:text-base leading-relaxed">
          O endereço que você está procurando pode ter sido removido ou está temporariamente indisponível.
        </p>

        {/* Ações / Botões */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto gap-2 bg-transparent"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button 
            size="lg"
            onClick={() => navigate("/")}
            className="w-full sm:w-auto gap-2 shadow-[0_0_20px_hsl(var(--primary)/0.15)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.25)] transition-all"
          >
            <Home className="h-4 w-4" />
            Voltar para o Início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
