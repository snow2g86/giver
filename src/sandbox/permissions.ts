import { getConfig } from "../core/config.js";

export class Permissions {
  private blockedCommands: string[];

  constructor() {
    this.blockedCommands = getConfig().blockedCommands;
  }

  validateCommand(command: string): void {
    const normalized = command.toLowerCase().trim();

    for (const blocked of this.blockedCommands) {
      if (normalized.includes(blocked.toLowerCase())) {
        throw new Error(
          `Command blocked: "${command}" contains prohibited pattern "${blocked}"`
        );
      }
    }
  }

  getAllowedPaths(): string[] {
    return getConfig().allowedPaths;
  }
}
