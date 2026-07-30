export const visualTokens = {
  color: {
    ink: '#27323a',
    paper: '#fff8df',
    panel: '#f2e2b8',
    panelStrong: '#d6b66f',
    court: '#d67b4d',
    courtLight: '#f0aa68',
    sky: '#78b7c9',
    grass: '#75a85c',
    accent: '#dd5f55',
    focus: '#234e70',
  },
  pixel: {
    baseUnit: 4,
    borderWidth: 4,
    shadowOffset: 4,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
    xl: 32,
  },
  typography: {
    display: '"Fusion Pixel", "Ark Pixel", "Microsoft YaHei", sans-serif',
    body: '"Microsoft YaHei", "PingFang SC", sans-serif',
  },
} as const;

export type VisualTokens = typeof visualTokens;
