/**
 * Capability Validator Tests (v2)
 * 
 * Tests the core v2 concept: unknown/disabled actions are blocked,
 * constraints are enforced, and prompt injection becomes irrelevant.
 */

import { CapabilityValidator, type ActionContext } from "../core/capability-validator";
import { DEFAULT_CONFIG, type SmithConfig } from "../smith.config";

describe("CapabilityValidator", () => {
  let validator: CapabilityValidator;

  beforeEach(() => {
    validator = new CapabilityValidator(DEFAULT_CONFIG);
  });

  describe("unknown capabilities", () => {
    it("blocks unknown actions", () => {
      const result = validator.validate({
        action: "evil_action_from_injection",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Unknown capability");
    });

    it("blocks made-up tool names from prompt injection", () => {
      const injectionAttempts = [
        "send_email",
        "exfiltrate_data",
        "sudo_rm_rf",
        "bypass_security",
        "steal_secrets",
      ];

      for (const action of injectionAttempts) {
        const result = validator.validate({ action });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Unknown capability");
      }
    });
  });

  describe("disabled capabilities", () => {
    it("blocks disabled capabilities", () => {
      const config: SmithConfig = {
        ...DEFAULT_CONFIG,
        capabilities: {
          dangerous_action: {
            enabled: false,
            description: "Disabled action",
          },
        },
      };
      const v = new CapabilityValidator(config);

      const result = v.validate({ action: "dangerous_action" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("disabled");
    });
  });

  describe("domain constraints", () => {
    it("blocks internal domains", () => {
      const result = validator.validate({
        action: "web_fetch",
        domain: "internal.company.local",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blocked");
    });

    it("blocks localhost", () => {
      const result = validator.validate({
        action: "web_fetch",
        domain: "localhost",
      });
      expect(result.allowed).toBe(false);
    });

    it("allows external domains", () => {
      const result = validator.validate({
        action: "web_fetch",
        domain: "api.github.com",
      });
      expect(result.allowed).toBe(true);
    });

    it("blocks .onion domains (global constraint)", () => {
      const result = validator.validate({
        action: "web_fetch",
        domain: "evil.onion",
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("path constraints", () => {
    it("blocks .env files", () => {
      const result = validator.validate({
        action: "file_read",
        path: "/app/.env",
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("blocked");
    });

    it("blocks secrets directory", () => {
      const result = validator.validate({
        action: "file_read",
        path: "/app/secrets/api_key.txt",
      });
      expect(result.allowed).toBe(false);
    });

    it("blocks private keys", () => {
      const result = validator.validate({
        action: "file_read",
        path: "/home/user/.ssh/id_rsa.pem",
      });
      expect(result.allowed).toBe(false);
    });

    it("allows normal files", () => {
      const result = validator.validate({
        action: "file_read",
        path: "/app/src/index.ts",
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("rate limiting", () => {
    it("enforces rate limits", () => {
      // web_search has rateLimit: 30 in default config
      const config: SmithConfig = {
        ...DEFAULT_CONFIG,
        capabilities: {
          test_action: {
            enabled: true,
            constraints: {
              rateLimit: 3, // Very low for testing
            },
          },
        },
      };
      const v = new CapabilityValidator(config);

      // First 3 should succeed
      expect(v.validate({ action: "test_action" }).allowed).toBe(true);
      expect(v.validate({ action: "test_action" }).allowed).toBe(true);
      expect(v.validate({ action: "test_action" }).allowed).toBe(true);

      // 4th should fail
      const result = v.validate({ action: "test_action" });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Rate limit");
    });
  });

  describe("payload size", () => {
    it("blocks oversized payloads", () => {
      const result = validator.validate({
        action: "file_read",
        path: "/app/huge.txt",
        payloadSize: 100 * 1024 * 1024, // 100MB, limit is 50MB
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("too large");
    });

    it("allows normal sized payloads", () => {
      const result = validator.validate({
        action: "file_read",
        path: "/app/normal.txt",
        payloadSize: 1024, // 1KB
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("confirmation requirements", () => {
    it("flags actions requiring confirmation", () => {
      const config: SmithConfig = {
        ...DEFAULT_CONFIG,
        capabilities: {
          dangerous_action: {
            enabled: true,
            constraints: {
              requireConfirmation: true,
            },
          },
        },
      };
      const v = new CapabilityValidator(config);

      const result = v.validate({ action: "dangerous_action" });
      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe("model scaling", () => {
    it("scales constraints for weak models", () => {
      const config: SmithConfig = {
        ...DEFAULT_CONFIG,
        capabilities: {
          test_action: {
            enabled: true,
            constraints: {
              rateLimit: 100,
              maxPayloadSize: 1000000,
            },
          },
        },
      };
      const v = new CapabilityValidator(config);
      v.scaleForModel("weak");

      // After scaling, rateLimit should be halved (50)
      const cap = v.getCapability("test_action");
      expect(cap?.constraints?.rateLimit).toBe(50);
      expect(cap?.constraints?.maxPayloadSize).toBe(500000);
    });
  });

  describe("custom validators", () => {
    it("runs custom validators", () => {
      const config: SmithConfig = {
        ...DEFAULT_CONFIG,
        capabilities: {
          custom_action: {
            enabled: true,
            constraints: {
              customValidator: "myValidator",
            },
          },
        },
      };
      const v = new CapabilityValidator(config);

      v.registerCustomValidator("myValidator", (ctx) => {
        if (ctx.args === "bad") {
          return { allowed: false, reason: "Custom: bad args" };
        }
        return { allowed: true };
      });

      expect(v.validate({ action: "custom_action", args: "good" }).allowed).toBe(true);
      expect(v.validate({ action: "custom_action", args: "bad" }).allowed).toBe(false);
    });
  });
});
