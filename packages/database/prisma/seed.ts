import { PrismaClient, AdminRole, OrderStatus, TransactionType, TransactionStatus, PaymentMethod } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seeding...')

  // Очистка существующих данных
  await prisma.orderStatusHistory.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.chatMessage.deleteMany()
  await prisma.supportChat.deleteMany()
  await prisma.adminLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.shippingOrder.deleteMany()
  await prisma.purchaseOrder.deleteMany