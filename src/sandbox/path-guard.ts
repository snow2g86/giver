import fs from "node:fs";
import path from "node:path";
import { getConfig } from "../core/config.js";

export class PathGuard {
  private allowedPaths: string[];

  constructor() {
    this.allowedPaths = getConfig().allowedPaths.map((p) =>
      path.resolve(p)
    );
  }

  async validate(targetPath: string): Promise<string> {
    const resolved = path.resolve(targetPath);

    // Resolve symlinks to prevent escape
    let realPath: string;
    try {
      realPath = await fs.promises.realpath(resolved);
    } catch {
      // File doesn't exist yet - validate parent directory
      const parentDir = path.dirname(resolved);
      try {
        realPath = path.join(
          await fs.promises.realpath(parentDir),
          path.basename(resolved)
        );
      } catch {
        throw new Error(`Parent directory does not exist: ${parentDir}`);
      }
    }

    const isAllowed = this.allowedPaths.some(
      (allowed) =>
        realPath === allowed || realPath.startsWith(allowed + path.sep)
    );

    if (!isAllowed) {
      throw new Error(
        `Access denied: ${targetPath} is outside allowed paths. ` +
          `Allowed: ${this.allowedPaths.join(", ")}`
      );
    }

    return realPath;
  }
}
