/**
 * 关系层筛选面板 RelationFilterPanel（Phase 4 P4-T6；politics_ui_design §4.7、契约 §4.3/§6）
 *
 * - 关系层图例 + 逐类勾选：同盟 / 敌对 / 附庸 / 贸易 / 联姻（线型与图标取自 config 的 POLITICS_LINE_STYLES）；
 * - 条约单列一行（宽缎带，不与其他细线共层），并提供次级入口「条约簿」；
 * - 自定义关联（ModuleConfig.linkTypes）列在末尾，默认不勾选，避免首屏噪声；
 * - 末尾「仅看与选中节点相关」开关：开启后聚焦时只画相关边，关闭时其余边降噪到 10%。
 */

import { Compass, PenLine, X } from 'lucide-react';

import type { CustomLinkTypeDef } from '../types';
import { POLITICS_LINE_STYLES, TREATY_RIBBON_STYLE } from '../config';
import { lucideIcon } from '../../shared/lucideIcon';
import { strokeClassOf } from './atlasLayout';
import { labelClass, sectionTitleClass } from '../tone';
import { useDismissOnEscape } from './atlasHooks';

const LineSample = ({ lineStyle, tone }: { lineStyle: 'solid' | 'dashed' | 'double'; tone: string }) => (
  <svg width="30" height="8" aria-hidden="true" className="shrink-0">
    {lineStyle === 'double' ? (
      <>
        <line x1="1" y1="2.6" x2="29" y2="2.6" strokeWidth="1.6" className={strokeClassOf(tone)} />
        <line x1="1" y1="5.8" x2="29" y2="5.8" strokeWidth="1.6" className={strokeClassOf(tone)} />
      </>
    ) : (
      <line
        x1="1"
        y1="4"
        x2="29"
        y2="4"
        strokeWidth="1.6"
        strokeDasharray={lineStyle === 'dashed' ? '5 4' : undefined}
        className={strokeClassOf(tone)}
      />
    )}
  </svg>
);

export interface RelationFilterPanelProps {
  open: boolean;
  enabledTypes: Set<string>;
  onToggleType: (linkType: string, next: boolean) => void;
  showRibbons: boolean;
  onToggleRibbons: (next: boolean) => void;
  customTypes: CustomLinkTypeDef[];
  customEnabled: Set<string>;
  onToggleCustom: (linkType: string, next: boolean) => void;
  onlyRelated: boolean;
  onToggleOnlyRelated: (next: boolean) => void;
  treatyCount: number;
  onOpenTreatyBook: () => void;
  onClose: () => void;
}

export const RelationFilterPanel = ({
  open,
  enabledTypes,
  onToggleType,
  showRibbons,
  onToggleRibbons,
  customTypes,
  customEnabled,
  onToggleCustom,
  onlyRelated,
  onToggleOnlyRelated,
  treatyCount,
  onOpenTreatyBook,
  onClose,
}: RelationFilterPanelProps) => {
  useDismissOnEscape(open, onClose);
  if (!open) return null;

  const RibbonIcon = lucideIcon(TREATY_RIBBON_STYLE.icon) ?? PenLine;

  return (
    <div
      role="group"
      aria-label="关系层"
      data-testid="atlas-relation-filter"
      className="absolute right-2 top-2 z-30 w-60 space-y-1.5 rounded-lg border border-border/60 bg-popover/95 p-2 shadow-lg"
    >
      <div className="flex items-center gap-1.5">
        <span className={sectionTitleClass}>关系层</span>
        <button
          type="button"
          aria-label="关闭关系层"
          onClick={onClose}
          className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {POLITICS_LINE_STYLES.map((layer) => {
        const Icon = lucideIcon(layer.icon);
        const checked = enabledTypes.has(layer.id);
        return (
          <label
            key={layer.id}
            className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground"
          >
            <input
              type="checkbox"
              checked={checked}
              aria-label={`显示关系类型 ${layer.label}`}
              onChange={(event) => onToggleType(layer.id, event.target.checked)}
              className="h-3 w-3"
            />
            <span className="w-14 shrink-0">{layer.label}</span>
            <LineSample lineStyle={layer.lineStyle} tone={layer.color} />
            <span className="ml-auto flex items-center gap-1 text-muted-foreground">
              {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
              <code className="text-[9px]">{layer.icon}</code>
            </span>
          </label>
        );
      })}

      <div className="flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[11px] text-foreground">
        <input
          id="atlas-ribbon-toggle"
          type="checkbox"
          checked={showRibbons}
          aria-label="显示条约缎带"
          onChange={(event) => onToggleRibbons(event.target.checked)}
          className="h-3 w-3"
        />
        <label htmlFor="atlas-ribbon-toggle" className="cursor-pointer">
          条约
        </label>
        <LineSample lineStyle={TREATY_RIBBON_STYLE.lineStyle} tone={TREATY_RIBBON_STYLE.color} />
        <span className="flex items-center gap-1 text-muted-foreground">
          <RibbonIcon className="h-3 w-3" aria-hidden="true" />
          <code className="text-[9px]">{TREATY_RIBBON_STYLE.icon}</code>
        </span>
        <button
          type="button"
          onClick={onOpenTreatyBook}
          className="ml-auto flex items-center gap-1 rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-primary motion-reduce:transition-none"
        >
          <Compass className="h-3 w-3" aria-hidden="true" />
          条约簿 {treatyCount}
        </button>
      </div>

      {customTypes.length === 0 ? (
        <div className={labelClass} title="在模块配置中登记自定义关联类型后可用">
          自定义关联：尚未登记类型
        </div>
      ) : (
        customTypes.map((definition) => {
          const Icon = lucideIcon(definition.icon);
          return (
            <label
              key={definition.id}
              className="flex cursor-pointer items-center gap-1.5 text-[11px] text-foreground"
            >
              <input
                type="checkbox"
                checked={customEnabled.has(definition.id)}
                aria-label={`显示自定义关系 ${definition.label}`}
                onChange={(event) => onToggleCustom(definition.id, event.target.checked)}
                className="h-3 w-3"
              />
              <span className="w-14 shrink-0 truncate">{definition.label}</span>
              <LineSample lineStyle="dashed" tone={definition.color ?? 'slate'} />
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                <code className="text-[9px]">{definition.icon ?? 'link-2'}</code>
              </span>
            </label>
          );
        })
      )}

      <label className="flex cursor-pointer items-center gap-1.5 border-t border-border/40 pt-1.5 text-[11px] text-foreground">
        <input
          type="checkbox"
          checked={onlyRelated}
          aria-label="仅看与选中节点相关的关系"
          onChange={(event) => onToggleOnlyRelated(event.target.checked)}
          className="h-3 w-3"
        />
        仅看与选中节点相关
      </label>
      <div className={labelClass}>
        {onlyRelated ? '聚焦时只保留相关边' : '聚焦时其余边降至 10% 透明度'}
      </div>
    </div>
  );
};

export default RelationFilterPanel;
