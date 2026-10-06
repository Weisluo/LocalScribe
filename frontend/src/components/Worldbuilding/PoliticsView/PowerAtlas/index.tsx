/**
 * 权力版图（Phase 4 P4-T3..P4-T7；politics_ui_design §4.2/§4.7/§8/§11）
 *
 * 分层画布：政权层（唯一主干）+ 卫星层 + 独立势力带 + 人物层 + 关系边层 + 条约缎带层。
 * 这里只做两件事：
 * - 按 §11.3 的降级模式分流：matrix 走「按等级分组的矩阵 + 关系列表」，其余走 AtlasCanvas；
 * - 保持 PowerAtlasProps 形状不变（契约由上层 index.tsx 传入，组件不自行发请求）。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import type { PoliticsFilterState, UsePoliticsResult } from '../hooks';
import { AtlasCanvas } from './AtlasCanvas';
import { MatrixFallback } from './MatrixFallback';

export interface PowerAtlasProps {
  politics: UsePoliticsResult;
  filter: PoliticsFilterState;
  focusedId: string | null;
  onFocus: (entityId: string) => void;
  onClearFocus: () => void;
  onNavigateToEntity: (ref: EntityRef) => void;
  relationLayerOpen: boolean;
  onToggleRelationLayer: (next: boolean) => void;
  onOpenTreatyBook: () => void;
  onCreateKind: (kind: string) => void;
}

export const PowerAtlas = (props: PowerAtlasProps) => (
  <div className="h-full min-h-0" data-testid="power-atlas">
    {props.politics.atlasMode === 'matrix' ? (
      <MatrixFallback
        politics={props.politics}
        /* 矩阵降级同样吃同一套筛选，换视图不让筛选静默失效（§11.3） */
        filter={props.filter}
        focusedId={props.focusedId}
        onFocus={props.onFocus}
        onOpenTreatyBook={props.onOpenTreatyBook}
        onNavigateToEntity={props.onNavigateToEntity}
        onCreateKind={props.onCreateKind}
      />
    ) : (
      <AtlasCanvas {...props} />
    )}
  </div>
);

export default PowerAtlas;
