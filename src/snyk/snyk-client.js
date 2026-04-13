const https = require("https");
const SNYK_TOKEN = process.env.SNYK_TOKEN || null;

function getMode() {
    return SNYK_TOKEN ? "api" : "manual";
}

function parseSnykReport(jsonString) {
    let report;
    try {
        report = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
    } catch {
        throw new Error("Invalid JSON. Run: npx snyk test --json > snyk-report.json");
    }

    const vulns = report.vulnerabilities || report.issues?.vulnerabilities || [];
    return vulns.map((v) => ({
        id: v.id,
        title: v.title,
        severity: v.severity,
        packageName: v.packageName,
        version: v.version,
        fixedIn: v.fixedIn || [],
        isUpgradable: v.isUpgradable || false,
    }));
}

function summarizeReport(parsedVulns) {
    const summary = { critical: [], high: [], medium: [], low: [] };
    for (const v of parsedVulns) {
        const sev = v.severity?.toLowerCase();
        if (summary[sev]) summary[sev].push(v);
    }
    return {
        total: parsedVulns.length,
        critical: summary.critical.length,
        high: summary.high.length,
        medium: summary.medium.length,
        low: summary.low.length,
        details: parsedVulns,
    };
}

function getSetupInstructions() {
    return `
HOW TO GET YOUR SNYK REPORT
============================

Option A — Run a local scan (no account needed for open source):
  npm projects:   npx snyk test --json > snyk-report.json
  Python:         snyk test --file=requirements.txt --json > snyk-report.json
  Java (Maven):   snyk test --file=pom.xml --json > snyk-report.json

Then run:  node src/agent/cli.js scan snyk-report.json

Option B — Use Snyk API (needs a Snyk account):
  1. Go to https://app.snyk.io -> Account Settings -> API Token
  2. Copy your token
  3. Add to .env:  SNYK_TOKEN=your_token_here
  `.trim();
}

module.exports = { getMode, parseSnykReport, summarizeReport, getSetupInstructions };