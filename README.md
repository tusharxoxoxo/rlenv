# rlenv

## How to run the server

```bash
bun run dev
```

## Why you chose the specific local storage option

I chose SQLite 
-> local storage lightweight file-based database easy to set up and use 
-> fast and reliable
-> can handle a large number of requests.

## Prompts used

<details>
<summary>1st prompt chain - env setup</summary>

```text
create a new .evn example file and add .env to git ignore 

GEMINI_API_KEY=your_api_key_here
```

</details>

<details>
<summary>2nd prompt chain - initial spec</summary>

```text
GitHub Issue Analyzer with Local Caching + LLM Processing
Overview
Build a small service with two endpoints that can:

Fetch and locally cache GitHub issues from a repository
Analyze the cached issues using a natural-language prompt and an LLM

Purpose
Fetch all open issues from a given GitHub repository and cache them locally.

Request format
{
  "repo": "owner/repository-name"
}

Expected behavior
Fetch all open issues from the GitHub REST API.
Extract and store at minimum:
id
title
body
html_url
created_at
Cache these issues locally using one storage approach sqlite

Response
Return a summary:

{
  "repo": "owner/repository-name",
  "issues_fetched": 42,
  "cached_successfully": true
}

2. Endpoint: POST /analyze
Purpose
Take a repo name and a natural-language prompt, retrieve cached issues for that repo, and analyze them using an LLM.

Request format
{
  "repo": "owner/repository-name",
  "prompt": "Find themes across recent issues and recommend what the maintainers should fix first"
}

Expected behavior
Look up cached issues for the given repo
Combine the prompt + cached issues into an LLM request
Let the LLM generate the analysis (no keyword classification; fully natural-language interpretation)
Return the LLM's output in a readable response

use gemini 2.5 via the api key
refer env.example 
for gemini 2.5 flash, the usage limit in free tier is 5 request per minute

example
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H 'Content-Type: application/text' \
  -H 'X-goog-api-key: $GEMINI_API_KEY' \
  -X POST \
  -d '{
    "contents": [
      {
        "parts": [
          {
            "text": "Explain how AI works in a few words"
          }
        ]
      }
    ]
  }'

{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "AI learns patterns from data to understand, predict, and generate."
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 8,
    "candidatesTokenCount": 13,
    "totalTokenCount": 917,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 8
      }
    ],
    "thoughtsTokenCount": 896
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "Drd5aYifOau84-EP9JrawAI"
}

Keep context size in mind (chunking is acceptable if needed)
Handle edge cases such as:
Repo not yet scanned
No issues cached
LLM errors

Response example
{
  "analysis": "<LLM-generated text here>"
}

No UI is needed; this is strictly a backend task.

Use TypeScript, Squalight and Bun.
use SQLite

Bun natively implements a high-performance SQLite3 driver.

Bun natively implements a high-performance SQLite3 driver. To use it import from the built-in bun:sqlite module.
https://mintcdn.com/bun-1dd33a4e/Hq64iapoQXHbYMEN/icons/typescript.svg?fit=max&auto=format&n=Hq64iapoQXHbYMEN&q=85&s=c6cceedec8f82d2cc803d7c6ec82b240
db.ts
import { Database } from "bun:sqlite";

const db = new Database(":memory:");
const query = db.query("select 'Hello world' as message;");
query.get();
{ message: "Hello world" }
```

</details>

<details>
<summary>2nd prompt chain - reference repo</summary>

```text
https://github.com/oven-sh/bun
```

</details>

<details>
<summary>2nd prompt chain - endpoint rename</summary>

```text
change the name to scan instead of fetch endpoint
```

</details>

<details>
<summary>3rd prompt chain - add linting</summary>

```text
add Linting	ESLint + Prettier	
```

</details>