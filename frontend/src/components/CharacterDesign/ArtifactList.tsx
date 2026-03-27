import { useState, useCallback } from 'react';
import { Plus, Trash2, Sword, Shield, Gem, Scroll, Box, Upload, X } from 'lucide-react';
import type { CharacterArtifact, ArtifactType } from '@/types/character';
import { ArtifactTypeLabels } from '@/types/character';

interface ArtifactListProps {
  artifacts: CharacterArtifact[];
  onAdd?: (data: { name: string; description?: string; artifact_type?: ArtifactType; image?: string }) => void;
  onUpdate?: (artifactId: string, data: { image?: string }) => void;
  onDelete?: (artifactId: string) => void;
  isEditable?: boolean;
}

const artifactTypeOptions: ArtifactType[] = ['weapon', 'armor', 'accessory', 'treasure', 'other'];

const artifactTypeIcons: Record<ArtifactType, React.ReactNode> = {
  weapon: <Sword className="h-4 w-4" />,
  armor: <Shield className="h-4 w-4" />,
  accessory: <Gem className="h-4 w-4" />,
  treasure: <Scroll className="h-4 w-4" />,
  other: <Box className="h-4 w-4" />,
};

/**
 * 器物列表组件
 *
 * 显示和管理人物的器物/物品，支持图片上传
 */
export const ArtifactList = ({
  artifacts,
  onAdd,
  onUpdate,
  onDelete,
  isEditable = true,
}: ArtifactListProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<ArtifactType>('other');
  const [newImage, setNewImage] = useState<string>('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // 开始添加
  const handleStartAdd = useCallback(() => {
    setNewName('');
    setNewDescription('');
    setNewType('other');
    setNewImage('');
    setIsAdding(true);
  }, []);

  // 保存添加
  const handleSaveAdd = useCallback(() => {
    if (newName.trim()) {
      onAdd?.({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        artifact_type: newType,
        image: newImage || undefined,
      });
      setIsAdding(false);
    }
  }, [newName, newDescription, newType, newImage, onAdd]);

  // 取消添加
  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
  }, []);

  // 删除器物
  const handleDelete = useCallback(
    (artifactId: string) => {
      if (confirm('确定要删除这个器物吗？')) {
        onDelete?.(artifactId);
      }
    },
    [onDelete]
  );

  // 处理图片上传
  const handleImageUpload = useCallback(
    async (artifactId: string, file: File) => {
      if (!file) return;

      setUploadingId(artifactId);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }

        const data = await response.json();
        onUpdate?.(artifactId, { image: data.url });
      } catch (error) {
        console.error('图片上传失败:', error);
        alert('图片上传失败，请重试');
      } finally {
        setUploadingId(null);
      }
    },
    [onUpdate]
  );

  // 处理新器物图片上传
  const handleNewImageUpload = useCallback(
    async (file: File) => {
      if (!file) return;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }

        const data = await response.json();
        setNewImage(data.url);
      } catch (error) {
        console.error('图片上传失败:', error);
        alert('图片上传失败，请重试');
      }
    },
    []
  );

  // 删除图片
  const handleRemoveImage = useCallback((artifactId: string) => {
    onUpdate?.(artifactId, { image: '' });
  }, [onUpdate]);

  // 删除新器物的图片
  const handleRemoveNewImage = useCallback(() => {
    setNewImage('');
  }, []);

  return (
    <div className="space-y-3">
      {/* 器物列表 - 横向滚动 */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="flex-shrink-0 w-36 p-3 bg-accent/5 rounded-lg group hover:bg-accent/10 transition-colors"
          >
            {/* 器物图标和类型 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {artifactTypeIcons[artifact.artifact_type || 'other']}
                <span className="text-xs">{ArtifactTypeLabels[artifact.artifact_type || 'other']}</span>
              </div>
              {isEditable && (
                <button
                  onClick={() => handleDelete(artifact.id)}
                  className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* 器物名称 */}
            <h5 className="text-sm font-medium text-foreground truncate">{artifact.name}</h5>

            {/* 器物描述 */}
            {artifact.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{artifact.description}</p>
            )}

            {/* 器物图片 */}
            <div className="mt-2">
              {artifact.image ? (
                <div className="relative rounded-md overflow-hidden group/image">
                  <img
                    src={artifact.image}
                    alt={artifact.name}
                    className="w-full h-20 object-cover"
                  />
                  {isEditable && (
                    <button
                      onClick={() => handleRemoveImage(artifact.id)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ) : isEditable ? (
                <label className="flex flex-col items-center justify-center w-full h-20 rounded-md border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/50 hover:bg-accent/5 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(artifact.id, file);
                    }}
                    disabled={uploadingId === artifact.id}
                  />
                  {uploadingId === artifact.id ? (
                    <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-muted-foreground mb-1" />
                      <span className="text-xs text-muted-foreground">上传图片</span>
                    </>
                  )}
                </label>
              ) : null}
            </div>
          </div>
        ))}

        {artifacts.length === 0 && !isAdding && (
          <div className="flex-shrink-0 w-full text-center py-4 text-sm text-muted-foreground/60">
            暂无器物
          </div>
        )}
      </div>

      {/* 添加新器物 */}
      {isEditable && (
        <div>
          {isAdding ? (
            <div className="p-3 bg-accent/5 rounded-lg space-y-3">
              {/* 器物类型选择 */}
              <div className="flex items-center gap-2 flex-wrap">
                {artifactTypeOptions.map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewType(type)}
                    className={`
                      flex items-center gap-1 px-2.5 py-1 text-xs rounded-full transition-colors
                      ${newType === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    {artifactTypeIcons[type]}
                    {ArtifactTypeLabels[type]}
                  </button>
                ))}
              </div>

              {/* 器物名称 */}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="器物名称"
                className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
                autoFocus
              />

              {/* 器物描述 */}
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="器物描述（可选）"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />

              {/* 器物图片上传 */}
              <div>
                {newImage ? (
                  <div className="relative rounded-md overflow-hidden group/image">
                    <img
                      src={newImage}
                      alt="器物预览"
                      className="w-full h-24 object-cover"
                    />
                    <button
                      onClick={handleRemoveNewImage}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 rounded-md border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/50 hover:bg-accent/5 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleNewImageUpload(file);
                      }}
                    />
                    <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">上传器物图片</span>
                  </label>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelAdd}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveAdd}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartAdd}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors w-full justify-center"
            >
              <Plus className="h-4 w-4" />
              添加器物
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtifactList;
