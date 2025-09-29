import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    errorFormat: 'pretty',
  })

// Подключение middleware для логирования
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `Query ${params.model}.${params.action} took ${after - before}ms`
    )
  }
  
  return result
})

// Подключение middleware для обработки bigint
prisma.$use(async (params, next) => {
  const result = await next(params)
  
  // Преобразование BigInt в строки для JSON сериализации
  if (result && typeof result === 'object') {
    const convertBigInt = (obj: any): any => {
      if (obj === null || obj === undefined) return obj
      
      if (typeof obj === 'bigint') {
        return obj.toString()
      }
      
      if (Array.isArray(obj)) {
        return obj.map(convertBigInt)
      }
      
      if (typeof obj === 'object') {
        const converted: any = {}
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertBigInt(value)
        }
        return converted
      }
      
      return obj
    }
    
    return convertBigInt(result)
  }
  
  return result
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Closing database connection...')
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)