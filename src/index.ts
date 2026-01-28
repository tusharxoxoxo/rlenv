import { initDb, cacheIssues, getIssuesByRepo, getRepoIssueCount } from "./db";
import { fetchAllOpenIssues } from "./github";
import { analyzeIssues } from "./gemini";

// Initialize database on startup
initDb();

const PORT = 3000;

interface FetchRequest {
    repo: string;
}

interface AnalyzeRequest {
    repo: string;
    prompt: string;
}

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function errorResponse(message: string, status = 400): Response {
    return jsonResponse({ error: message }, status);
}

async function handleFetch(req: Request): Promise<Response> {
    try {
        const body = (await req.json()) as FetchRequest;

        if (!body.repo || typeof body.repo !== "string") {
            return errorResponse("Missing or invalid 'repo' field. Expected format: 'owner/repository-name'");
        }

        // Validate repo format
        const repoParts = body.repo.split("/");
        if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
            return errorResponse("Invalid repo format. Expected: 'owner/repository-name'");
        }

        console.log(`Fetching issues for ${body.repo}...`);
        const issues = await fetchAllOpenIssues(body.repo);
        console.log(`Fetched ${issues.length} issues`);

        const cachedCount = cacheIssues(body.repo, issues);
        console.log(`Cached ${cachedCount} issues`);

        return jsonResponse({
            repo: body.repo,
            issues_fetched: cachedCount,
            cached_successfully: true,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Fetch error:", message);
        return errorResponse(message, 500);
    }
}

async function handleAnalyze(req: Request): Promise<Response> {
    try {
        const body = (await req.json()) as AnalyzeRequest;

        if (!body.repo || typeof body.repo !== "string") {
            return errorResponse("Missing or invalid 'repo' field");
        }

        if (!body.prompt || typeof body.prompt !== "string") {
            return errorResponse("Missing or invalid 'prompt' field");
        }

        const issues = getIssuesByRepo(body.repo);

        if (issues.length === 0) {
            const count = getRepoIssueCount(body.repo);
            if (count === 0) {
                return errorResponse(
                    `Repository '${body.repo}' has not been scanned yet. Use POST /fetch first.`,
                    404
                );
            }
        }

        console.log(`Analyzing ${issues.length} issues for ${body.repo}...`);
        const analysis = await analyzeIssues(body.prompt, issues);
        console.log("Analysis complete");

        return jsonResponse({ analysis });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Analyze error:", message);

        if (message.includes("GEMINI_API_KEY")) {
            return errorResponse(message, 500);
        }
        if (message.includes("Gemini API error")) {
            return errorResponse(`LLM analysis failed: ${message}`, 500);
        }

        return errorResponse(message, 500);
    }
}

const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;
        const method = req.method;

        // Health check
        if (path === "/" && method === "GET") {
            return jsonResponse({
                status: "ok",
                endpoints: [
                    "POST /fetch - Fetch and cache GitHub issues",
                    "POST /analyze - Analyze cached issues with LLM"
                ]
            });
        }

        // POST /fetch
        if (path === "/fetch" && method === "POST") {
            return handleFetch(req);
        }

        // POST /analyze
        if (path === "/analyze" && method === "POST") {
            return handleAnalyze(req);
        }

        return errorResponse("Not Found", 404);
    },
});

console.log(`🚀 GitHub Issue Analyzer running at http://localhost:${server.port}`);
