/**
 * Lucide 图标名解析（Phase 3 P3-T8；races_ui_design §4.4「图标只用 Lucide」）
 *
 * lucide-react 的导出绝大多数是 forwardRef 对象（`{ $$typeof, render }`，0.453 的 5196 个导出里
 * 5195 个是对象），只判 `typeof candidate === 'function'` 会永远解析失败、所有调用点都回退默认图标；
 * 这里同时接受函数导出与带 render 函数的对象导出，未知名字返回 undefined 交给调用方回退。
 */

import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** kebab-case / snake_case 图标名 -> lucide-react 的 PascalCase 导出名 */
const pascal = (name: string): string =>
  name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

/** 导出值 -> 可渲染图标：函数，或带 render 函数的对象（forwardRef） */
const asIcon = (candidate: unknown): LucideIcon | undefined => {
  if (typeof candidate === 'function') return candidate as unknown as LucideIcon;
  if (candidate && typeof (candidate as { render?: unknown }).render === 'function') {
    return candidate as unknown as LucideIcon;
  }
  return undefined;
};

/** Lucide 图标名（kebab-case / snake_case / PascalCase）-> 图标组件；未知名字返回 undefined */
export const lucideIcon = (name?: string): LucideIcon | undefined => {
  if (!name) return undefined;
  const map = LucideIcons as unknown as Record<string, unknown>;
  return asIcon(map[pascal(name)] ?? map[name]);
};
