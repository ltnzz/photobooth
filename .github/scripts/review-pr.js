/* eslint-env node, es2024 */
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

async function run() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const prNumber = process.env.PR_NUMBER;
  const repository = process.env.REPOSITORY;
  const initialCommentId = process.env.INITIAL_COMMENT_ID;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (!geminiApiKey || !githubToken || !prNumber || !repository) {
    console.error('Error: Missing required environment variables (GEMINI_API_KEY, GITHUB_TOKEN, PR_NUMBER, REPOSITORY).');
    process.exit(1);
  }

  const statusCommentId = initialCommentId ? Number(initialCommentId) : null;
  const authHeaders = {
    'Authorization': `token ${githubToken}`,
    'User-Agent': 'gemini-pr-reviewer'
  };

  try {
    // 1. Parallel fetch: PR metadata and PR diff
    console.log(`Fetching PR #${prNumber} metadata and diff in parallel...`);
    const prUrl = `https://api.github.com/repos/${repository}/pulls/${prNumber}`;

    const [prRes, diffRes] = await Promise.all([
      fetch(prUrl, { headers: { ...authHeaders, 'Accept': 'application/vnd.github.v3+json' } }),
      fetch(prUrl, { headers: { ...authHeaders, 'Accept': 'application/vnd.github.v3.diff' } })
    ]);

    if (!diffRes.ok) {
      throw new Error(`Failed to fetch PR diff: ${diffRes.status} ${diffRes.statusText}`);
    }

    const prData = prRes.ok ? await prRes.json() : {};
    const prTitle = prData.title || '';
    const prBody = prData.body || '';
    const diffText = await diffRes.text();

    if (!diffText.trim()) {
      console.log('PR diff is empty. Skipping review.');
      await updateOrPostComment(
        repository,
        prNumber,
        githubToken,
        statusCommentId,
        '### Gemini Code Review\n\n- [x] Perubahan PR kosong. Tidak ada file yang perlu ditinjau.'
      );
      return;
    }

    // 2. Detect and fetch Linked Issues in parallel
    let linkedIssueContext = '';
    const issueMatches = [
      ...prBody.matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ref|issue)\s*#(\d+)/gi),
      ...prBody.matchAll(/#(\d+)/g)
    ];

    const referencedIssueNumbers = [...new Set(issueMatches.map((m) => m[1]))].filter(
      (num) => num !== prNumber.toString()
    );

    if (referencedIssueNumbers.length > 0) {
      const issueFetches = referencedIssueNumbers.slice(0, 3).map(async (num) => {
        try {
          const res = await fetch(`https://api.github.com/repos/${repository}/issues/${num}`, {
            headers: { ...authHeaders, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (res.ok) {
            const data = await res.json();
            return `\n--- LINKED ISSUE #${num}: "${data.title}" ---\n${data.body || 'No description provided.'}\n`;
          }
        } catch {
          // silently continue
        }
        return '';
      });

      const issueResults = await Promise.all(issueFetches);
      linkedIssueContext = issueResults.join('');
    }

    // 3. Update progress comment & read project guidelines
    const step2Msg = `### Gemini Code Review

*Analyzing pull request changes...*

- [x] Fetching PR metadata & linked issues (${referencedIssueNumbers.length > 0 ? `#${referencedIssueNumbers.join(', #')}` : 'none'})
- [x] Loading project guidelines (\`GEMINI.md\`)
- [ ] Evaluating code correctness, React patterns, and PR spec alignment...
- [ ] Preparing review summary`;

    await updateComment(repository, statusCommentId, githubToken, step2Msg).catch(() => {});

    let projectGuidelines = '';
    const geminiMdPath = path.join(process.cwd(), 'GEMINI.md');
    if (fs.existsSync(geminiMdPath)) {
      projectGuidelines = fs.readFileSync(geminiMdPath, 'utf8');
    }

    // 4. Build prompt
    const systemInstructions = `
You are an expert software engineer reviewing a Pull Request diff.
Your task is to analyze the PR diff and provide an objective, professional code review.

CRITICAL RESPONSIBILITY — PR & ISSUE SPEC ALIGNMENT:
- You are provided with the PR Title, PR Description, and any Linked Issue requirements.
- Verify whether the implemented code in the diff satisfies what was requested in the PR Description and Linked Issue.
- Check if any requested features, edge cases, or acceptance criteria mentioned in the PR description / Issue were missed or only half-implemented.

REVIEW FOCUS:
1. Requirements & Spec Alignment: Check if the diff satisfies the PR description / Issue goals.
2. Code Correctness: Potential bugs, edge cases, state management issues, error handling.
3. Code Smells & Dead Code:
   - Dead code: unused functions/imports, commented-out code, unreachable logic branches, orphaned components/files.
   - Anti-patterns: redundant state, unused variables, magic numbers/strings, messy JSX.
4. Architecture & Reuse: Check if existing components, hooks, or helpers are properly reused.
5. TypeScript & Best Practices: Proper typing, no unexplained 'any', no anti-patterns.

IMPORTANT RULES:
- Do NOT praise the code. Be strictly objective and professional.
- Avoid unnecessary emojis or informal language.
- Only report actionable findings that create risk, technical debt, or violate specifications/guidelines.
- Do not report subjective stylistic preferences.
- If there are no actionable issues, output exactly: "No actionable issues found."
- Prioritize findings by Severity (Critical, High, Medium, Low).

For every finding, format as:
- **[SEVERITY] File: [file path] (Line: [relevant line number])**
  - **Issue:** [Short explanation of what is wrong or missing according to PR/Issue spec]
  - **Why it matters:** [Risk, discrepancy from specification, or maintenance impact]
  - **Recommendation:** [Concrete code or architectural recommendation]

PROJECT SPECIFIC GUIDELINES (if any):
${projectGuidelines}
`;

    const fullPrompt = `
${systemInstructions}

==================================================
PULL REQUEST TITLE:
"${prTitle}"

PULL REQUEST DESCRIPTION:
${prBody || 'No PR description provided.'}

${linkedIssueContext ? `LINKED ISSUE DETAILS:\n${linkedIssueContext}` : 'NO LINKED ISSUE FOUND.'}
==================================================

PULL REQUEST DIFF:
\`\`\`diff
${diffText}
\`\`\`
`;

    // 5. Invoke Gemini Interactions API
    console.log(`Calling Gemini API (${modelName})...`);
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    let reviewContent = null;
    let lastError = null;

    const candidates = [modelName, 'gemini-3.5-flash'].filter((m, i, arr) => arr.indexOf(m) === i);

    for (const candidate of candidates) {
      try {
        const interaction = await ai.interactions.create({
          model: candidate,
          input: fullPrompt,
        });

        const text = interaction.output_text;
        if (text && text.trim()) {
          reviewContent = text;
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!reviewContent) {
      const safeLastError = String(lastError).replace(geminiApiKey || '', '[REDACTED]');
      const diagnosticComment = `### Gemini Code Review — Error\n\n\`\`\`\n${safeLastError}\n\`\`\``;
      await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, diagnosticComment);
      process.exit(1);
    }

    // 6. Final report
    const finalComment = `### Gemini Code Review

<details open>
<summary><b>Review Scope & Automated Checks</b></summary>

- [x] **PR & Issue Spec Alignment**: Evaluated diff against PR description ${referencedIssueNumbers.length > 0 ? `and Issue #${referencedIssueNumbers.join(', #')}` : ''}
- [x] **Code Correctness & Logic**: Edge cases, null/undefined safety & error handling
- [x] **React Best Practices**: State derivation, hook dependencies & render performance
- [x] **Architecture & Reuse**: Component and utility reuse
- [x] **TypeScript Strictness**: Type consistency and domain types
- [x] **Project Guidelines**: Compliance with rules in \`GEMINI.md\`

</details>

---

#### Findings & Feedback

${reviewContent}`;

    // 7. Update status comment with full review
    console.log('Updating PR comment with review results...');
    await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, finalComment);
    console.log('Review posted successfully!');

  } catch (error) {
    const safeMessage = String(error).replace(geminiApiKey || '', '[REDACTED]');
    console.error('Error during AI review execution:', safeMessage);

    if (statusCommentId) {
      const errComment = `### Gemini Code Review — Error\n\n\`\`\`\n${safeMessage}\n\`\`\``;
      await updateComment(repository, statusCommentId, githubToken, errComment).catch(() => {});
    }

    process.exit(1);
  }
}

async function postComment(repository, prNumber, token, body) {
  const res = await fetch(`https://api.github.com/repos/${repository}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${token}`,
      'User-Agent': 'gemini-pr-reviewer'
    },
    body: JSON.stringify({ body })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to post comment: ${res.status} ${res.statusText}\n${errorText}`);
  }
  const data = await res.json();
  return data.id;
}

async function updateComment(repository, commentId, token, body) {
  const res = await fetch(`https://api.github.com/repos/${repository}/issues/comments/${commentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${token}`,
      'User-Agent': 'gemini-pr-reviewer'
    },
    body: JSON.stringify({ body })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update comment: ${res.status} ${res.statusText}\n${errorText}`);
  }
}

async function updateOrPostComment(repository, prNumber, token, commentId, body) {
  if (commentId) {
    try {
      await updateComment(repository, commentId, token, body);
      return;
    } catch {
      // fallback to post
    }
  }
  await postComment(repository, prNumber, token, body);
}

run();
