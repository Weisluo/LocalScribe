/**
 * 删除确认弹层（Phase 4 P4-T11；politics_ui_design §5.4/§6.8/§9.2）
 *
 * 删除确认必须逐项列出受影响对象（卫星组织 / 人物任职边 / 条约缔约边 / 跨模块关联），
 * 三种处理：级联删除关联（默认）/ 把卫星组织提升为独立势力 / 保留失效引用。
 * 人物删除只删政治身份与任职边，绝不删全局角色；条约删除同时解除 signatory_of 边。
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Modal } from '@/components/Modals/Modal';
import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { moduleLabel, sameRef } from '@/components/Worldbuilding/types';
import { kindDefOf } from '../../shared/moduleConfig';
import type { UsePoliticsResult } from '../hooks';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITICS_BUILTIN_KINDS,
  POLITICS_LINK_TYPES,
  SIGNATORY_LINK_TYPE,
  TENURE_LINK_TYPES,
  politicsRefOf,
  type PoliticsEntity,
} from '../types';
import { linkTypeLabel } from '../FocusPanel/linkLabels';

type DeleteOption = 'cascade' | 'promote' | 'keep';

export interface DeleteEntityModalProps {
  open: boolean;
  politics: UsePoliticsResult;
  entity: PoliticsEntity;
  onClose: () => void;
  /** 实际删除由 FocusPanel 的 onDelete 承担（含固定态与聚焦清理） */
  onConfirmDelete: (entityId: string) => Promise<void>;
}

export const DeleteEntityModal = ({
  open,
  politics,
  entity,
  onClose,
  onConfirmDelete,
}: DeleteEntityModalProps) => {
  const entityRef: EntityRef = politicsRefOf(entity.id, entity.kind);
  const kindLabel = kindDefOf(politics.config, entity.kind, POLITICS_BUILTIN_KINDS)?.label ?? entity.kind;
  const isFigure = entity.kind === FIGURE_KIND;

  const involved = politics.links.filter(
    (link) => sameRef(link.source, entityRef) || sameRef(link.target, entityRef)
  );

  /** 归属本实体的卫星组织：subordinate_to 指向它，或 parent_id 挂在它下面 */
  const satelliteLinks: WorldLink[] = politics.links.filter(
    (link) =>
      link.link_type === POLITICS_LINK_TYPES.subordinateTo &&
      sameRef(link.target, entityRef) &&
      link.source.module === 'politics' &&
      link.source.kind === ORGANIZATION_KIND
  );
  const childOrganizations = politics.organizations.filter(
    (candidate) => (candidate.parent_id ?? null) === entity.id
  );

  /**
   * 真正会被影响的下属组织 = subordinate_to 边的源 + parent_id 子节点（去重）。
   * 「提升为独立」与「级联」都以这个集合为准，弹层里的计数与实际动作必须一致。
   */
  const satellites = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; linkId?: string }
    >();
    for (const link of satelliteLinks) {
      map.set(link.source.id, { id: link.source.id, name: politics.refs.resolveName(link.source), linkId: link.id });
    }
    for (const child of childOrganizations) {
      if (!map.has(child.id)) map.set(child.id, { id: child.id, name: child.name });
    }
    return [...map.values()];
  }, [childOrganizations, politics.refs, satelliteLinks]);

  const satelliteCount = satellites.length;

  /**
   * 默认选项：有下属组织时默认「提升为独立势力」（保住实体，不再制造未归属孤儿）；
   * 没有下属组织时默认「级联删除关联」。
   */
  const [option, setOption] = useState<DeleteOption>(satelliteCount > 0 ? 'promote' : 'cascade');
  const [busy, setBusy] = useState(false);

  // 打开时按当前影响范围重置默认选项，避免沿用上一次的破坏性选择
  useEffect(() => {
    if (!open) return;
    setOption(satelliteCount > 0 ? 'promote' : 'cascade');
  }, [open, satelliteCount]);

  const tenureLinks = involved.filter(
    (link) =>
      TENURE_LINK_TYPES.includes(link.link_type) &&
      link.source.module === 'politics' &&
      link.source.kind === FIGURE_KIND
  );
  const signatoryLinks = involved.filter((link) => link.link_type === SIGNATORY_LINK_TYPE);
  const crossModuleLinks = involved.filter(
    (link) =>
      !TENURE_LINK_TYPES.includes(link.link_type) &&
      link.link_type !== SIGNATORY_LINK_TYPE &&
      link.link_type !== POLITICS_LINK_TYPES.subordinateTo
  );

  const linkLabel = (link: WorldLink): string =>
    `${linkTypeLabel(link, entityRef)} · ${
      sameRef(link.source, entityRef)
        ? politics.refs.resolveName(link.target)
        : politics.refs.resolveName(link.source)
    }`;

  /**
   * 把下属组织标记为独立势力：保证删除父级后不会留下「上溯不到政权」的孤儿卫星（§9）。
   * scope 是缓存字段，写失败不阻塞删除，但要显式报告。
   */
  const detachSatellites = async (): Promise<number> => {
    let detached = 0;
    for (const satellite of satellites) {
      try {
        await politics.updateMetaMerged(satellite.id, { scope: 'independent' });
        detached += 1;
      } catch (error) {
        toast.error(
          `「${satellite.name}」独立标记失败：${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }
    }
    return detached;
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      if (option === 'cascade') {
        // 先摘归属再删边：否则卫星会以「未归属」形态留在画布与名录里（§9 不允许静默孤儿）
        await detachSatellites();
        for (const link of involved) {
          await politics.deleteLink(link.id);
        }
      } else if (option === 'promote') {
        // 卫星组织提升为独立势力：改 scope + 摘掉 subordinate_to，其余关联保留
        await detachSatellites();
        for (const link of satelliteLinks) {
          await politics.deleteLink(link.id);
        }
      }
      await onConfirmDelete(entity.id);
      const preserved = involved.length - (option === 'keep' ? 0 : involved.length);
      toast.success(`${kindLabel}已删除`, {
        description:
          option === 'keep' && involved.length > 0
            ? `保留了 ${involved.length} 条失效引用，可在关联面板清理`
            : option === 'promote' && satellites.length > 0
              ? `已把 ${satellites.length} 个下属组织改为独立势力，其余 ${preserved} 条关联保留为失效引用`
              : option === 'cascade' && satellites.length > 0
                ? `已先注销 ${satellites.length} 个下属组织（标为独立势力），再删除 ${involved.length} 条关联边`
                : undefined,
      });
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  const optionRows: { id: DeleteOption; label: string; description: string }[] = [
    ...(satellites.length > 0
      ? [
          {
            id: 'promote' as DeleteOption,
            label: '把下方组织提升为独立势力（默认）',
            description: `把 ${satellites.length} 个下属组织改为独立势力并摘掉归属边，其余关联保留为失效引用；它们会留在画布与名录里`,
          },
        ]
      : []),
    {
      id: 'cascade',
      label: '级联删除关联',
      description:
        satellites.length > 0
          ? `先把 ${satellites.length} 个下属组织标为独立势力（不再是本${
              kindLabel
            }的卫星），再删除全部 ${involved.length} 条关联边`
          : `同时删除 ${involved.length} 条关联边；画布与两端详情不再出现该实体`,
    },
    {
      id: 'keep',
      label: '保留失效引用',
      description: satellites.length > 0
        ? `只删实体本身：${involved.length} 条关联边与 ${satellites.length} 个下属组织的归属边都保留为失效引用，提供后续一键清理`
        : '只删实体本身，关联边以警示 chip 保留，提供后续一键清理',
    },
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title={`删除${kindLabel}`} size="md">
      <div className="space-y-3" data-testid="politics-delete-modal">
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div>
            将删除「{entity.name}」。删除确认逐项列出影响范围，不静默级联。
            {isFigure ? ' 全局角色不会被删除，只删除政治身份与任职边。' : ''}
          </div>
        </div>

        <div className="space-y-1.5 rounded-md border border-border/50 p-2">
          <div className="text-[11px] font-medium text-foreground">受影响对象</div>
          {satellites.length === 0 ? null : (
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">
                下属组织（{satellites.length}）：默认全部提升为独立势力，不再依附本{kindLabel}
              </div>
              {satellites.map((satellite) => (
                <div key={satellite.id} className="text-[11px] text-foreground">
                  {satellite.name}
                </div>
              ))}
            </div>
          )}

          {tenureLinks.length > 0 ? (
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">
                人物任职边（{tenureLinks.length}）
              </div>
              {tenureLinks.map((link) => (
                <div key={link.id} className="text-[11px] text-foreground">
                  {linkLabel(link)}
                </div>
              ))}
            </div>
          ) : null}

          {signatoryLinks.length > 0 ? (
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">
                缔约边（{signatoryLinks.length}）
              </div>
              {signatoryLinks.map((link) => (
                <div key={link.id} className="text-[11px] text-foreground">
                  {linkLabel(link)}
                </div>
              ))}
            </div>
          ) : null}

          {crossModuleLinks.length > 0 ? (
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground">
                跨模块关联（{crossModuleLinks.length}）
              </div>
              {crossModuleLinks.map((link) => (
                <div key={link.id} className="text-[11px] text-foreground">
                  {linkLabel(link)}
                  <span className="text-muted-foreground">
                    {' '}
                    · {moduleLabel(link.source.module === 'politics' ? link.target.module : link.source.module)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {involved.length === 0 ? (
            <div className="text-[11px] text-muted-foreground">没有关联边，删除不影响其他实体。</div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          {optionRows.map((row) => (
            <label
              key={row.id}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                option === row.id ? 'border-primary/50 bg-primary/10' : 'border-border/50'
              }`}
            >
              <input
                type="radio"
                name="politics-delete-option"
                checked={option === row.id}
                onChange={() => setOption(row.id)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-[11px] text-foreground">{row.label}</span>
                <span className="block text-[10px] text-muted-foreground">{row.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy}
            data-testid="politics-delete-confirm"
            className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            确认删除
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteEntityModal;
