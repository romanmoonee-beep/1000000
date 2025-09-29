import { PrismaClient } from '@cargo/database'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'
import { Country, CountryWithStats } from '@cargo/shared'

export class CountryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {}

  /**
   * Получить все активные страны
   */
  async getActiveCountries(): Promise<Country[]> {
    // Проверяем кэш
    const cached = await this.redis.get<Country[]>(REDIS_KEYS.COUNTRY_LIST)
    if (cached) {
      return cached
    }

    const countries = await this.prisma.country.findMany({
      where: { isActive: true },
      orderBy: [
        { popularityScore: 'desc' },
        { name: 'asc' }
      ]
    })

    // Кэшируем на час
    await this.redis.setWithTTL(REDIS_KEYS.COUNTRY_LIST, countries, TTL.LONG)

    return countries
  }

  /**
   * Получить страны доступные для доставки
   */
  async getShippingCountries(): Promise<Country[]> {
    const countries = await this.getActiveCountries()
    return countries.filter(country => country.shippingAvailable)
  }

  /**
   * Получить страны доступные для выкупа
   */
  async getPurchaseCountries(): Promise<Country[]> {
    const countries = await this.getActiveCountries()
    return countries.filter(country => country.purchaseAvailable)
  }

  /**
   * Получить страну по ID
   */
  async getCountryById(countryId: number): Promise<Country | null> {
    const countries = await this.getActiveCountries()
    return countries.find(country => country.id === countryId) || null
  }

  /**
   * Получить страну по коду
   */
  async getCountryByCode(code: string): Promise<Country | null> {
    const countries = await this.getActiveCountries()
    return countries.find(country => country.code === code) || null
  }

  /**
   * Получить склады страны
   */
  async getCountryWarehouses(countryId: number): Promise<any[]> {
    // Проверяем кэш
    const cacheKey = REDIS_KEYS.WAREHOUSE_LIST(countryId)
    const cached = await this.redis.get(cacheKey)
    if (cached) {
      return cached
    }

    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        countryId,
        isActive: true
      },
      include: {
        country: true
      },
      orderBy: { name: 'asc' }
    })

    // Кэшируем на 30 минут
    await this.redis.setWithTTL(cacheKey, warehouses, TTL.MEDIUM)

    return warehouses
  }

  /**
   * Получить тарифы доставки для страны
   */
  async getShippingTariff(countryFromId: number, countryToId?: number): Promise<any | null> {
    // По умолчанию доставка в Россию
    const toCountryId = countryToId || (await this.getCountryByCode('RUS'))?.id

    if (!toCountryId) {
      return null
    }

    const tariff = await this.prisma.shippingTariff.findFirst({
      where: {
        countryFromId,
        countryToId: toCountryId,
        isActive: true
      },
      include: {
        countryFrom: true
      }
    })

    return tariff
  }

  /**
   * Рассчитать стоимость доставки
   */
  async calculateShippingCost(
    countryFromId: number,
    weight: number,
    countryToId?: number
  ): Promise<{
    cost: number
    pricePerKg: number
    minPrice: number
    deliveryDays?: { min: number; max: number }
  } | null> {
    const tariff = await this.getShippingTariff(countryFromId, countryToId)
    
    if (!tariff) {
      return null
    }

    const baseCost = weight * tariff.pricePerKg
    const finalCost = Math.max(baseCost, tariff.minPrice)

    return {
      cost: finalCost,
      pricePerKg: tariff.pricePerKg,
      minPrice: tariff.minPrice,
      deliveryDays: tariff.deliveryDaysMin && tariff.deliveryDaysMax 
        ? { min: tariff.deliveryDaysMin, max: tariff.deliveryDaysMax }
        : undefined
    }
  }

  /**
   * Получить популярные страны для отправки
   */
  async getPopularShippingCountries(limit: number = 6): Promise<Country[]> {
    const countries = await this.getShippingCountries()
    return countries
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)
  }

  /**
   * Получить популярные страны для выкупа
   */
  async getPopularPurchaseCountries(limit: number = 6): Promise<Country[]> {
    const countries = await this.getPurchaseCountries()
    return countries
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, limit)
  }

  /**
   * Получить товары с фиксированной ценой для страны
   */
  async getFixedPriceProducts(
    countryId: number,
    categoryId?: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    products: any[]
    total: number
    categories: any[]
  }> {
    const whereClause: any = {
      countryId,
      isActive: true
    }

    if (categoryId) {
      whereClause.categoryId = categoryId
    }

    const [products, total, categories] = await Promise.all([
      this.prisma.fixedPriceProduct.findMany({
        where: whereClause,
        include: {
          category: true,
          country: true
        },
        orderBy: [
          { isPopular: 'desc' },
          { name: 'asc' }
        ],
        take: limit,
        skip: offset
      }),
      this.prisma.fixedPriceProduct.count({
        where: whereClause
      }),
      this.prisma.productCategory.findMany({
        where: {
          fixedPriceProducts: {
            some: {
              countryId,
              isActive: true
            }
          }
        },
        include: {
          _count: {
            select: {
              fixedPriceProducts: {
                where: {
                  countryId,
                  isActive: true
                }
              }
            }
          }
        },
        orderBy: { sortOrder: 'asc' }
      })
    ])

    return {
      products,
      total,
      categories
    }
  }

  /**
   * Поиск товаров с фиксированной ценой
   */
  async searchFixedPriceProducts(
    countryId: number,
    query: string,
    limit: number = 10
  ): Promise<any[]> {
    return await this.prisma.fixedPriceProduct.findMany({
      where: {
        countryId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        category: true,
        country: true
      },
      orderBy: [
        { isPopular: 'desc' },
        { name: 'asc' }
      ],
      take: limit
    })
  }

  /**
   * Получить товар с фиксированной ценой по ID
   */
  async getFixedPriceProduct(productId: number): Promise<any | null> {
    return await this.prisma.fixedPriceProduct.findUnique({
      where: { 
        id: productId,
        isActive: true
      },
      include: {
        category: true,
        country: true
      }
    })
  }

  /**
   * Получить популярные товары страны
   */
  async getPopularProducts(countryId: number, limit: number = 10): Promise<any[]> {
    return await this.prisma.fixedPriceProduct.findMany({
      where: {
        countryId,
        isActive: true,
        isPopular: true
      },
      include: {
        category: true,
        country: true
      },
      orderBy: { name: 'asc' },
      take: limit
    })
  }

  /**
   * Получить все города России
   */
  async getRussianCities(popularOnly: boolean = false): Promise<any[]> {
    const whereClause: any = {
      countryCode: 'RUS',
      isActive: true
    }

    if (popularOnly) {
      whereClause.isPopular = true
    }

    return await this.prisma.city.findMany({
      where: whereClause,
      orderBy: [
        { isPopular: 'desc' },
        { population: 'desc' },
        { name: 'asc' }
      ]
    })
  }

  /**
   * Поиск городов
   */
  async searchCities(query: string, limit: number = 10): Promise<any[]> {
    return await this.prisma.city.findMany({
      where: {
        countryCode: 'RUS',
        isActive: true,
        name: {
          contains: query,
          mode: 'insensitive'
        }
      },
      orderBy: [
        { isPopular: 'desc' },
        { population: 'desc' },
        { name: 'asc' }
      ],
      take: limit
    })
  }

  /**
   * Получить город по ID
   */
  async getCityById(cityId: number): Promise<any | null> {
    return await this.prisma.city.findUnique({
      where: { id: cityId }
    })
  }

  /**
   * Получить статистику по странам
   */
  async getCountriesStats(): Promise<CountryWithStats[]> {
    const countries = await this.prisma.country.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            warehouses: { where: { isActive: true } },
            shippingOrders: true,
            purchaseOrders: true,
            fixedPriceProducts: { where: { isActive: true } }
          }
        }
      }
    })

    // Получаем статистику за месяц
    const monthAgo = new Date()
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const countriesWithStats = await Promise.all(
      countries.map(async (country) => {
        const [monthlyShipping, monthlyPurchase] = await Promise.all([
          this.prisma.shippingOrder.aggregate({
            where: {
              countryFromId: country.id,
              createdAt: { gte: monthAgo }
            },
            _sum: { totalCost: true },
            _count: { id: true }
          }),
          this.prisma.purchaseOrder.aggregate({
            where: {
              countryId: country.id,
              createdAt: { gte: monthAgo }
            },
            _sum: { totalCost: true },
            _count: { id: true }
          })
        ])

        return {
          ...country,
          monthlyRevenue: (monthlyShipping._sum.totalCost || 0) + (monthlyPurchase._sum.totalCost || 0),
          monthlyOrders: (monthlyShipping._count.id || 0) + (monthlyPurchase._count.id || 0),
          warehousesCount: country._count.warehouses,
          activeOrdersCount: country._count.shippingOrders + country._count.purchaseOrders
        }
      })
    )

    return countriesWithStats
  }

  /**
   * Очистить кэш стран
   */
  async clearCache(): Promise<void> {
    await this.redis.del(REDIS_KEYS.COUNTRY_LIST)
    
    // Очищаем кэш складов для всех стран
    const countries = await this.prisma.country.findMany({
      select: { id: true }
    })

    for (const country of countries) {
      await this.redis.del(REDIS_KEYS.WAREHOUSE_LIST(country.id))
    }
  }

  /**
   * Обновить популярность страны
   */
  async updatePopularity(countryId: number, score: number): Promise<void> {
    await this.prisma.country.update({
      where: { id: countryId },
      data: { popularityScore: score }
    })

    // Очищаем кэш
    await this.clearCache()
  }
}