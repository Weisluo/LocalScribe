import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modals/Modal';
import { AddRelationModalProps } from '../types';

export const AddRelationModal = ({
  isOpen,
  onClose,
  onSubmit,
  entities,
  relationTypes,
  currentEntityId,
  isLoading,
  error,
}: AddRelationModalProps) => {
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('');
  const [volume, setVolume] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  const availableEntities = entities.filter((e) => e.id !== currentEntityId);

  const currentRelationTypeConfig = relationTypes.find((r) => r.id === relationType);

  const handleSubmit = () => {
    if (targetId && relationType) {
      onSubmit({
        targetId,
        relationType,
        description: description.trim(),
        volume: volume.trim() || undefined,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
      });
    }
  };

  const handleClose = () => {
    setTargetId('');
    setRelationType('');
    setVolume('');
    setStartDate('');
    setEndDate('');
    setDescription('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="添加经济关系">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">目标实体 *</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
          >
            <option value="">请选择目标实体</option>
            {availableEntities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.icon} {entity.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">关系类型 *</label>
          <div className="grid grid-cols-2 gap-2">
            {relationTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setRelationType(type.id)}
                className={`px-3 py-2 text-sm rounded-lg border transition-all text-left ${
                  relationType === type.id
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border/30 hover:border-border/50 bg-muted/20 text-muted-foreground'
                }`}
              >
                <span className="mr-1">{type.icon}</span>
                {type.name}
              </button>
            ))}
          </div>
          {currentRelationTypeConfig?.description && (
            <p className="text-xs text-muted-foreground mt-2">{currentRelationTypeConfig.description}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">贸易量</label>
          <input
            type="text"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder="如：1000金币/年"
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">开始时间</label>
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="如：阳阙历元年"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">结束时间</label>
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="如：阳阙历1633年"
              className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入关系描述"
            rows={3}
            className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow] resize-none"
          />
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/10 rounded-md"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!targetId || !relationType || isLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-[background-color,opacity] disabled:opacity-50 flex items-center gap-2 shadow-sm active:scale-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                创建中...
              </>
            ) : (
              '创建'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
