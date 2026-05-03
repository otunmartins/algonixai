import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL!

function makePrisma() {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof makePrisma> | undefined
}

// Reuse client across hot-reloads in development
export const prisma = globalThis.__prisma ?? makePrisma()
if (process.env.NODE_ENV !== 'production') globalThis.__prisma = prisma
