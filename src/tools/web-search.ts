import type { Tool } from "./base.js";

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8080";

interface SearxngResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  score?: number;
}

interface SearxngResponse {
  query: string;
  results: SearxngResult[];
  number_of_results: number;
}

export const webSearchTool: Tool = {
  name: "web_search",
  description:
    "Search the web using the local SearXNG search engine. Returns titles, URLs, and snippets from multiple search engines. Requires SearXNG running locally (docker compose up -d).",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return (default: 5, max: 20)",
      },
    },
    required: ["query"],
  },
  async execute(input) {
    const query = input.query as string;
    const maxResults = Math.min((input.max_results as number) || 5, 20);

    try {
      const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        return `SearXNG returned status ${response.status}. Is SearXNG running? (docker compose up -d)`;
      }

      const data = (await response.json()) as SearxngResponse;
      const results = data.results.slice(0, maxResults);

      if (results.length === 0) {
        return `No results found for: "${query}"`;
      }

      const formatted = results.map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content || "(no snippet)"}`,
      );

      return `Search results for "${query}" (${data.number_of_results} total):\n\n${formatted.join("\n\n")}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
        return [
          "SearXNG is not running. To fix:",
          "  1. Install Docker: https://docker.com/products/docker-desktop",
          "  2. Run: docker compose -f data/searxng/docker-compose.yml up -d",
          "  Or re-run Giver setup to auto-configure.",
        ].join("\n");
      }
      return `Search error: ${msg}`;
    }
  },
};
