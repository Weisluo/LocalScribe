/**
 * 前端 feature flag（Phase 5 P5-T15）
 *
 * 双开关、默认关闭：
 * - 构建期：env 变量 `VITE_WORLD_ECONOMY_VIEW_V2`（Vite 只在构建时注入，运行时改不动）；
 * - 运行期：localStorage 键 `localscribe.featureFlag.worldEconomyViewV2`（可随时开关，便于回滚）。
 *
 * 语义：任一开关为真即视为开启。SSR / 无 window / 隐私模式 / about:blank 下全部安全回退为关闭，
 * 不抛错、不写入。旧经济视图（flag 关闭）必须与之前完全一致，因此这里不做任何副作用。
 */

export const FEATURE_FLAG_KEYS = {
  /** Vite 注入的 env 键名 */
  env: 'VITE_WORLD_ECONOMY_VIEW_V2',
  /** 运行时覆盖用的 localStorage 键名 */
  localStorage: 'localscribe.featureFlag.worldEconomyViewV2',
} as const;

/** 真值字面量：只有这些字符串算「开」（避免 '0' / 'false' 被误当成开） */
const TRUTHY = new Set(['1', 'true', 'on', 'yes', 'enabled']);

const parseFlagValue = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return TRUTHY.has(value.trim().toLowerCase());
  return false;
};

/** Vite 的 import.meta.env；无 import.meta.env（SSR / 非 Vite 环境）时返回 undefined */
const readEnv = (key: string): unknown => {
  try {
    const meta = import.meta as unknown as { env?: Record<string, unknown> };
    return meta.env?.[key];
  } catch {
    return undefined;
  }
};

const readStorage = (key: string): unknown => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    return window.localStorage.getItem(key);
  } catch {
    // 隐私模式 / 存储被禁用：静默回退
    return undefined;
  }
};

const writeStorage = (key: string, value: string | null): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 同上：写入失败不影响视图可用性
  }
};

/**
 * localStorage 不可用（opaque origin / 隐私模式 / SSR）时的内存兜底：
 * 当前会话仍可开关，刷新后回到 env 口径；不写任何东西，也不抛错。
 */
let memoryOverride: boolean | null = null;

/** 经济视图 V2 是否开启（env 或 localStorage / 内存兜底任一为真；默认关闭） */
export const isEconomyViewV2Enabled = (): boolean => {
  if (parseFlagValue(readEnv(FEATURE_FLAG_KEYS.env))) return true;
  const stored = readStorage(FEATURE_FLAG_KEYS.localStorage);
  if (typeof stored === 'string') return parseFlagValue(stored);
  return memoryOverride === true;
};

/** 运行时开关：写 localStorage（'1' / '0'），写不进去时留在内存里；不触碰 env 与任何世界数据 */
export const setEconomyViewV2Enabled = (on: boolean): void => {
  memoryOverride = on;
  writeStorage(FEATURE_FLAG_KEYS.localStorage, on ? '1' : '0');
};

/** 清掉运行时覆盖，回到 env 口径（回滚与测试用） */
export const clearEconomyViewV2Override = (): void => {
  memoryOverride = null;
  writeStorage(FEATURE_FLAG_KEYS.localStorage, null);
};
