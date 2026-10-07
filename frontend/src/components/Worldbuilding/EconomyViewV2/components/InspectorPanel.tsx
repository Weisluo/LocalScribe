/**
 * 统一检查器 InspectorPanel（Phase 5 P5-T11；economy_ui_design §4.1/§4.5.4/§4.6.2/§5.2/§5.3）
 *
 * 固定顺序：概览 -> 字段 ->（沙盘档在此插入「指标」）-> 关联 -> 条目。竖排标签，页角式编号。
 * - 概览：名称失焦改名、kind 徽章、描述、等级 / 状态（文字徽章 + 分段条，**不用星级**）、
 *   单位与规模（`0` 与「—」区分）、stub「待补全」、关联计数徽章；
 * - 字段：`meta.customFields` 按 `fieldSchema[kind]`（缺省 `kindDefs[].defaultFields`）渲染，
 *   复用 `shared/CustomFieldRenderer`；写回一律基于**当前 meta 快照**合并，未知 meta 键原样保留；
 * - 指标（仅沙盘）：简单曲线，缺采样断线 + 空心点、单点只画标记不画趋势线，可添加采样；
 * - 关联：直接嵌入 `components/common/LinkPanel`（不另造经济版本），下方列出本实体出入链摘要，
 *   入链用注册表 `reverseLabel` 显示、不可直接删（到源实体修改）；
 * - 条目：该实体的 `entries`，JSON content 里的长文 / 列表最小化渲染，可新增与就地编辑；
 * - 删除入口二次确认，文案列出将受影响的关联数。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  FileText,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';

import { LinkPanel } from '@/components/common/LinkPanel';
import { kindLabel as globalKindLabel, moduleLabel } from '@/components/Worldbuilding/types';
import type { EntityRef } from '@/services/worldbuildingApi';
import { CustomFieldRenderer } from '../../shared/CustomFieldRenderer';
import { writeCustomField } from '../../shared/customFieldModel';
import type { CustomFieldValues } from '../../shared/customFieldModel';
import type { CustomFieldDef, CustomFieldValue } from '../../shared/moduleConfig';
import { ECONOMY_CONFIG_DEFAULTS, ECONOMY_LINK_LABELS, SURPLUS_LABELS, stageLabel } from '../config';
import type { EconomyMetricSample, InspectorPanelProps } from '../types';

const FIELD_CLASS =
  'w-full rounded-md border border-border/50 bg-background px-2 py-1 text-[11px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20';

const Label = ({ children }: { children: ReactNode }) => (
  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80">{children}</span>
);

const Chip = ({
  children,
  tone = 'muted',
  title,
  testId,
}: {
  children: ReactNode;
  tone?: 'muted' | 'primary' | 'warn' | 'dashed';
  title?: string;
  testId?: string;
}) => {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : tone === 'warn'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : tone === 'dashed'
          ? 'border-dashed border-muted-foreground/60 text-muted-foreground'
          : 'border-border/60 bg-muted/20 text-muted-foreground';
  return (
    <span
      title={title}
      data-testid={testId}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${toneClass}`}
    >
      {children}
    </span>
  );
};

const Section = ({
  id,
  title,
  count,
  actions,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <section
    id={`economy-inspector-${id}`}
    data-testid={`economy-inspector-${id}`}
    className="space-y-1.5 border-t border-border/40 px-3 py-2.5 first:border-t-0"
  >
    <div className="flex items-center gap-1.5">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">{title}</h3>
      {typeof count === 'number' && (
        <span className="rounded-full border border-border/50 px-1.5 text-[10px] text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
      {actions ? <div className="ml-auto flex items-center gap-1">{actions}</div> : null}
    </div>
    {children}
  </section>
);

/** 采样值 -> 数值：band（[low, high]）取低值画线，区间文本另行显示 */
const sampleNumber = (value: EconomyMetricSample['value']): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === 'number' && Number.isFinite(first) ? first : null;
  }
  return null;
};

const sampleText = (sample: EconomyMetricSample): string =>
  Array.isArray(sample.value) ? `${sample.value[0]} ~ ${sample.value[1]}` : String(sample.value);

/**
 * 简单曲线（沙盘）：按 `timeOrder`（缺省按数组序）排序；
 * 缺采样断线并画空心点，单点只画标记不画趋势线，**不用 0 补点**（§4.6.2）。
 */
const MetricSparkline = ({
  samples,
  width = 180,
  height = 44,
}: {
  samples: EconomyMetricSample[];
  width?: number;
  height?: number;
}) => {
  const points = useMemo(() => {
    const rows = samples.map((sample, index) => ({
      sample,
      t: typeof sample.timeOrder === 'number' ? sample.timeOrder : index,
      value: sampleNumber(sample.value),
    }));
    return rows.sort((a, b) => a.t - b.t);
  }, [samples]);

  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  if (points.length === 0) {
    return <p className="text-[10px] text-muted-foreground">无采样（不按 0 处理）</p>;
  }
  if (values.length === 0) {
    return <p className="text-[10px] text-muted-foreground">采样值不可用（不按 0 处理）</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tSpan = tMax - tMin || 0;
  const gaps = points
    .slice(1)
    .map((point, index) => point.t - points[index].t)
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b);
  const medianGap = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 0;
  const gapLimit = medianGap > 0 ? medianGap * 2.5 : Number.POSITIVE_INFINITY;

  // 单点 / 时间锚点重合时居中画一个标记，不画趋势线
  const xOf = (t: number): number =>
    tSpan <= 0 ? width / 2 : 4 + ((t - tMin) / tSpan) * (width - 8);
  const yOf = (value: number): number => height - 4 - ((value - min) / span) * (height - 12);

  const segments: string[] = [];
  const breakPoints = new Set<number>();
  let current: string[] = [];
  let previousT: number | null = null;

  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 0) {
        segments.push(current.join(' '));
        current = [];
      }
      previousT = null;
      breakPoints.add(index);
      return;
    }
    if (previousT !== null && point.t - previousT > gapLimit && current.length > 0) {
      segments.push(current.join(' '));
      current = [];
      breakPoints.add(index);
      breakPoints.add(index - 1);
    }
    current.push(`${current.length === 0 ? 'M' : 'L'} ${xOf(point.t)} ${yOf(point.value)}`);
    previousT = point.t;
  });
  if (current.length > 0) segments.push(current.join(' '));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="指标采样曲线（缺采样处断线）"
      className="overflow-visible"
    >
      {segments.map((path, index) => (
        <path
          key={`segment-${index}`}
          d={path}
          fill="none"
          strokeWidth={1.6}
          className="stroke-cyan-600 dark:stroke-cyan-400"
        />
      ))}
      {points.map((point, index) =>
        point.value === null ? null : breakPoints.has(index) ? (
          <circle
            key={`hole-${index}`}
            cx={xOf(point.t)}
            cy={yOf(point.value)}
            r={2.6}
            fill="none"
            strokeWidth={1.2}
            className="stroke-cyan-600 dark:stroke-cyan-400"
          />
        ) : (
          <circle
            key={`point-${index}`}
            cx={xOf(point.t)}
            cy={yOf(point.value)}
            r={2.2}
            className="fill-cyan-600 dark:fill-cyan-400"
          />
        )
      )}
    </svg>
  );
};

/** 条目 content 的最小化渲染：长文直出，其余键值成列表 */
const renderEntryContent = (content: Record<string, unknown>): ReactNode => {
  const text = content.text;
  if (typeof text === 'string' && text.trim()) {
    return <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{text}</p>;
  }
  const rows = Object.entries(content);
  if (rows.length === 0) return <p className="text-[11px] text-muted-foreground">（空条目）</p>;
  return (
    <ul className="space-y-0.5 text-[11px] text-muted-foreground">
      {rows.map(([key, value]) => (
        <li key={key} className="flex gap-1">
          <span className="shrink-0 text-foreground">{key}</span>
          <span className="min-w-0 flex-1 break-words">
            {Array.isArray(value)
              ? value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' / ')
              : typeof value === 'string'
                ? value
                : JSON.stringify(value)}
          </span>
        </li>
      ))}
    </ul>
  );
};

export const InspectorPanel = ({
  worldId,
  complexity,
  node,
  edges,
  levels,
  statuses,
  fieldSchema,
  metrics,
  metricSamples,
  entries,
  kindDefs,
  canWrite,
  refs,
  onNavigateToEntity,
  onClose,
  onUpdateMeta,
  onUpdateName,
  onSaveMetrics,
  onSaveEntry,
  onDeleteEntity,
  onLinkChanged,
  onNavigateToHistory,
}: InspectorPanelProps) => {
  const [nameDraft, setNameDraft] = useState(node?.name ?? '');
  const [descriptionDraft, setDescriptionDraft] = useState(node?.description ?? '');
  const [unitDraft, setUnitDraft] = useState(node?.unit ?? '');
  const [scaleDraft, setScaleDraft] = useState(
    node?.scale === undefined || node?.scale === null ? '' : String(node.scale)
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sampleDrafts, setSampleDrafts] = useState<Record<string, { t: string; value: string }>>({});
  const [entryDraft, setEntryDraft] = useState({ name: '', text: '' });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryText, setEditingEntryText] = useState('');

  const nodeId = node?.id ?? null;
  const nodeName = node?.name ?? '';
  const nodeDescription = node?.description ?? '';
  const nodeUnit = node?.unit ?? '';
  const nodeScale = node?.scale;

  useEffect(() => {
    setNameDraft(nodeName);
    setDescriptionDraft(nodeDescription);
    setUnitDraft(nodeUnit);
    setScaleDraft(nodeScale === undefined || nodeScale === null ? '' : String(nodeScale));
    setConfirmDelete(false);
    setEditingEntryId(null);
  }, [nodeId, nodeName, nodeDescription, nodeUnit, nodeScale]);

  const sandbox = complexity === 'sandbox';

  const incident = useMemo(
    () =>
      node ? edges.filter((edge) => edge.source.id === node.id || edge.target.id === node.id) : [],
    [edges, node]
  );
  const outgoing = useMemo(
    () => (node ? incident.filter((edge) => edge.source.id === node.id) : []),
    [incident, node]
  );
  const incoming = useMemo(
    () => (node ? incident.filter((edge) => edge.target.id === node.id) : []),
    [incident, node]
  );

  const fieldDefs = useMemo<CustomFieldDef[]>(() => {
    if (!node) return [];
    const explicit = fieldSchema[node.kind];
    if (Array.isArray(explicit) && explicit.length > 0) {
      return explicit.filter((field) => !!field?.id);
    }
    return kindDefs.find((def) => def.id === node.kind)?.defaultFields ?? [];
  }, [fieldSchema, kindDefs, node]);

  /** 未经清洗的 meta.customFields：写回时以它为基准，未知键不会被丢掉 */
  const customFields = (node?.customFields ?? {}) as CustomFieldValues;

  const incidentSurplus = useMemo(() => {
    if (!sandbox) return null;
    const derived = incident.find((edge) => edge.surplusDerived);
    if (!derived) return null;
    return { surplus: incident.find((edge) => edge.surplus)?.surplus ?? 'unknown' };
  }, [incident, sandbox]);

  const applicableMetrics = useMemo(() => {
    if (!node) return [];
    return metrics.filter((metric) => {
      const kindOk = !metric.kindFilter?.length || metric.kindFilter.includes(node.kind);
      const stageOk = !metric.stageFilter?.length || metric.stageFilter.includes(node.stage);
      return kindOk && stageOk;
    });
  }, [metrics, node]);

  const nodeEntries = useMemo(
    () => (node ? entries.filter((entry) => entry.submodule_id === node.id) : []),
    [entries, node]
  );

  const levelDefs = useMemo(
    () => [...levels].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.id.localeCompare(b.id)),
    [levels]
  );
  const currentLevelIndex = node ? levelDefs.findIndex((def) => def.id === node.level) : -1;
  const levelText = node
    ? levelDefs.find((def) => def.id === node.level)?.label ?? (node.level ? node.level : '未分级')
    : '未分级';
  const statusText = node
    ? statuses.find((def) => def.id === node.status)?.label ?? (node.status ? node.status : '未标注')
    : '未标注';

  const kindText = node
    ? kindDefs.find((def) => def.id === node.kind)?.label ?? globalKindLabel(node.kind)
    : '';

  const saveName = () => {
    if (!node || !canWrite) return;
    const next = nameDraft.trim();
    if (!next || next === node.name) {
      setNameDraft(node.name);
      return;
    }
    void onUpdateName(node.id, next);
  };

  const saveMetaField = (patch: Record<string, unknown>) => {
    if (!node || !canWrite) return;
    void onUpdateMeta(node.id, patch);
  };

  const saveScale = () => {
    if (!node || !canWrite) return;
    const raw = scaleDraft.trim();
    if (raw === '') {
      saveMetaField({ scale: undefined });
      return;
    }
    const parsed = Number(raw);
    saveMetaField({ scale: Number.isFinite(parsed) ? parsed : undefined });
  };

  const handleFieldChange = (fieldId: string, value: CustomFieldValue) => {
    if (!node || !canWrite) return;
    saveMetaField({ customFields: writeCustomField(customFields, fieldId, value) });
  };

  const addSample = (metricId: string) => {
    if (!node || !canWrite) return;
    const draft = sampleDrafts[metricId] ?? { t: '', value: '' };
    const value = Number(draft.value);
    if (!draft.t.trim() || !Number.isFinite(value)) return;
    const samples = metricSamples[metricId] ?? [];
    void onSaveMetrics(node.id, metricId, [...samples, { t: draft.t.trim(), value }]);
    setSampleDrafts((prev) => ({ ...prev, [metricId]: { t: '', value: '' } }));
  };

  const saveEntry = (name: string, content: Record<string, unknown>) => {
    if (!node || !canWrite) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    void onSaveEntry(node.id, trimmed, content);
  };

  /** 关联摘要：按目标模块分组（出链用 label、入链用 reverseLabel；入链不可直接删） */
  const linkGroups = useMemo(() => {
    if (!node) return [];
    const rows = incident.map((edge) => {
      const isOut = edge.source.id === node.id;
      const counterpart = isOut ? edge.target : edge.source;
      const meta = ECONOMY_LINK_LABELS[edge.linkType];
      return {
        id: edge.id,
        out: isOut,
        counterpart,
        label: (isOut ? meta?.label : meta?.reverseLabel) ?? edge.linkType,
      };
    });
    const grouped: { module: string; rows: typeof rows }[] = [];
    for (const row of rows) {
      const bucket = grouped.find((item) => item.module === row.counterpart.module);
      if (bucket) bucket.rows.push(row);
      else grouped.push({ module: row.counterpart.module, rows: [row] });
    }
    return grouped;
  }, [incident, node]);

  const openRef = (ref: EntityRef) => {
    if (ref.module === 'history') onNavigateToHistory(ref);
    else onNavigateToEntity(ref);
  };

  return (
    <aside
      data-testid="economy-inspector"
      aria-label="实体检查器"
      className="flex h-full min-h-0 w-full flex-col overflow-y-auto border-l border-border/40 bg-card/30"
    >
      <header className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        <span
          className="rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] tracking-[0.08em] text-muted-foreground"
          title="页角式编号"
        >
          页 01
        </span>
        {node && (
          <span className="text-[10px] text-muted-foreground tabular-nums" title="实体短 id 后四位">
            {node.id.slice(-4)}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭检查器"
          data-testid="economy-inspector-close"
          className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      {!node ? (
        <div className="px-3 py-3 text-[11px] text-muted-foreground" data-testid="economy-inspector-empty">
          未选择实体：在画布或账册里点一行，这里显示它的分户账。
        </div>
      ) : (
        <>
          <Section id="overview" title="概览">
            <label className="block space-y-0.5">
              <Label>名称</Label>
              <input
                type="text"
                value={nameDraft}
                readOnly={!canWrite}
                aria-label="实体名称"
                data-testid="economy-inspector-name"
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                className={FIELD_CLASS}
              />
            </label>

            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <Chip tone="primary">{kindText}</Chip>
              <Chip>{stageLabel(node.stage, ECONOMY_CONFIG_DEFAULTS)}</Chip>
              <Chip>等级 {levelText}</Chip>
              <Chip>状态 {statusText}</Chip>
              {node.stub && (
                <Chip tone="dashed" title="由速写关键词展开、尚未补全">
                  待补全
                </Chip>
              )}
              {node.legacy && (
                <Chip tone="dashed" title="回填迁移写入的旧数据">
                  旧数据
                </Chip>
              )}
            </div>

            {levelDefs.length > 0 && (
              <div className="flex items-center gap-[3px]" role="img" aria-label={`等级分段：${levelText}`}>
                {levelDefs.map((def, index) => (
                  <span
                    key={def.id}
                    title={def.label}
                    className={`h-1.5 w-4 rounded-sm ${
                      currentLevelIndex >= 0 && index <= currentLevelIndex
                        ? 'bg-green-600 dark:bg-green-400'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            )}

            {canWrite && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-0.5">
                  <Label>等级</Label>
                  <select
                    value={node.level ?? ''}
                    aria-label="等级"
                    onChange={(event) =>
                      saveMetaField({ level: event.target.value || undefined })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">未分级</option>
                    {levelDefs.map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <Label>状态</Label>
                  <select
                    value={node.status ?? ''}
                    aria-label="状态"
                    onChange={(event) =>
                      saveMetaField({ status: event.target.value || undefined })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">未标注</option>
                    {statuses.map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="block space-y-0.5">
              <Label>描述</Label>
              <textarea
                rows={2}
                value={descriptionDraft}
                readOnly={!canWrite}
                aria-label="实体描述"
                onChange={(event) => setDescriptionDraft(event.target.value)}
                onBlur={() => saveMetaField({ description: descriptionDraft.trim() || null })}
                className={FIELD_CLASS}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-0.5">
                <Label>计量单位</Label>
                <input
                  type="text"
                  value={unitDraft}
                  readOnly={!canWrite}
                  aria-label="计量单位"
                  placeholder="袋 / 季"
                  onChange={(event) => setUnitDraft(event.target.value)}
                  onBlur={() => saveMetaField({ unit: unitDraft.trim() || undefined })}
                  className={FIELD_CLASS}
                />
              </label>
              <label className="block space-y-0.5">
                <Label>规模</Label>
                <input
                  type="number"
                  value={scaleDraft}
                  readOnly={!canWrite}
                  aria-label="规模"
                  placeholder="—"
                  data-testid="economy-inspector-scale"
                  onChange={(event) => setScaleDraft(event.target.value)}
                  onBlur={saveScale}
                  className={`${FIELD_CLASS} tabular-nums`}
                />
                <span className="block text-[10px] text-muted-foreground">
                  {node.scale === undefined || node.scale === null
                    ? '未填（与 0 不同）'
                    : `已填 ${node.scale}`}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <Chip>出链 {node.counts?.outgoing ?? outgoing.length}</Chip>
              <Chip>入链 {node.counts?.incoming ?? incoming.length}</Chip>
              {node.hasMetrics && <Chip>含指标</Chip>}
            </div>
          </Section>

          <Section id="fields" title="字段" count={fieldDefs.length}>
            {fieldDefs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                该类型没有字段定义：只有名称与描述（可在模块配置里补字段）。
              </p>
            ) : (
              <CustomFieldRenderer
                fields={fieldDefs}
                values={customFields}
                readOnly={!canWrite}
                showEmpty={!canWrite}
                onChange={handleFieldChange}
                onNavigateToEntity={onNavigateToEntity}
                resolveEntityName={(ref) => refs.resolveName(ref)}
                invalidEntity={(ref) => refs.isInvalid(ref)}
              />
            )}
          </Section>

          {sandbox && (
            <Section
              id="metrics"
              title="指标"
              count={applicableMetrics.length}
              actions={
                incidentSurplus ? (
                  <Chip
                    tone="warn"
                    title="数值由指标推定，非直接记录"
                    testId="economy-inspector-metric-derived"
                  >
                    推定 · {SURPLUS_LABELS[incidentSurplus.surplus] ?? '未知'}
                  </Chip>
                ) : (
                  <span className="text-[10px] text-muted-foreground">推定标注位</span>
                )
              }
            >
              {applicableMetrics.length === 0 ? (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  还没有指标定义：在模块配置里添加后才有曲线。
                </p>
              ) : (
                applicableMetrics.map((metric) => {
                  const samples = metricSamples[metric.id] ?? [];
                  const draft = sampleDrafts[metric.id] ?? { t: '', value: '' };
                  return (
                    <div
                      key={metric.id}
                      data-testid={`economy-metric-${metric.id}`}
                      className="space-y-1 rounded-md border border-border/40 bg-card/40 p-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-foreground">{metric.label}</span>
                        {metric.unit && (
                          <span className="text-[10px] text-muted-foreground">{metric.unit}</span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                          {samples.length} 个采样
                        </span>
                      </div>
                      <MetricSparkline samples={samples} />
                      {samples.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          最近：{sampleText(samples[samples.length - 1])}
                          {typeof samples[samples.length - 1]?.t === 'string'
                            ? ` · ${samples[samples.length - 1].t}`
                            : ''}
                        </p>
                      )}
                      {canWrite && (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={draft.t}
                            aria-label={`${metric.label} 采样时间`}
                            placeholder="时间 312 年"
                            onChange={(event) =>
                              setSampleDrafts((prev) => ({
                                ...prev,
                                [metric.id]: { ...draft, t: event.target.value },
                              }))
                            }
                            className={`${FIELD_CLASS} flex-1`}
                          />
                          <input
                            type="number"
                            value={draft.value}
                            aria-label={`${metric.label} 采样值`}
                            placeholder="值"
                            onChange={(event) =>
                              setSampleDrafts((prev) => ({
                                ...prev,
                                [metric.id]: { ...draft, value: event.target.value },
                              }))
                            }
                            className={`${FIELD_CLASS} w-20 tabular-nums`}
                          />
                          <button
                            type="button"
                            onClick={() => addSample(metric.id)}
                            aria-label={`添加 ${metric.label} 采样`}
                            data-testid={`economy-metric-add-${metric.id}`}
                            className="rounded-md border border-border/60 px-1.5 py-1 text-[10px] text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </Section>
          )}

          <Section
            id="links"
            title="关联"
            count={incident.length}
            actions={
              <button
                type="button"
                onClick={onLinkChanged}
                title="重新读取关联"
                aria-label="刷新关联"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              </button>
            }
          >
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              <Chip>出 {node.counts?.outgoing ?? outgoing.length}</Chip>
              <Chip>入 {node.counts?.incoming ?? incoming.length}</Chip>
            </div>

            <LinkPanel
              worldId={worldId}
              entity={node.ref}
              complexity={complexity}
              onNavigate={openRef}
              title="统一关联面板"
            />

            <div className="space-y-1 rounded-md border border-border/40 bg-card/30 p-1.5">
              <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80">
                出入链摘要
              </div>
              {linkGroups.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">暂无关联</p>
              ) : (
                linkGroups.map((group) => (
                  <div key={group.module} className="space-y-0.5">
                    <div className="text-[10px] text-muted-foreground">
                      {moduleLabel(group.module)}
                    </div>
                    {group.rows.map((row) => {
                      const name = refs.resolveName(row.counterpart);
                      const invalid = refs.isInvalid(row.counterpart);
                      return (
                        <div key={row.id} className="flex items-center gap-1.5 text-[11px]">
                          <span className="shrink-0 text-muted-foreground">{row.label}</span>
                          {invalid ? (
                            <span className="flex min-w-0 items-center gap-1 text-destructive">
                              <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{name}</span>
                              <span className="shrink-0 text-[10px]">已失效</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openRef(row.counterpart)}
                              className="min-w-0 truncate text-left text-foreground transition-colors hover:text-primary motion-reduce:transition-none"
                            >
                              {name}
                            </button>
                          )}
                          <span className="shrink-0 rounded-full border border-border/60 px-1 text-[9px] text-muted-foreground">
                            {kindDefs.find((def) => def.id === row.counterpart.kind)?.label ??
                              globalKindLabel(row.counterpart.kind)}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                            {row.out ? '出链' : '入链（到源实体修改）'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </Section>

          <Section id="entries" title="条目" count={nodeEntries.length}>
            {nodeEntries.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                还没有条目：长文、列表、条款都可以放在这里（条目不参与关联）。
              </p>
            ) : (
              nodeEntries.map((entry) => (
                <div
                  key={entry.id}
                  data-testid={`economy-entry-${entry.id}`}
                  className="space-y-1 rounded-md border border-border/40 bg-card/40 p-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <span className="text-[11px] text-foreground">{entry.name}</span>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntryId(entry.id);
                          const text = entry.content?.text;
                          setEditingEntryText(typeof text === 'string' ? text : '');
                        }}
                        className="ml-auto rounded px-1 text-[10px] text-primary transition-colors hover:bg-primary/10 motion-reduce:transition-none"
                      >
                        编辑
                      </button>
                    )}
                  </div>
                  {editingEntryId === entry.id ? (
                    <div className="space-y-1">
                      <textarea
                        rows={3}
                        value={editingEntryText}
                        aria-label={`${entry.name} 内容`}
                        onChange={(event) => setEditingEntryText(event.target.value)}
                        className={FIELD_CLASS}
                      />
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingEntryId(null)}
                          className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/20 motion-reduce:transition-none"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            saveEntry(entry.name, { ...entry.content, text: editingEntryText });
                            setEditingEntryId(null);
                          }}
                          className="rounded-md bg-primary px-2 py-0.5 text-[10px] text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    renderEntryContent(entry.content ?? {})
                  )}
                </div>
              ))
            )}

            {canWrite && (
              <div className="space-y-1 rounded-md border border-dashed border-border/50 p-1.5">
                <input
                  type="text"
                  value={entryDraft.name}
                  aria-label="新条目名称"
                  placeholder="条目名称（长文 / 条款 / 备注）"
                  onChange={(event) =>
                    setEntryDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className={FIELD_CLASS}
                />
                <textarea
                  rows={2}
                  value={entryDraft.text}
                  aria-label="新条目内容"
                  placeholder="内容（存 JSON，长文放 text）"
                  onChange={(event) =>
                    setEntryDraft((prev) => ({ ...prev, text: event.target.value }))
                  }
                  className={FIELD_CLASS}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      saveEntry(entryDraft.name, { text: entryDraft.text });
                      setEntryDraft({ name: '', text: '' });
                    }}
                    disabled={!entryDraft.name.trim()}
                    className="flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 motion-reduce:transition-none"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    新增条目
                  </button>
                </div>
              </div>
            )}
          </Section>

          {canWrite && (
            <section className="mt-auto space-y-1 border-t border-border/40 px-3 py-2.5">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  data-testid="economy-inspector-delete"
                  className="flex items-center gap-1 text-[11px] text-destructive transition-colors hover:underline motion-reduce:transition-none"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  删除实体
                </button>
              ) : (
                <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-1.5">
                  <p className="text-[11px] text-foreground">
                    将删除「{node.name}」，并影响 {incident.length} 条关联（出链{' '}
                    {node.counts?.outgoing ?? outgoing.length} / 入链{' '}
                    {node.counts?.incoming ?? incoming.length}）。入链不会从对方实体上被单独拆掉，
                    需要到源实体修改。
                  </p>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/20 motion-reduce:transition-none"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteEntity(node.id)}
                      data-testid="economy-inspector-delete-confirm"
                      className="rounded-md bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground transition-colors hover:bg-destructive/90 motion-reduce:transition-none"
                    >
                      确认删除
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </aside>
  );
};

export default InspectorPanel;
