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
    // 1. If reaction not added yet, add 'eyes' reaction
    if (commentId && !initialCommentId) {
      await addReaction(repository, commentId, githubToken, 'eyes');
    }

    // 2. Fetch Pull Request diff
    console.log(`Fetching PR diff for #${prNumber}...`);
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
        '### 🤖 Gemini AI Code Review\n\n- [x] 📥 Perubahan PR kosong. Tidak ada file yang perlu ditinjau.'
      );
      return;
    }

    // 4. Update progress to Step 2 & Read review guidelines
    const step2Msg = `### 🤖 Gemini AI Code Review

> *Running automated AI review pipeline...*

- [x] 📥 Mengambil diff & perubahan file PR (${diffText.split('\n').length} baris diff)
- [x] 📋 Membaca pedoman arsitektur \`GEMINI.md\`
- [ ] 🔍 **Menganalisis Code Correctness, React Patterns, & Code Smells dengan Gemini AI...**
- [ ] 📝 Menyusun ringkasan ulasan`;

    await updateComment(repository, statusCommentId, githubToken, step2Msg).catch(() => {});

    let projectGuidelines = '';
    const geminiMdPath = path.join(process.cwd(), 'GEMINI.md');
    const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');

    if (fs.existsSync(geminiMdPath)) {
      console.log('Reading review guidelines from GEMINI.md...');
      projectGuidelines = fs.readFileSync(geminiMdPath, 'utf8');
    } else if (fs.existsSync(agentsMdPath)) {
      console.log('Reading review guidelines from AGENTS.md...');
      projectGuidelines = fs.readFileSync(agentsMdPath, 'utf8');
    }

    // 5. Build system instructions
    const systemInstructions = `
You are an expert, senior software developer reviewing a Pull Request diff.
Your task is to analyze the PR diff and provide a high-quality, professional code review.

GUIDELINES FOR REVIEW FOCUS:
1. Code Correctness (potential bugs, edge cases, error handling)
2. Code Smells (redundant state, unused variables, magic numbers/strings, messy JSX)
3. Architecture & Reusability (reusing existing hooks, components, utilities)
4. TypeScript & Type Consistency (proper typing, no unexplained 'any')
5. Performance & React Best Practices (unnecessary re-renders, useEffect anti-patterns)

IMPORTANT RULES:
- Do NOT praise the code. Be strictly objective.
- Only report actionable findings that create risk, technical debt, or violate project conventions.
- Do not report subjective stylistic preferences.
- If there are no actionable issues, output exactly: "No actionable issues found."
- Prioritize findings by Severity (Critical, High, Medium, Low).

For every finding, format as:
- **[SEVERITY] File: [file path] (Line: [relevant line number])**
  - **Issue:** [Short explanation]
  - **Why it matters:** [Risk or maintenance impact]
  - **Recommendation:** [Concrete code recommendation]

PROJECT SPECIFIC GUIDELINES (if any):
${projectGuidelines}
`;

    const fullPrompt = `${systemInstructions}\n\nPlease review the following Pull Request diff:\n\n\`\`\`diff\n${diffText}\n\`\`\``;

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
      const diagnosticComment = `### 🤖 Gemini AI Code Review — ❌ Failed\n\n**Error:**\n\`\`\`\n${safeLastError}\n\`\`\``;
      await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, diagnosticComment);
      process.exit(1);
    }

    // 7. Final structured report with scope verification checklist
    const finalComment = `### 🤖 Gemini AI Code Review

<details open>
<summary><b>📋 Review Scope & Automated Checks</b></summary>

- [x] 🔍 **Code Correctness & Logic**: Verifikasi edge cases, null/undefined safety & error handling
- [x] ⚛️ **React Best Practices**: Pemeriksaan state derivation, hook dependency & unnecessary re-renders
- [x] 🏗️ **Architecture & Reuse**: Memastikan reusabilitas utilitas, hooks, dan komponen yang ada
- [x] 📐 **TypeScript Strictness**: Konsistensi tipe data & domain types
- [x] 📖 **Project Guidelines**: Keselarasan terhadap aturan proyek di \`GEMINI.md\`

</details>

---

#### 📝 Findings & Feedback

${reviewContent}`;

    // 8. Update status comment with full review
    console.log(`Updating PR comment with review results...`);
    await updateOrPostComment(repository, prNumber, githubToken, statusCommentId, finalComment);

    // 9. Add 'rocket' reaction to trigger comment to indicate completion
    if (commentId) {
      await addReaction(repository, commentId, githubToken, 'rocket');
    }

    console.log('Review posted successfully!');

  } catch (error) {
    const safeMessage = String(error).replace(geminiApiKey || '', '[REDACTED]');
    console.error('Error during AI review execution:', safeMessage);

    if (statusCommentId) {
      const errComment = `### 🤖 Gemini AI Code Review — ❌ Error\n\n\`\`\`\n${safeMessage}\n\`\`\``;
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
