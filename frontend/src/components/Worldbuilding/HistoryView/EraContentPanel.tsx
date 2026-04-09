import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { ERA_THEME_CONFIG, cardVariants, getEraThemeConfig, DEFAULT_ERA_THEME_CONFIGS } from './config';
import { EraContentPanelProps } from './types';
import { EraTimeline } from './EraTimeline';
import { EventCard } from './EventCard';

export const EraContentPanel = ({
  era,
  events,
  onEditEra,
  onDeleteEra,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onUpdateEventDescription,
  onUpdateEraDescription,
  onAddCharRefItem,
  projectId,
  moduleId,
  isStandalone = false,
  onNavigateToCharacter,
  eraThemeConfigs,
  eventTypeConfigs,
  levelConfigs,
}: EraContentPanelProps) => {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(era.description || '');

  const themeConfig = getEraThemeConfig(era.theme || 'ochre', eraThemeConfigs || DEFAULT_ERA_THEME_CONFIGS) || ERA_THEME_CONFIG[era.theme || 'ochre'];

  const handleStartEditDesc = () => {
    setEditDesc(era.description || '');
    setIsEditingDesc(true);
  };

  const handleSaveDesc = () => {
    onUpdateEraDescription(editDesc.trim());
    setIsEditingDesc(false);
  };

  const handleCancelEditDesc = () => {
    setEditDesc(era.description || '');
    setIsEditingDesc(false);
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={cardVariants}
      className={`relative bg-background bg-gradient-to-br ${themeConfig.gradient} rounded-2xl border ${themeConfig.border} overflow-hidden shadow-xl mx-auto`}
      style={{ minHeight: 'calc(100vh - 200px)' }}
    >
      <motion.div
        className="flex items-center gap-4 px-6 py-5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28, delay: 0.05 }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.div
            className={`w-3 h-3 rounded-full ${themeConfig.accent} shrink-0`}
            layoutId={`era-dot-${era.id}`}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
          <h3 className={`text-lg font-semibold ${themeConfig.text} truncate`}>
            {era.name}
          </h3>
          {era.startDate && (
            <motion.span
              className="text-xs text-muted-foreground/70 shrink-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
            >
              ({era.startDate}{era.endDate ? ` - ${era.endDate}` : ''})
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 group/header">
          {!isStandalone && (
            <>
              <motion.button
                whileHover={{ scale: 1.12, rotate: -3 }}
                whileTap={{ scale: 0.88 }}
                onClick={onEditEra}
                className="p-1.5 hover:bg-background/60 rounded-lg transition-colors opacity-0 group-hover/header:opacity-100"
                title="编辑时代"
              >
                <Edit2 className="h-4 w-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.12, rotate: 3 }}
                whileTap={{ scale: 0.88 }}
                onClick={onDeleteEra}
                className="p-1.5 hover:bg-destructive/15 rounded-lg text-destructive transition-colors opacity-0 group-hover/header:opacity-100"
                title="删除时代"
              >
                <Trash2 className="h-4 w-4" />
              </motion.button>
            </>
          )}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onAddEvent}
            className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-dashed border-border/50 hover:border-primary/40"
            title="添加事件"
          >
            <Plus className="h-3.5 w-3.5" />
            添加事件
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        className="px-6 pb-4 ml-14"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.08 }}
      >
        {era.description && !isEditingDesc ? (
          <motion.div
            className={`relative px-4 py-3.5 text-sm leading-relaxed ${isStandalone ? '' : 'cursor-text'}`}
            style={{
              background: `linear-gradient(145deg,
                rgba(248, 250, 252, 0.6) 0%,
                rgba(241, 245, 249, 0.4) 50%,
                rgba(248, 250, 252, 0.2) 100%
              )`,
              boxShadow: `
                inset 2px 2px 8px rgba(0, 0, 0, 0.04),
                inset -1px -1px 5px rgba(255, 255, 255, 0.6),
                inset 0 0 15px ${themeConfig.accentColor}24
              `,
              borderRadius: '10px',
              border: `1px solid ${themeConfig.accentColor}36`,
            }}
            whileHover={isStandalone ? undefined : { boxShadow: `inset 2px 2px 10px rgba(0, 0, 0, 0.06), inset -1px -1px 6px rgba(255, 255, 255, 0.7), inset 0 0 18px ${themeConfig.accentColor}0C` }}
            transition={{ duration: 0.2 }}
          >
            <p
              className={`relative z-10 text-foreground/85 ${isStandalone ? '' : 'cursor-text hover:text-foreground transition-colors group/desc'}`}
              onClick={isStandalone ? undefined : handleStartEditDesc}
              title={isStandalone ? undefined : "点击编辑描述"}
            >
              {era.description}
              {!isStandalone && (
                <span className="ml-2 opacity-0 group-hover/desc:opacity-40 text-xs transition-opacity">
                  (点击编辑)
                </span>
              )}
            </p>
          </motion.div>
        ) : isEditingDesc ? (
          <div
            className="relative px-4 py-3.5 text-sm leading-relaxed"
            style={{
              background: `linear-gradient(145deg,
                rgba(248, 250, 252, 0.6) 0%,
                rgba(241, 245, 249, 0.4) 50%,
                rgba(248, 250, 252, 0.2) 100%
              )`,
              boxShadow: `
                inset 2px 2px 8px rgba(0, 0, 0, 0.04),
                inset -1px -1px 5px rgba(255, 255, 255, 0.6),
                inset 0 0 15px ${themeConfig.accentColor}08
              `,
              borderRadius: '10px',
              border: `1px solid ${themeConfig.accentColor}14`,
            }}
          >
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-transparent resize-y outline-none text-foreground/85 leading-relaxed"
              placeholder="输入时代描述..."
              autoFocus
              rows={editDesc.split('\n').length || 1}
              style={{ fieldSizing: 'content', minHeight: 'auto' }}
            />
            <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/20">
              <button
                onClick={handleCancelEditDesc}
                className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveDesc}
                className="px-2.5 py-1 text-xs bg-primary/90 text-primary-foreground rounded-md hover:bg-primary transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        ) : !isStandalone ? (
          <motion.button
            whileHover={{ scale: 1.01, borderColor: 'rgba(var(--primary), 0.4)' }}
            whileTap={{ scale: 0.99 }}
            onClick={handleStartEditDesc}
            className="w-full px-5 py-3.5 text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border/50 rounded-xl hover:border-primary/40 hover:bg-primary/5"
          >
            + 添加时代描述
          </motion.button>
        ) : null}
      </motion.div>

      <motion.div
        className="flex px-6 pb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.12 }}
      >
        {!isStandalone && (
          <div className="shrink-0 mr-4 self-stretch">
            <EraTimeline events={events} eraId={era.id} theme={era.theme} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center border-2 border-dashed border-border/40 rounded-xl bg-background/60">
              暂无事件，点击上方 + 添加事件
            </div>
          ) : (
            <motion.div
              className="flex flex-wrap gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: {
                    staggerChildren: 0.055,
                    delayChildren: 0.15,
                  },
                },
              }}
            >
              <AnimatePresence mode="popLayout">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    projectId={projectId}
                    moduleId={moduleId}
                    onEdit={() => onEditEvent(event)}
                    onDelete={() => onDeleteEvent(event.id)}
                    onAddItem={() => onAddItem(event)}
                    onEditItem={(item) => onEditItem(event, item)}
                    onDeleteItem={(itemId) => onDeleteItem(itemId)}
                    onUpdateDescription={(desc) => onUpdateEventDescription(event, desc)}
                    onAddCharRefItem={(name, content) => onAddCharRefItem?.(event, name, content)}
                    onNavigateToCharacter={onNavigateToCharacter}
                    eventTypeConfigs={eventTypeConfigs}
                    levelConfigs={levelConfigs}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
