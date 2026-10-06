/**
 * 复杂度上下文（Phase 2 P2-T5）
 *
 * 世界级复杂度在 WorldbuildingView 注入，模块与共用件通过 useComplexity() 读取，
 * 避免逐层透传 complexity prop。P2 只做披露控制，不写回 World.settings（P6 负责持久化）。
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  COMPLEXITY_CAPABILITIES,
  normalizeComplexity,
  type ComplexityCapabilities,
  type ComplexityLevel,
} from './types';

export interface ComplexityContextValue {
  level: ComplexityLevel;
  setLevel: (level: ComplexityLevel) => void;
  capabilities: ComplexityCapabilities;
  can: (feature: keyof ComplexityCapabilities) => boolean;
}

const ComplexityContext = createContext<ComplexityContextValue | null>(null);

export interface ComplexityProviderProps {
  children: ReactNode;
  /** 世界 settings.complexity 的默认档 */
  defaultLevel?: string | null;
  /** 受控模式：传入后由外部持有状态 */
  value?: ComplexityLevel;
  onChange?: (level: ComplexityLevel) => void;
}

export const ComplexityProvider = ({
  children,
  defaultLevel,
  value,
  onChange,
}: ComplexityProviderProps) => {
  const [internal, setInternal] = useState<ComplexityLevel>(() =>
    normalizeComplexity(defaultLevel)
  );

  const level = value ?? internal;

  const contextValue = useMemo<ComplexityContextValue>(() => {
    const capabilities = COMPLEXITY_CAPABILITIES[level];
    return {
      level,
      setLevel: (next: ComplexityLevel) => {
        setInternal(next);
        onChange?.(next);
      },
      capabilities,
      can: (feature) => capabilities[feature],
    };
  }, [level, onChange]);

  return (
    <ComplexityContext.Provider value={contextValue}>
      {children}
    </ComplexityContext.Provider>
  );
};

/**
 * 无 Provider 时退化为 sketch 档，保证共用件可独立渲染（P3-P5 复用与单测友好）。
 */
export const useComplexity = (): ComplexityContextValue => {
  const context = useContext(ComplexityContext);
  if (context) return context;
  return {
    level: 'sketch',
    setLevel: () => undefined,
    capabilities: COMPLEXITY_CAPABILITIES.sketch,
    can: (feature) => COMPLEXITY_CAPABILITIES.sketch[feature],
  };
};
