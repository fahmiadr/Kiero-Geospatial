import { PrismaClient } from '@prisma/client';

/**
 * @constant {object} globalForPrisma
 * Objek global yang digunakan untuk menyimpan instance Prisma Client.
 * Ini adalah solusi untuk mencegah pembuatan beberapa instance Prisma Client
 * selama hot-reloading di lingkungan pengembangan. Di produksi, pola ini
 * memastikan bahwa satu instance digunakan sepanjang siklus hidup aplikasi.
 * @see {@link https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices}
 */
const globalForPrisma = global;

/**
 * @constant {PrismaClient} prisma
 * Instance tunggal (singleton) dari Prisma Client.
 * Instance ini diambil dari objek global (dalam pengembangan) atau instance baru
 * dibuat. Ini memastikan adanya satu connection pool yang persisten.
 */
const prisma = globalForPrisma.prisma || new PrismaClient();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;