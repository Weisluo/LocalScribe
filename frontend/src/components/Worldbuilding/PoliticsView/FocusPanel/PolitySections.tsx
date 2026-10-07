/**
 * 政权详情六段（Phase 4 P4-T8；politics_ui_design §4.3/§6.2/§6.3/§6.4/§6.7/§8.2）
 *
 * 概览 / 机构 / 人物 / 关系 / 条约 / 沿革 是同一详情内的锚点分段，不是四个平级 Tab。
 * sketch 档（capabilities.fullDetail = false）只保留概览，其余分段整段不渲染（降档只隐藏不删数据）。
 * 地图未接入：领土 / 首府新建入口整行隐藏，已有链接以只读行保留（§6.7）。
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Flag,
  Landmark,
  Link2,
  ScrollText,
  Shield,
  Sprout,
  Truck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import type { UsePoliticsResult } from '../hooks';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITICS_LINK_TYPES,
  SCOPE_LABELS,
  SIGNATORY_LINK_TYPE,
  TENURE_LINK_TYPES,
  TREATY_KIND,
  TREATY_STATUS_LABELS,
  normalizeScope,
  politicsRefOf,
  treatyTermsOf,
  type FigureEntity,
  type OrganizationEntity,
  type PolityEntity,
} from '../types';
import type { PolityDetailView } from '../hooks';
import { chipClass, fieldClass, toneSurfaceClass } from '../tone';
import { PoliticsFormModal } from '../modals/PoliticsFormModal';
import { EdgeCard } from './EdgeCard';
import { RulerEditor } from './RulerEditor';
import { linkTypeLabel, RELATION_LINK_TYPES } from './linkLabels';
import {
  CountPill,
  EmptyHint,
  InfoRow,
  LinkChip,
  NoteRow,
  SectionBlock,
  StaticChip,
} from './sectionParts';
import { sectionDomId, timeRangeText } from './sectionUtils';

/** 结构 / 沙盘档才展开的概览细分行，以及经济基础的预览行数（§6.3.4） */
const ECONOMY_PREVIEW_ROWS = 3;

export interface PolitySectionsProps {
  politics: UsePoliticsResult;
  entity: PolityEntity;
  detail: PolityDetailView;
  worldId: string;
  onNavigateToEntity: (ref: EntityRef) => void;
  onOpenFocus: (entityId: string) => void;
  onOpenTreatyBook: () => void;
  onEdit: () => void;
  /** 内部浮层（边卡）开关：让抽屉的 Esc 先收浮层 */
  onOverlay: (close: (() => void) | null) => void;
}

export const PolitySections = ({
  politics,
  entity,
  detail,
  worldId,
  onNavigateToEntity,
  onOpenFocus,
  onOpenTreatyBook,
  onEdit,
  onOverlay,
}: PolitySectionsProps) => {
  const full = politics.capabilities.fullDetail;
  const canWrite = politics.canWriteEntities;
  const polityRef = politicsRefOf(entity.id, entity.kind);

  const [racePickerOpen, setRacePickerOpen] = useState(false);
  const [orgFormOpen, setOrgFormOpen] = useState(false);
  const [figureFormOpen, setFigureFormOpen] = useState(false);
  const [treatyFormOpen, setTreatyFormOpen] = useState(false);
  const [rulerEditorOpen, setRulerEditorOpen] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [expandedTreatyId, setExpandedTreatyId] = useState<string | null>(null);
  const [expandedEconomyGroup, setExpandedEconomyGroup] = useState<string | null>(null);
  const [chronicleDraft, setChronicleDraft] = useState({ title: '', time: '' });
  const [savingChronicle, setSavingChronicle] = useState(false);

  const figureName = (figure: FigureEntity): string => {
    const character = figure.meta.characterId
      ? politics.refs.lookup({ module: 'character', kind: 'character', id: figure.meta.characterId })
      : undefined;
    return character?.name ?? figure.name;
  };

  const linkOfEdge = (edgeId: string) => politics.links.find((link) => link.id === edgeId);

  const openEdgeCard = (edgeId: string) => {
    setEditingEdgeId(edgeId);
    onOverlay(() => setEditingEdgeId(null));
  };
  const closeEdgeCard = () => {
    setEditingEdgeId(null);
    onOverlay(null);
  };

  // 面板卸载时释放抽屉的浮层状态，避免上层的 Esc 分层一直停在「收浮层」
  useEffect(() => () => onOverlay(null), [onOverlay]);

  const scrollTo = (key: string) => {
    document.getElementById(sectionDomId(entity.id, key))?.scrollIntoView({ block: 'start' });
  };

  /* ---------------- 概览 ---------------- */

  /** 统治者 = 以 leads 边指向本政权的人物，任期与职位在边上（§3.8.2） */
  const rulerGroups = (() => {
    const groups = new Map<string, { figure: FigureEntity; bands: typeof detail.tenureBands }>();
    for (const band of detail.tenureBands) {
      const link = politics.links.find((candidate) => candidate.id === band.edgeId);
      if (link?.link_type !== POLITICS_LINK_TYPES.leads) continue;
      const figure = detail.figures.find((candidate) => candidate.id === band.figureId);
      if (!figure) continue;
      const bucket = groups.get(band.figureId) ?? { figure, bands: [] };
      bucket.bands.push(band);
      groups.set(band.figureId, bucket);
    }
    return [...groups.values()];
  })();

  /**
   * 当前统治者（leads 边 + 边上载荷）：RulerEditor 的初值与「更换 / 移除」的目标。
   * 职位 / 任期 / 是否主要都在边上，因此编辑器读的是边而不是 meta（§3.8.2）。
   */
  const currentRuler = (() => {
    const link = politics.links.find(
      (candidate) =>
        candidate.link_type === POLITICS_LINK_TYPES.leads &&
        candidate.source.module === 'politics' &&
        candidate.target.module === 'politics' &&
        candidate.target.id === entity.id
    );
    if (!link) return undefined;
    const figure = detail.figures.find((candidate) => candidate.id === link.source.id);
    const band = detail.tenureBands.find((candidate) => candidate.edgeId === link.id);
    return {
      figure,
      officeTitle: band?.officeTitle,
      start: band?.start,
      end: band?.end,
      isPrimary: band?.isPrimary,
    };
  })();

  const raceShareTotal = detail.races.reduce((sum, race) => sum + (race.share ?? 0), 0);
  const economyGroups = detail.economyLinks.filter((group) => group.refs.length > 0);
  const historyCount = detail.historyEvents.length;
  const chronicleCount = detail.chronicle.length;

  /* ---------------- 机构 / 人物 ---------------- */

  const officeHolderOf = (organizationId: string): string | undefined => {
    const link = politics.links.find(
      (candidate) =>
        TENURE_LINK_TYPES.includes(candidate.link_type) &&
        candidate.target.module === 'politics' &&
        candidate.target.id === organizationId
    );
    if (!link) return undefined;
    const figure = politics.byId.get(link.source.id);
    if (!figure || figure.kind !== FIGURE_KIND) return undefined;
    return figureName(figure as FigureEntity);
  };

  const childCountOf = (organization: OrganizationEntity): number =>
    politics.organizations.filter((candidate) => (candidate.parent_id ?? null) === organization.id)
      .length;

  /* ---------------- 关系 ---------------- */

  const relationEdges = politics
    .linksOf(polityRef)
    .filter((link) => RELATION_LINK_TYPES.includes(link.link_type))
    .map((link) => ({
      link,
      outgoing: link.source.id === entity.id && link.source.module === 'politics',
    }));

  /* ---------------- 沿革 ---------------- */

  const mergedAnchors = useMemo(() => {
    const entries: {
      key: string;
      label: string;
      summary?: string;
      timeText: string;
      timeKey: string;
      history: boolean;
      ref?: EntityRef;
    }[] = [];
    for (const entry of detail.chronicle) {
      entries.push({
        key: `chronicle-${entry.id}`,
        label: entry.title,
        summary: entry.summary,
        timeText: timeRangeText(entry.time?.start, entry.time?.end),
        timeKey: entry.time?.start ?? entry.time?.end ?? '',
        history: false,
      });
    }
    for (const event of detail.historyEvents) {
      entries.push({
        key: `history-${event.ref.module}-${event.ref.id}-${event.linkType}`,
        label: event.label,
        summary: linkTypeLabel(
          { link_type: event.linkType, source: event.ref },
          null,
          false
        ),
        timeText: timeRangeText(event.time?.start, event.time?.end),
        timeKey: event.time?.start ?? event.time?.end ?? '',
        history: true,
        ref: event.ref,
      });
    }
    return entries.sort(
      (a, b) => (a.timeKey || '~').localeCompare(b.timeKey || '~') || a.label.localeCompare(b.label)
    );
  }, [detail.chronicle, detail.historyEvents]);

  /* ---------------- 写操作 ---------------- */

  const handleRaceConfirm = async (selection: EntityPickerSelection) => {
    try {
      const result = await politics.createLinks(
        selection.targets.map((target) => ({
          linkType: POLITICS_LINK_TYPES.includesRace,
          target,
          note: selection.note,
        })),
        polityRef
      );
      if (result.failed > 0) toast.error('部分种族构成写入失败');
      else toast.success('已添加种族构成');
      setRacePickerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '种族构成写入失败');
    }
  };

  const handleOrgSaved = async (organizationId: string) => {
    setOrgFormOpen(false);
    try {
      const result = await politics.createLinks(
        [{ linkType: POLITICS_LINK_TYPES.subordinateTo, target: polityRef }],
        politicsRefOf(organizationId, ORGANIZATION_KIND)
      );
      if (result.created > 0) toast.success('已添加组织卫星');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '组织归属写入失败');
    }
    onOpenFocus(organizationId);
  };

  const handleFigureSaved = async (figureId: string) => {
    setFigureFormOpen(false);
    try {
      await politics.createLinks(
        [
          {
            linkType: POLITICS_LINK_TYPES.memberOf,
            target: polityRef,
            meta: { isPrimary: false },
          },
        ],
        politicsRefOf(figureId, FIGURE_KIND)
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '任职写入失败');
    }
    onOpenFocus(figureId);
  };

  const handleTreatySaved = async (treatyId: string) => {
    setTreatyFormOpen(false);
    try {
      const result = await politics.createLinks(
        [{ linkType: SIGNATORY_LINK_TYPE, target: politicsRefOf(treatyId, TREATY_KIND) }],
        polityRef
      );
      if (result.created > 0) toast.success('已发起条约并加入缔约方');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '缔约写入失败');
    }
    onOpenFocus(treatyId);
  };

  const handleAddChronicle = async () => {
    const title = chronicleDraft.title.trim();
    if (!title) {
      toast.error('沿革标题不能为空');
      return;
    }
    setSavingChronicle(true);
    try {
      const order = detail.chronicle.reduce((max, item) => Math.max(max, item.order ?? 0), 0) + 1;
      const entry = {
        id: `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        order,
        title,
        time: chronicleDraft.time.trim() ? { start: chronicleDraft.time.trim() } : undefined,
      };
      await politics.saveItem(entity.id, 'chronicle', {
        entries: [...detail.chronicle, entry],
      });
      setChronicleDraft({ title: '', time: '' });
      toast.success('已添加沿革条目');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '沿革条目保存失败');
    } finally {
      setSavingChronicle(false);
    }
  };

  const editingEdge = editingEdgeId ? linkOfEdge(editingEdgeId) : undefined;

  return (
    <div data-testid="polity-sections">
      {/* 概览（§4.3：政体 / 首府 / 统治者 / 人口 / 经济基础 / 沿革） */}
      <SectionBlock
        id={sectionDomId(entity.id, 'overview')}
        title="概览"
        actions={
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-primary transition-colors hover:underline"
          >
            编辑
          </button>
        }
      >
        <InfoRow label="政体">
          {detail.government.formLabel || detail.government.succession ? (
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1">
                {detail.government.formLabel ? (
                  <span className={`${chipClass} border-border/60 text-foreground`}>
                    {detail.government.formLabel}
                  </span>
                ) : null}
                {detail.government.succession ? (
                  <span className="text-muted-foreground">
                    继承方式 {detail.government.succession}
                  </span>
                ) : null}
              </div>
              {detail.government.legitimacy ? (
                <div className="text-muted-foreground">合法性：{detail.government.legitimacy}</div>
              ) : null}
            </div>
          ) : (
            <EmptyHint text="还未填写政体" actionLabel="补充" onAction={onEdit} />
          )}
        </InfoRow>

        {/* 政体备注：@ 行内引用渲染为可点击 chip（§4.8.7） */}
        <NoteRow
          worldId={worldId}
          label="政体备注"
          value={detail.government.notes}
          onNavigate={onNavigateToEntity}
        />

        {/* 地图未接入：首府行只在已有 capital_at 链接时以只读形式出现（§6.7） */}
        {detail.capital ? (
          <InfoRow label="首府">
            <StaticChip
              label={politics.refs.resolveName(detail.capital)}
              title="地图未接入：只读保留，接入后可跳转地区"
            />
          </InfoRow>
        ) : null}

        <InfoRow
          label="统治者"
          action={
            <button
              type="button"
              onClick={() => setRulerEditorOpen(true)}
              disabled={!canWrite}
              title={canWrite ? '设置 / 更换 / 移除统治者（写 leads 边上的职位与任期）' : '当前不可写实体'}
              className="text-xs font-medium text-primary transition-colors hover:underline disabled:opacity-50"
            >
              {rulerGroups.length > 0 ? '更换 / 编辑任职' : '设置统治者'}
            </button>
          }
        >
          {rulerGroups.length === 0 ? (
            <EmptyHint
              text="还没有统治者"
              actionLabel={canWrite ? '设置统治者' : undefined}
              onAction={canWrite ? () => setRulerEditorOpen(true) : undefined}
            />
          ) : (
            <div className="space-y-1">
              {rulerGroups.map(({ figure, bands }) => (
                <div key={figure.id} className="flex flex-wrap items-center gap-1.5">
                  <LinkChip
                    label={figureName(figure)}
                    tone="red"
                    onClick={() => onOpenFocus(figure.id)}
                  />
                  <span className="text-muted-foreground">
                    {bands.map((band) => band.officeTitle).filter(Boolean).join(' / ') || '未填职位'}
                  </span>
                  <span className="text-muted-foreground">
                    {timeRangeText(bands[0]?.start, bands[0]?.end)}
                  </span>
                  {bands.some((band) => band.isPrimary) ? (
                    <span className={`${chipClass} border-primary/40 text-primary`}>主要</span>
                  ) : null}
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => setRulerEditorOpen(true)}
                      title="编辑任命 / 任期 / 是否主要（写 leads 边）"
                      className="text-xs font-medium text-primary transition-colors hover:underline"
                    >
                      编辑任职
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {rulerEditorOpen ? (
            <RulerEditor
              politics={politics}
              entity={entity}
              worldId={worldId}
              fixture={currentRuler?.figure}
              officeTitle={currentRuler?.officeTitle}
              start={currentRuler?.start}
              end={currentRuler?.end}
              isPrimary={currentRuler?.isPrimary}
              onClose={() => setRulerEditorOpen(false)}
            />
          ) : null}
        </InfoRow>

        {full ? (
          <InfoRow
            label="人口"
            action={
              canWrite ? (
                <button
                  type="button"
                  onClick={() => setRacePickerOpen(true)}
                  className="text-xs font-medium text-primary transition-colors hover:underline"
                >
                  添加种族构成
                </button>
              ) : null
            }
          >
            {detail.races.length === 0 ? (
              <EmptyHint
                text="还没有种族构成"
                actionLabel={canWrite ? '添加种族构成' : undefined}
                onAction={canWrite ? () => setRacePickerOpen(true) : undefined}
                icon={Sprout}
              />
            ) : (
              <div className="space-y-1">
                {raceShareTotal > 0 ? (
                  <div
                    className="flex h-1.5 overflow-hidden rounded-full bg-muted/40"
                    role="img"
                    aria-label="种族构成比例"
                  >
                    {detail.races.map((race) => (
                      <span
                        key={`${race.ref.module}-${race.ref.id}`}
                        className={toneSurfaceClass('teal')}
                        style={{ width: `${Math.max(race.share ?? 0, 1)}%` }}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  {detail.races.map((race) => (
                    <span
                      key={`${race.ref.module}-${race.ref.id}`}
                      className="flex items-center gap-1"
                    >
                      <LinkChip
                        label={race.label}
                        tone="teal"
                        onClick={() => onNavigateToEntity(race.ref)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {race.share === undefined
                          ? race.note || '占比未标注'
                          : `${race.share}%${race.note ? ` · ${race.note}` : ''}`}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </InfoRow>
        ) : null}

        {full ? (
          <InfoRow label="经济基础">
            {economyGroups.length === 0 ? (
              <div className="space-y-0.5">
                {detail.economyBase.summary ? <div>{detail.economyBase.summary}</div> : null}
                <EmptyHint text="还没有经济关联（经济模块为空不阻塞）" icon={Truck} />
              </div>
            ) : (
              <div className="space-y-1">
                {detail.economyBase.summary ? <div>{detail.economyBase.summary}</div> : null}
                <div className="flex flex-wrap items-center gap-1.5">
                  {detail.economyLinks.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() =>
                        group.refs.length > 0
                          ? setExpandedEconomyGroup((prev) => (prev === group.id ? null : group.id))
                          : undefined
                      }
                      className={`${chipClass} ${
                        group.refs.length > 0
                          ? 'border-border/60 text-foreground hover:bg-accent/20'
                          : 'border-border/50 text-muted-foreground'
                      }`}
                    >
                      {group.label}
                      <CountPill value={group.refs.length} />
                    </button>
                  ))}
                </div>
                {expandedEconomyGroup
                  ? (() => {
                      const group = economyGroups.find((item) => item.id === expandedEconomyGroup);
                      if (!group) return null;
                      return (
                        <div className="space-y-0.5 pl-1">
                          {group.refs.map((ref) => (
                            <div key={`${ref.module}-${ref.kind}-${ref.id}`}>
                              <LinkChip
                                label={politics.refs.resolveName(ref)}
                                onClick={() => onNavigateToEntity(ref)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  : economyGroups.map((group) => (
                      <div key={group.id} className="space-y-0.5 pl-1">
                        {group.refs.slice(0, ECONOMY_PREVIEW_ROWS).map((ref) => (
                          <div
                            key={`${ref.module}-${ref.kind}-${ref.id}`}
                            className="flex items-center gap-1.5"
                          >
                            <span className="text-xs text-muted-foreground">{group.label}</span>
                            <LinkChip
                              label={politics.refs.resolveName(ref)}
                              onClick={() => onNavigateToEntity(ref)}
                            />
                          </div>
                        ))}
                        {group.refs.length > ECONOMY_PREVIEW_ROWS ? (
                          <button
                            type="button"
                            onClick={() => setExpandedEconomyGroup(group.id)}
                            className="text-xs font-medium text-primary transition-colors hover:underline"
                          >
                            查看全部 {group.refs.length}
                          </button>
                        ) : null}
                      </div>
                    ))}
              </div>
            )}
          </InfoRow>
        ) : null}

        {full ? (
          <InfoRow
            label="沿革"
            action={
              <button
                type="button"
                onClick={() => scrollTo('chronicle')}
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                查看沿革
              </button>
            }
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                {historyCount} 个历史里程碑
              </span>
              <span className="text-muted-foreground">·</span>
              <span>{chronicleCount} 条政治沿革</span>
              {detail.historyEvents[0] ? (
                <button
                  type="button"
                  onClick={() => onNavigateToEntity(detail.historyEvents[0].ref)}
                  className="text-xs font-medium text-primary transition-colors hover:underline"
                >
                  打开历史
                </button>
              ) : null}
            </div>
          </InfoRow>
        ) : null}

        <NoteRow
          worldId={worldId}
          label="备注"
          value={detail.meta.note}
          onNavigate={onNavigateToEntity}
        />
      </SectionBlock>

      {/* 机构：政权内 organization（§4.3） */}
      {full ? (
        <SectionBlock
          id={sectionDomId(entity.id, 'organizations')}
          title="机构"
          count={detail.organizations.length}
          actions={
            canWrite ? (
              <button
                type="button"
                onClick={() => setOrgFormOpen(true)}
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                添加组织
              </button>
            ) : null
          }
        >
          {detail.organizations.length === 0 ? (
            <EmptyHint
              text="还没有组织卫星"
              actionLabel={canWrite ? '添加组织' : undefined}
              onAction={canWrite ? () => setOrgFormOpen(true) : undefined}
              icon={Shield}
            />
          ) : (
            <div className="space-y-0.5">
              {detail.organizations.map((organization) => {
                const holder = officeHolderOf(organization.id);
                const children = childCountOf(organization);
                return (
                  <div
                    key={organization.id}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-accent/20"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => onOpenFocus(organization.id)}
                      className="min-w-0 truncate text-sm text-foreground transition-colors hover:text-primary"
                    >
                      {organization.name}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {normalizeScope(organization.meta.scope) === 'intra_polity'
                        ? '机构'
                        : SCOPE_LABELS[normalizeScope(organization.meta.scope)]}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      负责人 {holder ?? '未指定'}
                    </span>
                    {children > 0 ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        下辖 {children}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenFocus(organization.id)}
                      className="ml-auto shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
                    >
                      打开
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>
      ) : null}

      {/* 人物：紧凑行 + 任职带，不出现大卡片（§4.3） */}
      {full ? (
        <SectionBlock
          id={sectionDomId(entity.id, 'figures')}
          title="人物"
          count={detail.figures.length}
          actions={
            canWrite ? (
              <button
                type="button"
                onClick={() => setFigureFormOpen(true)}
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                关联全局角色
              </button>
            ) : null
          }
        >
          {detail.figures.length === 0 ? (
            <EmptyHint
              text="还没有人物任职"
              actionLabel={canWrite ? '关联全局角色' : undefined}
              onAction={canWrite ? () => setFigureFormOpen(true) : undefined}
              icon={UserRound}
            />
          ) : (
            <div className="space-y-0.5">
              {detail.figures.map((figure) => {
                const bands = detail.tenureBands.filter((band) => band.figureId === figure.id);
                const office = bands.map((band) => band.officeTitle).filter(Boolean).join(' / ');
                return (
                  <div
                    key={figure.id}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-accent/20"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/50">
                      <UserRound className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenFocus(figure.id)}
                      className="min-w-0 truncate text-sm text-foreground transition-colors hover:text-primary"
                    >
                      {figureName(figure)}
                    </button>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {figure.meta.identityLabel || office || '政治身份未标注'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeRangeText(bands[0]?.start, bands[0]?.end)}
                    </span>
                    {bands.some((band) => band.isPrimary) ? (
                      <span className={`${chipClass} border-primary/40 text-primary`}>主要</span>
                    ) : null}
                    {figure.meta.characterId ? (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToEntity({
                            module: 'character',
                            kind: 'character',
                            id: figure.meta.characterId,
                          })
                        }
                        className="ml-auto shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
                      >
                        角色档案
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>
      ) : null}

      {/* 关系：politics.* 关系边分组列表（§4.7/§6.9） */}
      {full ? (
        <SectionBlock
          id={sectionDomId(entity.id, 'relations')}
          title="关系"
          count={relationEdges.length}
        >
          {relationEdges.length === 0 ? (
            <EmptyHint text="还没有政治关系边" icon={Link2} />
          ) : (
            <div className="space-y-0.5">
              {relationEdges.map(({ link, outgoing }) => {
                const counterpart = outgoing ? link.target : link.source;
                const strength =
                  typeof link.meta?.strength === 'number' ? (link.meta.strength as number) : undefined;
                return (
                  <div key={link.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-accent/20">
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {linkTypeLabel(link, polityRef, outgoing)}
                      </span>
                      <LinkChip
                        label={politics.refs.resolveName(counterpart)}
                        onClick={() => onNavigateToEntity(counterpart)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {timeRangeText(link.time?.start, link.time?.end)}
                      </span>
                      {strength !== undefined ? (
                        <span className="text-xs text-muted-foreground">强度 {strength}</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEdgeCard(link.id)}
                        className="ml-auto shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
                      >
                        编辑
                      </button>
                    </div>
                    {editingEdgeId === link.id && editingEdge ? (
                      <EdgeCard
                        politics={politics}
                        link={editingEdge}
                        perspective={polityRef}
                        onClose={closeEdgeCard}
                        onNavigateToEntity={onNavigateToEntity}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>
      ) : null}

      {/* 条约：entityRibbons 缔约方集合投影，不重复存（§4.6） */}
      {full ? (
        <SectionBlock
          id={sectionDomId(entity.id, 'treaties')}
          title="条约"
          count={detail.treaties.length}
          actions={
            <>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => setTreatyFormOpen(true)}
                  className="text-xs font-medium text-primary transition-colors hover:underline"
                >
                  发起条约
                </button>
              ) : null}
              <button
                type="button"
                onClick={onOpenTreatyBook}
                className="text-xs font-medium text-primary transition-colors hover:underline"
              >
                打开条约簿
              </button>
            </>
          }
        >
          {detail.treaties.length === 0 ? (
            <EmptyHint
              text="还没有缔约记录"
              actionLabel={canWrite ? '发起条约' : undefined}
              onAction={canWrite ? () => setTreatyFormOpen(true) : undefined}
              icon={ScrollText}
            />
          ) : (
            <div className="space-y-1">
              {detail.treaties.map(({ ribbon, parties }) => {
                const others = parties.filter((party) => party.ref.id !== entity.id);
                const expanded = expandedTreatyId === ribbon.treaty.id;
                const terms = expanded ? treatyTermsOf(politics.items, ribbon.treaty.id) : [];
                return (
                  <div key={ribbon.treaty.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-accent/20">
                      <ScrollText
                        className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => onOpenFocus(ribbon.treaty.id)}
                        className="min-w-0 truncate text-sm text-foreground transition-colors hover:text-primary"
                      >
                        {ribbon.treaty.name}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        与{' '}
                        {others.length > 0
                          ? others.map((party) => party.label).join('、')
                          : '（单缔约方，旌旗）'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {TREATY_STATUS_LABELS[ribbon.status]}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedTreatyId(expanded ? null : ribbon.treaty.id)
                        }
                        className="ml-auto shrink-0 text-xs font-medium text-primary transition-colors hover:underline"
                      >
                        {expanded ? '收起条款' : '展开条款'}
                      </button>
                    </div>
                    {expanded ? (
                      <div className="space-y-1 rounded-lg border border-border/40 bg-muted/10 p-2">
                        {terms.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            该条约还没有条款，可在条约详情补充
                          </span>
                        ) : (
                          terms.map((term) => (
                            <div key={term.id} className="text-xs leading-relaxed text-foreground">
                              <span className="font-medium">{term.title}</span>
                              {term.content ? (
                                <span className="text-muted-foreground"> · {term.content}</span>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionBlock>
      ) : null}

      {/* 沿革：chronicle 与历史入链按时间合并，历史事件用 flag 标记可跳转（§6.2） */}
      {full ? (
        <SectionBlock
          id={sectionDomId(entity.id, 'chronicle')}
          title="沿革"
          count={mergedAnchors.length}
        >
          <div className="space-y-0.5">
            {mergedAnchors.length === 0 ? (
              <EmptyHint text="还没有沿革记录" icon={Flag} />
            ) : (
              mergedAnchors.map((anchor) => (
                <div key={anchor.key} className="flex items-start gap-1.5 px-1 py-0.5">
                  {anchor.history ? (
                    <Flag className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  ) : (
                    <Landmark className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">
                    {anchor.timeText || '未标时间'}
                  </span>
                  <div className="min-w-0 flex-1">
                    {anchor.ref ? (
                      <button
                        type="button"
                        onClick={() => onNavigateToEntity(anchor.ref as EntityRef)}
                        className="text-sm text-foreground transition-colors hover:text-primary"
                      >
                        {anchor.label}
                      </button>
                    ) : (
                      <span className="text-sm text-foreground">{anchor.label}</span>
                    )}
                    {anchor.summary ? (
                      <div className="text-xs text-muted-foreground">{anchor.summary}</div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-1.5 flex items-end gap-1.5">
            <label className="flex-1 space-y-0.5">
              <span className="text-xs text-muted-foreground">标题</span>
              <input
                type="text"
                value={chronicleDraft.title}
                onChange={(event) =>
                  setChronicleDraft((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="沿革条目标题"
                aria-label="沿革条目标题"
                disabled={!canWrite}
                className={fieldClass}
              />
            </label>
            <label className="w-24 space-y-0.5">
              <span className="text-xs text-muted-foreground">时间</span>
              <input
                type="text"
                value={chronicleDraft.time}
                onChange={(event) =>
                  setChronicleDraft((prev) => ({ ...prev, time: event.target.value }))
                }
                placeholder="可选"
                aria-label="沿革条目时间"
                disabled={!canWrite}
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => void handleAddChronicle()}
              disabled={savingChronicle || !canWrite}
              title={canWrite ? '添加沿革条目' : '当前不可写实体'}
              className="shrink-0 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-accent/30 hover:bg-accent/10 hover:text-foreground disabled:opacity-50"
            >
              添加沿革
            </button>
          </div>
        </SectionBlock>
      ) : null}

      <EntityPicker
        open={racePickerOpen}
        worldId={worldId}
        source={polityRef}
        presetModule="races"
        multi
        excludeRefs={detail.races.map((race) => race.ref)}
        onClose={() => setRacePickerOpen(false)}
        onConfirm={(selection) => void handleRaceConfirm(selection)}
      />

      <PoliticsFormModal
        open={orgFormOpen}
        kind={ORGANIZATION_KIND}
        politics={politics}
        onClose={() => setOrgFormOpen(false)}
        onSaved={(organizationId) => void handleOrgSaved(organizationId)}
      />
      <PoliticsFormModal
        open={figureFormOpen}
        kind={FIGURE_KIND}
        politics={politics}
        onClose={() => setFigureFormOpen(false)}
        onSaved={(figureId) => void handleFigureSaved(figureId)}
      />
      <PoliticsFormModal
        open={treatyFormOpen}
        kind={TREATY_KIND}
        politics={politics}
        onClose={() => setTreatyFormOpen(false)}
        onSaved={(treatyId) => void handleTreatySaved(treatyId)}
      />
    </div>
  );
};

export default PolitySections;
