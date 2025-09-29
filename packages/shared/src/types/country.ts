export interface Country {
  id: number
  name: string
  code: string
  flagEmoji: string
  currency?: string
  isActive: boolean
  shippingAvailable: boolean
  purchaseAvailable: boolean
  purchaseCommission: number
  popularityScore: number
  createdAt: Date
  updatedAt: Date
}

export interface Warehouse {
  id: number
  countryId: number
  name: string
  address: string
  phone?: string
  email?: string
  workingHours?: string
  timezone?: string
  maxWeightKg: number
  maxDeclaredValue: number
  restrictions?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ShippingTariff {
  id: number
  countryFromId: number
  countryToId: number
  pricePerKg: number
  minPrice: number
  deliveryDaysMin?: number
  deliveryDaysMax?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface City {
  id: number
  name: string
  region?: string
  countryCode: string
  isPopular: boolean
  population?: number
  isActive: boolean
}

export interface CountryCreateInput {
  name: string
  code: string
  flagEmoji: string
  currency?: string
  shippingAvailable?: boolean
  purchaseAvailable?: boolean
  purchaseCommission?: number
  popularityScore?: number
}

export interface WarehouseCreateInput {
  countryId: number
  name: string
  address: string
  phone?: string
  email?: string
  workingHours?: string
  timezone?: string
  maxWeightKg?: number
  maxDeclaredValue?: number
  restrictions?: string
}

export interface ShippingTariffCreateInput {
  countryFromId: number
  countryToId: number
  pricePerKg: number
  minPrice: number
  deliveryDaysMin?: number
  deliveryDaysMax?: number
}

export interface CountryWithStats extends Country {
  warehousesCount: number
  activeOrdersCount: number
  monthlyOrdersCount: number
  monthlyRevenue: number
}