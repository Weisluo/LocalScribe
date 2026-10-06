/**
 * 政治实体表单状态与纯转换（Phase 4 P4-T11；politics_ui_design §5.2/§5.3/§5.7）
 *
 * 四 kind 共用一个状态对象，表单只按 kind 渲染对应字段；这里只做纯数据变换与校验，
 * 不发请求、不读 hook。必填规则与 ../hooks 的 validatePoliticsForm 保持一致（§5.7 阻断级）。
 */

import type { EntityRef } from '@/services/worldbuildingApi';
import {
  validatePoliticsForm,
  type FigureEntity,
  type FigureFormValues,
  type OrganizationEntity,
  type OrganizationFormValues,
  type PolityEntity,
  type PolityFormValues,
  type PoliticsScope,
  type PoliticsTimeSpan,
  type TreatyEntity,
  type TreatyFormValues,
} from '../hooks';
import {
  FIGURE_KIND,
  ORGANIZATION_KIND,
  POLITY_KIND,
  POLITICS_LINK_TYPES,
  TREATY_KIND,
  cleanText,
  readMetaOfKind,
} from '../types';
import type { CustomFieldValue } from '../../shared/moduleConfig';

export interface PoliticsFormState {
  name: string;
  level: string;
  status: string;
  timeStart: string;
  timeEnd: string;
  description: string;
  note: string;
  // 政权
  governmentFormLabel: string;
  rulerCharacterId: string;
  rulerOfficeTitle: string;
  rulerStart: string;
  rulerEnd: string;
  rulerIsPrimary: boolean;
  // 组织
  scope: PoliticsScope;
  orgSubtypeId: string;
  baseLabel: string;
  parentRef: EntityRef | null;
  // 人物
  characterId: string;
  identityLabel: string;
  courtRank: string;
  factionLabel: string;
  officeRef: EntityRef | null;
  officeTitle: string;
  officeStart: string;
  officeEnd: string;
  officeIsPrimary: boolean;
  officeLinkType: string;
  // 条约
  treatyTypeId: string;
  effectiveAt: string;
  expiresAt: string;
  breachState: string;
  visibility: string;
  summary: string;
  parties: EntityRef[];
  // 自定义字段（config.fieldSchema[kind]）
  customFields: Record<string, CustomFieldValue>;
}

/** 新建时的空表单：不预填任何等级、状态、政体、名称（§9.3 引导不预填） */
export const emptyFormState = (): PoliticsFormState => ({
  name: '',
  level: '',
  status: '',
  timeStart: '',
  timeEnd: '',
  description: '',
  note: '',
  governmentFormLabel: '',
  rulerCharacterId: '',
  rulerOfficeTitle: '',
  rulerStart: '',
  rulerEnd: '',
  rulerIsPrimary: true,
  scope: 'intra_polity',
  orgSubtypeId: '',
  baseLabel: '',
  parentRef: null,
  characterId: '',
  identityLabel: '',
  courtRank: '',
  factionLabel: '',
  officeRef: null,
  officeTitle: '',
  officeStart: '',
  officeEnd: '',
  officeIsPrimary: true,
  officeLinkType: POLITICS_LINK_TYPES.leads,
  treatyTypeId: '',
  effectiveAt: '',
  expiresAt: '',
  breachState: '',
  visibility: '',
  summary: '',
  parties: [],
  customFields: {},
});

/** `string | null`（契约）-> PoliticsTimeSpan（端点 string | undefined） */
export const toTimeSpan = (start?: string, end?: string): PoliticsTimeSpan | undefined => {
  const from = cleanText(start);
  const to = cleanText(end);
  return from || to ? { start: from, end: to } : undefined;
};

const timeStart = (time?: PoliticsTimeSpan): string => time?.start ?? '';
const timeEnd = (time?: PoliticsTimeSpan): string => time?.end ?? '';

/** 编辑态：由实体 meta / items 回填表单（未绑定角色等情况不阻塞其他字段） */
export const formStateOf = (entity: FigureEntity | PolityEntity | OrganizationEntity | TreatyEntity): PoliticsFormState => {
  const base = emptyFormState();
  const meta = readMetaOfKind(entity.kind, entity.meta) as Record<string, unknown> & {
    level?: string;
    status?: string;
    time?: PoliticsTimeSpan;
    note?: string;
    customFields?: Record<string, CustomFieldValue>;
  };
  const next: PoliticsFormState = {
    ...base,
    name: entity.name,
    level: meta.level ?? '',
    status: meta.status ?? '',
    timeStart: timeStart(meta.time),
    timeEnd: timeEnd(meta.time),
    description: entity.description ?? '',
    note: typeof meta.note === 'string' ? meta.note : '',
    customFields: meta.customFields ?? {},
  };
  if (entity.kind === POLITY_KIND) {
    const polity = entity as PolityEntity;
    next.governmentFormLabel = polity.meta.governmentFormLabel ?? '';
  }
  if (entity.kind === ORGANIZATION_KIND) {
    const organization = entity as OrganizationEntity;
    next.scope = organization.meta.scope ?? 'intra_polity';
    next.orgSubtypeId = organization.meta.orgSubtypeId ?? '';
    next.baseLabel = organization.meta.baseLabel ?? '';
  }
  if (entity.kind === FIGURE_KIND) {
    const figure = entity as FigureEntity;
    next.characterId = figure.meta.characterId ?? '';
    next.identityLabel = figure.meta.identityLabel ?? '';
    next.courtRank = figure.meta.courtRank ?? '';
    next.factionLabel = figure.meta.factionLabel ?? '';
  }
  if (entity.kind === TREATY_KIND) {
    const treaty = entity as TreatyEntity;
    next.treatyTypeId = treaty.meta.treatyTypeId ?? '';
    next.effectiveAt = treaty.meta.effectiveAt ?? '';
    next.expiresAt = treaty.meta.expiresAt ?? '';
    next.breachState = treaty.meta.breachState ?? '';
    next.visibility = treaty.meta.visibility ?? '';
    next.summary = treaty.meta.summary ?? '';
  }
  return next;
};

/** 政权最短路径：名称 + 等级（统治者可选），其余字段创建后补充（§5.2/§10.3） */
export const toPolityValues = (state: PoliticsFormState): PolityFormValues => ({
  name: state.name,
  kind: POLITY_KIND,
  description: state.description,
  level: state.level,
  status: state.status,
  time: toTimeSpan(state.timeStart, state.timeEnd),
  note: state.note,
  governmentFormLabel: state.governmentFormLabel,
  rulerCharacterId: cleanText(state.rulerCharacterId),
  rulerOfficeTitle: state.rulerOfficeTitle,
  rulerStart: state.rulerStart,
  rulerEnd: state.rulerEnd,
  rulerIsPrimary: state.rulerIsPrimary,
  customFields: state.customFields,
});

export const toOrganizationValues = (state: PoliticsFormState): OrganizationFormValues => ({
  name: state.name,
  kind: ORGANIZATION_KIND,
  description: state.description,
  scope: state.scope,
  level: state.level,
  status: state.status,
  time: toTimeSpan(state.timeStart, state.timeEnd),
  note: state.note,
  orgSubtypeId: state.orgSubtypeId,
  baseLabel: state.baseLabel,
  parentRef: state.parentRef,
  customFields: state.customFields,
});

export const toFigureValues = (state: PoliticsFormState): FigureFormValues => ({
  name: state.name,
  kind: FIGURE_KIND,
  description: state.description,
  characterId: state.characterId,
  identityLabel: state.identityLabel,
  courtRank: state.courtRank,
  factionLabel: state.factionLabel,
  note: state.note,
  time: toTimeSpan(state.timeStart, state.timeEnd),
  officeRef: state.officeRef,
  officeTitle: state.officeTitle,
  officeStart: state.officeStart,
  officeEnd: state.officeEnd,
  officeIsPrimary: state.officeIsPrimary,
  officeLinkType: state.officeLinkType,
  customFields: state.customFields,
});

export const toTreatyValues = (state: PoliticsFormState): TreatyFormValues => ({
  name: state.name,
  kind: TREATY_KIND,
  description: state.description,
  status: state.status,
  time: toTimeSpan(state.timeStart, state.timeEnd),
  treatyTypeId: state.treatyTypeId,
  effectiveAt: state.effectiveAt,
  expiresAt: state.expiresAt,
  breachState: state.breachState,
  visibility: state.visibility,
  summary: state.summary,
  parties: state.parties,
  customFields: state.customFields,
});

/**
 * 阻断级校验（§5.7）：政权名称 + 等级；组织名称 + scope；人物 characterId（名称可取自角色名）；条约名称。
 * fallbackName 用于人物：已选全局角色时政治记录名可直接沿用角色名。
 */
export const validateForm = (
  kind: string,
  state: PoliticsFormState,
  fallbackName?: string
): string | null => {
  const name = cleanText(state.name) ?? cleanText(fallbackName) ?? '';
  const reason = validatePoliticsForm(kind, {
    name,
    level: state.level,
    characterId: state.characterId,
    scope: state.scope,
  });
  if (reason) return reason;
  if (kind === FIGURE_KIND && !cleanText(state.characterId)) return '人物必须绑定全局角色';
  return null;
};

/** 警告级校验（不阻断，仅提示）：条约到期早于生效（§5.7 警告） */
export const warningOf = (kind: string, state: PoliticsFormState): string | null => {
  if (kind !== TREATY_KIND) return null;
  const effective = cleanText(state.effectiveAt);
  const expires = cleanText(state.expiresAt);
  if (!effective || !expires) return null;
  if (expires < effective) return '到期时间早于生效时间，请确认';
  return null;
};

/** 等级 / 状态 id：ASCII slug，中文等无 ASCII 字符时退回前缀 + 序号（不预置任何名称） */
export const slugId = (label: string, taken: string[], prefix: string): string => {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || prefix;
  let candidate = base;
  let index = 2;
  while (taken.includes(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
};
