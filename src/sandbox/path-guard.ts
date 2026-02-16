import fs from "node:fs";
import path from "node:path";
import { getConfig, loadConfig, saveConfig } from "../core/config.js";
import type { PermissionPrompter } from "../core/types.js";

export class PathGuard {
  private static instance: PathGuard | null = null;

  private allowedPaths: string[];
  private sessionPaths: string[] = [];
  private prompter: PermissionPrompter | null = null;

  constructor() {
    this.allowedPaths = getConfig().allowedPaths.map((p) =>
      path.resolve(p)
    );
  }

  static getInstance(): PathGuard {
    if (!PathGuard.instance) {
      PathGuard.instance = new PathGuard();
    }
    return PathGuard.instance;
  }

  setPrompter(prompter: PermissionPrompter): void {
    this.prompter = prompter;
  }

  addSessionPath(targetPath: string): void {
    const resolved = path.resolve(targetPath);
    if (!this.sessionPaths.includes(resolved)) {
      this.sessionPaths.push(resolved);
    }
  }

  clearSessionPaths(): void {
    this.sessionPaths = [];
  }

  addPermanentPath(targetPath: string): void {
    const resolved = path.resolve(targetPath);
    const config = loadConfig();
    if (!config.allowedPaths.includes(resolved)) {
      config.allowedPaths.push(resolved);
      saveConfig(config);
      this.allowedPaths.push(resolved);
    }
  }

  private isPathAllowed(realPath: string): boolean {
    const allPaths = [...this.allowedPaths, ...this.sessionPaths];
    return allPaths.some(
      (allowed) =>
        realPath === allowed || realPath.startsWith(allowed + path.sep)
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

    if (this.isPathAllowed(realPath)) {
      return realPath;
    }

    // Prompter가 설정되어 있으면 사용자에게 승인 요청
    if (this.prompter) {
      const grant = await this.prompter.requestApproval(resolved);

      if (grant.granted) {
        // 접근 허용할 상위 디렉토리 결정 (파일이면 부모 디렉토리)
        let grantPath: string;
        try {
          const stat = await fs.promises.stat(resolved);
          grantPath = stat.isDirectory() ? resolved : path.dirname(resolved);
        } catch {
          // 파일이 아직 없으면 부모 디렉토리
          grantPath = path.dirname(resolved);
        }

        if (grant.persistent) {
          this.addPermanentPath(grantPath);
        } else {
          this.addSessionPath(grantPath);
        }
        return realPath;
      }
    }

    throw new Error(
      `Access denied: ${targetPath} is outside allowed paths. ` +
        `Allowed: ${[...this.allowedPaths, ...this.sessionPaths].join(", ")}`
    );
  }
}
