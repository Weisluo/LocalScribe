/**
 * 政治详情内的关联类型文案（Phase 4 P4-T8；politics_ui_design §4.8、契约 §4 注册表）
 *
 * 只做「后端未回填 label / reverse_label 时的兜底文案」：优先用 WorldLink 自带字段，
 * 这里不承担 kind 校验，也不引入注册表之外的语义。文案与契约 §4 表格逐条一致。
 */

import type { EntityRef, WorldLink } from '@/services/worldbuildingApi';
import { sameRef } from '@/components/Worldbuilding/types';
import { POLITICS_RELATION_LAYERS, linkTypeLabelFor } from '../types';

export { linkTypeLabelFor };

interface LinkLabelDef {
  label: string;
  reverse?: string;
}

export const POLITICS_LINK_LABELS: Record<string, LinkLabelDef> = {
  // 政治关系层 5 类：唯一真源是 types.ts 的 POLITICS_RELATION_LAYERS（与契约 §4.3 逐字一致），
  // 这里只做映射，避免同一模块内出现三份会各自漂移的标签表。
  ...Object.fromEntries(
    POLITICS_RELATION_LAYERS.map((layer) => [
      layer.id as string,
      { label: layer.label, reverse: layer.reverseLabel },
    ])
  ),
  // 政治（契约 §4.3，关系层之外的类型）
  'politics.controls_region': { label: '控制领土', reverse: '被控制' },
  'politics.capital_at': { label: '首府位于', reverse: '首府' },
  'politics.member_of': { label: '效忠 / 隶属', reverse: '拥有成员' },
  'politics.leads': { label: '领导', reverse: '被领导' },
  'politics.founded_by': { label: '建立者', reverse: '建立' },
  'politics.subordinate_to': { label: '下属于', reverse: '下辖' },
  'politics.signatory_of': { label: '签署 / 加入', reverse: '签署方' },
  'politics.includes_race': { label: '民族 / 种族构成', reverse: '构成' },
  'politics.succeeds': { label: '继承', reverse: '前任' },
  // 历史（§4.2）
  'history.occurs_at': { label: '发生于', reverse: '发生事件' },
  'history.involves': { label: '涉及', reverse: '被涉及' },
  'history.causes': { label: '导致', reverse: '由该事件导致' },
  'history.caused_by': { label: '起因于', reverse: '引发了' },
  'history.milestone_of': { label: '大事记', reverse: '收录大事记' },
  // 经济（§4.4）
  'economy.regulated_by': { label: '受管制', reverse: '管制' },
  'economy.taxed_by': { label: '征税', reverse: '征税于' },
  'economy.supplies': { label: '供给', reverse: '由该方供给' },
  'economy.owned_by': { label: '归属 / 控制', reverse: '拥有 / 控制' },
  'economy.currency_of': { label: '流通货币', reverse: '通行货币为' },
  // 体系与种族（§4.5 / §4.6）
  'systems.practiced_by': { label: '修习 / 推行', reverse: '修习者' },
  'races.notable_figure': { label: '代表人物', reverse: '代表种族' },
  // 角色（§4.7）
  'character.serves': { label: '效力于', reverse: '效力于' },
  'character.owns': { label: '拥有 / 掌控', reverse: '拥有 / 掌控' },
  'character.appears_in': { label: '登场 / 参与', reverse: '登场 / 参与' },
  'character.belongs_to_race': { label: '种族归属', reverse: '拥有族裔' },
  'character.practices_system': { label: '修习体系', reverse: '修习者' },
  'character.attained': { label: '达到境界', reverse: '境界达成者' },
  // 通用（§4.1）
  'core.references': { label: '引用', reverse: '被引用' },
  'core.related_to': { label: '相关', reverse: '相关' },
  'custom.link': { label: '自定义关联', reverse: '自定义关联' },
};

/** 某关联类型在给定视角下的文案：出链用 label，入链用 reverse（契约 §5.1） */
export const linkTypeLabel = (
  link: Pick<WorldLink, 'link_type' | 'label' | 'reverse_label' | 'source'>,
  perspective?: EntityRef | null,
  outgoing?: boolean
): string => {
  const definition = POLITICS_LINK_LABELS[link.link_type];
  const isOutgoing =
    outgoing ?? (perspective ? sameRef(link.source, perspective) : true);
  if (isOutgoing) return link.label || definition?.label || link.link_type;
  return link.reverse_label || definition?.reverse || definition?.label || link.link_type;
};

/** 政治模块内的关系边（关系段展示用；结构边与缔约边除外） */
export const RELATION_LINK_TYPES: string[] = [
  'politics.ally_of',
  'politics.at_war_with',
  'politics.vassal_of',
  'politics.trades_with',
  'politics.marriage_tie',
  'politics.succeeds',
];
