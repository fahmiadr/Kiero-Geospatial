import { PrismaClient } from '@prisma/client';
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

export default prisma;