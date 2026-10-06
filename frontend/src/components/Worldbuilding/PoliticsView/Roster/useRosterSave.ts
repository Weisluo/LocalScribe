/**
 * 名录行内写入（Phase 4 P4-T9；politics_ui_design §4.4.6）
 *
 * 行内编辑一律走 politics.updateEntity；失败给 sonner toast，不弹原生 alert。
 * 组件内不发起自己的请求（§11.2），只是把写操作包一层 pending 与错误提示。
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import type { UsePoliticsResult } from '../hooks';

export interface RosterSaveState {
  saving: boolean;
  /** 行内字段写入；返回是否成功 */
  save: (entityId: string, values: Parameters<UsePoliticsResult['updateEntity']>[1]) => Promise<boolean>;
}

export const useRosterSave = (politics: UsePoliticsResult): RosterSaveState => {
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (
      entityId: string,
      values: Parameters<UsePoliticsResult['updateEntity']>[1]
    ): Promise<boolean> => {
      setSaving(true);
      try {
        await politics.updateEntity(entityId, values);
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        toast.error(`保存失败：${message}`);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [politics]
  );

  return { saving, save };
};
