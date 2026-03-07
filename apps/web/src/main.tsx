import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";
import App from "./App.tsx";
import "./index.css";

const initializeTheme = () => {
  const theme = localStorage.getItem('theme') || 'system';
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      root.classList.add('dark');
    }
  }
};

initializeTheme();

const ThemeTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [sphereRadius, setSphereRadius] = useState(0);
  const [centerPos, setCenterPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleThemeChange = () => {
      const button = document.querySelector('[data-theme-toggle]') as HTMLButtonElement;
      if (!button) {
        setCenterPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      } else {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        setCenterPos({ x, y });
      }
      
      setIsTransitioning(true);
      
      const startTime = Date.now();
      const duration = 800;
      const maxRadius = Math.max(
        Math.sqrt(Math.pow(centerPos.x, 2) + Math.pow(centerPos.y, 2)),
        Math.sqrt(Math.pow(window.innerWidth - centerPos.x, 2) + Math.pow(centerPos.y, 2)),
        Math.sqrt(Math.pow(centerPos.x, 2) + Math.pow(window.innerHeight - centerPos.y, 2)),
        Math.sqrt(Math.pow(window.innerWidth - centerPos.x, 2) + Math.pow(window.innerHeight - centerPos.y, 2))
      ) * 1.5;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const eased = 1 - Math.pow(1 - progress, 4);
        
        setSphereRadius(eased * maxRadius);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            setIsTransitioning(false);
            setSphereRadius(0);
          }, 100);
        }
      };
      
      requestAnimationFrame(animate);
    };
    
    window.addEventListener('theme-transition', handleThemeChange);
    return () => window.removeEventListener('theme-transition', handleThemeChange);
  }, []);

  if (!isTransitioning) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{
        background: sphereRadius > 0 
          ? `radial-gradient(circle ${sphereRadius}px at ${centerPos.x}px ${centerPos.y}px, var(--theme-transition-color) 0%, transparent 100%)`
          : 'transparent',
      }}
    />
  );
};

createRoot(document.getElementById("root")!).render(
  <>
    <ThemeTransition />
    <App />
  </>
);
