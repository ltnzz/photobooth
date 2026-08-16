/* eslint-env node, es2024 */
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

async function run() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const prNumber = process.env.PR_NUMBER;
  const repository = process.env.REPOSITORY;
  const commentId = process.env.COMMENT_ID;
  const initialCommentId = process.env.INITIAL_COMMENT_ID;
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (!geminiApiKey) {
    console.error('Error: GEMINI_API_KEY is not defined in the environment.');
    process.exit(1);
  }
  if (!githubToken) {
    console.error('Error: GITHUB_TOKEN is not defined in the environment.');
    process.exit(1);
  }
  if (!prNumber || !repository) {
    console.error('Error: PR_NUMBER or REPOSITORY is not defined in the environment.');
    process.exit(1);
  }

  let statusCommentId = initialCommentId ? Number(initialCommentId) : null;

  try {
    // 1. Fetch Pull Request details (Title, Body, Base/Head)
    console.log(`Fetching PR metadata for #${prNumber}...`);
    const prUrl = `https://api.github.com/repos/${repository}/pulls/${prNumber}`;
    const prResponse = await fetch(prUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'gemini-pr-reviewer'
      }
    });

    let prTitle = '';
    let prBody = '';
    if (prResponse.ok) {
      const prData = await prResponse.json();
      prTitle = prData.title || '';
      prBody = prData.body || '';
    }

    // 2. Fetch Linked Issues if any
    let linkedIssueContext = '';
    const issueMatches = [
      ...prBody.matchAll(/(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ref|issue)\s*#(\d+)/gi),
      ...prBody.matchAll(/#(\d+)/g)
    ];

    const referencedIssueNumbers = [...new Set(issueMatches.map((m) => m[1]))].filter(
      (num) => num !== prNumber.toString()
    );

    if (referencedIssueNumbers.length > 0) {
      console.log(`Found linked issues: #${referencedIssueNumbers.join(', #')}...`);
      for (const issueNum of referencedIssueNumbers.slice(0, 3)) {
        try {
          const issueUrl = `https://api.github.com/repos/${repository}/issues/${issueNum}`;
          const issueRes = await fetch(issueUrl, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `token ${githubToken}`,
              'User-Agent': 'gemini-pr-reviewer'
            }
          });
          if (issueRes.ok) {
            const issueData = await issueRes.json();
            linkedIssueContext += `\n--- LINKED ISSUE #${issueNum}: "${issueData.title}" ---\n${issueData.body || 'No description provided.'}\n`;
          }
        } catch (e) {
          console.warn(`Failed to fetch linked issue #${issueNum}:`, e.message);
        }
      }
    }

    // 3. Fetch Pull Request diff
    console.log(`Fetching PR diff for #${prNumber}...`);
    const diffResponse = await fetch(prUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3.diff',
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'gemini-pr-reviewer'
      }
    });

    if (!diffResponse.ok) {
      throw new Error(`Failed to fetch PR diff: ${diffResponse.status} ${diffResponse.statusText}`);
    }
    const diffText = await diffResponse.text();

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

    // 4. Update progress & Read review guidelines
    const step2Msg = `### Gemini Code Review

*Analyzing pull request changes...*

- [x] Fetching PR metadata & linked issues (${referencedIssueNumbers.length > 0 ? `#${referencedIssueNumbers.join(', #')}` : 'none'})
- [x] Loading project guidelines (\`GEMINI.md\`)
- [ ] Analyzing code correctness, React patterns, and PR spec alignment...
- [ ] Preparing review summary`;

    await updateComment(repository, statusCommentId, githubToken, step2Msg).catch(() => {});

    let projectGuidelines = '';
    const geminiMdPath = path.join(process.cwd(), 'GEMINI.md');
    const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');

    if (fs.existsSync(geminiMdPath)) {
      projectGuidelines = fs.readFileSync(geminiMdPath, 'utf8');
    } else if (fs.existsSync(agentsMdPath)) {
      projectGuidelines = fs.readFileSync(agentsMdPath, 'utf8');
    }

    // 5. Build system instructions
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
3. Code Smells: Redundant state, unused variables, magic numbers/strings, messy JSX.
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

    // 6. Invoke Gemini Interactions API
    console.log(`Calling Gemini API...`);
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    let reviewContent = null;
    let usedModel = null;
    let lastError = null;

    const modelCandidates = [modelName, 'gemini-3.5-flash'].filter(
      (m, i, arr) => arr.indexOf(m) === i
    );

    for (const candidate of modelCandidates) {
      try {
        const interaction = await ai.interactions.create({
          model: candidate,
          input: fullPrompt,
        });

        const text = interaction.output_text;
        if (text && text.trim()) {
          reviewContent = text;
          usedModel = candidate;
          break;
        }
      } catch (modelError) {
        lastError = modelError;
      }
    }

    if (!reviewContent || !usedModel) {
      const safeLastError = String(lastError).replace(geminiApiKey || '', '[REDACTED]');
      const diagnosticComment = `### Gemini Code Review — Error\n\n\`\`\`\n${safeLastError}\n\`\`\``;
      await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, diagnosticComment);
      process.exit(1);
    }

    // 7. Final structured report (clean, no excessive emojis)
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

    // 8. Update status comment with full review
    console.log(`Updating PR comment with review results...`);
    await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, finalComment);

    // 9. Add reaction to indicate completion
    if (commentId) {
      await addReaction(repository, commentId, githubToken, '+1');
    }

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

async function addReaction(repository, commentId, token, content) {
  try {
    const url = `https://api.github.com/repos/${repository}/issues/comments/${commentId}/reactions`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.squirrel-girl-preview+json',
        'Authorization': `token ${token}`,
        'User-Agent': 'gemini-pr-reviewer'
      },
      body: JSON.stringify({ content })
    });
  } catch (e) {
    console.warn(`Failed to add reaction '${content}':`, e.message);
  }
}

async function postComment(repository, prNumber, token, body) {
  const commentUrl = `https://api.github.com/repos/${repository}/issues/${prNumber}/comments`;
  const response = await fetch(commentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${token}`,
      'User-Agent': 'gemini-pr-reviewer'
    },
    body: JSON.stringify({ body })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post comment: ${response.status} ${response.statusText}\n${errorText}`);
  }
  const data = await response.json();
  return data.id;
}

async function updateComment(repository, commentId, token, body) {
  const commentUrl = `https://api.github.com/repos/${repository}/issues/comments/${commentId}`;
  const response = await fetch(commentUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${token}`,
      'User-Agent': 'gemini-pr-reviewer'
    },
    body: JSON.stringify({ body })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update comment: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

async function updateOrPostComment(repository, prNumber, token, commentId, body) {
  if (commentId) {
    try {
      await updateComment(repository, commentId, token, body);
      return;
    } catch (e) {
      console.warn('Failed to update comment, fallback to posting new comment:', e.message);
    }
  }
  await postComment(repository, prNumber, token, body);
}

run();
