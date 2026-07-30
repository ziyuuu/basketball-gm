import { visualTokens } from '@sunny-court/ui-tokens';
import type { CSSProperties } from 'react';

const phaseRows = [
  ['T00', '视觉系统已冻结；临时代码不复用'],
  ['P00', '正式工程、边界、工具链与 Gate'],
  ['P01', '无 UI / 无 API 的三年规则沙盘'],
] as const;

export function App() {
  const shellVariables = {
    '--paper': visualTokens.color.paper,
    '--panel': visualTokens.color.panel,
    '--panel-strong': visualTokens.color.panelStrong,
    '--ink': visualTokens.color.ink,
    '--accent': visualTokens.color.accent,
    '--shadow': `${visualTokens.pixel.shadowOffset}px`,
  } as CSSProperties;

  return (
    <main className="shell" style={shellVariables}>
      <section className="panel" aria-labelledby="project-title">
        <p className="eyebrow">FORMAL ENGINEERING BASELINE</p>
        <h1 id="project-title">高中篮球经理 · P00</h1>
        <p>
          这是正式工程空壳，用于验证构建、包边界与后续规则接入。它不是 T00 静态主题稿，也不是 P04
          可用性交互原型。
        </p>
        <dl>
          {phaseRows.map(([phase, description]) => (
            <div key={phase}>
              <dt>{phase}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
