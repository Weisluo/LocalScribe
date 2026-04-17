import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, BookOpen, Layers, FileText, Tag, ChevronDown, RefreshCw } from 'lucide-react';
import type { CharacterSnapshot, CharacterSnapshotType, Character } from '@/types/character';
import { SnapshotTypeLabels } from '@/types/character';
import type { TreeNodeType, VolumeNode, ActNode } from '@/types';
import { captureCharacterData } from '@/utils/snapshot';

interface SnapshotEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    snapshot_type: CharacterSnapshotType;
    volume_id?: string;
    act_id?: string;
    chapter_id?: string;
    title: string;
    description?: string;
    attributes: Record<string, unknown>;
  }) => void;
  character: Character;
  snapshot?: CharacterSnapshot;
  projectId: string;
  tree?: TreeNodeType[];
  isLoading?: boolean;
}

const SNAPSHOT_TYPES: { type: CharacterSnapshotType; icon: React.ReactNode; label: string }[] = [
  { type: 'volume', icon: <BookOpen className="h-4 w-4" />, label: SnapshotTypeLabels.volume },
  { type: 'act', icon: <Layers className="h-4 w-4" />, label: SnapshotTypeLabels.act },
  { type: 'chapter', icon: <FileText className="h-4 w-4" />, label: SnapshotTypeLabels.chapter },
  { type: 'custom', icon: <Tag className="h-4 w-4" />, label: SnapshotTypeLabels.custom },
];

/**
 * 快照编辑器弹窗组件
 *
 * 用于创建和编辑人物快照
 * 快照会自动捕获当前人物的所有信息
 */
export const SnapshotEditorModal = ({
  isOpen,
  onClose,
  onSave,
  character,
  snapshot,
  tree,
  isLoading,
}: SnapshotEditorModalProps) => {
  const [snapshotType, setSnapshotType] = useState<CharacterSnapshotType>('custom');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [volumeId, setVolumeId] = useState('');
  const [actId, setActId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [refreshAttributes, setRefreshAttributes] = useState(false);

  useEffect(() => {
    if (snapshot) {
      setSnapshotType(snapshot.snapshot_type);
      setTitle(snapshot.title);
      setDescription(snapshot.description || '');
      setVolumeId(snapshot.volume_id || '');
      setActId(snapshot.act_id || '');
      setChapterId(snapshot.chapter_id || '');
      setRefreshAttributes(false);
    } else {
      setSnapshotType('custom');
      setTitle('');
      setDescription('');
      setVolumeId('');
      setActId('');
      setChapterId('');
      setRefreshAttributes(false);
    }
  }, [snapshot, isOpen]);

  // 从 tree 中提取卷、幕、章节数据
  const volumes = useMemo(() => {
    if (!tree) return [];
    return tree.filter((node): node is VolumeNode => node.type === 'volume');
  }, [tree]);

  const acts = useMemo(() => {
    if (!volumeId || !tree) return [];
    const volume = tree.find((node): node is VolumeNode => 
      node.type === 'volume' && node.id === volumeId
    );
    return volume?.children || [];
  }, [volumeId, tree]);

  const chapters = useMemo(() => {
    if (!actId || !acts) return [];
    const act = acts.find((node): node is ActNode => node.id === actId);
    return act?.children || [];
  }, [actId, acts]);

  // 当选择卷改变时，重置幕和章节
  const handleVolumeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVolumeId = e.target.value;
    setVolumeId(newVolumeId);
    setActId('');
    setChapterId('');
  };

  // 当选择幕改变时，重置章节
  const handleActChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newActId = e.target.value;
    setActId(newActId);
    setChapterId('');
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const attributes = snapshot
      ? (refreshAttributes ? captureCharacterData(character) : snapshot.attributes)
      : captureCharacterData(character);

    onSave({
        snapshot_type: snapshotType,
        title: title.trim(),
        description: description.trim() || undefined,
        volume_id: volumeId || undefined,
        act_id: actId || undefined,
        chapter_id: chapterId || undefined,
        attributes,
      });
  };

  const isFormValid = title.trim().length > 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card rounded-xl shadow-2xl border border-border/60"
        >
        {/* 头部 */}
        <div className="p-6 border-b border-border/60 flex items-center justify-between sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {snapshot ? '编辑快照' : '创建快照'}
              </h2>
              <p className="text-sm text-muted-foreground">{character.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 快照类型 */}
          <div>
            <label className="block text-sm font-medium mb-3">快照类型</label>
            <div className="grid grid-cols-4 gap-2">
              {SNAPSHOT_TYPES.map(({ type, icon, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSnapshotType(type)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    snapshotType === type
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/60 hover:border-primary/50 hover:bg-accent/5'
                  }`}
                >
                  {icon}
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 标题 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              快照标题 <span className="text-destructive">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：初入江湖、黑化后的状态"
              className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              required
            />
          </div>

          {/* 描述 */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              描述
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述这个快照记录的人物状态..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            />
          </div>

          {/* 故事位置（级联选择） */}
          <div>
            <label className="block text-sm font-medium mb-3">故事位置（可选）</label>
            <div className="grid grid-cols-3 gap-3">
              {/* 卷选择 */}
              <div className="relative">
                <label className="block text-xs text-muted-foreground mb-1">卷</label>
                <div className="relative">
                  <select
                    value={volumeId}
                    onChange={handleVolumeChange}
                    className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm appearance-none cursor-pointer"
                  >
                    <option value="">选择卷</option>
                    {volumes.map((volume) => (
                      <option key={volume.id} value={volume.id}>
                        {volume.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 幕选择 */}
              <div className="relative">
                <label className="block text-xs text-muted-foreground mb-1">幕</label>
                <div className="relative">
                  <select
                    value={actId}
                    onChange={handleActChange}
                    disabled={!volumeId || acts.length === 0}
                    className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择幕</option>
                    {acts.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* 章节选择 */}
              <div className="relative">
                <label className="block text-xs text-muted-foreground mb-1">章节</label>
                <div className="relative">
                  <select
                    value={chapterId}
                    onChange={(e) => setChapterId(e.target.value)}
                    disabled={!actId || chapters.length === 0}
                    className="w-full px-3 py-2 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">选择章节</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
            {volumes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                暂无可用的大纲数据，请先创建卷、幕和章节
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">将记录的人物信息</label>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              {snapshot && (
                <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-border/40 mb-2">
                  <input
                    type="checkbox"
                    checked={refreshAttributes}
                    onChange={(e) => setRefreshAttributes(e.target.checked)}
                    className="rounded border-border/60 text-primary focus:ring-primary/30"
                  />
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">刷新为当前人物数据</span>
                </label>
              )}
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-2 py-1 bg-background rounded text-muted-foreground">
                  基础信息 ({Object.keys(
                    snapshot && !refreshAttributes
                      ? snapshot.attributes
                      : captureCharacterData(character)
                  ).filter(k =>
                    !['aliases', 'cards', 'relationships', 'artifacts'].includes(k)
                  ).length} 项)
                </span>
                <span className="px-2 py-1 bg-background rounded text-muted-foreground">
                  别名 ({(snapshot && !refreshAttributes
                    ? (snapshot.attributes.aliases as unknown[])?.length
                    : character.aliases?.length) || 0} 个)
                </span>
                <span className="px-2 py-1 bg-background rounded text-muted-foreground">
                  卡片 ({(snapshot && !refreshAttributes
                    ? (snapshot.attributes.cards as unknown[])?.length
                    : character.cards?.length) || 0} 个)
                </span>
                <span className="px-2 py-1 bg-background rounded text-muted-foreground">
                  关系 ({(snapshot && !refreshAttributes
                    ? (snapshot.attributes.relationships as unknown[])?.length
                    : character.relationships?.length) || 0} 个)
                </span>
                <span className="px-2 py-1 bg-background rounded text-muted-foreground">
                  器物 ({(snapshot && !refreshAttributes
                    ? (snapshot.attributes.artifacts as unknown[])?.length
                    : character.artifacts?.length) || 0} 个)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {snapshot && !refreshAttributes
                  ? '当前保留快照创建时的历史数据。勾选"刷新为当前人物数据"可更新为最新状态。'
                  : '快照将自动捕获当前人物的所有信息，包括基础属性、别名、详细信息卡片、人物关系和器物。'}
              </p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 rounded-lg transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              )}
              {snapshot ? '保存修改' : '创建快照'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
    </AnimatePresence>
  );
};
