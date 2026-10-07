/**
 * 政权内卫星簇 OrganizationCluster（Phase 4 P4-T4；politics_ui_design §2.2 第 2 层、§4.1/§4.2.3）
 *
 * - scope=intra_polity 的组织留在所属政权卡内，横排为高 28px 的 chip；
 * - 溢出显示 +N，点击展开卫星簇浮层；高 rank 卡显示 chip，中 / 低 rank 卡只显示计数（§4.1 尺寸表）；
 * - 卫星组织不画卡片、不离开政权卡；点击进入该组织的聚焦详情。
 */

import { Plus, Shield } from 'lucide-react';
import { useState } from 'react';

import type { OrganizationEntity } from '../hooks/politicsTypes';
import { chipClass } from '../tone';
import { useDismissOnEscape } from './atlasHooks';

const CHIP_LIMIT = 4;

export interface OrganizationClusterProps {
  organizations: OrganizationEntity[];
  /** chips：高 rank 卡横排 chip；count：中 / 低 rank 卡只给计数 + 浮层 */
  variant: 'chips' | 'count';
  onOpen: (organizationId: string) => void;
  onAdd?: () => void;
}

export const OrganizationCluster = ({
  organizations,
  variant,
  onOpen,
  onAdd,
}: OrganizationClusterProps) => {
  const [open, setOpen] = useState(false);
  useDismissOnEscape(open, () => setOpen(false));

  const visible = organizations.slice(0, CHIP_LIMIT);
  const overflow = organizations.length - visible.length;
  const label = (organization: OrganizationEntity) => organization.name;

  const chipContent = (organization: OrganizationEntity) => (
    <>
      <Shield className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="max-w-[104px] truncate">{label(organization)}</span>
    </>
  );

  return (
    <div className="relative" data-testid="atlas-organization-cluster">
      <div className="flex flex-wrap items-center gap-1">
        {variant === 'chips' &&
          visible.map((organization) => (
            <button
              key={organization.id}
              type="button"
              aria-label={`打开组织 ${organization.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(organization.id);
              }}
              className={`${chipClass} h-7 border-red-500/40 bg-red-500/10 text-red-700 hover:border-primary/60 dark:text-red-300`}
            >
              {chipContent(organization)}
            </button>
          ))}

        {variant === 'chips' && organizations.length === 0 && (
          <span className="text-xs leading-tight text-muted-foreground/70">暂无卫星组织</span>
        )}

        {(overflow > 0 || variant === 'count') && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`展开卫星组织 ${organizations.length} 个`}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((prev) => !prev);
            }}
            className={`${chipClass} h-7 border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground`}
          >
            <Shield className="h-3 w-3 shrink-0" aria-hidden="true" />
            卫星 {organizations.length}
            {overflow > 0 && <span>+{overflow}</span>}
          </button>
        )}

        {onAdd && (
          <button
            type="button"
            aria-label="添加组织"
            title="添加组织"
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            className="inline-flex h-7 items-center gap-0.5 rounded-full border border-dashed border-border/60 px-2 text-xs text-muted-foreground transition-colors hover:text-primary motion-reduce:transition-none"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="group"
          aria-label="卫星组织列表"
          className="absolute left-0 top-full z-30 mt-1 max-h-44 w-56 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg"
          data-testid="atlas-organization-cluster-popover"
        >
          {organizations.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">暂无卫星组织</div>
          ) : (
            organizations.map((organization) => (
              <button
                key={organization.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  onOpen(organization.id);
                }}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
              >
                <Shield className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                <span className="min-w-0 truncate">{organization.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default OrganizationCluster;
