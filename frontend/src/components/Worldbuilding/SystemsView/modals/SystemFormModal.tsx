/**
 * SystemFormModal（Phase 3 P3-T5；systems_ui_design §3.2/§5.1.1/§8/§9）
 *
 * 新建 / 编辑体系：体系名（必填）+ 一句话说明（§5.1.1 标注必填，但不阻塞保存，
 * 只作为推荐项提示），类型 / Lucide 图标 / 颜色 / 排序方向与自定义字段折叠在「更多」。
 * 不预置任何体系类型或模板（§12.2）；自定义字段走 CustomFieldRenderer（契约 §2.7）。
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Layers, Loader2, Save } from 'lucide-react';

import { Modal } from '@/components/Modals/Modal';
import {
  CustomFieldRenderer,
  type CustomFieldValues,
} from '../../shared/CustomFieldRenderer';
import {
  customFieldsOf,
  type EntityTypeDef,
  type ModuleConfig,
} from '../../shared/moduleConfig';
import { missingRequiredFields } from '../../shared/customFieldModel';
import { SYSTEM_KIND, type SystemEntity } from '../types';
import type { SystemFormValues } from '../hooks/useSystems';
import { colorDot, lucideIcon } from '../components/systemsSupport';

const FIELD_CLASS =
  'w-full rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/15';

export interface SystemFormModalProps {
  open: boolean;
  onClose: () => void;
  config: ModuleConfig;
  kinds: EntityTypeDef[];
  /** 编辑目标；缺省为新建 */
  system?: SystemEntity | null;
  onSubmit: (values: SystemFormValues, customFields: CustomFieldValues) => Promise<unknown>;
  isSubmitting?: boolean;
}

export const SystemFormModal = ({
  open,
  onClose,
  config,
  kinds,
  system,
  onSubmit,
  isSubmitting = false,
}: SystemFormModalProps) => {
  const editing = !!system;
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [rankDirection, setRankDirection] = useState<'ascending' | 'descending'>('ascending');
  const [customFields, setCustomFields] = useState<CustomFieldValues>({});
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(system?.name ?? '');
    setTagline(system?.meta.tagline ?? '');
    setCategoryLabel(system?.meta.categoryLabel ?? '');
    setIcon(system?.meta.icon ?? '');
    setColor(system?.meta.color ?? '');
    setRankDirection(system?.meta.rankDirection ?? 'ascending');
    setCustomFields(system?.meta.customFields ?? {});
    setShowMore(false);
    setError(null);
    // 依赖用 system?.id：世界 refetch 会换对象引用，用对象会把正在填写的内容重置掉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, system?.id]);

  const fields = customFieldsOf(config, SYSTEM_KIND, kinds);
  const Icon = lucideIcon(icon) ?? Layers;
  const dot = color ? colorDot(color) : null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('体系名不能为空');
      return;
    }
    // 自定义字段的必填校验（P6-T4）：字段定义来自 config.fieldSchema
    const missing = missingRequiredFields(fields, customFields);
    if (missing.length) {
      setError(`必填字段未填写：${missing.join('、')}`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          // 传空串而非 undefined：mergeMeta 会删除该键，编辑时可清空（§3.2）
          tagline: tagline.trim(),
          categoryLabel: categoryLabel.trim(),
          icon: icon.trim(),
          color: color.trim(),
          rankDirection,
        },
        customFields
      );
      onClose();
    } catch {
      // 失败提示由数据层统一 toast，保留表单便于重试
    } finally {
      setSaving(false);
    }
  };

  const pending = saving || isSubmitting;

  return (
    <Modal isOpen={open} onClose={onClose} title={editing ? '编辑体系' : '新建体系'}>
      <div className="space-y-4" data-testid="system-form">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">
            体系名 <span className="text-destructive">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="用户自定义的体系名"
            aria-label="体系名"
            autoFocus
            className={FIELD_CLASS}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">一句话说明</span>
          <input
            type="text"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
            placeholder="例如：这个世界最核心的进阶路径"
            aria-label="一句话说明"
            className={FIELD_CLASS}
          />
          <span className="text-xs text-muted-foreground">
            建议填写（最短路径要求「体系名 + 一句话」）；留空不阻塞保存，可后补。
          </span>
        </label>

        <button
          type="button"
          onClick={() => setShowMore((value) => !value)}
          aria-expanded={showMore}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {showMore ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
          更多（类型 / 图标 / 颜色 / 排序方向 / 自定义字段）
        </button>

        {showMore && (
          <div className="space-y-4 rounded-xl border border-border/40 bg-muted/20 p-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                类型（展示名，由用户定义）
              </span>
              <input
                type="text"
                value={categoryLabel}
                onChange={(event) => setCategoryLabel(event.target.value)}
                placeholder="如 修炼 / 科技 / 制度，不预置任何选项"
                aria-label="体系类型"
                className={FIELD_CLASS}
              />
            </label>

            <div className="flex gap-2">
              <label className="flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Lucide 图标名
                </span>
                <input
                  type="text"
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                  placeholder="如 layers / sparkles"
                  aria-label="图标名"
                  className={FIELD_CLASS}
                />
              </label>
              <label className="flex-1 space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  颜色（token 或 hex）
                </span>
                <input
                  type="text"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder="如 violet / #6d28d9"
                  aria-label="颜色"
                  className={FIELD_CLASS}
                />
              </label>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-4 w-4" aria-hidden="true" />
                预览
              </span>
              {dot && (
                <span
                  className={`h-2.5 w-2.5 rounded-full ${dot.className}`}
                  style={dot.style}
                  aria-hidden="true"
                />
              )}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                排序方向
              </span>
              <select
                value={rankDirection}
                onChange={(event) =>
                  setRankDirection(event.target.value as 'ascending' | 'descending')
                }
                aria-label="排序方向"
                className={FIELD_CLASS}
              >
                <option value="ascending">升序（低阶在前，默认）</option>
                <option value="descending">降序</option>
              </select>
            </label>

            {fields.length > 0 && (
              <CustomFieldRenderer
                fields={fields}
                values={customFields}
                onChange={(fieldId, value) =>
                  setCustomFields((prev) => ({ ...prev, [fieldId]: value }))
                }
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border/30 pt-3">
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="rounded-lg border border-border/50 bg-muted/40 px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground"
          >
            取消
          </motion.button>
          <motion.button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/90 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-primary/20 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            保存
          </motion.button>
        </div>
      </div>
    </Modal>
  );
};
