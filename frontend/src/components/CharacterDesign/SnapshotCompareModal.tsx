import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare, ArrowRight, ChevronDown, ChevronUp, Plus, Minus, Edit3 } from 'lucide-react';
import type { CharacterSnapshot } from '@/types/character';
import { SnapshotTypeLabels } from '@/types/character';

interface SnapshotCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: CharacterSnapshot[];
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray !== bIsArray) return false;

  if (aIsArray) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    return arrA.every((val, idx) => deepEqual(val, arrB[idx]));
  }

  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(objA[key], objB[key]));
}

function formatAttributeValue(value: unknown): string {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '（空）';
    return `${value.length} 项`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '（空）';
    return `${entries.length} 个属性`;
  }
  return String(value);
}

function formatDiffSummary(left: unknown, right: unknown): string | null {
  if (deepEqual(left, right)) return null;

  const leftArr = Array.isArray(left) ? left : null;
  const rightArr = Array.isArray(right) ? right : null;

  if (leftArr !== null || rightArr !== null) {
    const leftLen = leftArr?.length ?? 0;
    const rightLen = rightArr?.length ?? 0;
    if (leftLen !== rightLen) {
      return `${leftLen} 项 → ${rightLen} 项`;
    }
    // 计算具体变化项
    let changedCount = 0;
    const maxLen = Math.max(leftLen, rightLen);
    for (let i = 0; i < maxLen; i++) {
      if (!deepEqual(leftArr?.[i], rightArr?.[i])) {
        changedCount++;
      }
    }
    return changedCount > 0 ? `${leftLen} 项中 ${changedCount} 项变化` : '内容有变化';
  }

  const leftObj = typeof left === 'object' && left !== null && !Array.isArray(left) ? left as Record<string, unknown> : null;
  const rightObj = typeof right === 'object' && right !== null && !Array.isArray(right) ? right as Record<string, unknown> : null;

  if (leftObj !== null && rightObj !== null) {
    const leftKeys = Object.keys(leftObj);
    const rightKeys = Object.keys(rightObj);
    const allKeys = [...new Set([...leftKeys, ...rightKeys])];
    const changedKeys = allKeys.filter((k) => !deepEqual(leftObj[k], rightObj[k]));
    const addedKeys = rightKeys.filter((k) => !(k in leftObj));
    const removedKeys = leftKeys.filter((k) => !(k in rightObj));
    
    if (changedKeys.length > 0 || addedKeys.length > 0 || removedKeys.length > 0) {
      const parts: string[] = [];
      if (addedKeys.length > 0) parts.push(`+${addedKeys.length}`);
      if (removedKeys.length > 0) parts.push(`-${removedKeys.length}`);
      if (changedKeys.length > 0) parts.push(`~${changedKeys.length}`);
      return parts.join(' ');
    }
  }

  return '有变化';
}

// 获取数组差异详情
function getArrayDiffDetails(left: unknown[] | null, right: unknown[] | null): { added: number; removed: number; modified: number } {
  const leftArr = left || [];
  const rightArr = right || [];
  
  // 对于对象数组，使用 id 或 name 作为唯一标识
  const getId = (item: unknown): string => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return String(obj.id || obj.name || obj.title || obj.content || JSON.stringify(item));
    }
    return String(item);
  };
  
  const leftMap = new Map(leftArr.map(item => [getId(item), item]));
  const rightMap = new Map(rightArr.map(item => [getId(item), item]));
  
  let added = 0;
  let removed = 0;
  let modified = 0;
  
  for (const [id, rightItem] of rightMap) {
    if (!leftMap.has(id)) {
      added++;
    } else if (!deepEqual(leftMap.get(id), rightItem)) {
      modified++;
    }
  }
  
  for (const [id] of leftMap) {
    if (!rightMap.has(id)) {
      removed++;
    }
  }
  
  return { added, removed, modified };
}

const COMPLEX_KEYS = new Set(['aliases', 'cards', 'relationships', 'artifacts']);

const KEY_LABELS: Record<string, string> = {
  name: '姓名',
  gender: '性别',
  birth_date: '出生日期',
  birthplace: '出生地',
  race: '种族',
  faction: '阵营',
  level: '等级',
  quote: '判词',
  avatar: '头像',
  full_image: '全身像',
  first_appearance_volume: '首次出场卷',
  first_appearance_act: '首次出场幕',
  first_appearance_chapter: '首次出场章',
  last_appearance_volume: '最后出场卷',
  last_appearance_act: '最后出场幕',
  last_appearance_chapter: '最后出场章',
  aliases: '别名',
  cards: '详细信息',
  relationships: '人物关系',
  artifacts: '器物',
};

// 复杂属性详细对比组件
interface ComplexDiffDetailProps {
  left: unknown;
  right: unknown;
}

const ComplexDiffDetail = ({ left, right }: ComplexDiffDetailProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const leftArr = Array.isArray(left) ? left : [];
  const rightArr = Array.isArray(right) ? right : [];
  const diff = getArrayDiffDetails(leftArr, rightArr);
  const hasChanges = diff.added > 0 || diff.removed > 0 || diff.modified > 0;
  
  if (!hasChanges) return null;
  
  // 获取具体变化项
  const getItemId = (item: unknown): string => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return String(obj.id || obj.name || obj.title || obj.content || obj.alias_type || JSON.stringify(item));
    }
    return String(item);
  };
  
  const leftMap = new Map(leftArr.map(item => [getItemId(item), item]));
  const rightMap = new Map(rightArr.map(item => [getItemId(item), item]));
  
  const allIds = [...new Set([...leftMap.keys(), ...rightMap.keys()])];
  const changes = allIds.map(id => {
    const leftItem = leftMap.get(id);
    const rightItem = rightMap.get(id);
    if (!leftItem) return { id, type: 'added' as const, item: rightItem };
    if (!rightItem) return { id, type: 'removed' as const, item: leftItem };
    if (!deepEqual(leftItem, rightItem)) return { id, type: 'modified' as const, left: leftItem, right: rightItem };
    return null;
  }).filter(Boolean);
  
  const getItemDisplayName = (item: unknown): string => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return String(obj.name || obj.title || obj.content || obj.alias_type || '未命名');
    }
    return String(item);
  };
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        查看详细变化 ({changes.length} 项)
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 text-xs">
              {changes.slice(0, 10).map((change, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1">
                  {change!.type === 'added' && (
                    <>
                      <Plus className="h-3 w-3 text-green-500" />
                      <span className="text-green-600">{getItemDisplayName(change!.item)}</span>
                    </>
                  )}
                  {change!.type === 'removed' && (
                    <>
                      <Minus className="h-3 w-3 text-red-500" />
                      <span className="text-red-600 line-through">{getItemDisplayName(change!.item)}</span>
                    </>
                  )}
                  {change!.type === 'modified' && (
                    <>
                      <Edit3 className="h-3 w-3 text-amber-500" />
                      <span className="text-amber-600">{getItemDisplayName(change!.left)}</span>
                      <span className="text-muted-foreground">(已修改)</span>
                    </>
                  )}
                </div>
              ))}
              {changes.length > 10 && (
                <p className="text-muted-foreground py-1">还有 {changes.length - 10} 项变化...</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const SnapshotCompareModal = ({
  isOpen,
  onClose,
  snapshots,
}: SnapshotCompareModalProps) => {
  const [leftSnapshotId, setLeftSnapshotId] = useState<string>('');
  const [rightSnapshotId, setRightSnapshotId] = useState<string>('');

  const leftSnapshot = snapshots.find((s) => s.id === leftSnapshotId);
  const rightSnapshot = snapshots.find((s) => s.id === rightSnapshotId);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAttributeDiff = () => {
    if (!leftSnapshot || !rightSnapshot) return [];

    const leftAttrs = leftSnapshot.attributes || {};
    const rightAttrs = rightSnapshot.attributes || {};
    const allKeys = new Set([...Object.keys(leftAttrs), ...Object.keys(rightAttrs)]);

    return Array.from(allKeys).map((key) => {
      const left = leftAttrs[key];
      const right = rightAttrs[key];
      const changed = !deepEqual(left, right);
      const isComplex = COMPLEX_KEYS.has(key);
      const diffSummary = changed && isComplex ? formatDiffSummary(left, right) : null;

      return { key, left, right, changed, isComplex, diffSummary };
    });
  };

  const attributeDiff = getAttributeDiff();

  return (
    <AnimatePresence>
      {isOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-card rounded-xl shadow-2xl border border-border/60"
      >
        {/* 头部 */}
        <div className="p-6 border-b border-border/60 flex items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <GitCompare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">快照对比</h2>
              <p className="text-sm text-muted-foreground">对比人物在不同阶段的状态变化</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 选择器 */}
          <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-2">选择快照 A</label>
              <select
                value={leftSnapshotId}
                onChange={(e) => setLeftSnapshotId(e.target.value)}
                data-testid="left-snapshot-select"
                className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">请选择...</option>
                {snapshots.filter(s => s.id !== rightSnapshotId).map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id} data-testid={`left-option-${snapshot.id}`}>
                    {snapshot.title} ({formatDate(snapshot.created_at)})
                  </option>
                ))}
              </select>
            </div>
            <div className="pb-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">选择快照 B</label>
              <select
                value={rightSnapshotId}
                onChange={(e) => setRightSnapshotId(e.target.value)}
                data-testid="right-snapshot-select"
                className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              >
                <option value="">请选择...</option>
                {snapshots.filter(s => s.id !== leftSnapshotId).map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id} data-testid={`right-option-${snapshot.id}`}>
                    {snapshot.title} ({formatDate(snapshot.created_at)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 对比结果 */}
          {leftSnapshot && rightSnapshot && (
            <div className="space-y-6">
              {/* 基本信息对比 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <h4 className="font-medium mb-2">{leftSnapshot.title}</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      类型: {SnapshotTypeLabels[leftSnapshot.snapshot_type as keyof typeof SnapshotTypeLabels] || '自定义'}
                    </p>
                    <p className="text-muted-foreground">时间: {formatDate(leftSnapshot.created_at)}</p>
                    {leftSnapshot.description && (
                      <p className="text-muted-foreground mt-2">{leftSnapshot.description}</p>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg">
                  <h4 className="font-medium mb-2">{rightSnapshot.title}</h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      类型: {SnapshotTypeLabels[rightSnapshot.snapshot_type as keyof typeof SnapshotTypeLabels] || '自定义'}
                    </p>
                    <p className="text-muted-foreground">时间: {formatDate(rightSnapshot.created_at)}</p>
                    {rightSnapshot.description && (
                      <p className="text-muted-foreground mt-2">{rightSnapshot.description}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 属性对比 */}
              {attributeDiff.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">属性变化</h3>
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">属性</th>
                          <th className="px-4 py-2 text-left font-medium">快照 A</th>
                          <th className="px-4 py-2 text-left font-medium">快照 B</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {attributeDiff.map(({ key, left, right, changed, isComplex, diffSummary }) => (
                          <tr key={key} className={changed ? 'bg-primary/5' : ''}>
                            <td className="px-4 py-2 font-medium align-top">
                              {KEY_LABELS[key] || key}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground align-top">
                              {isComplex
                                ? formatAttributeValue(left)
                                : (left !== undefined ? String(left) : '-')}
                            </td>
                            <td
                              className={`px-4 py-2 align-top ${
                                changed ? 'text-primary font-medium' : 'text-muted-foreground'
                              }`}
                            >
                              {isComplex ? (
                                <div>
                                  <span>{diffSummary || formatAttributeValue(right)}</span>
                                  {changed && (
                                    <ComplexDiffDetail left={left} right={right} />
                                  )}
                                </div>
                              ) : (
                                (right !== undefined ? String(right) : '-')
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {attributeDiff.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  两个快照都没有属性数据
                </div>
              )}
            </div>
          )}

          {(!leftSnapshot || !rightSnapshot) && (
            <div className="text-center py-12 text-muted-foreground">
              请选择两个快照进行对比
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t border-border/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
};
