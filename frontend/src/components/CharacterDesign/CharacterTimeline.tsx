import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Camera,
  BookOpen,
  Layers,
  FileText,
  Tag,
  User,
  ScrollText,
  Users,
  Gem,
} from 'lucide-react';
import type { CharacterSnapshot } from '@/types/character';
import { SnapshotTypeLabels } from '@/types/character';
import type { CapturedCharacterData } from '@/utils/snapshot';

export interface CharacterTimelineProps {
  snapshots: CharacterSnapshot[];
  onEdit: (snapshot: CharacterSnapshot) => void;
  onDelete: (snapshotId: string) => void;
  isLoading?: boolean;
}

/**
 * 人物成长时间线组件
 *
 * 展示人物在故事不同阶段的状态快照
 */
export const CharacterTimeline = ({
  snapshots,
  onEdit,
  onDelete,
  isLoading,
}: CharacterTimelineProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Camera className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">暂无成长记录</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          点击右上角"添加快照"按钮，记录人物在故事中的重要时刻
        </p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getSnapshotTypeIcon = (type: string) => {
    switch (type) {
      case 'volume':
        return <BookOpen className="h-4 w-4" />;
      case 'act':
        return <Layers className="h-4 w-4" />;
      case 'chapter':
        return <FileText className="h-4 w-4" />;
      default:
        return <Tag className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 解析快照中的人物数据
  const parseCharacterData = (attributes: Record<string, unknown>): CapturedCharacterData => {
    return attributes as unknown as CapturedCharacterData;
  };

  return (
    <div className="space-y-4">
      {snapshots.map((snapshot, index) => {
        const data = parseCharacterData(snapshot.attributes || {});
        const hasBasicInfo = data.name || data.gender || data.race || data.faction;
        const hasAliases = data.aliases && data.aliases.length > 0;
        const hasCards = data.cards && data.cards.length > 0;
        const hasRelationships = data.relationships && data.relationships.length > 0;
        const hasArtifacts = data.artifacts && data.artifacts.length > 0;

        return (
          <motion.div
            key={snapshot.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative"
          >
            {/* 时间线连接线 */}
            {index < snapshots.length - 1 && (
              <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-border" />
            )}

            <div className="flex gap-4">
              {/* 时间线节点 */}
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {getSnapshotTypeIcon(snapshot.snapshot_type)}
                </div>
              </div>

              {/* 快照卡片 */}
              <div className="flex-1 bg-card border border-border/60 rounded-lg overflow-hidden">
                {/* 卡片头部 */}
                <div
                  className="p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => toggleExpand(snapshot.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                          {SnapshotTypeLabels[snapshot.snapshot_type as keyof typeof SnapshotTypeLabels] || '自定义'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(snapshot.created_at)}
                        </span>
                      </div>
                      <h4 className="font-medium text-foreground">{snapshot.title}</h4>
                      {snapshot.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {snapshot.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(snapshot);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(snapshot.id);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="p-1.5 text-muted-foreground">
                        {expandedId === snapshot.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 展开的详情区域 */}
                <AnimatePresence>
                  {expandedId === snapshot.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border/60 pt-4 space-y-4">
                        {/* 位置信息 */}
                        {(snapshot.volume_id || snapshot.act_id || snapshot.chapter_id) && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              故事位置
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {snapshot.volume_id && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  卷ID: {snapshot.volume_id.slice(0, 8)}...
                                </span>
                              )}
                              {snapshot.act_id && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  幕ID: {snapshot.act_id.slice(0, 8)}...
                                </span>
                              )}
                              {snapshot.chapter_id && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  章ID: {snapshot.chapter_id.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 基础信息 */}
                        {hasBasicInfo && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              基础信息
                            </h5>
                            <div className="grid grid-cols-2 gap-2">
                              {data.name && (
                                <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">姓名</span>
                                  <span className="text-sm font-medium">{data.name}</span>
                                </div>
                              )}
                              {data.gender && (
                                <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">性别</span>
                                  <span className="text-sm font-medium">
                                    {data.gender === 'male' ? '男' : data.gender === 'female' ? '女' : '未知'}
                                  </span>
                                </div>
                              )}
                              {data.race && (
                                <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">种族</span>
                                  <span className="text-sm font-medium">{data.race}</span>
                                </div>
                              )}
                              {data.faction && (
                                <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">阵营</span>
                                  <span className="text-sm font-medium">{data.faction}</span>
                                </div>
                              )}
                              {data.birth_date && (
                                <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">出生日期</span>
                                  <span className="text-sm font-medium">{data.birth_date}</span>
                                </div>
                              )}
                              {data.birthplace && (
                                <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm text-muted-foreground">出生地</span>
                                  <span className="text-sm font-medium">{data.birthplace}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 别名 */}
                        {hasAliases && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              别名 ({data.aliases?.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {data.aliases?.map((alias, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-secondary rounded">
                                  {alias.alias_type === 'zi' && '字'}
                                  {alias.alias_type === 'hao' && '号'}
                                  {alias.alias_type === 'nickname' && '外号'}
                                  {alias.alias_type === 'title' && '称号'}
                                  {alias.alias_type === 'other' && ''}
                                  {alias.content}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 判词 */}
                        {data.quote && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              判词
                            </h5>
                            <p className="text-sm italic text-muted-foreground px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                              "{data.quote}"
                            </p>
                          </div>
                        )}

                        {/* 卡片 */}
                        {hasCards && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <ScrollText className="h-3 w-3" />
                              详细信息 ({data.cards?.length})
                            </h5>
                            <div className="space-y-2">
                              {data.cards?.slice(0, 3).map((card, idx) => (
                                <div key={idx} className="px-3 py-2 bg-secondary/50 rounded-lg">
                                  <span className="text-sm font-medium">{card.title}</span>
                                  {card.content && card.content.length > 0 && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {card.content.length} 项内容
                                    </span>
                                  )}
                                </div>
                              ))}
                              {data.cards?.length && data.cards.length > 3 && (
                                <p className="text-xs text-muted-foreground text-center">
                                  还有 {data.cards.length - 3} 个卡片...
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 关系 */}
                        {hasRelationships && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              人物关系 ({data.relationships?.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {data.relationships?.slice(0, 5).map((rel, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-secondary rounded">
                                  {rel.target_name || rel.target_character_id?.slice(0, 8)}
                                  {rel.relation_type && ` · ${rel.relation_type}`}
                                </span>
                              ))}
                              {data.relationships?.length && data.relationships.length > 5 && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  +{data.relationships.length - 5}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 器物 */}
                        {hasArtifacts && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Gem className="h-3 w-3" />
                              器物 ({data.artifacts?.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                              {data.artifacts?.slice(0, 5).map((artifact, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 bg-secondary rounded">
                                  {artifact.name}
                                  {artifact.rarity && ` · ${artifact.rarity}`}
                                </span>
                              ))}
                              {data.artifacts?.length && data.artifacts.length > 5 && (
                                <span className="text-xs px-2 py-1 bg-secondary rounded">
                                  +{data.artifacts.length - 5}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {!hasBasicInfo && !hasAliases && !hasCards && !hasRelationships && !hasArtifacts && !snapshot.volume_id && !snapshot.act_id && !snapshot.chapter_id && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            暂无详细信息
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
