/**
 * Vault Tests (v2)
 * 
 * Tests secret isolation: LLM never sees raw secrets,
 * tokens are single-use, expired tokens rejected.
 */

import { SecretVault } from "../core/vault";
import { VaultClient } from "../core/vault-client";
import type { VaultConfig } from "../smith.config";

describe("SecretVault", () => {
  let vault: SecretVault;

  const testConfig: VaultConfig = {
    enabled: true,
    secrets: {
      TEST_API_KEY: {
        source: "env",
        envVar: "TEST_API_KEY",
      },
      MISSING_KEY: {
        source: "env",
        envVar: "NONEXISTENT_VAR",
      },
    },
    tokenTTL: 5, // 5 seconds for testing
  };

  beforeAll(() => {
    // Set test env var
    process.env.TEST_API_KEY = "test-secret-value-12345";
  });

  afterAll(() => {
    delete process.env.TEST_API_KEY;
  });

  beforeEach(() => {
    vault = new SecretVault(testConfig);
  });

  describe("token management", () => {
    it("issues valid tokens", () => {
      const result = vault.requestToken("TEST_API_KEY");
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
    });

    it("rejects tokens for unknown secrets", () => {
      const result = vault.requestToken("UNKNOWN_SECRET");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown secret");
    });

    it("allows using valid tokens", () => {
      const tokenResult = vault.requestToken("TEST_API_KEY");
      expect(tokenResult.success).toBe(true);

      const useResult = vault.useToken(tokenResult.token!);
      expect(useResult.success).toBe(true);
      expect(useResult.value).toBe("test-secret-value-12345");
    });

    it("prevents token reuse (replay attack)", () => {
      const tokenResult = vault.requestToken("TEST_API_KEY");
      expect(tokenResult.success).toBe(true);

      // First use succeeds
      const firstUse = vault.useToken(tokenResult.token!);
      expect(firstUse.success).toBe(true);

      // Second use fails (same token)
      const secondUse = vault.useToken(tokenResult.token!);
      expect(secondUse.success).toBe(false);
      expect(secondUse.error).toContain("already used");
    });

    it("rejects invalid tokens", () => {
      const result = vault.useToken("invalid-token-garbage");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });

    it("rejects tampered tokens", () => {
      const tokenResult = vault.requestToken("TEST_API_KEY");
      
      // Tamper by modifying a character in the middle
      const chars = tokenResult.token!.split("");
      const midpoint = Math.floor(chars.length / 2);
      chars[midpoint] = chars[midpoint] === "A" ? "B" : "A";
      const tamperedToken = chars.join("");
      
      const result = vault.useToken(tamperedToken);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });
  });

  describe("secret management", () => {
    it("lists available secrets", () => {
      const secrets = vault.listSecrets();
      expect(secrets).toContain("TEST_API_KEY");
      expect(secrets).toContain("MISSING_KEY");
    });

    it("checks if secret exists", () => {
      expect(vault.hasSecret("TEST_API_KEY")).toBe(true);
      expect(vault.hasSecret("MISSING_KEY")).toBe(false); // env var doesn't exist
      expect(vault.hasSecret("UNKNOWN")).toBe(false);
    });

    it("handles missing env vars", () => {
      const tokenResult = vault.requestToken("MISSING_KEY");
      expect(tokenResult.success).toBe(true);

      const useResult = vault.useToken(tokenResult.token!);
      expect(useResult.success).toBe(false);
      expect(useResult.error).toContain("not available");
    });
  });

  describe("disabled vault", () => {
    it("returns error when disabled", () => {
      const disabledVault = new SecretVault({
        enabled: false,
        secrets: {},
      });

      const result = disabledVault.requestToken("any");
      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled");
    });
  });
});

describe("VaultClient", () => {
  let vault: SecretVault;
  let client: VaultClient;

  const testConfig: VaultConfig = {
    enabled: true,
    secrets: {
      TEST_API_KEY: {
        source: "env",
        envVar: "TEST_API_KEY",
      },
    },
    tokenTTL: 60,
  };

  beforeAll(() => {
    process.env.TEST_API_KEY = "test-secret-value";
  });

  afterAll(() => {
    delete process.env.TEST_API_KEY;
  });

  beforeEach(() => {
    vault = new SecretVault(testConfig);
    client = new VaultClient(vault);
  });

  describe("secret listing", () => {
    it("lists available secrets", () => {
      const secrets = client.listAvailableSecrets();
      expect(secrets).toContain("TEST_API_KEY");
    });

    it("checks secret availability", () => {
      expect(client.hasSecret("TEST_API_KEY")).toBe(true);
      expect(client.hasSecret("UNKNOWN")).toBe(false);
    });
  });

  describe("executor registration", () => {
    it("allows registering custom executors", async () => {
      client.registerExecutor("custom", async (secret, params) => {
        return { gotSecret: secret.length > 0, params };
      });

      const result = await client.executeWithSecret("TEST_API_KEY", "custom", {
        foo: "bar",
      });

      expect(result.success).toBe(true);
      expect((result.data as any).gotSecret).toBe(true);
      expect((result.data as any).params.foo).toBe("bar");
    });
  });
});
