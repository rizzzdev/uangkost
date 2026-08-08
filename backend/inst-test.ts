import { prisma } from "./src/config/prisma.js";
import { getAllInstallments } from "./src/modules/finance/installment.service.js";

(async () => {
  try {
    const rows = await getAllInstallments();
    console.log("OK rows:", rows.length);
  } catch (err) {
    console.log("ERROR:", (err as Error).message);
    console.log((err as Error).stack?.split("\n").slice(0, 6).join("\n"));
  } finally {
    await prisma.$disconnect();
  }
})();
