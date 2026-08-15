/* eslint-env node, es2024 */
import fs from 'fs';
import path from 'path';

async function run() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const prNumber = process.env.PR_NUMBER;
  const repository = process.env.REPOSITORY;

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

  try {
    console.log(`Fetching PR diff for #${prNumber} from repository ${repository}...`);
    
    // 1. Fetch Pull Request diff
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
      await postComment(repository, prNumber, githubToken, 'PR diff is empty. Nothing to review.');
      return;
    }

    // 2. Read rule guidelines from GEMINI.md or AGENTS.md if present
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
      console.log('No project-specific guidelines (GEMINI.md/AGENTS.md) found. Using default guidelines.');
    }

    // 3. Construct System Instructions
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
- Only report a finding if it creates meaningful complexity, risk, duplication, or maintenance cost, OR clearly violates a project convention. Do not flag minor things that could merely be "theoretically improved".
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

    // 4. Invoke Gemini API
    console.log('Calling Gemini API for review...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Please review the following Pull Request diff:\n\n\`\`\`diff\n${diffText}\n\`\`\``
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [
          {
            text: systemInstructions
          }
        ]
      },
      generationConfig: {
        temperature: 0.2
      }
    };

    const apiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Gemini API call failed: ${apiResponse.status} ${apiResponse.statusText}\n${errorText}`);
    }

    const responseJson = await apiResponse.json();
    const reviewContent = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reviewContent) {
      throw new Error('Gemini API returned an empty response.');
    }

    const finalComment = `### 🤖 Gemini AI Code Review\n\n${reviewContent}`;

    // 5. Post comment on the PR
    console.log('Posting review comment to PR...');
    await postComment(repository, prNumber, githubToken, finalComment);
    console.log('Review posted successfully!');

  } catch (error) {
    console.error('Error during AI review execution:', error);
    process.exit(1);
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
    throw new Error(`Failed to post comment to PR: ${response.status} ${response.statusText}\n${errorText}`);
  }
}

run();
