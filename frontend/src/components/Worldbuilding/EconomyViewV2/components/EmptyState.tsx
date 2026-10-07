/**
 * 经济模块空状态 EmptyState（Phase 5 P5-T14；economy_ui_design §9.1 / §9.2 / §9.3、§8.4）
 *
 * 九种场景一一对应 §9.2 表格；规则：
 * - **每个空状态只有一个主按钮，最多一个备选**（§9.3），不并列四五个入口；
 * - 文案**不出现下一档术语**：速写档（全空 / 有实体无往来 / 关键词未展开 / 有产业无物产 / 有集市无通货）
 *   不出现「节点」「关联」「流量」，用「往来」「脉络」这类日常词；
 * - **不自动创建任何实体或关联**：所有按钮只调用外壳传来的回调，本组件不发请求、不写数据；
 * - 主按钮存在但没有回调时置灰（不渲染成假按钮，也不偷偷创建数据）；备选没有回调时不渲染。
 */

import {
  Activity,
  BookOpen,
  CalendarClock,
  Coins,
  FilterX,
  Network,
  PackagePlus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { EconomyEmptyStateProps } from '../types';

interface SceneAction {
  label: string;
  onClick?: () => void;
}

interface SceneDef {
  icon: LucideIcon;
  title: string;
  description: string;
  primary: SceneAction;
  secondary?: SceneAction;
}

const sceneOf = (props: EconomyEmptyStateProps): SceneDef => {
  const { term } = props;
  const sketchField = term('sketchField', '物产');
  const industryWord = term('industryWord', '营生');
  const currencyWord = term('currencyWord', '通货');
  const metricWord = term('metricWord', '指标');
  const cycleWord = term('cycleWord', '周期');
  const windowWord = term('windowWord', '窗口');

  switch (props.scene) {
    case 'entities-without-links':
      return {
        icon: Network,
        title: '这些实体还没往来',
        description: '两点之间连一句往来，脉络就成立了；也可以先给实体补字段，连结留到以后。',
        primary: { label: '拖一条线', onClick: props.onDrawCanvas },
        secondary: { label: '先给实体补字段', onClick: props.onCreateEntity },
      };
    case 'chips-unexpanded':
      return {
        icon: Sparkles,
        title: '关键词可以长成线路图',
        description: '已记下的关键词可以一键展开成实体与往来，id 不变，随时也能收回。',
        primary: { label: term('promoChip', '展开为脉络'), onClick: props.onExpandChips },
        secondary: { label: term('keepSketch', '就这样，先记着'), onClick: props.onWriteSketch },
      };
    case 'industry-without-resource':
      return {
        icon: PackagePlus,
        title: `${industryWord}还不知道靠什么`,
        description: `补一个${sketchField}，上下游就看出来了；不确定的话先放着也算完整设定。`,
        primary: { label: `补一个${sketchField}`, onClick: props.onCreateEntity },
      };
    case 'market-without-currency':
      return {
        icon: Coins,
        title: '东西在换，还没写用什么换',
        description: `加一种${currencyWord}，交换才有计价基准；数值可以后填，不填也不影响成立。`,
        primary: { label: `加一种${currencyWord}`, onClick: props.onCreateEntity },
      };
    case 'sandbox-without-metrics':
      return {
        icon: Activity,
        title: '还没有数字记录',
        description: `${metricWord}默认为空，缺采样不补 0；也可以先用线宽表达强度，不写数值。`,
        primary: { label: `添加${metricWord}骨架`, onClick: props.onAddMetric },
      };
    case 'sandbox-without-cycle':
      return {
        icon: RefreshCw,
        title: '还没有时间分段',
        description: `加一个${cycleWord}，时间刷才有周期带与阶段标签；只先看单年快照也可以。`,
        primary: { label: `添加一个${cycleWord}`, onClick: props.onAddCycle },
      };
    case 'empty-window':
      return {
        icon: CalendarClock,
        title: '此段没有记录',
        description: '这个窗口里没有可锚定的时代、周期或采样，所以不显示 0。放宽窗口，或回到全时段看看。',
        primary: { label: `放宽${windowWord}`, onClick: props.onWidenWindow },
        // 冻结 props 里只有 onWidenWindow 一个窗口回调：两个按钮语义不同（放宽 / 复位），
        // 具体行为由外壳决定，这里不自行造第二个入口。
        secondary: { label: '回到全时段', onClick: props.onWidenWindow },
      };
    case 'no-filter-result':
      return {
        icon: FilterX,
        title: '当前筛选没有匹配',
        description: '放宽阶段 / 类型 / 搜索范围，或者清除筛选回到全部结果。',
        primary: { label: '清除筛选', onClick: props.onClearFilter },
      };
    case 'all-empty':
    default:
      return {
        icon: BookOpen,
        title: '这里还是空白',
        description:
          '先记三件事就够了：用什么换东西 · 出产什么 · 谁靠什么营生。不预置任何经济类型、货币、资源或指标。',
        primary: { label: '写一张经济速写', onClick: props.onWriteSketch },
        secondary: { label: '直接画脉络', onClick: props.onDrawCanvas },
      };
  }
};

export const EconomyEmptyState = (props: EconomyEmptyStateProps) => {
  const scene = sceneOf(props);
  const Icon = scene.icon;
  const primaryDisabled = !scene.primary.onClick;

  return (
    <div
      data-testid={`economy-empty-${props.scene}`}
      className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
    >
      <Icon className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{scene.title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{scene.description}</p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-testid="economy-empty-primary"
          disabled={primaryDisabled}
          aria-disabled={primaryDisabled || undefined}
          onClick={scene.primary.onClick}
          className={
            primaryDisabled
              ? 'flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground opacity-60'
              : 'flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90 motion-reduce:transition-none'
          }
        >
          {scene.primary.label}
        </button>
        {scene.secondary?.onClick && (
          <button
            type="button"
            data-testid="economy-empty-secondary"
            onClick={scene.secondary.onClick}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/30 motion-reduce:transition-none"
          >
            {scene.secondary.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EconomyEmptyState;
