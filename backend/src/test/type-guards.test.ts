import { describe, it, expect } from "vitest";
import { isError, isAppError, isZodError, getErrorMessage } from "../utils/type-guards.js";
import { AppError } from "../middlewares/error-handler.js";

describe("Type Guards & Error Helpers", () => {
  it("correctly identifies standard Error instances", () => {
    const err = new Error("Standard error");
    expect(isError(err)).toBe(true);
    expect(isAppError(err)).toBe(false);
    expect(getErrorMessage(err)).toBe("Standard error");
  });

  it("correctly identifies AppError instances", () => {
    const appErr = new AppError("App error", 400);
    expect(isError(appErr)).toBe(true);
    expect(isAppError(appErr)).toBe(true);
    expect(appErr.statusCode).toBe(400);
    expect(getErrorMessage(appErr)).toBe("App error");
  });

  it("correctly identifies ZodError structures", () => {
    const zodErr = new Error("Validation failed");
    (zodErr as unknown as { issues: unknown[] }).issues = [
      { path: ["name"], message: "Required" },
    ];
    expect(isZodError(zodErr)).toBe(true);
  });

  it("handles string or fallback errors gracefully", () => {
    expect(getErrorMessage("String error")).toBe("String error");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
  });
});
