import { describe, expect, it } from "vitest";
import { runtimeCheck } from "../checks/runtime-check.js";

describe("runtimeCheck", () => {
  it("fails unsupported Node.js versions", () => {
    const result = runtimeCheck("18.20.4");

    expect(result.status).toBe("fail");
    expect(result.message).toContain("requires Node.js 20+");
  });

  it("passes supported LTS Node.js versions", () => {
    const result = runtimeCheck("22.14.0");

    expect(result.status).toBe("pass");
    expect(result.message).toContain("22.14.0");
  });

  it("warns on non-LTS Node.js versions", () => {
    const result = runtimeCheck("25.5.0");

    expect(result.status).toBe("warn");
    expect(result.message).toContain("recommended targets");
  });

  it("warns when the version string is not parseable", () => {
    const result = runtimeCheck("mystery");

    expect(result.status).toBe("warn");
    expect(result.message).toContain("Could not determine");
  });
});
