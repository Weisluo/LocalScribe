/**
 * 头像条 + 任职带 FigureStrip（Phase 4 P4-T4；politics_ui_design §2.1/§2.2 第 4 层、§4.1/§4.9）
 *
 * - 人物展示名与字母章一律从全局 Character 解析（figure.meta.characterId -> module 'character'），
 *   政治侧不复制姓名、头像、种族、生平（§2.1 补充规则 / §11.5）；
 * - 头像条顺序由调用方给的 figures 决定：政权卡传的是已排序的 node.coreFigures
 *   （主要任职 -> 任职数 -> 名称，§2.2 第 4 层），这里不再对 figures 重新排序；
 * - 头像条默认最多 FIGURE_STRIP_MAX = 5 个 + 溢出计数，中屏（< 1440px）最多 3 个（§4.9）；
 * - 无头像数据时用名称首字生成字母章，不使用 emoji；
 * - 任职带来自 node.tenureBands（officeTitle / start / end / isPrimary），只在能力开启时渲染。
 */

import type { FigureEntity, FigureTenureBand } from '../hooks/politicsTypes';
import type { EntityRefsResult } from '../../hooks';
import { FIGURE_STRIP_MAX, FIGURE_STRIP_MAX_MEDIUM } from '../config';
import { chipClass } from '../tone';
import { useMediaQuery } from './atlasHooks';

/** 溢出计数与 tooltip 用「未截断的全量人物」，因此额外收一份完整列表 */
export interface FigureStripProps {
  /** 头像条顺序：政权卡传已排序的 node.coreFigures（主要任职 -> 任职数 -> 名称） */
  figures: FigureEntity[];
  /** 全部人物（含未进头像条的）：溢出计数与 tooltip 用（§2.2 第 4 层） */
  allFigures?: FigureEntity[];
  tenureBands: FigureTenureBand[];
  refs: EntityRefsResult;
  /** capabilities.tenureBands：任职带只在结构档起显示 */
  showTenureBands: boolean;
  onOpenFigure?: (figureId: string) => void;
}

/** 人物展示名：优先全局角色名，未绑定或索引未就绪时退回政治侧名称 */
const resolveFigureName = (figure: FigureEntity, refs: EntityRefsResult): string => {
  const characterId = figure.meta.characterId;
  if (!characterId) return figure.name;
  const ref = { module: 'character', kind: 'character', id: characterId };
  return refs.lookup(ref)?.name ?? (refs.resolveName(ref) || figure.name);
};

const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';

const timeRangeOf = (band: FigureTenureBand): string => {
  const start = band.start ?? '';
  const end = band.end ?? '';
  if (!start && !end) return '任期未标注';
  return `${start || '?'} - ${end || '如今'}`;
};

export const FigureStrip = ({
  figures,
  allFigures,
  tenureBands,
  refs,
  showTenureBands,
  onOpenFigure,
}: FigureStripProps) => {
  // 中屏 1024-1439px 头像条最多 3 个（§4.9），宽屏 5 个
  const wide = useMediaQuery('(min-width: 1440px)');
  const max = wide ? FIGURE_STRIP_MAX : FIGURE_STRIP_MAX_MEDIUM;
  const visible = figures.slice(0, max);
  const rest = allFigures && allFigures.length > 0 ? allFigures : figures;
  const overflow = rest.length - visible.length;
  const bands = tenureBands.slice(0, 3);
  const bandOverflow = tenureBands.length - bands.length;

  return (
    <div className="space-y-1" data-testid="atlas-figure-strip">
      <div className="flex flex-wrap items-center gap-1">
        {visible.map((figure) => {
          const name = resolveFigureName(figure, refs);
          const shared = 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500/40 bg-slate-500/10 text-[10px] font-medium text-slate-700 dark:text-slate-300';
          if (!onOpenFigure) {
            return (
              <span key={figure.id} className={shared} title={`${name} · ${figure.name}`}>
                {initialOf(name)}
              </span>
            );
          }
          return (
            <button
              key={figure.id}
              type="button"
              aria-label={`打开人物 ${name}`}
              title={`${name} · ${figure.name}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenFigure(figure.id);
              }}
              className={`${shared} transition-colors hover:border-primary/60 motion-reduce:transition-none`}
            >
              {initialOf(name)}
            </button>
          );
        })}
        {overflow > 0 && (
          <span
            className="text-[10px] text-muted-foreground"
            title={rest
              .slice(max)
              .map((figure) => resolveFigureName(figure, refs))
              .join('、')}
          >
            +{overflow}
          </span>
        )}
        {rest.length === 0 && (
          <span className="text-[10px] text-muted-foreground/70">暂无关联人物</span>
        )}
      </div>

      {showTenureBands && tenureBands.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1 border-t border-dashed border-slate-500/30 pt-1"
          data-testid="atlas-tenure-bands"
        >
          {bands.map((band) => (
            <span
              key={band.edgeId}
              className={`${chipClass} border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300`}
              title={`${band.officeTitle || '任职'} · ${timeRangeOf(band)}`}
            >
              <span className="max-w-[92px] truncate">{band.officeTitle || '任职'}</span>
              <span className="text-muted-foreground">{timeRangeOf(band)}</span>
              {band.isPrimary && <span className="text-primary">主要</span>}
            </span>
          ))}
          {bandOverflow > 0 && (
            <span className="text-[10px] text-muted-foreground">等 {tenureBands.length} 项</span>
          )}
        </div>
      )}
    </div>
  );
};

export default FigureStrip;
