import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(import.meta.dirname ?? ".", ".env") });

const dbUrl = process.env.DATABASE_URL;

console.log("DATABASE_URL:", dbUrl ? "SET" : "NOT SET");

export default defineConfig({
  datasource: {
    url: dbUrl ?? "",
  },
});
