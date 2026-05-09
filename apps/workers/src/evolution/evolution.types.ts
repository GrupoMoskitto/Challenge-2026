// ============================================================================
// Evolution Go (EvoGo) — Type Definitions
// API Reference: https://docs.evolutionfoundation.com.br/evolution-go
// ============================================================================

// ---------------------------------------------------------------------------
// Generic API Response Wrapper
// EvoGo wraps ALL responses in { data: T, message: string }
// ---------------------------------------------------------------------------
export interface EvoGoResponse<T> {
  data: T;
  message: string;
}

// ---------------------------------------------------------------------------
// Instance Management
// ---------------------------------------------------------------------------

/** Returned by GET /instance/all and POST /instance/create */
export interface EvoGoInstanceData {
  id: string;            // UUID — primary identifier in EvoGo
  name: string;          // Human-readable name
  token: string;         // Instance-specific auth token
  webhook: string;
  jid: string;           // WhatsApp JID (populated after connection)
  qrcode: string;
  connected: boolean;
  expiration: number;
  disconnect_reason: string;
  events: string;
  os_name: string;
  proxy: string;
  client_name: string;
  createdAt: string;     // ISO 8601
  alwaysOnline: boolean;
  rejectCall: boolean;
  msgRejectCall: string;
  readMessages: boolean;
  ignoreGroups: boolean;
  ignoreStatus: boolean;
}

/** Returned by GET /instance/status */
export interface EvoGoStatusData {
  Connected: boolean;
  LoggedIn: boolean;
  Name: string;
}

/** Returned by POST /instance/connect */
export interface EvoGoConnectData {
  eventString: string;    // e.g. "MESSAGE,SEND_MESSAGE,CONNECTION,QRCODE"
  jid: string;
  webhookUrl: string;
}

/** Body for POST /instance/create */
export interface EvoGoCreateInstancePayload {
  name: string;
  token?: string;
  proxy?: {
    address: string;
    password: string;
    port: string;
    username: string;
  };
}

/** Body for POST /instance/connect */
export interface EvoGoConnectPayload {
  webhookUrl: string;
  subscribe: string[];     // e.g. ['ALL'] or ['MESSAGE', 'CONNECTION', 'QRCODE']
  immediate?: boolean;
  phone?: string;          // Optional: use pairing code instead of QR
}

// ---------------------------------------------------------------------------
// Send Message
// ---------------------------------------------------------------------------

/** Body for POST /send/text */
export interface EvoGoSendTextPayload {
  number: string;
  text: string;
  delay?: number;         // milliseconds
  id?: string;            // Optional custom message ID
  mentionAll?: boolean;
  mentionedJid?: string;
  quoted?: {
    messageId: string;
    participant: string;
  };
}

/** Info object returned in send/webhook responses */
export interface EvoGoMessageInfo {
  Chat: string;           // e.g. "5511...@s.whatsapp.net"
  Sender: string;
  SenderAlt?: string;
  IsFromMe: boolean;
  IsGroup: boolean;
  ID: string;             // WhatsApp message ID
  Type: string;           // "text", "media", "ExtendedTextMessage"
  PushName: string;
  Timestamp: string;      // ISO 8601
  MediaType: string;      // "", "image", "video", "audio", "document"
  VerifiedName?: {
    Certificate?: Record<string, unknown>;
    Details?: {
      serial: number;
      issuer: string;
      verifiedName: string;
    };
  } | null;
}

/** Message content object */
export interface EvoGoMessageContent {
  conversation?: string;
  extendedTextMessage?: {
    text: string;
    contextInfo?: Record<string, unknown>;
  };
  imageMessage?: Record<string, unknown>;
  videoMessage?: Record<string, unknown>;
  audioMessage?: Record<string, unknown>;
  documentMessage?: Record<string, unknown>;
  base64?: string;
}

/** Full response from POST /send/text */
export interface EvoGoSendTextResponseData {
  Info: EvoGoMessageInfo;
  Message: EvoGoMessageContent;
  MessageContextInfo?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Webhook Payloads (received from EvoGo via HTTP POST)
// ---------------------------------------------------------------------------

/** Generic webhook envelope */
export interface EvoGoWebhookEnvelope {
  event: EvoGoWebhookEvent;
  data: Record<string, unknown>;
  instanceId: string;      // UUID
  instanceToken: string;
}

/** All possible webhook event names */
export type EvoGoWebhookEvent =
  | 'Message'
  | 'SendMessage'
  | 'Receipt'
  | 'Presence'
  | 'HistorySync'
  | 'ChatPresence'
  | 'Archive'
  | 'CallOffer'
  | 'CallRelayLatency'
  | 'CallTerminate'
  | 'Connected'
  | 'PairSuccess'
  | 'LoggedOut'
  | 'OfflineSyncCompleted'
  | 'LabelEdit'
  | 'LabelAssociationChat'
  | 'LabelAssociationMessage'
  | 'Contact'
  | 'PushName'
  | 'GroupInfo'
  | 'JoinedGroup'
  | 'NewsletterJoin'
  | 'NewsletterLeave'
  | 'QRCode'
  | 'QRTimeout'
  | 'QRSuccess';

/** Webhook: Message event data */
export interface EvoGoMessageWebhookData {
  Info: EvoGoMessageInfo;
  Message: EvoGoMessageContent;
  IsEphemeral: boolean;
  IsViewOnce: boolean;
  IsEdit: boolean;
}

/** Webhook: QRCode event data */
export interface EvoGoQRCodeWebhookData {
  code: string;           // Raw QR code string
  qrcode: string;         // Base64 PNG data URI
}

/** Webhook: PairSuccess event data */
export interface EvoGoPairSuccessData {
  BusinessName: string;
  ID: string;
  Platform: string;       // "android" | "ios"
  jid: string;
  pushName: string;
  status: string;         // "open"
}

/** Webhook: Receipt event data */
export interface EvoGoReceiptWebhookData {
  Chat: string;
  Sender: string;
  IsFromMe: boolean;
  IsGroup: boolean;
  MessageIDs: string[];
  Timestamp: string;
  Type: string;
}

