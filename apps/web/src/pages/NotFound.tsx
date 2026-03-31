import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-muted">
        <CardHeader className="text-center pb-0">
          <div className="mx-auto mb-6">
            <img 
              src="/logo.svg" 
              alt="Hospital São Rafael" 
              className="h-20 w-auto mx-auto"
            />
          </div>
          <h1 className="text-8xl font-black tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            404
          </h1>
        </CardHeader>
        <CardContent className="text-center pb-6 space-y-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Ops, esta página está de folga
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Parece que ela foi para o almoço e não avisou quando volta. Enquanto isso, que tal voltar ao início?
          </p>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 mt-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono break-all">
              {location.pathname}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-4 pb-6">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => navigate(-1)}
            className="gap-2 px-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </Button>
          <Button 
            size="lg"
            onClick={() => navigate("/")}
            className="gap-2 px-6"
          >
            <Home className="h-5 w-5" />
            Ir para o início
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default NotFound;
