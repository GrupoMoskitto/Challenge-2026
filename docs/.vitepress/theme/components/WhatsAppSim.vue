<template>
  <div class="whatsapp-sim">

    <div class="wa-header">
      <div class="wa-header-left">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="wa-back-btn"><path d="m15 18-6-6 6-6"/></svg>
        <div class="wa-avatar">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21v-1a7 7 0 0 1 14 0v1"/><circle cx="10" cy="8" r="4"/><path d="M17.5 8a2.5 2.5 0 0 1 0 5"/><path d="M21 21v-1a4 4 0 0 0-3-3.85"/></svg>
        </div>
        <div class="wa-contact-info">
          <div class="wa-name">{{ contactName }}</div>
          <div class="wa-status">visto por último hoje às {{ currentTime }}</div>
        </div>
      </div>
      <div class="wa-header-right">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.6 11.6L22 7v10l-6.4-4.5v-1zM4 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2z"/></svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </div>
    </div>

    <div class="wa-chat-area" ref="chatArea">
      <div class="wa-encryption-notice">
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>As mensagens são protegidas com criptografia de ponta a ponta.</span>
      </div>

      <div class="wa-message-row" v-for="(msg, index) in parsedMessages" :key="index" :class="msg.direction">
        <div class="wa-message-bubble" :class="{ 'has-tail': isFirstInGroup(index) }">
          <div class="wa-tail" v-if="isFirstInGroup(index)"></div>
          <div class="wa-message-text" v-html="msg.html"></div>
          <div class="wa-message-meta">
            <span class="wa-time">{{ msg.time || currentTime }}</span>
            <span v-if="msg.direction === 'outbound'" class="wa-ticks">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="11" viewBox="0 0 16 11" class="tick-icon">
                <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.46.46 0 0 0-.33-.15.457.457 0 0 0-.328.135.474.474 0 0 0-.015.658l2.338 2.438a.47.47 0 0 0 .34.15h.024a.462.462 0 0 0 .342-.166l6.507-8.02a.458.458 0 0 0 .008-.662z" fill="currentColor"/>
                <path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.25-.352.434 1.525 1.59a.47.47 0 0 0 .34.15h.024a.462.462 0 0 0 .342-.166l6.507-8.02a.458.458 0 0 0-.311-.45z" fill="currentColor"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="wa-input-area">
      <div class="wa-icon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
      <div class="wa-icon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></div>
      <div class="wa-input-box">Digite uma mensagem</div>
      <div class="wa-icon microphone"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg></div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  contactName: {
    type: String,
    default: 'CRMed Atendimento'
  },
  messages: {
    type: Array,
    required: true,
  }
})

const chatArea = ref(null)

const currentTime = computed(() => {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})

const formatText = (text) => {
  if (!text) return ''
  return text
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/~([^~]+)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br/>')
}

const parsedMessages = computed(() => {
  return props.messages.map(m => ({
    ...m,
    html: formatText(m.text)
  }))
})

const isFirstInGroup = (index) => {
  if (index === 0) return true
  return props.messages[index].direction !== props.messages[index - 1].direction
}
</script>

<style scoped>
.whatsapp-sim {
  /* Light theme — WhatsApp Web defaults */
  --wa-header-bg: #075e54;
  --wa-header-text: #ffffff;
  --wa-bg: #eae6df;
  --wa-outbound-bg: #d9fdd3;
  --wa-inbound-bg: #ffffff;
  --wa-text: #111b21;
  --wa-time-text: #667781;
  --wa-enc-bg: #fdf8c8;
  --wa-enc-text: #54656f;
  --wa-input-area-bg: #f0f2f5;
  --wa-input-box-bg: #ffffff;
  --wa-icon-color: #54656f;
  --wa-border: rgba(0,0,0,0.08);

  border: 1px solid var(--wa-border);
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
  max-width: 480px;
  margin: 24px auto;
  box-shadow:
    0 4px 6px -1px rgba(0,0,0,0.1),
    0 2px 4px -1px rgba(0,0,0,0.06),
    0 12px 40px -4px rgba(0,0,0,0.12);
  display: flex;
  flex-direction: column;
  height: 580px;
  background-color: var(--wa-bg);
  font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  transition: background-color 0.3s ease;
}

:root.dark .whatsapp-sim {
  --wa-header-bg: #202c33;
  --wa-header-text: #e9edef;
  --wa-bg: #0b141a;
  --wa-outbound-bg: #005c4b;
  --wa-inbound-bg: #202c33;
  --wa-text: #e9edef;
  --wa-time-text: rgba(255,255,255,0.45);
  --wa-enc-bg: rgba(255,210,121,0.06);
  --wa-enc-text: #ffd279;
  --wa-input-area-bg: #202c33;
  --wa-input-box-bg: #2a3942;
  --wa-icon-color: #8696a0;
  --wa-border: rgba(255,255,255,0.06);
}

/* ─── Header ─── */
.wa-header {
  background-color: var(--wa-header-bg);
  color: var(--wa-header-text);
  padding: 10px 16px 10px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
  transition: background-color 0.3s ease;
}

.wa-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wa-header-right {
  display: flex;
  align-items: center;
  gap: 18px;
  opacity: 0.85;
}

.wa-back-btn {
  cursor: pointer;
}

.wa-avatar {
  width: 38px;
  height: 38px;
  background-color: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.85);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wa-contact-info {
  display: flex;
  flex-direction: column;
  margin-left: 4px;
}

.wa-name {
  font-weight: 500;
  font-size: 16px;
  line-height: 21px;
}

.wa-status {
  font-size: 13px;
  line-height: 20px;
  color: rgba(255,255,255,0.7);
}

/* ─── Chat Area ─── */
.wa-chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 5% 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: var(--wa-bg);
  /* WhatsApp-style doodle pattern (dark mode uses plain bg) */
  background-image:
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.02) 1px, transparent 1px),
    radial-gradient(circle at 70% 60%, rgba(0,0,0,0.02) 1px, transparent 1px),
    radial-gradient(circle at 40% 80%, rgba(0,0,0,0.015) 1px, transparent 1px);
  background-size: 60px 60px, 80px 80px, 100px 100px;
  transition: background-color 0.3s ease;
}

:root.dark .wa-chat-area {
  background-image: none;
}

/* ─── Encryption Notice ─── */
.wa-encryption-notice {
  text-align: center;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.wa-encryption-notice svg {
  color: var(--wa-enc-text);
  opacity: 0.7;
}

.wa-encryption-notice span {
  background-color: var(--wa-enc-bg);
  color: var(--wa-enc-text);
  font-size: 11.5px;
  padding: 6px 12px;
  border-radius: 7.5px;
  box-shadow: 0 1px 0.5px rgba(11,20,26,.08);
  transition: all 0.3s ease;
}

/* ─── Message Rows ─── */
.wa-message-row {
  display: flex;
  width: 100%;
  margin-bottom: 2px;
}

.wa-message-row.outbound {
  justify-content: flex-end;
}

.wa-message-row.inbound {
  justify-content: flex-start;
}

/* ─── Bubbles ─── */
.wa-message-bubble {
  max-width: 80%;
  padding: 6px 7px 8px 9px;
  border-radius: 7.5px;
  position: relative;
  box-shadow: 0 1px 0.5px rgba(11,20,26,.13);
  font-size: 14.2px;
  line-height: 19px;
  color: var(--wa-text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.wa-message-row.outbound .wa-message-bubble {
  background-color: var(--wa-outbound-bg);
}

.wa-message-row.outbound .wa-message-bubble.has-tail {
  border-top-right-radius: 0;
}

.wa-message-row.inbound .wa-message-bubble {
  background-color: var(--wa-inbound-bg);
}

.wa-message-row.inbound .wa-message-bubble.has-tail {
  border-top-left-radius: 0;
}

/* ─── Message Content ─── */
.wa-message-text {
  margin-bottom: 2px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.wa-message-text :deep(strong) {
  font-weight: bold;
}

.wa-message-text :deep(em) {
  font-style: italic;
}

/* ─── Message Meta (time + ticks) ─── */
.wa-message-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  float: right;
  margin-left: 12px;
  margin-top: 4px;
  margin-bottom: -4px;
}

.wa-time {
  font-size: 11px;
  color: var(--wa-time-text);
  transition: color 0.3s ease;
}

.tick-icon {
  color: #53bdeb;
  margin-top: -1px;
}

/* ─── Tail ─── */
.wa-tail {
  position: absolute;
  top: 0;
  width: 0;
  height: 0;
  border-bottom: 10px solid transparent;
}

.wa-message-row.outbound .wa-tail {
  right: -8px;
  border-left: 10px solid var(--wa-outbound-bg);
}

.wa-message-row.inbound .wa-tail {
  left: -8px;
  border-right: 10px solid var(--wa-inbound-bg);
}

/* ─── Input Area ─── */
.wa-input-area {
  background-color: var(--wa-input-area-bg);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid rgba(0,0,0,0.04);
  transition: background-color 0.3s ease;
}

:root.dark .wa-input-area {
  border-top-color: rgba(255,255,255,0.04);
}

.wa-icon {
  color: var(--wa-icon-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.3s ease;
}

.wa-input-box {
  flex: 1;
  background-color: var(--wa-input-box-bg);
  border-radius: 20px;
  padding: 9px 14px;
  color: var(--wa-icon-color);
  font-size: 15px;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.microphone {
  background-color: #00a884;
  color: white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.microphone:hover {
  background-color: #06cf9c;
}
</style>