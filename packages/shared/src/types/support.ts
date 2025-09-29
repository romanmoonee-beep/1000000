export enum ChatStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_USER = 'WAITING_USER',
  WAITING_ADMIN = 'WAITING_ADMIN',
  CLOSED = 'CLOSED'
}

export enum ChatPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  VOICE = 'VOICE',
  LOCATION = 'LOCATION',
  SYSTEM = 'SYSTEM'
}

export interface SupportChat {
  id: bigint
  userId: bigint
  adminId?: number
  subject?: string
  status: ChatStatus
  priority: ChatPriority
  rating?: number
  createdAt: Date
  closedAt?: Date
  updatedAt: Date
}

export interface ChatMessage {
  id: bigint
  chatId: bigint
  senderId: bigint
  senderType: 'user' | 'admin'
  message: string
  messageType: MessageType
  metadata?: MessageMetadata
  createdAt: Date
}

export interface MessageMetadata {
  // Image/Document
  fileName?: string
  fileSize?: number
  mimeType?: string
  fileUrl?: string
  
  // Voice
  duration?: number
  
  // Location
  latitude?: number
  longitude?: number
  
  // System message
  systemAction?: string
  
  // Message reply
  replyToMessageId?: bigint
  
  // Rich content
  buttons?: MessageButton[]
}

export interface MessageButton {
  text: string
  callbackData?: string
  url?: string
}

export interface SupportChatCreateInput {
  userId: bigint
  subject?: string
  priority?: ChatPriority
  initialMessage?: string
}

export interface ChatMessageCreateInput {
  chatId: bigint
  senderId: bigint
  senderType: 'user' | 'admin'
  message: string
  messageType?: MessageType
  metadata?: MessageMetadata
}

export interface SupportStats {
  today: {
    newChats: number
    closedChats: number
    averageResponseTime: number
    averageResolutionTime: number
  }
  active: {
    openChats: number
    inProgressChats: number
    waitingChats: number
  }
  operators: {
    online: number
    total: number
    averageRating: number
  }
  queue: {
    pending: number
    highPriority: number
    averageWaitTime: number
  }
}

export interface OperatorStats {
  adminId: number
  name: string
  status: 'online' | 'busy' | 'offline'
  activeChats: number
  todayChats: number
  averageRating: number
  averageResponseTime: number
}

export interface ChatFilters {
  status?: ChatStatus
  priority?: ChatPriority
  adminId?: number
  userId?: bigint
  dateFrom?: Date
  dateTo?: Date
  search?: string
}