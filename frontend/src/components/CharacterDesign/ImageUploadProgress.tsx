import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';

interface ImageUploadProgressProps {
  type: 'avatar' | 'full_image';
  currentImage?: string;
  onUpload: (type: 'avatar' | 'full_image', file: File) => Promise<void>;
  label: string;
  size?: { width: number; height: number };
  levelColor?: string;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export const ImageUploadProgress = ({
  type,
  currentImage,
  onUpload,
  label,
  size = { width: 120, height: 120 },
  levelColor,
}: ImageUploadProgressProps) => {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(currentImage || '');
  const [error, setError] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      setStatus('error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      setStatus('error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setStatus('uploading');
    setProgress(0);
    setError('');

    abortControllerRef.current = new AbortController();

    try {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      await onUpload(type, file);

      clearInterval(progressInterval);
      setProgress(100);
      setStatus('success');

      setTimeout(() => {
        setStatus('idle');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : '上传失败');
      setPreview(currentImage || '');
    }
  }, [type, onUpload, currentImage]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setStatus('idle');
    setProgress(0);
    setPreview(currentImage || '');
    setError('');
  }, [currentImage]);

  const handleClick = useCallback(() => {
    if (status === 'idle' || status === 'success') {
      fileInputRef.current?.click();
    }
  }, [status]);

  return (
    <div className="flex-shrink-0">
      <label className="block text-sm font-medium text-muted-foreground mb-2">
        {label}
      </label>
      <div
        className={`relative overflow-hidden rounded-xl border-2 flex items-center justify-center transition-all ${
          status === 'uploading' 
            ? 'border-primary/50' 
            : status === 'error'
            ? 'border-red-300'
            : 'border-dashed hover:border-primary/50'
        }`}
        style={{
          width: size.width,
          height: size.height,
          borderColor: preview && levelColor ? levelColor : undefined,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {preview ? (
          <img
            src={preview}
            alt={label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            <Upload className="h-6 w-6" />
            <span className="text-xs">点击上传</span>
          </div>
        )}

        <AnimatePresence>
          {status === 'uploading' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2"
            >
              <div className="w-3/4 h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
              <span className="text-xs text-white">{progress}%</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="flex items-center gap-1 px-3 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded transition-colors"
              >
                <X className="h-3 w-3" />
                取消
              </button>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 bg-green-500/80 flex items-center justify-center"
            >
              <CheckCircle className="h-12 w-12 text-white" />
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-500/80 flex flex-col items-center justify-center gap-2 p-2"
            >
              <AlertCircle className="h-8 w-8 text-white" />
              <span className="text-xs text-white text-center">{error}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus('idle');
                  setError('');
                }}
                className="text-xs text-white underline"
              >
                重试
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {(status === 'idle' || status === 'success') && (
          <div
            onClick={handleClick}
            className="absolute inset-0 cursor-pointer"
          />
        )}
      </div>
    </div>
  );
};

export default ImageUploadProgress;
