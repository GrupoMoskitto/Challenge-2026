# CRMed - Frontend

Frontend do sistema de gestão de pacientes e jornada do cliente para o Hospital São Rafael.

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Apollo Client

## Como executar

```bash
cd apps/web
npm install
npm run dev
```

## Estrutura

```
src/
├── components/     # Componentes React (UI e layout)
├── data/          # Dados mockados
├── hooks/        # Custom hooks
├── lib/          # Utilitários (Apollo, etc)
├── pages/        # Páginas da aplicação
└── App.tsx       # Componente principal
```

## Rotas

- `/login` - Login
- `/` - Dashboard
- `/leads` - Gestão de Leads
- `/schedule` - Agenda de Consultas
- `/patients` - Pacientes
- `/settings` - Configurações
