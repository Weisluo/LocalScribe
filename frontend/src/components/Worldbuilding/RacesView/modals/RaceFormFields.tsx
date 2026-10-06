/**
 * 速写表单主体 RaceFormFields（Phase 3 P3-T3；races_ui_design §5.1.1/§5.1.3/§7）
 *
 * 主条目与支系共用同一套最小字段：名称（必填）+ 一句话特征 + 代表色 + 图标，
 * 其余（标签 / 居住地 / 起源 / 状态 / 自定义字段）折叠在「更多字段」下。
 * 代表色是可点选的真实色块（不用 emoji）；图标名走 Lucide 名输入。
 * 键盘：Ctrl/Cmd+Enter 保存；Esc 由外层 Modal 承担关闭。
 */

import { useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { CustomFieldRenderer } from '../../shared/CustomFieldRenderer';
import { writeCustomField } from '../../shared/customFieldModel';
import {
  statusDefsOf,
  type CustomFieldDef,
  type CustomFieldValue,
  type EntityTypeDef,
  type ModuleConfig,
} from '../../shared/moduleConfig';
import { emblemPaletteOf } from '../config';
import type { RaceFormState } from './raceFormState';

const FIELD_CLASS =
  'w-full rounded-md border border-border/50 bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]';

export interface RaceFormFieldsProps {
  state: RaceFormState;
  onChange: (patch: Partial<RaceFormState>) => void;
  config: ModuleConfig;
  /** 可选的主条目 kind（传空数组则不渲染 kind 选择） */
  kindOptions?: EntityTypeDef[];
  /** 支系表单：显示所属主条目 */
  parentName?: string;
  customFields: CustomFieldDef[];
  submitLabel: string;
  submitting?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export const RaceFormFields = ({
  state,
  onChange,
  config,
  kindOptions = [],
  parentName,
  customFields,
  submitLabel,
  submitting = false,
  disabled = false,
  onCancel,
  onSubmit,
}: RaceFormFieldsProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const palette = emblemPaletteOf(config);
  const statuses = statusDefsOf(config);
  const nameMissing = !state.name.trim();

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!disabled) onSubmit();
    }
  };

  return (
    <div className="space-y-3" onKeyDown={handleKeys}>
      <label className="block space-y-0.5">
        <span className="text-[11px] font-medium text-foreground">名称</span>
        <input
          type="text"
          value={state.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="族裔名称"
          aria-label="名称"
          className={FIELD_CLASS}
        />
        {nameMissing && <span className="text-[10px] text-muted-foreground">名称必填</span>}
      </label>

      {parentName && (
        <div className="text-[11px] text-muted-foreground" data-testid="subrace-parent">
          所属主条目：{parentName}
        </div>
      )}

      <label className="block space-y-0.5">
        <span className="text-[11px] font-medium text-foreground">一句话特征</span>
        <input
          type="text"
          value={state.tagline}
          onChange={(event) => onChange({ tagline: event.target.value })}
          placeholder="如 逐水草而居的商旅族裔"
          aria-label="一句话特征"
          className={FIELD_CLASS}
        />
      </label>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-foreground">代表色</span>
        <div className="flex flex-wrap items-center gap-1.5" data-testid="emblem-palette">
          {palette.map((color, index) => (
            <button
              // 配置的色板可能出现重复色值：key 用「值 + 下标」保持稳定唯一
              key={`${color}-${index}`}
              type="button"
              aria-label={`代表色 ${color}`}
              aria-pressed={state.emblemColor === color}
              onClick={() => onChange({ emblemColor: color })}
              style={{ backgroundColor: color }}
              className={`h-6 w-6 rounded-md border-2 transition-[border-color,transform] motion-reduce:transition-none ${
                state.emblemColor === color
                  ? 'border-foreground'
                  : 'border-transparent hover:border-border'
              }`}
            />
          ))}
          <input
            type="text"
            value={state.emblemColor}
            onChange={(event) => onChange({ emblemColor: event.target.value })}
            placeholder="#0f766e"
            aria-label="代表色取值"
            className={`${FIELD_CLASS} w-28`}
          />
        </div>
      </div>

      <label className="block space-y-0.5">
        <span className="text-[11px] font-medium text-foreground">Lucide 图标名</span>
        <input
          type="text"
          value={state.emblemIcon}
          onChange={(event) => onChange({ emblemIcon: event.target.value })}
          placeholder="如 book-marked、sprout、moon"
          aria-label="图标名"
          className={FIELD_CLASS}
        />
      </label>

      <button
        type="button"
        onClick={() => setMoreOpen((value) => !value)}
        aria-expanded={moreOpen}
        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        {moreOpen ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        更多字段
      </button>

      {moreOpen && (
        <div className="space-y-2 rounded-md border border-border/50 p-2" data-testid="race-form-more">
          {kindOptions.length > 1 && (
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-foreground">类型</span>
              <select
                value={state.kind}
                onChange={(event) => onChange({ kind: event.target.value })}
                aria-label="类型"
                className={FIELD_CLASS}
              >
                {kindOptions.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-foreground">特征标签（逗号分隔）</span>
            <input
              type="text"
              value={state.traits}
              onChange={(event) => onChange({ traits: event.target.value })}
              placeholder="如 长寿，善水，夜行"
              aria-label="特征标签"
              className={FIELD_CLASS}
            />
          </label>

          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-foreground">
              居住地文本（地图未接入时回退展示）
            </span>
            <input
              type="text"
              value={state.habitatText}
              onChange={(event) => onChange({ habitatText: event.target.value })}
              aria-label="居住地文本"
              className={FIELD_CLASS}
            />
          </label>

          <label className="block space-y-0.5">
            <span className="text-[11px] font-medium text-foreground">起源文本</span>
            <input
              type="text"
              value={state.originText}
              onChange={(event) => onChange({ originText: event.target.value })}
              aria-label="起源文本"
              className={FIELD_CLASS}
            />
          </label>

          {statuses.length > 0 && (
            <label className="block space-y-0.5">
              <span className="text-[11px] font-medium text-foreground">状态</span>
              <select
                value={state.status}
                onChange={(event) => onChange({ status: event.target.value })}
                aria-label="状态"
                className={FIELD_CLASS}
              >
                <option value="">未设置</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {customFields.length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-foreground">自定义字段</span>
              <CustomFieldRenderer
                fields={customFields}
                values={state.customFields}
                onChange={(fieldId: string, value: CustomFieldValue) =>
                  // writeCustomField 保留 schema 之外的历史键（§7 / P3-T8）
                  onChange({
                    customFields: writeCustomField(state.customFields, fieldId, value),
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || disabled}
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
};
