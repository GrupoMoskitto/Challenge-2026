import { ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-x-hidden overflow-y-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
