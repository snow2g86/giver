import type { Tool } from "./base.js";

// Lazy-load playwright to avoid import errors when not installed
async function getPlaywright() {
  try {
    const pw = await import("playwright");
    return pw;
  } catch {
    throw new Error(
      "Playwright is not available. Run: npx playwright install chromium"
    );
  }
}

let browserInstance: Awaited<
  ReturnType<typeof import("playwright")["chromium"]["launch"]>
> | null = null;
let pageInstance: Awaited<
  ReturnType<typeof import("playwright")["chromium"]["launch"]>
>["contexts"] extends any
  ? any
  : never;

async function getBrowser() {
  if (!browserInstance) {
    const pw = await getPlaywright();
    browserInstance = await pw.chromium.launch({ headless: true });
  }
  return browserInstance;
}

async function getPage() {
  if (!pageInstance || pageInstance.isClosed?.()) {
    const browser = await getBrowser();
    const context = await browser.newContext();
    pageInstance = await context.newPage();
  }
  return pageInstance;
}

export const browseUrlTool: Tool = {
  name: "browse_url",
  description:
    "Open a URL in a headless browser and return the page's text content. Useful for reading web pages.",
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description: "The URL to browse",
      },
    },
    required: ["url"],
  },
  async execute(input) {
    const url = input.url as string;
    const page = await getPage();

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      const title = await page.title();
      const text = await page.evaluate(() => {
        // Remove script/style elements
        document
          .querySelectorAll("script, style, noscript")
          .forEach((el) => el.remove());
        return document.body?.innerText || "";
      });

      // Truncate to reasonable size
      const truncated =
        text.length > 10_000
          ? text.slice(0, 10_000) + "\n...(truncated)"
          : text;

      return `Title: ${title}\nURL: ${url}\n\n${truncated}`;
    } catch (err) {
      return `Failed to browse ${url}: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

export const browserActionTool: Tool = {
  name: "browser_action",
  description:
    "Perform an action in the browser: click, type, screenshot, or evaluate JavaScript.",
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["click", "type", "screenshot", "evaluate"],
        description: "The action to perform",
      },
      selector: {
        type: "string",
        description: "CSS selector for click/type actions",
      },
      text: {
        type: "string",
        description: "Text to type (for 'type' action)",
      },
      script: {
        type: "string",
        description: "JavaScript to evaluate (for 'evaluate' action)",
      },
    },
    required: ["action"],
  },
  async execute(input) {
    const page = await getPage();
    const action = input.action as string;

    switch (action) {
      case "click": {
        if (!input.selector)
          return "Error: selector required for click action";
        await page.click(input.selector as string, { timeout: 5000 });
        return `Clicked: ${input.selector}`;
      }
      case "type": {
        if (!input.selector || !input.text)
          return "Error: selector and text required for type action";
        await page.fill(input.selector as string, input.text as string);
        return `Typed into ${input.selector}: ${input.text}`;
      }
      case "screenshot": {
        const buffer = await page.screenshot({ fullPage: false });
        const base64 = buffer.toString("base64");
        return `Screenshot taken (${buffer.length} bytes, base64 encoded). First 200 chars: ${base64.slice(0, 200)}...`;
      }
      case "evaluate": {
        if (!input.script)
          return "Error: script required for evaluate action";
        const result = await page.evaluate(input.script as string);
        return `Result: ${JSON.stringify(result)}`;
      }
      default:
        return `Unknown action: ${action}`;
    }
  },
};

// Cleanup function
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;
  }
}
