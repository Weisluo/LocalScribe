/**
 * InlineReference（Phase 2 P2-T8，接口冻结见 phase2_interface_freeze.md §3.5）
 *
 * 契约 §5.3：token 只存 id，显示名实时解析；目标不存在渲染失效 chip（警示色 + 提示），
 * 只渲染不阻塞保存。行内引用不占关联类型、不计计数、不进世界脉络。
 * 编辑态输入 @ 打开 EntityPicker；readOnly 时整段渲染为文本 + chip。
 */

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { EntityRef } from '@/services/worldbuildingApi';
import { EntityBadge } from '@/components/common/EntityBadge';
import { EntityPicker, type EntityPickerSelection } from '@/components/common/EntityPicker';
import { useEntityRefs } from '@/components/Worldbuilding/hooks';
import { buildInlineToken, parseInlineTokens } from '@/components/Worldbuilding/types';
import type { InlineReferenceProps } from './types';

/**
 * 行内引用不落关联类型（契约 §5.3），但 EntityPicker 冻结签名要求 source。
 * 以哨兵 ref 传入并走 simpleMode：既不做类型过滤，也不会排除任何真实实体。
 */
const INLINE_SOURCE: EntityRef = {
  module: 'special',
  kind: 'custom',
  id: '__inline_reference__',
};

const FIELD_CLASS =
  'w-full bg-background border border-border/50 px-2.5 py-1.5 rounded-md text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-[border-color,box-shadow]';

export const InlineReference = ({
  value,
  onChange,
  worldId,
  projectId,
  readOnly = false,
  multiline = true,
  onNavigate,
  placeholder,
  className = '',
}: InlineReferenceProps) => {
  const entityRefs = useEntityRefs(worldId, projectId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const tokens = useMemo(() => parseInlineTokens(value), [value]);

  const renderOnly = readOnly || !onChange;

  /** 把焦点交还输入框，并把 caret 放到 token 之后（等 React 提交新值后再设置） */
  const focusCaret = (position: number) => {
    window.setTimeout(() => {
      const element = multiline ? textareaRef.current : inputRef.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(position, position);
    }, 0);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    if (event.key !== '@' || renderOnly) return;
    setInsertAt(event.currentTarget.selectionStart ?? value.length);
    setPickerOpen(true);
  };

  const handleConfirm = (selection: EntityPickerSelection) => {
    setPickerOpen(false);
    const ref = selection.targets[0];
    if (!ref || !onChange) return;
    const at = insertAt ?? value.length;
    const before = value.slice(0, at);
    const after = value.slice(at);
    // 触发选择器的 @ 本身不保留
    const rest = after.startsWith('@') ? after.slice(1) : after;
    const token = buildInlineToken(ref, entityRefs.resolveName(ref));
    onChange(`${before}${token}${rest}`);
    setInsertAt(null);
    focusCaret(before.length + token.length);
  };

  /** 取消 / Esc / 点遮罩关闭：清掉触发用的孤立 @，避免正文残留 */
  const handlePickerClose = () => {
    setPickerOpen(false);
    const at = insertAt;
    setInsertAt(null);
    if (at === null || !onChange) return;
    const after = value.slice(at);
    if (after.startsWith('@')) {
      onChange(`${value.slice(0, at)}${after.slice(1)}`);
    }
  };

  if (renderOnly) {
    const nodes: ReactNode[] = [];
    let cursor = 0;
    tokens.forEach((token, index) => {
      if (token.start > cursor) {
        nodes.push(
          <span key={`text-${index}`} className="whitespace-pre-wrap">
            {value.slice(cursor, token.start)}
          </span>
        );
      }
      nodes.push(
        <EntityBadge
          key={`ref-${index}`}
          entityRef={token.ref}
          name={entityRefs.resolveName(token.ref)}
          invalid={entityRefs.isInvalid(token.ref)}
          onClick={onNavigate}
          className="mx-0.5"
        />
      );
      cursor = token.end;
    });
    if (cursor < value.length) {
      nodes.push(
        <span key="text-tail" className="whitespace-pre-wrap">
          {value.slice(cursor)}
        </span>
      );
    }

    return (
      <div className={`text-xs leading-relaxed text-foreground ${className}`}>
        {nodes.length > 0 ? (
          nodes
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          className={FIELD_CLASS}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={FIELD_CLASS}
        />
      )}
      <EntityPicker
        open={pickerOpen}
        worldId={worldId ?? ''}
        source={INLINE_SOURCE}
        simpleMode
        onClose={handlePickerClose}
        onConfirm={handleConfirm}
      />
    </div>
  );
};
