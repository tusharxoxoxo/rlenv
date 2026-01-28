import { Database } from "bun:sqlite";

export interface Issue {
    id: number;
    repo: string;
    github_id: number;
    title: string;
    body: string | null;
    html_url: string;
    created_at: string;
    cached_at: string;
}

let db: Database;

export function initDb(): Database {
    db = new Database("issues.db");

    db.run(`
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      github_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      html_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      UNIQUE(repo, github_id)
    )
  `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_issues_repo ON issues(repo)`);

    return db;
}

export function getDb(): Database {
    if (!db) {
        return initDb();
    }
    return db;
}

export interface GitHubIssue {
    id: number;
    title: string;
    body: string | null;
    html_url: string;
    created_at: string;
}

export function cacheIssues(repo: string, issues: GitHubIssue[]): number {
    const db = getDb();
    const cachedAt = new Date().toISOString();

    // Clear existing issues for this repo
    db.run("DELETE FROM issues WHERE repo = ?", [repo]);

    const insert = db.prepare(`
    INSERT INTO issues (repo, github_id, title, body, html_url, created_at, cached_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    let count = 0;
    for (const issue of issues) {
        insert.run(repo, issue.id, issue.title, issue.body, issue.html_url, issue.created_at, cachedAt);
        count++;
    }

    return count;
}

export function getIssuesByRepo(repo: string): Issue[] {
    const db = getDb();
    const query = db.query<Issue, [string]>("SELECT * FROM issues WHERE repo = ? ORDER BY created_at DESC");
    return query.all(repo);
}

export function hasRepoBeenScanned(repo: string): boolean {
    const db = getDb();
    const query = db.query<{ count: number }, [string]>("SELECT COUNT(*) as count FROM issues WHERE repo = ?");
    const result = query.get(repo);
    return result !== null && result.count > 0;
}

export function getRepoIssueCount(repo: string): number {
    const db = getDb();
    const query = db.query<{ count: number }, [string]>("SELECT COUNT(*) as count FROM issues WHERE repo = ?");
    const result = query.get(repo);
    return result?.count ?? 0;
}
