/**
 * 政治模块配置面板（Phase 4 P4-T11；politics_ui_design §7/§3.7）
 *
 * 优先复用 shared/ModuleConfigPanel 的既有能力（类型 / 字段 / 状态与等级 / 术语与默认复杂度）；
 * 政治侧只补三件事：displayMode 只能取三主视图之一、palette（红金色板）、三视图术语快捷入口。
 * levels / statuses / fieldSchema / linkTypes / terminology 默认全空，不预置任何内容。
 */

import { useRef, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { toast } from 'sonner';

import { ModuleConfigPanel } from '../../shared/ModuleConfigPanel';
import type { ModuleConfig } from '../../shared/moduleConfig';
import {
  POLITICS_VIEWS,
  POLITICS_VIEW_LABELS,
  resolvePoliticsView,
  type PoliticsViewId,
} from '../config';
import { POLITICS_BUILTIN_KINDS, POLITICS_MAX_ORG_DEPTH } from '../types';
import { fieldClass, labelClass } from '../tone';

export interface PoliticsConfigPanelProps {
  open: boolean;
  onClose: () => void;
  config: ModuleConfig;
  /** 后端原始 config：对象键增量保存的基底，缺了会丢未编辑的同级子键 */
  rawConfig?: ModuleConfig;
  onSave: (patch: ModuleConfig) => Promise<void>;
}

/** 三视图术语键：只有用户填写才写入 terminology（§7.5 不预填用户世界用词） */
const VIEW_TERM_KEYS: PoliticsViewId[] = [...POLITICS_VIEWS];

const PoliticsViewExtras = ({
  config,
  onSave,
}: {
  config: ModuleConfig;
  onSave: (patch: ModuleConfig) => Promise<void>;
}) => {
  const [displayMode, setDisplayMode] = useState<PoliticsViewId>(
    resolvePoliticsView(config.displayMode)
  );
  const [accent, setAccent] = useState(config.palette?.accent ?? '');
  const [surface, setSurface] = useState(config.palette?.surface ?? '');
  const [viewTerms, setViewTerms] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of VIEW_TERM_KEYS) initial[key] = config.terminology?.[key] ?? '';
    return initial;
  });
  const [saving, setSaving] = useState(false);
  /** 术语与色板按最新 config 合并，避免把基础面板刚保存的子键回退 */
  const latestConfig = useRef(config);
  latestConfig.current = config;

  const handleSave = async () => {
    setSaving(true);
    try {
      const terminology: Record<string, string> = { ...(latestConfig.current.terminology ?? {}) };
      for (const key of VIEW_TERM_KEYS) {
        const value = viewTerms[key]?.trim();
        if (value) terminology[key] = value;
      }
      const palette =
        accent.trim() || surface.trim()
          ? { accent: accent.trim() || undefined, surface: surface.trim() || undefined }
          : undefined;
      await onSave({ displayMode, palette, terminology });
      toast.success('视图与色板已保存');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border/50 p-2" data-testid="politics-config-extras">
      <div className="text-[11px] font-medium text-foreground">视图、色板与三视图术语</div>

      <label className="block space-y-0.5">
        <span className={labelClass}>默认视图（三主视图之一）</span>
        <select
          value={displayMode}
          onChange={(event) => setDisplayMode(event.target.value as PoliticsViewId)}
          aria-label="默认视图"
          className={fieldClass}
        >
          {POLITICS_VIEWS.map((view) => (
            <option key={view} value={view}>
              {POLITICS_VIEW_LABELS[view]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <label className="flex-1 space-y-0.5">
          <span className={labelClass}>强调色 accent</span>
          <input
            type="text"
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            placeholder="留空沿用默认红金"
            aria-label="强调色"
            className={fieldClass}
          />
        </label>
        <label className="flex-1 space-y-0.5">
          <span className={labelClass}>底色 surface</span>
          <input
            type="text"
            value={surface}
            onChange={(event) => setSurface(event.target.value)}
            placeholder="留空沿用默认底色"
            aria-label="底色"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="space-y-1">
        <span className={labelClass}>三视图术语（留空则用默认文案）</span>
        {VIEW_TERM_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">{key}</span>
            <input
              type="text"
              value={viewTerms[key] ?? ''}
              onChange={(event) =>
                setViewTerms((prev) => ({ ...prev, [key]: event.target.value }))
              }
              placeholder={POLITICS_VIEW_LABELS[key]}
              aria-label={`术语 ${key}`}
              className={fieldClass}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/30 disabled:opacity-50"
        >
          {saving ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          保存视图与色板
        </button>
      </div>
    </div>
  );
};

export const PoliticsConfigPanel = ({
  open,
  onClose,
  config,
  rawConfig,
  onSave,
}: PoliticsConfigPanelProps) => (
  <ModuleConfigPanel
    open={open}
    onClose={onClose}
    config={config}
    rawConfig={rawConfig}
    onSave={onSave}
    builtins={POLITICS_BUILTIN_KINDS}
    maxDepth={POLITICS_MAX_ORG_DEPTH}
    title="政治模块配置"
    // key 让附加区在每次打开时按最新 config 重新初始化
    extra={
      <PoliticsViewExtras key={open ? 'open' : 'closed'} config={config} onSave={onSave} />
    }
  />
);

export default PoliticsConfigPanel;
