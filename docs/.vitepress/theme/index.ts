import DefaultTheme from 'vitepress/theme'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import mediumZoom from 'medium-zoom'
import './style.css'
import RiskBadge from './components/RiskBadge.vue'
import EnvBadge from './components/EnvBadge.vue'
import WhatsAppSim from './components/WhatsAppSim.vue'

const MODAL_ID = 'mermaid-zoom-modal'
const CONTENT_ID = 'mermaid-zoom-content'

function ensureModal() {
  if (typeof document === 'undefined') return
  if (document.getElementById(MODAL_ID)) return
  const modal = document.createElement('div')
  modal.id = MODAL_ID
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  modal.addEventListener('click', () => { modal.style.display = 'none' })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.style.display = 'none'
  })
  document.body.appendChild(modal)
}

function handleMermaidClick(e: MouseEvent) {
  // Capture the closest .mermaid container from the clicked target
  const container = (e.target as Element).closest?.('.vp-doc .mermaid')
  if (!container) return
  
  // Find the SVG within the container
  const svg = container.querySelector('svg')
  if (!svg) return

  // Prevent other click handlers (if any)
  e.stopPropagation()

  const modal = document.getElementById(MODAL_ID)
  if (!modal) return
  
  modal.innerHTML = ''

  const wrapper = document.createElement('div')
  wrapper.id = CONTENT_ID
  wrapper.addEventListener('click', (e) => e.stopPropagation())

  // Clone SVG to show in the modal
  const clone = svg.cloneNode(true) as SVGElement
  clone.removeAttribute('width')
  clone.removeAttribute('height')
  // Force the SVG to take up the full available width of the wrapper
  clone.style.cssText = 'width: 100%; height: auto; min-width: 100%; min-height: 100%; display: block; margin: 0 auto;'

  wrapper.appendChild(clone)
  modal.appendChild(wrapper)
  modal.style.display = 'flex'
}

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    const init = () => {
      ensureModal()
      mediumZoom('.vp-doc img:not(.medium-zoom-image)', { background: 'var(--vp-c-bg)', margin: 24 })
    }

    onMounted(() => {
      init()
      // Register event delegation once using capture phase
      document.addEventListener('click', handleMermaidClick, true)
    })
    
    watch(() => route.path, () => nextTick(() => {
      mediumZoom('.vp-doc img:not(.medium-zoom-image)', { background: 'var(--vp-c-bg)', margin: 24 })
    }))
  },
  enhanceApp({ app }) {
    app.component('RiskBadge', RiskBadge)
    app.component('EnvBadge', EnvBadge)
    app.component('WhatsAppSim', WhatsAppSim)
  },
}






