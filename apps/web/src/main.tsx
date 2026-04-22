import { createRoot } from "react-dom/client";

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

window.onerror = (msg, url, line, col, error) => {
  console.error('Global error:', msg, url, line, col, error);
  return false;
};

createRoot(document.getElementById("root")!).render(
  <App />
);
