/**
 * 图鉴卡 RaceCard（Phase 3 P3-T3；races_ui_design §4.1/§4.4/§8、§7 卡片字段顺序）
 *
 * 一卡 = 一页图鉴：顶部代表色条 + 纹章 + 标题 + 一句话特征 + 标签 + 居住地 + 页脚。
 * 字段顺序读 config.cardFields（tagline | habitat | traits | linkCount），未知项忽略；
 * 居住地优先父级传入的 races.inhabits 目标名，回退 meta.habitatText，都没有显示「未记录」。
 * sketch 档只保留「名称 / 一句话 / 代表色 / 关联计数」（降档只隐藏，不删数据）。
 */

import { motion } from 'framer-motion';
import { Link2, MapPin } from 'lucide-react';

import {
  kindLabelOf,
  statusDefsOf,
  statusLabelOf,
  type ModuleConfig,
} from '../../shared/moduleConfig';
import { viewItemVariants, viewSpring } from '../../shared/motion';
import { cardFieldsOf, emblemColorOf } from '../config';
import { RACE_KINDS, type RaceNode } from '../types';
import { Emblem } from './Emblem';
import { toneColor } from './toneColor';

export interface RaceCardProps {
  node: RaceNode;
  config: ModuleConfig;
  /** 排序最前的 races.inhabits 目标名（父级批量解析，避免逐卡遍历关联） */
  habitatName?: string;
  subraceCount: number;
  linkCount: number;
  selected: boolean;
  /** sketch 档：只渲染名称 + 一句话 + 代表色 + 计数 */
  sketch: boolean;
  onOpen: (nodeId: string) => void;
}

const TRAIT_LIMIT = 6;

export const RaceCard = ({
  node,
  config,
  habitatName,
  subraceCount,
  linkCount,
  selected,
  sketch,
  onOpen,
}: RaceCardProps) => {
  const color = emblemColorOf(node, config);
  // 纹章图标取原始 meta/icon：两者都缺时不发明图标，退回字母章（§4.4）
  const icon = node.meta.emblem?.icon ?? node.icon;
  const tagline = node.meta.tagline ?? node.description ?? '';
  const kindLabel = kindLabelOf(config, node.kind, RACE_KINDS);
  const traits = node.meta.traits.slice(0, TRAIT_LIMIT);
  const habitat = habitatName || node.meta.habitatText || '未记录';
  const statusLabel = statusLabelOf(config, node.meta.status);
  const statusColor = statusDefsOf(config).find((def) => def.id === node.meta.status)?.color;
  // sketch 档固定「名称 + 一句话 + 色 + 计数」，不读配置顺序
  const fields = sketch ? ['tagline', 'linkCount'] : cardFieldsOf(config);
  const has = (field: string) => fields.includes(field);
  // 无障碍名带上 kind / 一句话 / 计数 / 状态：只留名称会把卡片的可见信息全挡在辅助技术之外
  const accessibleName = [
    node.name,
    kindLabel,
    tagline,
    `支系 ${subraceCount}`,
    `关联 ${linkCount}`,
    statusLabel ? `状态 ${statusLabel}` : '',
  ]
    .filter(Boolean)
    .join('，');

  return (
    <motion.button
      type="button"
      data-testid="race-card"
      data-race-id={node.id}
      data-kind={node.kind}
      aria-pressed={selected}
      aria-current={selected ? 'true' : undefined}
      aria-label={accessibleName}
      onClick={() => onOpen(node.id)}
      variants={viewItemVariants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={viewSpring}
      className={`group flex min-w-[260px] flex-col overflow-hidden rounded-xl border bg-card/50 text-left shadow-sm transition-all duration-300 motion-reduce:transition-none hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
        selected ? 'border-teal-500 ring-1 ring-teal-500/40' : 'border-border/50 hover:border-teal-500/30'
      }`}
    >
      <span className="block h-1 w-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="flex w-full items-start gap-3 p-4">
        <Emblem name={node.name} icon={icon} color={color} size={40} />
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1 truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
              {node.name}
            </span>
            <span
              className="shrink-0 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300"
              data-testid="race-card-kind"
            >
              {kindLabel}
            </span>
          </span>
          {/* 卡片字段按 config.cardFields 顺序渲染：tagline | habitat | traits | linkCount */}
          {fields.map((field) => {
            if (field === 'tagline') {
              return tagline ? (
                <span
                  key={field}
                  className="line-clamp-2 block text-xs font-normal leading-relaxed text-muted-foreground"
                  data-field="tagline"
                >
                  {tagline}
                </span>
              ) : null;
            }
            if (field === 'habitat') {
              return sketch ? null : (
                <span
                  key={field}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  data-field="habitat"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{habitat}</span>
                </span>
              );
            }
            if (field === 'traits') {
              return sketch || traits.length === 0 ? null : (
                <span key={field} className="flex flex-wrap gap-1" data-field="traits">
                  {traits.map((trait, index) => (
                    <span
                      // 标签是自由文本，可能重复：key 用「值 + 下标」保持稳定唯一
                      key={`${trait}-${index}`}
                      className="rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                    >
                      {trait}
                    </span>
                  ))}
                </span>
              );
            }
            return null;
          })}
        </span>
      </span>
      <span className="mt-auto flex w-full items-center gap-2 border-t border-border/30 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span data-testid="race-card-subraces">支系 {subraceCount}</span>
        {has('linkCount') && (
          <span
            className="flex items-center gap-1"
            data-testid="race-card-link-count"
            title="关联计数（出链 + 入链）"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {linkCount}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {statusLabel && (
            <span className="flex items-center gap-1 rounded-full border border-border/40 px-2 py-0.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: toneColor(statusColor) }}
                aria-hidden="true"
              />
              {statusLabel}
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
};
