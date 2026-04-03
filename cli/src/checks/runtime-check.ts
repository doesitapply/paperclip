import type { CheckResult } from "./index.js";

const MIN_NODE_MAJOR = 20;
const RECOMMENDED_LTS_MAJORS = new Set([20, 22, 24]);

export function runtimeCheck(version = process.versions.node): CheckResult {
  const parsed = parseMajorVersion(version);
  if (parsed === null) {
    return {
      name: "Node.js runtime",
      status: "warn",
      message: `Could not determine Node.js version from "${version}"`,
      canRepair: false,
      repairHint: "Use an active LTS release such as Node.js 20, 22, or 24",
    };
  }

  if (parsed < MIN_NODE_MAJOR) {
    return {
      name: "Node.js runtime",
      status: "fail",
      message: `Node.js ${version} detected; Paperclip requires Node.js ${MIN_NODE_MAJOR}+`,
      canRepair: false,
      repairHint: "Upgrade Node.js to an active LTS release such as 20, 22, or 24",
    };
  }

  if (!RECOMMENDED_LTS_MAJORS.has(parsed)) {
    return {
      name: "Node.js runtime",
      status: "warn",
      message: `Node.js ${version} detected; active LTS releases (20, 22, 24) are the recommended targets`,
      canRepair: false,
      repairHint: "Switch to Node.js 20, 22, or 24 if you hit install or runtime issues",
    };
  }

  return {
    name: "Node.js runtime",
    status: "pass",
    message: `Node.js ${version} detected`,
  };
}

function parseMajorVersion(version: string): number | null {
  const match = version.match(/^v?(\d+)/);
  if (!match) return null;

  const major = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(major) ? major : null;
}
