import { PrismaClient } from "@prisma/client";

// Prisma CLI setup already uses this local SQLite database. Next.js runs in a
// separate process, so give the application runtime the same safe local
// default when DATABASE_URL is not explicitly configured.
process.env.DATABASE_URL ||= "file:./dev.db";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function getDb() {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}
