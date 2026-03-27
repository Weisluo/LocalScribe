import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Crown, Star, User, Circle } from 'lucide-react';
import type { CharacterLevel, CharacterGender } from '@/types/character';
import { CharacterLevelLabels, CharacterLevelColors, CharacterGenderLabels } from '@/types/character';

interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    level: CharacterLevel;
    gender: CharacterGender;
  }) => void;
  isLoading?: boolean;
}

const levelOptions: CharacterLevel[] = ['protagonist', 'major_support', 'support', 'minor'];
const genderOptions: CharacterGender[] = ['male', 'female', 'other', 'unknown'];

const levelIcons: Record<CharacterLevel, React.ReactNode> = {
  protagonist: <Crown className="h-5 w-5" />,
  major_support: <Star className="h-5 w-5" />,
  support: <User className="h-5 w-5" />,
  minor: <Circle className="h-5 w-5" />,
};

export const CreateCharacterModal = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: CreateCharacterModalProps) => {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<CharacterLevel>('support');
  const [gender, setGender] = useState<CharacterGender>('unknown');

  const handleConfirm = useCallback(() => {
    if (!name.trim()) {
      return;
    }
    onConfirm({ name: name.trim(), level, gender });
  }, [name, level, gender, onConfirm]);

  const handleClose = useCallback(() => {
    setName('');
    setLevel('support');
    setGender('unknown');
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-xl shadow-2xl border border-border/60 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
              <h2 className="text-lg font-serif font-semibold text-foreground">
                创建新人物
              </h2>
              <button
                onClick={handleClose}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  人物姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入人物姓名"
                  className="w-full px-4 py-2.5 bg-background border border-border/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  角色等级
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {levelOptions.map((lvl) => {
                    const colors = CharacterLevelColors[lvl];
                    const isSelected = level === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setLevel(lvl)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm rounded-lg border transition-all ${
                          isSelected
                            ? 'ring-2 ring-primary/30'
                            : 'hover:bg-accent/10'
                        }`}
                        style={{
                          backgroundColor: isSelected ? colors.bg : undefined,
                          borderColor: colors.border,
                          color: isSelected ? colors.bar : undefined,
                        }}
                      >
                        {levelIcons[lvl]}
                        {CharacterLevelLabels[lvl]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  性别
                </label>
                <div className="flex flex-wrap gap-2">
                  {genderOptions.map((gnd) => {
                    const isSelected = gender === gnd;
                    return (
                      <button
                        key={gnd}
                        onClick={() => setGender(gnd)}
                        className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border/60 hover:bg-accent/10'
                        }`}
                      >
                        {CharacterGenderLabels[gnd]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60 bg-accent/5">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/20 rounded-lg transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!name.trim() || isLoading}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading && (
                  <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                )}
                创建人物
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateCharacterModal;
