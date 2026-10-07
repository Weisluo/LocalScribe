/**
 * 纹章块 Emblem（Phase 3 P3-T3；races_ui_design §4.1/§4.4、§7「纹章与颜色」）
 *
 * 纹章 = 代表色块 + Lucide 图标（不用 emoji）；色块 40 / 32 / 24 三档。
 * 图标名以 kebab-case 存在 meta.emblem.icon（如 book-marked、sprout、moon），
 * 这里按名字动态解析；名字缺失或不存在时回退 BookMarked；无图标时用名称首字做字母章。
 */

import type { ReactElement } from 'react';
import { BookMarked } from 'lucide-react';

import { lucideIcon } from '../../shared/lucideIcon';

export type EmblemSize = 40 | 32 | 24;

const SIZE_CLASS: Record<EmblemSize, string> = {
  40: 'h-10 w-10',
  32: 'h-8 w-8',
  24: 'h-6 w-6',
};

const ICON_SIZE_CLASS: Record<EmblemSize, string> = {
  40: 'h-5 w-5',
  32: 'h-4 w-4',
  24: 'h-3.5 w-3.5',
};

const LETTER_SIZE_CLASS: Record<EmblemSize, string> = {
  40: 'text-base',
  32: 'text-sm',
  24: 'text-xs',
};

/** 按名字渲染 Lucide 图标；未知名字回退 BookMarked（不用 emoji） */
const renderLucideIcon = (name: string | undefined, className: string): ReactElement => {
  const Icon = lucideIcon(name) ?? BookMarked;
  return <Icon className={className} aria-hidden="true" />;
};

/** hex 底色的 WCAG 相对亮度；非 hex（token / 其它色值写法）返回 null */
const relativeLuminance = (color: string): number | null => {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const channel = (offset: number): number => {
    const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
};

/** 前景色按底色亮度取：亮底用深色字、暗底用浅色字（0.179 是黑白对比度的交叉点）；非 hex 保持浅色字 */
const foregroundOf = (color: string): string => {
  const luminance = relativeLuminance(color);
  if (luminance === null) return 'text-white/95';
  return luminance > 0.179 ? 'text-slate-900' : 'text-white/95';
};

export interface EmblemProps {
  /** 名称：无图标时取首字做字母章 */
  name: string;
  /** Lucide 图标名（缺省渲染字母章） */
  icon?: string;
  /** 代表色（色板 token 或 hex）；hex 底色按亮度自动选前景色 */
  color: string;
  size?: EmblemSize;
  /** 字母章字符；缺省由 name 首字生成 */
  letter?: string;
  className?: string;
}

export const Emblem = ({
  name,
  icon,
  color,
  size = 40,
  letter,
  className = '',
}: EmblemProps) => {
  const text = (letter ?? name.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      data-testid="race-emblem"
      data-emblem-icon={icon ?? ''}
      style={{ backgroundColor: color }}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ring-white/10 ${foregroundOf(color)} ${SIZE_CLASS[size]} ${className}`}
      aria-hidden="true"
    >
      {icon ? (
        renderLucideIcon(icon, ICON_SIZE_CLASS[size])
      ) : (
        <span className={`font-semibold leading-none ${LETTER_SIZE_CLASS[size]}`}>{text}</span>
      )}
    </span>
  );
};
