import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: "CRMed",
    description: "Documentação técnica do CRMed — arquitetura, regras de negócio e guias de desenvolvimento.",
    base: '/Challenge-2026/',

    mermaid: {
      securityLevel: 'loose',
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        // ─── Core Palette (CRMed Teal) ───
        primaryColor: '#e8f4f8',
        primaryTextColor: '#0e4a5c',
        primaryBorderColor: '#2196a4',
        secondaryColor: '#f0f7e8',
        secondaryTextColor: '#3d5a1e',
        secondaryBorderColor: '#7cb342',
        tertiaryColor: '#fef3e2',
        tertiaryTextColor: '#6d4c00',
        tertiaryBorderColor: '#f9a825',

        // ─── Lines & Labels ───
        lineColor: '#4a8fa0',
        textColor: '#1a3a47',

        // ─── Backgrounds ───
        mainBkg: '#e8f4f8',
        nodeBorder: '#2196a4',
        clusterBkg: '#f0fafc',
        clusterBorder: '#b2dfdb',
        titleColor: '#0e4a5c',

        // ─── Notes ───
        noteBkgColor: '#fff8e1',
        noteTextColor: '#5d4037',
        noteBorderColor: '#ffe082',

        // ─── Sequence Diagram ───
        actorBkg: '#e8f4f8',
        actorBorder: '#2196a4',
        actorTextColor: '#0e4a5c',
        actorLineColor: '#78b8c4',
        signalColor: '#1a3a47',
        signalTextColor: '#1a3a47',
        labelBoxBkgColor: '#e8f4f8',
        labelBoxBorderColor: '#2196a4',
        labelTextColor: '#0e4a5c',
        loopTextColor: '#0e4a5c',
        activationBorderColor: '#2196a4',
        activationBkgColor: '#d4eef4',
        sequenceNumberColor: '#ffffff',

        // ─── State Diagram ───
        labelColor: '#0e4a5c',
        altBackground: '#f0fafc',

        // ─── ER Diagram ───
        attributeBackgroundColorEven: '#f0fafc',
        attributeBackgroundColorOdd: '#e0f2f1',

        // ─── Fonts ───
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        fontSize: '14px',
      },
    },

    themeConfig: {
      logo: '/logo.svg',
      siteTitle: false,
      nav: [
        { text: 'Início', link: '/' },
        { text: 'Desenvolvimento', link: '/development' },
        { text: 'Arquitetura', link: '/architecture' }
      ],

      sidebar: [
        {
          text: 'Começando',
          items: [
            { text: 'Introdução', link: '/' },
            { text: 'Guia de Início Rápido', link: '/development' },
            { text: 'Fluxos de Teste (Manual)', link: '/testing-flows' }
          ]
        },
        {
          text: 'O Sistema (Negócio)',
          items: [
            { text: 'Regras de Negócio', link: '/business-rules' },
            {
              text: 'Módulos & Features',
              items: [
                { text: 'Gestão de Leads', link: '/features/lead-management' },
                { text: 'Score de Risco No-Show', link: '/features/no-show-risk-score' },
                { text: 'Agendamento & Calendário', link: '/features/scheduling' },
                { text: 'Automação WhatsApp', link: '/features/whatsapp-automation' }
              ]
            }
          ]
        },
        {
          text: 'Especificações Técnicas',
          items: [
            { text: 'Arquitetura', link: '/architecture' },
            { text: 'Segurança & LGPD', link: '/security' },
            { text: 'Banco de Dados', link: '/database' },
            { text: 'Referência da API GraphQL', link: '/api' }
          ]
        }
      ],

      socialLinks: [
        { icon: 'github', link: 'https://github.com/GrupoMoskitto/Challenge-2026' }
      ],

      docFooter: {
        prev: 'Página Anterior',
        next: 'Próxima Página'
      },
      outline: { label: 'Nesta página' },
      sidebarMenuLabel: 'Menu',
      returnToTopLabel: 'Voltar ao topo',
      darkModeSwitchLabel: 'Tema Escuro',

      search: {
        provider: 'local',
        options: {
          translations: {
            button: {
              buttonText: 'Pesquisar',
              buttonAriaLabel: 'Pesquisar na documentação'
            },
            modal: {
              noResultsText: 'Sem resultados para',
              resetButtonTitle: 'Limpar pesquisa',
              footer: {
                selectText: 'para selecionar',
                navigateText: 'para navegar',
                closeText: 'para fechar'
              }
            }
          }
        }
      }
    }
  })
)
