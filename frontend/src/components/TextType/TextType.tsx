import { useState, useEffect, useCallback } from 'react';

interface TextTypeProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
  cursorChar?: string;
  cursorClassName?: string;
  onComplete?: () => void;
  repeat?: boolean;
  repeatDelay?: number;
  deleteSpeed?: number;
  showOnComplete?: boolean;
}

export const TextType = ({
  text,
  className = '',
  speed = 50,
  delay = 0,
  cursor = true,
  cursorChar = '|',
  cursorClassName = 'animate-pulse',
  onComplete,
  repeat = false,
  repeatDelay = 2000,
  deleteSpeed = 30,
  showOnComplete = true,
}: TextTypeProps) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(cursor);

  const typeNextChar = useCallback(() => {
    if (isDeleting) {
      if (displayText.length > 0) {
        setDisplayText(prev => prev.slice(0, -1));
      } else {
        setIsDeleting(false);
        setCurrentIndex(0);
        setIsComplete(false);
      }
    } else {
      if (currentIndex < text.length) {
        setDisplayText(text.slice(0, currentIndex + 1));
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsComplete(true);
        if (onComplete) {
          onComplete();
        }
        if (!repeat && !cursor) {
          setShowCursor(false);
        }
      }
    }
  }, [currentIndex, displayText, isDeleting, text, onComplete, repeat, cursor]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (delay > 0 && currentIndex === 0 && !isDeleting) {
      timeout = setTimeout(() => {
        typeNextChar();
      }, delay);
    } else if (isComplete && repeat) {
      timeout = setTimeout(() => {
        setIsDeleting(true);
      }, repeatDelay);
    } else if (!isComplete || isDeleting) {
      const currentSpeed = isDeleting ? deleteSpeed : speed;
      // 添加随机性使打字更自然
      const randomDelay = currentSpeed + Math.random() * 20 - 10;
      timeout = setTimeout(() => {
        typeNextChar();
      }, Math.max(10, randomDelay));
    }

    return () => clearTimeout(timeout);
  }, [currentIndex, isComplete, isDeleting, delay, repeat, repeatDelay, speed, deleteSpeed, typeNextChar]);

  // 如果 showOnComplete 为 false，在完成后隐藏光标
  useEffect(() => {
    if (isComplete && !repeat && !showOnComplete) {
      const timeout = setTimeout(() => {
        setShowCursor(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isComplete, repeat, showOnComplete]);

  return (
    <span className={className}>
      {displayText}
      {showCursor && (
        <span className={`inline-block ${cursorClassName}`}>
          {cursorChar}
        </span>
      )}
    </span>
  );
};

// 多文本循环打字组件
interface TextTypeLoopProps extends Omit<TextTypeProps, 'text' | 'repeat'> {
  texts: string[];
  pauseDuration?: number;
}

export const TextTypeLoop = ({
  texts,
  className = '',
  speed = 50,
  delay = 0,
  cursor = true,
  cursorChar = '|',
  cursorClassName = 'animate-pulse',
  pauseDuration = 1500,
  deleteSpeed = 30,
}: TextTypeLoopProps) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [key, setKey] = useState(0);

  const handleComplete = () => {
    setTimeout(() => {
      setCurrentTextIndex((prev) => (prev + 1) % texts.length);
      setKey((prev) => prev + 1);
    }, pauseDuration);
  };

  return (
    <TextType
      key={key}
      text={texts[currentTextIndex]}
      className={className}
      speed={speed}
      delay={delay}
      cursor={cursor}
      cursorChar={cursorChar}
      cursorClassName={cursorClassName}
      onComplete={handleComplete}
      repeat={false}
      deleteSpeed={deleteSpeed}
    />
  );
};

export default TextType;
