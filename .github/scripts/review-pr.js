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

  let statusCommentId = null;

  try {
    // 1. Add 'eyes' reaction to the trigger comment immediately for visual feedback
    if (commentId) {
      await addReaction(repository, commentId, githubToken, 'eyes');
    }

    // 2. Post initial loading status comment on PR
    console.log(`Posting initial loading status on PR #${prNumber}...`);
    statusCommentId = await postComment(
      repository,
      prNumber,
      githubToken,
      '⏳ *Gemini Code Reviewer is analyzing this Pull Request diff...*'
    );

    console.log(`Fetching PR diff for #${prNumber} from repository ${repository}...`);

    // 3. Fetch Pull Request diff
    const diffUrl = `https://api.github.com/repos/${repository}/pulls/${prNumber}`;
    const diffResponse = await fetch(diffUrl, {
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
        '### 🤖 Gemini AI Code Review\n\nPR diff is empty. Nothing to review.'
      );
      return;
    }

    // 4. Read review guidelines from GEMINI.md or AGENTS.md
    let projectGuidelines = '';
    const geminiMdPath = path.join(process.cwd(), 'GEMINI.md');
    const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');

    if (fs.existsSync(geminiMdPath)) {
      console.log('Reading review guidelines from GEMINI.md...');
      projectGuidelines = fs.readFileSync(geminiMdPath, 'utf8');
    } else if (fs.existsSync(agentsMdPath)) {
      console.log('Reading review guidelines from AGENTS.md...');
      projectGuidelines = fs.readFileSync(agentsMdPath, 'utf8');
    } else {
      console.log('No project-specific guidelines found. Using default guidelines.');
    }

    // 5. Build the full prompt (system instructions + diff)
    const systemInstructions = `
You are an expert, senior software developer reviewing a Pull Request diff.
Your task is to analyze the PR diff and provide a high-quality, professional code review.

GUIDELINES FOR REVIEW FOCUS:

1. Code Correctness:
   - Potential bugs, incorrect behavior, broken edge cases, race conditions, state management issues, null/undefined handling, error handling.

2. Code Smells:
   - Duplicated code or JSX, overly long/complex functions, deeply nested conditionals, large components, prop drilling, magic numbers/strings, dead code, unused variables/imports.
   - Poor separation of concerns, leaky abstractions, performance anti-patterns, unnecessary state/renders.

3. Architecture & Reusability:
   - Check if existing components, hooks, utilities, services, or helpers should be reused.
   - Do not recommend abstractions solely to reduce line count. Responsibility of any new abstraction must be clear and reusable.

4. Type & Domain Consistency:
   - Incorrect/broad types, unnecessary 'any', unsafe type assertions, mismatch between API contracts and frontend types.

5. Logic & Branching:
   - Unnecessary branching, complex boolean expressions, missing default/fallback behavior.

6. Maintainability & Performance:
   - Code violating repository conventions, expensive calculations inside render paths, resource/memory leaks.

IMPORTANT RULES:
- Do NOT praise the code or the implementer. Be purely objective.
- Only report a finding if it creates meaningful complexity, risk, duplication, or maintenance cost, OR clearly violates a project convention.
- Do not report subjective stylistic preferences or formatting-only issues.
- If there are no actionable issues, you MUST explicitly output exactly: "No actionable issues found."
- Prioritize findings by Severity:
  - Critical: likely to cause production failure, security issue, or major incorrect behavior.
  - High: significant bug, architectural problem, or serious maintainability issue.
  - Medium: meaningful code smell, duplication, unnecessary complexity, or potential bug.
  - Low: minor maintainability issue with limited impact.

For every finding, output in this exact markdown list format:
- **[SEVERITY] File: [file path] (Line: [relevant line number/reference])**
  - **Issue:** [Short explanation of what is wrong]
  - **Why it matters:** [Explanation of risk, maintenance cost, or impact]
  - **Recommendation:** [Concrete code or pattern recommendation to fix it]

PROJECT SPECIFIC GUIDELINES (if any):
${projectGuidelines}
`;

    const fullPrompt = `${systemInstructions}\n\nPlease review the following Pull Request diff:\n\n\`\`\`diff\n${diffText}\n\`\`\``;

    // 6. Invoke Gemini via Interactions API
    console.log(`Calling Gemini Interactions API using model: ${modelName}...`);

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    let reviewContent = null;
    let usedModel = null;
    let lastError = null;

    const modelCandidates = [modelName, 'gemini-3.5-flash'].filter(
      (m, i, arr) => arr.indexOf(m) === i
    );

    for (const candidate of modelCandidates) {
      console.log(`Trying model: ${candidate}...`);
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

        console.warn(`Model ${candidate} returned empty output, trying next...`);
        lastError = new Error(`Model ${candidate} returned empty output.`);
      } catch (modelError) {
        const safeErr = String(modelError).replace(geminiApiKey || '', '[REDACTED]');
        console.warn(`Model ${candidate} failed: ${safeErr}`);
        lastError = modelError;
      }
    }

    if (!reviewContent || !usedModel) {
      const safeLastError = String(lastError).replace(geminiApiKey || '', '[REDACTED]');
      const diagnosticComment = [
        '### 🤖 Gemini AI Code Review — ❌ Failed',
        '',
        '**All models returned an error or empty response.**',
        '',
        '| Model tried | Result |',
        '|---|---|',
        ...modelCandidates.map(m => `| \`${m}\` | failed or empty |`),
        '',
        '**Last error:**',
        '```',
        safeLastError,
        '```',
        '',
        '_Check the GitHub Actions log for details. Verify `GEMINI_API_KEY` in repository secrets is valid._'
      ].join('\n');

      await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, diagnosticComment);
      console.error('All models failed. Diagnostic comment posted to PR.');
      process.exit(1);
    }

    // Clean final review output without model header text
    const finalComment = `### 🤖 Gemini AI Code Review\n\n${reviewContent}`;

    // 7. Update status comment with full review
    console.log(`Updating PR comment with review results...`);
    await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, finalComment);

    // 8. Add 'rocket' reaction to trigger comment to indicate completion
    if (commentId) {
      await addReaction(repository, commentId, githubToken, 'rocket');
    }

    console.log('Review posted successfully!');

  } catch (error) {
    const safeMessage = String(error).replace(geminiApiKey || '', '[REDACTED]');
    console.error('Error during AI review execution:', safeMessage);

    if (statusCommentId) {
      const errComment = `### 🤖 Gemini AI Code Review — ❌ Error\n\nAn unexpected error occurred during review:\n\`\`\`\n${safeMessage}\n\`\`\``;
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
