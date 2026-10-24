/*
    “It sets up and manages the Prisma client, which is used by the application to communicate with the PostgreSQL database.”

     In simple words: Creates the database connection/client using Prisma.
*/

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { config } = require('./');
const connectionString = config.DATABASE_URL;

const globalForPrisma = global;

if (!globalForPrisma.prisma) {
     const adapter = new PrismaPg({ connectionString });

     globalForPrisma.prisma = new PrismaClient({
          adapter,
          log: ['error', 'warn'],
     });
}

const prisma = globalForPrisma.prisma;

module.exports = prisma;
