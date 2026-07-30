#!/usr/bin/env node

import { resolve } from 'node:path';

import { FileSaveRepository } from '@sunny-court/persistence-node';

import { runBatch, runThreeYearSimulation } from './runner.js';

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer; received ${value}.`);
  }
  return parsed;
}

function printHumanSummary(summary: Awaited<ReturnType<typeof runThreeYearSimulation>>['summary']) {
  console.log('P01 三年 Headless 沙盘完成');
  console.log(`种子：${summary.seed}`);
  console.log(
    `时间：${summary.calendarWeeks} 日历周 / ${summary.operationWeeks} 运营周 / ${summary.examWeeks} 考试周`,
  );
  console.log(
    `生命周期：${summary.schoolYearsCompleted} 学年，现役 ${summary.activePlayers}，档案 ${summary.archivedPlayers}`,
  );
  console.log(`比赛：${summary.matches} 场，${summary.wins} 胜 ${summary.losses} 负`);
  console.log(`预算余额：${summary.budgetBalance.toFixed(2)}`);
  console.log(`状态哈希：${summary.stateHash}`);
  console.log(`完整重放哈希：${summary.replayHash}`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'run';
  const json = args.includes('--json');

  if (command === 'run') {
    const seed = option(args, '--seed') ?? 'p01-demo-001';
    const saveDirectory = resolve(option(args, '--save-dir') ?? 'artifacts/local/p01-saves');
    const result = await runThreeYearSimulation({
      seed,
      schoolName: option(args, '--school') ?? 'P01测试高中',
      managerName: option(args, '--manager') ?? 'P01测试经理',
      saveRepository: new FileSaveRepository(saveDirectory),
      saveSlot: option(args, '--slot') ?? 'autosave',
    });
    if (json) console.log(JSON.stringify(result.summary, null, 2));
    else printHumanSummary(result.summary);
    return;
  }

  if (command === 'batch') {
    const summary = await runBatch({
      runs: positiveInteger(option(args, '--runs'), 1000),
      seedPrefix: option(args, '--seed-prefix') ?? 'p01-gate',
      replaySamples: positiveInteger(option(args, '--replay-samples'), 10),
    });
    console.log(JSON.stringify(summary, null, 2));
    if (
      summary.failedRuns > 0 ||
      summary.replayMismatches > 0 ||
      summary.calendarWeekViolations > 0 ||
      summary.operationWeekViolations > 0 ||
      summary.illegalTerminalStates > 0
    ) {
      process.exitCode = 1;
    }
    return;
  }

  throw new Error(`Unknown command "${command}". Use "run" or "batch".`);
}

await main();
