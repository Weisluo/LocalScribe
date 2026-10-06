/**
 * 领域色 / 关系色 token -> 具体色值（Phase 3 P3-T3；races_ui_design §4.4）
 *
 * 契约里颜色是 Tailwind 色系描述（teal / emerald / rose ...）或用户自定义 hex；
 * CSS 圆点、血缘树线型等无法直接用 token，这里统一换算（未识别 token 回退领域色）。
 */

export const TONE_HEX: Record<string, string> = {
  slate: '#64748b',
  teal: '#0d9488',
  emerald: '#059669',
  rose: '#e11d48',
  violet: '#7c3aed',
  amber: '#d97706',
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  orange: '#ea580c',
  cyan: '#0891b2',
  yellow: '#ca8a04',
  gold: '#ca8a04',
  lime: '#65a30d',
  pink: '#db2777',
  purple: '#9333ea',
  neutral: '#737373',
};

/** 领域默认强调色（races_ui_design §4.4：teal） */
export const RACES_ACCENT = '#0d9488';

export const toneColor = (token?: string, fallback: string = RACES_ACCENT): string => {
  if (!token) return fallback;
  if (token.startsWith('#') || token.startsWith('rgb') || token.startsWith('hsl')) return token;
  return TONE_HEX[token] ?? fallback;
};
