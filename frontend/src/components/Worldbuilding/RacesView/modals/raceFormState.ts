/**
 * 种族速写表单状态（Phase 3 P3-T3；races_ui_design §5.1、§8 sketch 必填三项）
 *
 * 名称（必填）+ 一句话特征 + 代表色/图标是 sketch 档的最小路径，其余字段折叠在「更多字段」。
 * 状态 -> RaceFormValues 只做值转换，落库口径由 useRaces（metaFromRaceForm / mergeMeta）承担。
 */

import type { CustomFieldValue, ModuleConfig } from '../../shared/moduleConfig';
import { emblemPaletteOf } from '../config';
import type { RaceFormValues } from '../hooks/useRaces';
import { RACE_KIND, type RaceNode } from '../types';

export interface RaceFormState {
  name: string;
  tagline: string;
  /** 代表色（色板 token 或 hex） */
  emblemColor: string;
  /** Lucide 图标名，空则渲染字母章 */
  emblemIcon: string;
  /** 逗号分隔输入，提交时切成 string[] */
  traits: string;
  habitatText: string;
  originText: string;
  status: string;
  kind: string;
  customFields: Record<string, CustomFieldValue>;
}

/** 新建：代表色默认取色板第一项（§4.4 领域强调色） */
export const newRaceFormState = (
  config: ModuleConfig,
  kind: string = RACE_KIND
): RaceFormState => ({
  name: '',
  tagline: '',
  emblemColor: emblemPaletteOf(config)[0],
  emblemIcon: '',
  traits: '',
  habitatText: '',
  originText: '',
  status: '',
  kind,
  customFields: {},
});

/** 编辑：从节点 meta 回填（字面值原样带入，不发明默认内容） */
export const raceFormStateOf = (node: RaceNode, config: ModuleConfig): RaceFormState => ({
  name: node.name,
  tagline: node.meta.tagline ?? '',
  emblemColor: node.meta.emblem?.color ?? node.color ?? emblemPaletteOf(config)[0],
  emblemIcon: node.meta.emblem?.icon ?? node.icon ?? '',
  traits: node.meta.traits.join('，'),
  habitatText: node.meta.habitatText ?? '',
  originText: node.meta.originText ?? '',
  status: node.meta.status ?? '',
  kind: node.kind,
  customFields: node.meta.customFields,
});

export const toRaceFormValues = (state: RaceFormState): RaceFormValues => ({
  name: state.name,
  kind: state.kind,
  tagline: state.tagline,
  traits: state.traits
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean),
  emblemColor: state.emblemColor,
  emblemIcon: state.emblemIcon,
  habitatText: state.habitatText,
  originText: state.originText,
  status: state.status,
});

/** 唯一硬校验：名称必填（§5.1.1） */
export const validateRaceForm = (state: RaceFormState): string | null =>
  state.name.trim() ? null : '名称必填';
