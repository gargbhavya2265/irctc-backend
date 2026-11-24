
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

const datasourceUrl = new URL(databaseUrl);
datasourceUrl.searchParams.set("schema", "inventory_service");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl.toString(),
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});