/**
 * GlobalSearch（Phase 6 P6-T6；worldbuilding_ui_design §2.4 / §2.5）
 *
 * 全局搜索面板：
 * - 入口由外壳提供（头部搜索按钮 + Ctrl/Cmd + K），本组件只管面板本身；
 * - 索引在客户端一次建好（子模块 + 条目的名称/描述/标签/自定义字段/行内引用显示名）；
 * - 限定符：模块:政治 / kind:polity / 关联:历史 / 标签:古老，兼容 ASCII module:/kind:/link:/tag:；
 * - 结果按模块分组，行内显示图标、名称、kind 徽章、模块、命中字段摘要与关联数；
 * - 选中结果经 onNavigate(EntityRef) 跳转（打开目标模块 + 详情）；
 * - 键盘：上下移动、Enter 打开、Esc 关闭；aria 标注齐全；无 emoji。
 * - 速写档同样可用：关联数据未就绪时只有「关联:」限定符给提示，其余照常。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Clock, CornerDownLeft, Link2, Search, Tag, X } from 'lucide-react';

import type {
  EntityRef,
  WorldLink,
  WorldModuleV2,
} from '@/services/worldbuildingApi';
import { useWorldLinks } from '../hooks/useLinks';
import {
  buildSearchIndex,
  countHits,
  hasQualifier,
  isSearchQueryEmpty,
  loadRecentSearches,
  parseSearchQuery,
  pushRecentSearch,
  saveRecentSearches,
  searchIndex,
  type SearchGroup,
  type SearchHit,
} from '../hooks/globalSearch';
import { lucideIcon } from '../shared/lucideIcon';

/** 模块默认图标（Lucide kebab-case；与标签栏一致） */
const MODULE_ICONS: Record<string, string> = {
  map: 'map',
  history: 'scroll-text',
  politics: 'crown',
  economy: 'coins',
  races: 'users',
  systems: 'sparkles',
  special: 'star',
};

export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  /** /worlds/{id} 详情里的模块（含 submodules + items） */
  modules: WorldModuleV2[];
  worldId?: string | null;
  projectId?: string | null;
  /** 模块展示名（世界术语替换后）；缺省用模块自身名称 */
  moduleLabels?: Record<string, string>;
  /** kind 展示名 */
  kindLabels?: Record<string, string>;
  /** 跳转到目标实体（打开对应模块 + 详情抽屉） */
  onNavigate: (ref: EntityRef) => void;
}

const Highlight = ({ text, query }: { text: string; query: string }) => {
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-primary/20 px-0.5 text-foreground">{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
};

export const GlobalSearch = ({
  open,
  onClose,
  modules,
  worldId,
  projectId,
  moduleLabels = {},
  kindLabels = {},
  onNavigate,
}: GlobalSearchProps) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 关联数据在面板打开后才拉（关闭时不发请求）；速写档缺它也不影响其它限定符
  const linksQuery = useWorldLinks(open ? worldId ?? undefined : undefined);
  const links = useMemo(() => (linksQuery.data ?? []) as WorldLink[], [linksQuery.data]);

  // 最近记录按 项目 + 世界 分键，切世界不读回上一个世界的记录
  useEffect(() => {
    if (!open) return;
    setRecent(loadRecentSearches(projectId, worldId));
    setQuery('');
    setActiveIndex(0);
  }, [open, projectId, worldId]);

  const index = useMemo(
    () => buildSearchIndex(modules, { moduleLabels, kindLabels, links }),
    [modules, moduleLabels, kindLabels, links]
  );

  const qualifiers = useMemo(() => parseSearchQuery(query), [query]);
  const freeText = qualifiers.text;

  const groups: SearchGroup[] = useMemo(() => {
    if (isSearchQueryEmpty(qualifiers)) return [];
    return searchIndex(index, qualifiers, { moduleLabels });
  }, [index, qualifiers, moduleLabels]);

  const flatHits: SearchHit[] = useMemo(() => groups.flatMap((group) => group.hits), [groups]);
  const total = countHits(groups);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Esc 关闭（面板自己消费，避免外壳的返回栈 Esc 同时触发）
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  const rememberQuery = useCallback(
    (value: string) => {
      if (!value.trim()) return;
      const next = pushRecentSearch(value, recent);
      setRecent(next);
      saveRecentSearches(projectId, worldId, next);
    },
    [recent, projectId, worldId]
  );

  const openHit = useCallback(
    (hit: SearchHit) => {
      rememberQuery(query);
      onNavigate({ module: hit.entity.module, kind: hit.entity.kind, id: hit.entity.id });
      onClose();
    },
    [rememberQuery, query, onNavigate, onClose]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatHits.length) setActiveIndex((index) => (index + 1) % flatHits.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatHits.length) setActiveIndex((index) => (index - 1 + flatHits.length) % flatHits.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const hit = flatHits[activeIndex];
      if (hit) openHit(hit);
      else rememberQuery(query);
    }
  };

  if (!open) return null;

  const linkHint = qualifiers.link && !index.linkData;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24" role="dialog" aria-modal="true" aria-label="全局搜索">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索实体、字段、标签；支持 模块:政治 kind:polity 关联:历史 标签:古老"
            aria-label="搜索关键词"
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
          <span className="hidden text-[11px] text-muted-foreground sm:inline">
            {total > 0 ? `${total} 条结果` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭搜索"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearchQueryEmpty(qualifiers) && recent.length > 0 && (
            <div className="p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                最近搜索
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setQuery(item)}
                    className="rounded-full border border-border/60 bg-card/40 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSearchQueryEmpty(qualifiers) && recent.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              搜索全部模块的实体、描述、标签与自定义字段
            </div>
          )}

          {!isSearchQueryEmpty(qualifiers) && total === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {linkHint
                ? '当前档位未加载关联数据，「关联:」限定符暂时不可用；其它条件可以正常搜索'
                : '没有匹配的实体'}
            </div>
          )}

          {hasQualifier(qualifiers) && (
            <div className="flex items-center gap-1.5 border-b border-border/40 px-4 py-1.5 text-[11px] text-muted-foreground">
              {qualifiers.module && <span className="rounded bg-accent/30 px-1.5">模块:{qualifiers.module}</span>}
              {qualifiers.kind && <span className="rounded bg-accent/30 px-1.5">kind:{qualifiers.kind}</span>}
              {qualifiers.link && (
                <span className="rounded bg-accent/30 px-1.5">
                  <Link2 className="mr-1 inline h-3 w-3" />
                  关联:{qualifiers.link}
                </span>
              )}
              {qualifiers.tag && (
                <span className="rounded bg-accent/30 px-1.5">
                  <Tag className="mr-1 inline h-3 w-3" />
                  标签:{qualifiers.tag}
                </span>
              )}
            </div>
          )}

          {groups.map((group) => {
            const ModuleIcon = lucideIcon(MODULE_ICONS[group.module]) ?? Search;
            return (
              <section key={group.module} aria-label={`${group.label} 的搜索结果`}>
                <div className="flex items-center gap-2 bg-card/30 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
                  <ModuleIcon className="h-3.5 w-3.5" />
                  {group.label}
                  <span className="text-muted-foreground/70">{group.hits.length}</span>
                </div>
                <ul>
                  {group.hits.map((hit) => {
                    const flatIndex = flatHits.indexOf(hit);
                    const isActive = flatIndex === activeIndex;
                    return (
                      <li key={`${hit.entity.module}:${hit.entity.id}`}>
                        <button
                          type="button"
                          aria-current={isActive}
                          data-testid="global-search-hit"
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => openHit(hit)}
                          className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                            isActive ? 'bg-primary/10' : 'hover:bg-accent/20'
                          }`}
                        >
                          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded bg-accent/30 text-[10px] uppercase text-muted-foreground">
                            {hit.entity.kind.slice(0, 2)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                <Highlight text={hit.entity.name} query={freeText} />
                              </span>
                              <span className="rounded border border-border/60 px-1.5 text-[10px] text-muted-foreground">
                                {hit.entity.kindLabel}
                              </span>
                              {hit.entity.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="rounded bg-accent/25 px-1.5 text-[10px] text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              <span className="text-muted-foreground/70">{hit.field}：</span>
                              <Highlight text={hit.snippet} query={freeText} />
                            </span>
                          </span>
                          <span className="flex flex-shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="rounded-full bg-accent/25 px-1.5">{group.label}</span>
                            <span className="flex items-center gap-0.5">
                              <Link2 className="h-3 w-3" />
                              {hit.entity.linkCount}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            打开
          </span>
          <span className="flex items-center gap-1">
            <ArrowUpDown className="h-3 w-3" />
            方向键选择
          </span>
          <span>Esc 关闭</span>
          <span className="ml-auto">Ctrl/Cmd + K</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
