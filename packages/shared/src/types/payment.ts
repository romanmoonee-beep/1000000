export enum TransactionType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
  WITHDRAWAL = 'WITHDRAWAL',
  COMMISSION = 'COMMISSION',
  CASHBACK = 'CASHBACK'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

export enum PaymentMethod {
  CARD = 'CARD',
  SBP = 'SBP',
  CRYPTO = 'CRYPTO',
  BALANCE = 'BALANCE',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

export interface Transaction {
  id: bigint
  userId: bigint
  orderId?: bigint
  orderType?: 'shipping' | 'purchase'
  amount: number
  type: TransactionType
  paymentMethod?: PaymentMethod
  paymentId?: string
  status: TransactionStatus
  description?: string
  metadata?: TransactionMetadata
  createdAt: Date
  completedAt?: Date
  updatedAt: Date
}

export interface TransactionMetadata {
  // Card payment
  cardLast4?: string
  cardBrand?: string
  
  // Crypto payment
  cryptoCurrency?: string
  cryptoAddress?: string
  cryptoTxHash?: string
  
  // SBP payment
  sbpBankName?: string
  sbpPhoneNumber?: string
  
  // Error details
  errorCode?: string
  errorMessage?: string
  
  // Additional data
  exchangeRate?: number
  originalAmount?: number
  originalCurrency?: string
  
  // Admin data
  adminId?: number
  adminComment?: string
}

export interface PaymentCreateInput {
  userId: bigint
  orderId?: bigint
  orderType?: 'shipping' | 'purchase'
  amount: number
  type: TransactionType
  paymentMethod: PaymentMethod
  description?: string
  metadata?: TransactionMetadata
}

export interface PaymentLink {
  id: string
  amount: number
  currency: string
  description: string
  paymentUrl: string
  expiresAt: Date
  status: 'pending' | 'paid' | 'expired'
}

export interface BalanceOperation {
  type: 'add' | 'subtract'
  amount: number
  description: string
  transactionId?: bigint
}

export interface PaymentStats {
  today: {
    total: number
    count: number
    methods: Record<PaymentMethod, number>
  }
  month: {
    total: number
    count: number
    growth: number
  }
  pending: {
    count: number
    amount: number
  }
  failed: {
    count: number
    amount: number
  }
}