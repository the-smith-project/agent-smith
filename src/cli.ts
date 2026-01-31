#!/usr/bin/env node
/**
 * Agent Smith CLI — standalone scan from stdin, file, or interactive.
 * Exit codes: 0 = allowed, 1 = blocked, 2 = error.
 */

import * as fs from "fs";
import * as readline from "readline";
import chalk from "chalk";
import { AgentSmithDetector } from "./detector";
import type { ScanResult } from "./types";

const detector = new AgentSmithDetector();

function formatResult(result: ScanResult, json: boolean): string {
  if (json) {
    return JSON.stringify(result, null, 2);
  }
  if (result.blocked) {
    return [
      chalk.red.bold("⚠️  BLOCKED"),
      chalk.gray(`Category: ${result.category ?? "—"}`),
      chalk.gray(`Reason: ${result.reason ?? "—"}`),
      chalk.gray(`Confidence: ${result.confidence.toFixed(2)}`),
      chalk.gray(`Latency: ${result.latency.toFixed(1)}ms`),
    ].join("\n");
  }
  return [
    chalk.green.bold("✅ ALLOWED"),
    chalk.gray(`Confidence: ${result.confidence.toFixed(2)}`),
    chalk.gray(`Latency: ${result.latency.toFixed(1)}ms`),
  ].join("\n");
}

function scan(text: string, options: { json: boolean; quiet: boolean }): void {
  const result = detector.scan(text);
  if (!options.quiet) {
    console.log(formatResult(result, options.json));
  }
  process.exit(result.blocked ? 1 : 0);
}

function run(): void {
  const args = process.argv.slice(2);
  const options = {
    json: args.includes("--json"),
    quiet: args.includes("--quiet"),
    interactive: args.includes("--interactive"),
  };
  const filename = args.find((a) => !a.startsWith("--"));

  if (options.interactive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.blue("smith> "),
    });
    rl.prompt();
    rl.on("line", (input: string) => {
      const line = input.trim();
      if (line === "exit" || line === "quit") {
        rl.close();
        process.exit(0);
      }
      if (line.length > 0) {
        const result = detector.scan(line);
        console.log(formatResult(result, options.json));
      }
      rl.prompt();
    });
    return;
  }

  if (filename) {
    try {
      const text = fs.readFileSync(filename, "utf8");
      scan(text.trim(), options);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!options.quiet) {
        console.error(chalk.red("Error:"), msg);
      }
      process.exit(2);
    }
    return;
  }

  // Read from stdin
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    scan(input.trim(), options);
  });
}

run();
