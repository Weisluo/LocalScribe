/**
 * 新建 / 编辑主条目 RaceFormModal（Phase 3 P3-T3；races_ui_design §5.1、§8）
 *
 * 速写优先：名称（必填）+ 一句话特征 + 代表色/图标；其余字段折叠在「更多字段」。
 * 提交调 createRace / updateRace（由父级决定），自定义字段随 meta.customFields 一起写回，
 * 保证写库经过 writeCustomField（未知键不丢）。Ctrl/Cmd+Enter 保存、Esc 取消（Modal 承担）。
 */

import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/Modals/Modal';
import {
  customFieldsOf,
  type CustomFieldValue,
  type EntityTypeDef,
  type ModuleConfig,
} from '../../shared/moduleConfig';
import { missingRequiredFields } from '../../shared/customFieldModel';
import type { RaceFormValues } from '../hooks/useRaces';
import { RACE_KIND, RACE_KINDS, type RaceNode } from '../types';
import { RaceFormFields } from './RaceFormFields';
import {
  newRaceFormState,
  raceFormStateOf,
  toRaceFormValues,
  validateRaceForm,
  type RaceFormState,
} from './raceFormState';

export interface RaceFormModalProps {
  open: boolean;
  config: ModuleConfig;
  /** 全部 kind（自定义字段按 kind 取；主条目可选 kind 从中筛根层级） */
  kinds: EntityTypeDef[];
  /** 编辑目标；为空表示新建 */
  node?: RaceNode | null;
  onClose: () => void;
  onSubmit: (
    values: RaceFormValues,
    customFields: Record<string, CustomFieldValue>
  ) => Promise<unknown>;
}

export const RaceFormModal = ({
  open,
  config,
  kinds,
  node,
  onClose,
  onSubmit,
}: RaceFormModalProps) => {
  const [state, setState] = useState<RaceFormState>(() => newRaceFormState(config));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const wasOpen = useRef(false);

  // 只在打开时重置草稿：避免父级渲染出的新对象把输入清掉
  useEffect(() => {
    if (open && !wasOpen.current) {
      setState(node ? raceFormStateOf(node, config) : newRaceFormState(config));
      setError(null);
    }
    wasOpen.current = open;
  }, [open, node, config]);

  const rootKinds = kinds.filter((def) => !def.parentKind || def.id === RACE_KIND);
  const customFields = customFieldsOf(config, state.kind, RACE_KINDS);

  const handleSubmit = async () => {
    const reason = validateRaceForm(state);
    if (reason) {
      setError(reason);
      return;
    }
    // 自定义字段的必填校验（P6-T4）：与 CustomFieldRenderer 共用同一套纯函数
    const missing = missingRequiredFields(customFields, state.customFields);
    if (missing.length) {
      setError(`必填字段未填写：${missing.join('、')}`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(toRaceFormValues(state), state.customFields);
      onClose();
    } catch {
      // 失败提示由数据层 toast 统一处理，保留弹窗便于重试
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={node ? '编辑条目' : '新建种族'}
      size="md"
    >
      <div className="space-y-3" data-testid="race-form">
        {error && (
          <div
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            data-testid="race-form-error"
          >
            {error}
          </div>
        )}
        <RaceFormFields
          state={state}
          onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
          config={config}
          // 换 kind 只在新建时有意义（updateRace 不改 kind）
          kindOptions={node ? [] : rootKinds}
          customFields={customFields}
          submitLabel="保存"
          submitting={submitting}
          onCancel={onClose}
          onSubmit={() => void handleSubmit()}
        />
      </div>
    </Modal>
  );
};
