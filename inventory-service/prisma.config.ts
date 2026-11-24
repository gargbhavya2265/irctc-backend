
import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env["DATABASE_URL"];

const datasourceUrl = databaseUrl
  ? new URL(databaseUrl)
  : undefined;

if (datasourceUrl) {
  datasourceUrl.searchParams.set("schema", "inventory_service");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    ...(datasourceUrl
      ? { url: datasourceUrl.toString() }
      : {}),
    ...(process.env["SHADOW_DATABASE_URL"]
      ? { shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] }
      : {}),
  },
});
