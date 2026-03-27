import { describe, it, expect, beforeAll } from "vitest";

describe("Crypto", () => {
  beforeAll(() => {
    // Set test encryption key
    process.env.AGENT_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  it("encrypts and decrypts correctly", async () => {
    const { encrypt, decrypt } = await import("@/lib/agents/crypto");
    const original = "sk-test-api-key-12345";
    const { encrypted, iv } = encrypt(original);
    const decrypted = decrypt(encrypted, iv);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext for same input", async () => {
    const { encrypt } = await import("@/lib/agents/crypto");
    const input = "same-key";
    const result1 = encrypt(input);
    const result2 = encrypt(input);
    expect(result1.encrypted).not.toBe(result2.encrypted);
  });
});
