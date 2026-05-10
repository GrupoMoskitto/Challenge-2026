import { ReactNode, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile/Tablet: off-canvas drawer — OUTSIDE main wrapper to avoid aria-hidden conflicts */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72 border-r-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Menu de navega\u00e7\u00e3o</SheetTitle>
          <SheetDescription className="sr-only">Navega\u00e7\u00e3o principal do sistema</SheetDescription>
          <AppSidebar
            onNavigate={() => setMobileMenuOpen(false)}
            isMobileDrawer
          />
        </SheetContent>
      </Sheet>

      <div className="flex h-screen-dvh w-full overflow-hidden bg-background">
        <div className="hidden lg:block">
          <AppSidebar />
        </div>

        <div className="flex flex-col flex-1 overflow-x-hidden overflow-y-hidden">
          <TopBar
            title={title}
            onMenuToggle={() => setMobileMenuOpen(true)}
          />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
