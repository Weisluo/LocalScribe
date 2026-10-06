/**
 * 统治者编辑（Phase 4 P4 fix；politics_ui_design §5.2/§3.8.2）
 *
 * 「设置 / 更换 / 移除」全部走 setRuler：写 `figure -> polity` 的 leads 边，
 * 职位 / 任期 / 主要任职都在边上（同一人物时更新既有边，换人时删旧边建新边）。
 * 结果（含 skippedLinks / failedLinks）必须落 toast：不再无条件显示「已保存」。
 */

import { useState } from 'react';
import { Loader2, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import type { UsePoliticsResult } from '../hooks';
import { politicsRefOf, type FigureEntity, type PolityEntity } from '../types';
import { fieldClass, labelClass } from '../tone';

export interface RulerEditorProps {
  politics: UsePoliticsResult;
  entity: PolityEntity;
  worldId: string;
  /** 当前统治者（可能为空） */
  fixture?: FigureEntity;
  officeTitle?: string;
  start?: string;
  end?: string;
  isPrimary?: boolean;
  onClose: () => void;
}

export const RulerEditor = ({
  politics,
  entity,
  worldId,
  fixture,
  officeTitle,
  start,
  end,
  isPrimary,
  onClose,
}: RulerEditorProps) => {
  const entityRef = politicsRefOf(entity.id, entity.kind);
  const initialCharacterId = fixture?.meta.characterId;
  const [characterRef, setCharacterRef] = useState<EntityRef | null>(
    initialCharacterId
      ? { module: 'character', kind: 'character', id: initialCharacterId }
      : null
  );
  const [office, setOffice] = useState(officeTitle ?? '');
  const [from, setFrom] = useState(start ?? '');
  const [to, setTo] = useState(end ?? '');
  const [primary, setPrimary] = useState(isPrimary ?? true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedName = characterRef ? politics.refs.resolveName(characterRef) : '';

  const handleConfirm = (selection: EntityPickerSelection) => {
    setCharacterRef(selection.targets[0] ?? null);
    setPickerOpen(false);
  };

  /** setRuler 的结果落 toast：写入失败 / 被跳过的关联都显式报出 */
  const reportResult = (result: { skippedLinks: string[]; failedLinks: string[] }, okText: string) => {
    if (result.failedLinks.length > 0) {
      toast.error(`统治者写入失败：${result.failedLinks.join('、')}`);
      return;
    }
    if (result.skippedLinks.length > 0) {
      toast.warning(`统治者未变更：同类关联已存在（${result.skippedLinks.join('、')}）`);
      return;
    }
    toast.success(okText);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const result = await politics.setRuler(entity.id, {
        characterId: characterRef?.id,
        officeTitle: office.trim() || undefined,
        start: from.trim() || undefined,
        end: to.trim() || undefined,
        isPrimary: primary,
      });
      reportResult(result, characterRef ? '统治者已保存（职位与任期写入任职边）' : '已移除统治者');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '统治者保存失败');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      const result = await politics.setRuler(entity.id, { characterId: undefined });
      reportResult(result, '已移除统治者');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '统治者移除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="polity-ruler-editor"
      className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-2"
    >
      <div className="flex items-center gap-1.5">
        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-[11px] font-medium text-foreground">统治者 / 任职</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          职位与任期保存在 leads 边上
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">全局角色</span>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-accent/30"
        >
          {selectedName || '选择角色'}
        </button>
        {selectedName ? (
          <button
            type="button"
            onClick={() => setCharacterRef(null)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            清除
          </button>
        ) : null}
      </div>

      <label className="block space-y-0.5">
        <span className={labelClass}>职位</span>
        <input
          type="text"
          value={office}
          onChange={(event) => setOffice(event.target.value)}
          placeholder="如：执政官 / 大统领"
          aria-label="统治者职位"
          className={fieldClass}
        />
      </label>

      <div className="flex gap-2">
        <label className="flex-1 space-y-0.5">
          <span className={labelClass}>任期起</span>
          <input
            type="text"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            placeholder="可选"
            aria-label="统治者任期起"
            className={fieldClass}
          />
        </label>
        <label className="flex-1 space-y-0.5">
          <span className={labelClass}>任期止</span>
          <input
            type="text"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="可选"
            aria-label="统治者任期止"
            className={fieldClass}
          />
        </label>
      </div>

      <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <input
          type="checkbox"
          checked={primary}
          onChange={(event) => setPrimary(event.target.checked)}
          aria-label="设为主要任职"
          className="h-3.5 w-3.5"
        />
        主要任职（isPrimary）
      </label>

      <div className="flex items-center justify-end gap-2">
        {fixture ? (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={busy}
            aria-label="移除统治者"
            title="移除统治者（删除 leads 边，人物与政权都保留）"
            className="mr-auto flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            移除统治者
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent/10 hover:text-foreground"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy}
          className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          保存任职
        </button>
      </div>

      <EntityPicker
        open={pickerOpen}
        worldId={worldId}
        source={entityRef}
        presetModule="character"
        kindFilter={['character']}
        simpleMode
        onClose={() => setPickerOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default RulerEditor;
