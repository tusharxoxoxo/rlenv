import type { Issue } from "./db";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const MAX_CHARS_PER_CHUNK = 800000; // ~800K chars to stay well under token limits

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message: string;
        code: number;
    };
}

function formatIssuesForPrompt(issues: Issue[]): string {
    return issues.map((issue, index) => {
        const body = issue.body ? issue.body.substring(0, 2000) : "(no body)";
        return `### Issue ${index + 1}
**Title:** ${issue.title}
**URL:** ${issue.html_url}
**Created:** ${issue.created_at}
**Body:** ${body}
`;
    }).join("\n---\n");
}

function chunkIssues(issues: Issue[]): Issue[][] {
    const chunks: Issue[][] = [];
    let currentChunk: Issue[] = [];
    let currentSize = 0;

    for (const issue of issues) {
        const issueSize = (issue.title?.length || 0) + (issue.body?.length || 0) + 200; // 200 for metadata

        if (currentSize + issueSize > MAX_CHARS_PER_CHUNK && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentSize = 0;
        }

        currentChunk.push(issue);
        currentSize += issueSize;
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

export async function analyzeIssues(prompt: string, issues: Issue[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    if (issues.length === 0) {
        throw new Error("No issues to analyze");
    }

    const chunks = chunkIssues(issues);

    if (chunks.length === 1) {
        // Single chunk - simple case
        return await callGemini(apiKey, prompt, formatIssuesForPrompt(issues));
    }

    // Multiple chunks - analyze each and then synthesize
    const chunkAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunkPrompt = `You are analyzing GitHub issues (chunk ${i + 1} of ${chunks.length}).

${prompt}

Here are the issues in this chunk:

${formatIssuesForPrompt(chunks[i])}`;

        const analysis = await callGemini(apiKey, chunkPrompt, "");
        chunkAnalyses.push(analysis);

        // Rate limiting: wait 12 seconds between requests (5 req/min limit)
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 12000));
        }
    }

    // Synthesize all chunk analyses
    const synthesisPrompt = `You previously analyzed ${chunks.length} chunks of GitHub issues. 
Here are your analyses for each chunk:

${chunkAnalyses.map((a, i) => `## Chunk ${i + 1} Analysis\n${a}`).join("\n\n")}

Now synthesize these analyses into a single coherent response for the original prompt:
"${prompt}"`;

    await new Promise(resolve => setTimeout(resolve, 12000));
    return await callGemini(apiKey, synthesisPrompt, "");
}

async function callGemini(apiKey: string, prompt: string, issuesText: string): Promise<string> {
    const fullPrompt = issuesText
        ? `${prompt}\n\nHere are the GitHub issues to analyze:\n\n${issuesText}`
        : prompt;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: fullPrompt,
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error("No response text from Gemini API");
    }

    return text;
}
