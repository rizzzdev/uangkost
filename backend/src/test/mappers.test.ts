import { describe, it, expect } from "vitest";
import { toTenantResponse, toInstallmentResponse, toTransactionResponse } from "../utils/mappers.js";
import { Prisma } from "@prisma/client";

describe("DTO Mappers", () => {
  it("maps User model to TenantResponse DTO accurately", () => {
    const user = {
      id: "usr_123",
      role: "tenant" as const,
      name: "Budi Santoso",
      phone: "081234567890",
      password: null,
      roomNumber: "101",
      accessTokenHash: "hash123",
      accessTokenExpiresAt: new Date("2026-12-31T00:00:00.000Z"),
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    };

    const res = toTenantResponse(user);
    expect(res.id).toBe("usr_123");
    expect(res.name).toBe("Budi Santoso");
    expect(res.phone).toBe("081234567890");
    expect(res.roomNumber).toBe("101");
    expect(res.accessTokenExpiresAt).toBe("2026-12-31T00:00:00.000Z");
  });

  it("maps Installment model to InstallmentResponse DTO accurately", () => {
    const inst = {
      id: "inst_1",
      transactionId: "tx_1",
      amount: new Prisma.Decimal(500000),
      paymentProofUrl: "/uploads/proof.jpg",
      isVerified: true,
      verifiedAt: new Date("2026-08-01T10:00:00.000Z"),
      rejectedAt: null,
      description: "Cicilan ke-1",
      createdAt: new Date("2026-08-01T09:00:00.000Z"),
      updatedAt: new Date("2026-08-01T10:00:00.000Z"),
      deletedAt: null,
    };

    const res = toInstallmentResponse(inst);
    expect(res.id).toBe("inst_1");
    expect(res.amount).toBe("500000");
    expect(res.isVerified).toBe(true);
    expect(res.verifiedAt).toBe("2026-08-01T10:00:00.000Z");
  });

  it("maps Transaction model to TransactionResponse DTO accurately", () => {
    const tx = {
      id: "tx_100",
      userId: "usr_123",
      type: "income" as const,
      amount: new Prisma.Decimal(1500000),
      totalPaid: new Prisma.Decimal(500000),
      billingMonth: "Agustus 2026",
      status: "partial" as const,
      category: "Sewa Kost",
      description: "Tagihan Agustus",
      transactionDate: new Date("2026-08-01"),
      paymentProofUrl: null,
      isVerified: false,
      waNotifiedAt: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      deletedAt: null,
      user: { name: "Budi Santoso", roomNumber: "101" },
      installments: [],
    };

    const res = toTransactionResponse(tx);
    expect(res.id).toBe("tx_100");
    expect(res.amount).toBe("1500000");
    expect(res.totalPaid).toBe("500000");
    expect(res.status).toBe("partial");
    expect(res.user?.name).toBe("Budi Santoso");
  });
});
