require("dotenv").config();
const https = require("https");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const SYSTEM_PROMPT = `You are a world-class application security expert.
You specialise in Java, Python, JavaScript and TypeScript.
You know Snyk vulnerabilities, OWASP Top 10, and secure coding patterns deeply.
Always give plain English first, then technical detail.
Always provide copy-paste-ready fixes with before/after code.
Use these indicators: 🔴 Critical  🟠 High  🟡 Medium  🟢 Low  ✅ Fixed  ⚠️ Warning`;

async function chat(messages) {
    if (!GITHUB_TOKEN) {
        throw new Error(
            "GITHUB_TOKEN not set.\nFix: make sure your .env file exists and has GITHUB_TOKEN=ghp_..."
        );
    }

    const body = JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 2000,
        temperature: 0.2,
    });

    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: "models.inference.ai.azure.com",
                path: "/chat/completions",
                method: "POST",
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            reject(new Error(`API Error: ${parsed.error.message}`));
                            return;
                        }
                        resolve(parsed.choices?.[0]?.message?.content || "No response received.");
                    } catch {
                        reject(new Error("Failed to parse response from GitHub Models API"));
                    }
                });
            }
        );
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

async function explainVulnerability(input) {
    return chat([{
        role: "user",
        content: `Explain this Snyk vulnerability using exactly this structure:

🔴 VULNERABILITY SUMMARY (id, package, severity, fix version)
🧠 WHAT THIS MEANS (plain English, 2-3 sentences)
⚠️ REAL-WORLD RISK (what an attacker can actually do)
✅ HOW TO FIX (code diff or upgrade command)
🧪 HOW TO VERIFY (test or scan command to confirm fix)
💡 PREVENTION TIP (how to avoid this class of issue)

Input: ${input}`
    }]);
}

async function fixVulnerableCode(code, language) {
    return chat([{
        role: "user",
        content: `Fix all security vulnerabilities in this ${language} code.

Format your response as:
1. VULNERABILITIES FOUND (bullet list with severity)
2. FIXED CODE (complete fixed version in a code block)
3. WHAT CHANGED (explain each fix with inline comments)
4. DEPENDENCIES TO UPDATE (if any package upgrades needed)

Code:
\`\`\`${language}
${code}
\`\`\``
    }]);
}

async function reviewCode(code, language) {
    return chat([{
        role: "user",
        content: `Perform a thorough security review of this ${language} code.

Check for: SQL injection, XSS, command injection, broken auth,
sensitive data exposure, insecure deserialization, missing input validation,
hardcoded secrets, missing error handling, insecure dependencies.

For each issue: show severity emoji, description, and the exact fix.
If the code is clean, say so clearly.

\`\`\`${language}
${code}
\`\`\``
    }]);
}

async function answerSecurityQuestion(question) {
    return chat([{
        role: "user",
        content: `${question}

Give a practical, actionable answer with:
- Clear explanation
- Code examples (Java, Python, or JS/TS where relevant)
- Common mistakes to avoid
- Tools or libraries that help`
    }]);
}

async function generateSecureCode(description, language) {
    return chat([{
        role: "user",
        content: `Generate secure ${language} code for: ${description}

Requirements:
- Security best practices by default
- Inline comments explaining security decisions
- Parameterized queries if DB is involved
- Environment variables for any secrets (never hardcode)
- Input validation included
- Errors handled without leaking sensitive info`
    }]);
}

async function analyzeSnykReport(summary) {
    return chat([{
        role: "user",
        content: `Analyse this Snyk vulnerability report and give a prioritised fix plan.

Report: ${JSON.stringify(summary, null, 2)}

Provide:
1. EXECUTIVE SUMMARY (2-3 sentences for non-technical stakeholders)
2. TOP 5 PRIORITIES (ordered by real-world risk)
3. QUICK WINS (fixes under 30 minutes)
4. FIX COMMANDS (copy-paste npm/pip/mvn upgrade commands)
5. MITIGATIONS (what to do if you cannot fix immediately)`
    }], );
}

module.exports = {
    explainVulnerability,
    fixVulnerableCode,
    reviewCode,
    answerSecurityQuestion,
    generateSecureCode,
    analyzeSnykReport,
};