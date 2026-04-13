#!/usr/bin/env node
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ai = require("./github-models-client");
const snyk = require("../snyk/snyk-client");

// Colours for terminal output
const c = {
    red:    (s) => `\x1b[31m${s}\x1b[0m`,
    green:  (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
    bold:   (s) => `\x1b[1m${s}\x1b[0m`,
    dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

function banner() {
    console.log(c.cyan(`
+------------------------------------------+
|   Snyk Security AI Agent                 |
|   Powered by GitHub Models (GPT-4o)      |
+------------------------------------------+
`));
}

function detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        ".js": "javascript", ".ts": "typescript",
        ".py": "python",     ".java": "java",
        ".jsx": "javascript", ".tsx": "typescript",
    };
    return map[ext] || "code";
}

async function interactiveMode() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(c.green("Interactive mode — type a question or command. Ctrl+C to exit.\n"));
    console.log(c.dim("Examples:"));
    console.log(c.dim("  explain CVE-2021-44228"));
    console.log(c.dim("  ask how do I prevent SQL injection in Java?"));
    console.log(c.dim("  generate python secure file upload handler\n"));

    const prompt = () => {
        rl.question(c.cyan("snyk-agent> "), async (input) => {
            input = input.trim();
            if (!input) return prompt();
            const [cmd, ...rest] = input.split(" ");
            const arg = rest.join(" ");
            try {
                let result;
                if      (cmd === "explain")  result = await ai.explainVulnerability(arg);
                else if (cmd === "ask")      result = await ai.answerSecurityQuestion(arg);
                else if (cmd === "generate") {
                    const [lang, ...desc] = arg.split(" ");
                    result = await ai.generateSecureCode(desc.join(" "), lang);
                }
                else result = await ai.answerSecurityQuestion(input);
                console.log("\n" + result + "\n");
            } catch (err) {
                console.error(c.red(`Error: ${err.message}`));
            }
            prompt();
        });
    };
    prompt();
}

async function main() {
    banner();
    const [,, command, ...args] = process.argv;
    if (!command) return interactiveMode();

    try {
        switch (command.toLowerCase()) {

            case "explain": {
                const input = args.join(" ");
                if (!input) { console.error(c.red('Usage: node src/agent/cli.js explain "CVE-2021-44228"')); process.exit(1); }
                console.log(c.yellow(`\nExplaining: ${input}\n`));
                console.log(await ai.explainVulnerability(input));
                break;
            }

            case "fix": {
                const filePath = args[0];
                if (!filePath || !fs.existsSync(filePath)) {
                    console.error(c.red("Usage: node src/agent/cli.js fix .\\path\\to\\file.js"));
                    process.exit(1);
                }
                const code = fs.readFileSync(filePath, "utf8");
                const lang = detectLanguage(filePath);
                console.log(c.yellow(`\nFixing ${filePath} (${lang})...\n`));
                console.log(await ai.fixVulnerableCode(code, lang));
                break;
            }

            case "review": {
                const filePath = args[0];
                if (!filePath || !fs.existsSync(filePath)) {
                    console.error(c.red("Usage: node src/agent/cli.js review .\\path\\to\\file.py"));
                    process.exit(1);
                }
                const code = fs.readFileSync(filePath, "utf8");
                const lang = detectLanguage(filePath);
                console.log(c.yellow(`\nReviewing ${filePath} (${lang})...\n`));
                console.log(await ai.reviewCode(code, lang));
                break;
            }

            case "ask": {
                const question = args.join(" ");
                if (!question) { console.error(c.red('Usage: node src/agent/cli.js ask "How do I prevent XSS?"')); process.exit(1); }
                console.log(c.yellow(`\nAnswering: ${question}\n`));
                console.log(await ai.answerSecurityQuestion(question));
                break;
            }

            case "generate": {
                const language = args[0];
                const description = args.slice(1).join(" ");
                if (!language || !description) {
                    console.error(c.red('Usage: node src/agent/cli.js generate java "user login endpoint"'));
                    process.exit(1);
                }
                console.log(c.yellow(`\nGenerating secure ${language} code...\n`));
                console.log(await ai.generateSecureCode(description, language));
                break;
            }

            case "scan": {
                const reportPath = args[0];
                if (!reportPath) { console.log(snyk.getSetupInstructions()); break; }
                if (!fs.existsSync(reportPath)) {
                    console.error(c.red(`File not found: ${reportPath}`));
                    console.log(snyk.getSetupInstructions());
                    process.exit(1);
                }
                const raw = fs.readFileSync(reportPath, "utf8");
                const vulns = snyk.parseSnykReport(raw);
                const summary = snyk.summarizeReport(vulns);
                console.log(c.bold("\nReport Summary"));
                console.log(c.red(`  Critical: ${summary.critical}`));
                console.log(`  High:     ${summary.high}`);
                console.log(`  Medium:   ${summary.medium}`);
                console.log(`  Low:      ${summary.low}`);
                console.log(`  Total:    ${summary.total}\n`);
                console.log(c.yellow("Analysing with AI...\n"));
                console.log(await ai.analyzeSnykReport(summary));
                break;
            }

            case "setup": {
                console.log(snyk.getSetupInstructions());
                break;
            }

            default: {
                const question = [command, ...args].join(" ");
                console.log(c.yellow(`\n${question}\n`));
                console.log(await ai.answerSecurityQuestion(question));
            }
        }
    } catch (err) {
        console.error(c.red(`\nError: ${err.message}\n`));
        if (err.message.includes("GITHUB_TOKEN")) {
            console.log(c.yellow("Fix: create a .env file with GITHUB_TOKEN=ghp_your_token"));
        }
        process.exit(1);
    }
}

main();