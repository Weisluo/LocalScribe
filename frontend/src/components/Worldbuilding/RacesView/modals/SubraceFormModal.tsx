/**
 * 新建 / 编辑支系 SubraceFormModal（Phase 3 P3-T3；races_ui_design §5.1.4、§8）
 *
 * 与主条目同一套最小字段，差别：kind 固定 subrace、parent_id 指向所属主条目（父级在提交时写入），
 * 顶部显示所属主条目；第三层入口不渲染（canOwnSubrace 由详情页把关）。
 */

import { useEffect, useRef, useState } from 'react';

import { Modal } from '@/components/Modals/Modal';
import {
  customFieldsOf,
  type CustomFieldValue,
  type ModuleConfig,
} from '../../shared/moduleConfig';
import type { RaceFormValues } from '../hooks/useRaces';
import { RACE_KINDS, SUBRACE_KIND, type RaceNode } from '../types';
import { RaceFormFields } from './RaceFormFields';
import {
  newRaceFormState,
  raceFormStateOf,
  toRaceFormValues,
  validateRaceForm,
  type RaceFormState,
} from './raceFormState';

export interface SubraceFormModalProps {
  open: boolean;
  config: ModuleConfig;
  /** 所属主条目（新建时必填；编辑时用于展示） */
  parent?: RaceNode | null;
  /** 编辑目标；为空表示新建 */
  node?: RaceNode | null;
  onClose: () => void;
  onSubmit: (
    values: RaceFormValues,
    customFields: Record<string, CustomFieldValue>
  ) => Promise<unknown>;
}

export const SubraceFormModal = ({
  open,
  config,
  parent,
  node,
  onClose,
  onSubmit,
}: SubraceFormModalProps) => {
  const [state, setState] = useState<RaceFormState>(() =>
    newRaceFormState(config, SUBRACE_KIND)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setState(
        node ? raceFormStateOf(node, config) : newRaceFormState(config, SUBRACE_KIND)
      );
      setError(null);
    }
    wasOpen.current = open;
  }, [open, node, config]);

  const customFields = customFieldsOf(config, state.kind, RACE_KINDS);

  const handleSubmit = async () => {
    const reason = validateRaceForm(state);
    if (reason) {
      setError(reason);
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
      title={node ? '编辑支系' : '添加支系'}
      size="md"
    >
      <div className="space-y-2" data-testid="subrace-form">
        {error && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive"
            data-testid="subrace-form-error"
          >
            {error}
          </div>
        )}
        <RaceFormFields
          state={state}
          onChange={(patch) => setState((prev) => ({ ...prev, ...patch }))}
          config={config}
          parentName={parent?.name}
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
