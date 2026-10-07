/**
 * 图层开关 LayerRail（Phase 5 P5-T12；economy_ui_design §4.6.5、§11.1）
 *
 * 八个图层按 `minComplexity` 出现（sketch 档不出现任何图层；structure 见主干 / 通货 / 制度 / 外部站点；
 * sandbox 全见）。开关**只影响绘制，不改变筛选结果**；关闭某层后统计仍按全量计算，
 * 由 StatsPanel 标注「含已隐藏图层」。
 *
 * 图标一律走 `shared/lucideIcon`（`layer.icon` 是 Lucide 名，kebab-case）；全文无 emoji。
 */

import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';

import { lucideIcon } from '../../shared/lucideIcon';
import { COMPLEXITY_RANK } from '../graph/guards';
import type { EconomyLayerId, LayerRailProps } from '../types';

/** §4.6.5 表格「内容」列：开关的 title，避免用户猜图层含义 */
const LAYER_HINTS: Record<string, string> = {
  trunk: '枢纽节点与主干边',
  flows: '边宽与流量标签',
  balance: '节点与边的盈余色、斜纹',
  currency: '通货轨与 economy.currency_of',
  institutions: '制度轨与 regulated_by / taxed_by',
  cycles: '周期带、阶段标签',
  history: '事件标记与时代底带',
  external: '政治 / 历史 / 种族 / 体系 / 角色节点',
};

export const LayerRail = ({ layers, value, complexity, onChange }: LayerRailProps) => {
  const rank = COMPLEXITY_RANK[complexity] ?? COMPLEXITY_RANK.sandbox;
  const visible = layers.filter(
    (layer) => (COMPLEXITY_RANK[layer.minComplexity] ?? COMPLEXITY_RANK.sketch) <= rank
  );

  return (
    <div
      data-testid="economy-layer-rail"
      role="group"
      aria-label="图层"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        图层
      </span>
      {visible.map((layer) => {
        const Icon = lucideIcon(layer.icon);
        const id = layer.id as EconomyLayerId;
        const on = value[id] ?? layer.defaultOn;
        return (
          <motion.button
            key={layer.id}
            type="button"
            data-testid={`economy-layer-${layer.id}`}
            aria-pressed={on}
            title={`${layer.label}：${LAYER_HINTS[layer.id] ?? ''}（只影响绘制，不改变筛选结果）`}
            onClick={() => onChange({ ...value, [id]: !on })}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 motion-reduce:transition-none ${
              on
                ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                : 'border-border/40 text-muted-foreground hover:border-border/70 hover:bg-accent/5 hover:text-foreground'
            }`}
          >
            {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
            {layer.label}
          </motion.button>
        );
      })}
      <span className="text-xs text-muted-foreground/70">只影响绘制，不改变筛选结果</span>
    </div>
  );
};

export default LayerRail;
