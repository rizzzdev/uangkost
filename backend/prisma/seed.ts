import { auth } from "../src/config/auth.js";
import { prisma } from "../src/config/prisma.js";

async function seed(): Promise<void> {
  console.log("🌱 Seeding database...");

  // Ensure Sentri tables exist
  console.log("📋 Running Sentri migrations...");
  await auth.migrate();
  console.log("✅ Sentri migrations complete");

  // Try creating Sentri admin (may already exist)
  try {
    await auth.register({
      identifiers: [{ type: "username", value: "admin" }],
      password: "admin1234",
      roles: ["admin"],
    });
    console.log("✅ Sentri admin registered");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`⚠️  Sentri: ${message}`);
  }

  // Find Sentri admin user ID via identifiers table
  const rows = await prisma.$queryRawUnsafe<Array<{ user_id: string }>>(
    `SELECT user_id FROM sentri_identifiers WHERE value = 'admin' AND type = 'username' LIMIT 1`
  );

  const sentriUserId = rows[0]?.user_id ?? null;

  if (!sentriUserId) {
    console.error("❌ Cannot find Sentri admin user ID");
    process.exit(1);
  }

  console.log(`   Sentri admin ID: ${sentriUserId}`);

  // Ensure admin exists in Prisma users table (required by requireAdmin middleware)
  const existing = await prisma.user.findFirst({
    where: { id: sentriUserId, deletedAt: null },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        id: sentriUserId,
        role: "admin",
        name: "Admin",
        phone: "-",
        isActive: true,
      },
    });
    console.log("✅ Prisma admin created");
  } else {
    console.log("⚠️  Prisma admin already exists, skipping...");
  }

  console.log("   Username: admin");
  console.log("   Password: admin1234");
  console.log("✨ Seed complete");
}

await seed();
process.exit(0);
