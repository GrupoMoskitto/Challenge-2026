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
      zoom: false,
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
