/**
 * 聚焦抽屉壳（Phase 4 P4-T8；politics_ui_design §4.3/§4.9）
 *
 * 只负责面板自身：按 kind 取默认宽度（FOCUS_PANEL_WIDTH）、窄屏转全屏 sheet、
 * 固定 / 关闭、标题行的等级与状态徽章、关联出 / 入计数、详情内部锚点滚动，
 * 以及 Esc 先收内部浮层再交给上层关面板。聚焦降噪由画布层处理，面板不参与（§4.2.6）。
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, Pin, PinOff, Trash2, X } from 'lucide-react';

import { FOCUS_PANEL_WIDTH } from '../config';
import { toneSurfaceClass, toneTextClass } from '../tone';
import { lucideIcon } from '../../shared/lucideIcon';
import { CountPill } from './sectionParts';
import { useFocusTrap } from './useFocusTrap';

/** 中屏以下（§4.9 窄屏 / 移动）详情改为覆盖式全屏 sheet */
const NARROW_FOCUS_QUERY = '(max-width: 1023px)';

const useNarrowScreen = (): boolean => {
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_FOCUS_QUERY).matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const query = window.matchMedia(NARROW_FOCUS_QUERY);
    const onChange = () => setNarrow(query.matches);
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
};

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface FocusAnchor {
  id: string;
  label: string;
}

export interface FocusDrawerProps {
  /** polity / organization / figure / treaty（自定义 kind 回落后的形态） */
  kind: string;
  title: string;
  /** Lucide 图标名，来自 EntityTypeDef.icon */
  icon?: string;
  tone?: string;
  /** 等级 / 状态徽章（术语替换后的文字） */
  levelLabel?: string;
  statusLabel?: string;
  /** 终端状态：文字标注 + 降噪（§2.1 补充规则 2） */
  terminal?: boolean;
  counts: { out: number; in: number };
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  /** 详情内部锚点（政权六段）；为空则不渲染锚点行 */
  anchors?: FocusAnchor[];
  onEdit?: () => void;
  onDelete?: () => void;
  /** 内部浮层（边卡）打开中：Esc 先收浮层，不关面板（§5.1.4） */
  overlayOpen?: boolean;
  onCloseOverlay?: () => void;
  children: ReactNode;
}

export const FocusDrawer = ({
  kind,
  title,
  icon,
  tone,
  levelLabel,
  statusLabel,
  terminal = false,
  counts,
  pinned,
  onTogglePin,
  onClose,
  anchors,
  onEdit,
  onDelete,
  overlayOpen = false,
  onCloseOverlay,
  children,
}: FocusDrawerProps) => {
  const narrow = useNarrowScreen();
  const width = FOCUS_PANEL_WIDTH[kind] ?? 420;
  const Icon = lucideIcon(icon);

  // Esc 逐级：内部浮层打开时只收浮层；用捕获阶段拦住上层的全局 Esc（§5.1.4）
  useEffect(() => {
    if (!overlayOpen) return undefined;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onCloseOverlay?.();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [overlayOpen, onCloseOverlay]);

  /**
   * 窄屏形态是覆盖式全屏 sheet（dialog）：Tab 必须在面板内循环，Esc 只关这一层。
   * 桌面并排形态是 complementary，不抢键盘。
   */
  const trapRef = useFocusTrap<HTMLElement>({
    active: narrow && !overlayOpen,
    onEscape: onClose,
  });

  const scrollToSection = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const containerClass = narrow
    ? 'fixed inset-0 z-40 flex flex-col overflow-hidden bg-card'
    : `flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-lg border bg-card/60 ${
        pinned ? 'border-primary/40' : 'border-border/50'
      }`;

  return (
    <aside
      ref={trapRef}
      role={narrow ? 'dialog' : 'complementary'}
      aria-modal={narrow ? true : undefined}
      aria-label={`${title} 聚焦详情`}
      data-testid="focus-panel"
      data-kind={kind}
      data-pinned={pinned}
      className={containerClass}
      style={narrow ? undefined : { width }}
    >
      <header className="shrink-0 space-y-1.5 border-b border-border/50 px-3 py-2">
        <div className="flex items-start gap-2">
          {Icon ? (
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="min-w-0 truncate text-xs font-semibold text-foreground" title={title}>
                {title}
              </h2>
              {levelLabel ? (
                <span className={`${toneSurfaceClass(tone ?? 'gold')} rounded-full border border-border/50 px-1.5 py-0.5 text-[10px]`}>
                  {levelLabel}
                </span>
              ) : null}
              {statusLabel ? (
                <span
                  className={`rounded-full border border-border/50 px-1.5 py-0.5 text-[10px] ${
                    terminal ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {statusLabel}
                  {terminal ? '（终端）' : ''}
                </span>
              ) : null}
              {pinned ? (
                <span className="rounded-full border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary">
                  已固定
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <CountPill value={counts.out} label="出" />
              <CountPill value={counts.in} label="入" />
              <span className="text-[10px] text-muted-foreground">关联</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={pinned}
              data-testid="focus-pin"
              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                pinned
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {pinned ? (
                <PinOff className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Pin className="h-3 w-3" aria-hidden="true" />
              )}
              {pinned ? '取消固定' : '固定'}
            </button>
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                aria-label="编辑"
                title="编辑"
                data-testid="focus-edit"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                aria-label="删除"
                title="删除"
                data-testid="focus-delete"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭详情"
              title="关闭"
              data-testid="focus-close"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {anchors && anchors.length > 0 ? (
          <nav
            aria-label="详情分段"
            data-testid="focus-anchors"
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground"
          >
            {anchors.map((anchor, index) => (
              <span key={anchor.id} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden="true">·</span> : null}
                <button
                  type="button"
                  onClick={() => scrollToSection(anchor.id)}
                  className="transition-colors hover:text-foreground"
                >
                  {anchor.label}
                </button>
              </span>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" data-testid="focus-body">
        {children}
      </div>

      {narrow ? (
        <footer className="shrink-0 border-t border-border/50 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-border px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30"
          >
            关闭详情
          </button>
        </footer>
      ) : null}

      {terminal ? (
        <div className={`shrink-0 px-3 pb-2 text-[10px] ${toneTextClass(tone)}`}>
          终端状态：画布降为幽灵节点，数据保留
        </div>
      ) : null}
    </aside>
  );
};

export default FocusDrawer;
