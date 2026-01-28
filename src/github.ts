import type { GitHubIssue } from "./db";

const GITHUB_API_BASE = "https://api.github.com";
const PER_PAGE = 100;

export async function fetchAllOpenIssues(repo: string): Promise<GitHubIssue[]> {
    const allIssues: GitHubIssue[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const url = `${GITHUB_API_BASE}/repos/${repo}/issues?state=open&per_page=${PER_PAGE}&page=${page}`;

        const response = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "GitHub-Issue-Analyzer",
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Repository not found: ${repo}`);
            }
            if (response.status === 403) {
                throw new Error("GitHub API rate limit exceeded. Please try again later.");
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const issues = await response.json() as Array<{
            id: number;
            title: string;
            body: string | null;
            html_url: string;
            created_at: string;
            pull_request?: unknown;
        }>;

        // Filter out pull requests (GitHub API returns PRs in issues endpoint)
        const realIssues = issues.filter(issue => !issue.pull_request);

        for (const issue of realIssues) {
            allIssues.push({
                id: issue.id,
                title: issue.title,
                body: issue.body,
                html_url: issue.html_url,
                created_at: issue.created_at,
            });
        }

        // Check if there are more pages
        if (issues.length < PER_PAGE) {
            hasMore = false;
        } else {
            page++;
        }
    }

    return allIssues;
}
