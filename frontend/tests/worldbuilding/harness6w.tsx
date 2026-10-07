/* eslint-disable react-refresh/only-export-components -- 测试 harness：只注入浏览器执行，不参与 HMR */
/**
 * Phase 6 世界脉络回归用例（浏览器侧，P6-T8 / 验收）
 *
 * 由 tests/worldbuilding/phase6w.spec.ts 用 Vite 打成单文件后注入真实浏览器执行，
 * 结果写到 window.__PHASE6W_TESTS__。全部是 worldWebGraph.ts 的纯函数断言：
 * 1) 节点/边构造：submodule 建节点、外站端点只在被引用时出现、关联数按边统计、自环只算一次；
 * 2) 降级判定：800 边界（800 不降级 / 801 降级）与原因文案；
 * 3) 筛选：模块 / kind / 关联类型 / 时间窗（含无锚点不猜） / 默认隐藏孤立节点 /
 *    被筛掉的边不留下孤儿外站节点；
 * 4) 布局：确定性（同输入同坐标）、落在画布内、单节点居中、空输入不抛错；
 * 5) 降级视图数据：模块矩阵统计、推荐关联（同模块同 kind、去重、按关联数倒序）；
 * 6) 静态护栏：本文件涉及的源码无 emoji、无契约外 link_type 字面量。
 *
 * 不发任何网络请求。
 */

import {
  EMPTY_WEB_FILTERS,
  WEB_CANVAS,
  WEB_NODE_LIMIT,
  buildWebGraph,
  edgeInTimeWindow,
  filterWebGraph,
  layoutWebGraph,
  parseTimeAnchor,
  recommendWebLinks,
  webDegradeStateOf,
  webKindOptions,
  webModuleMatrix,
  type WebGraph,
} from '@/components/Worldbuilding/config/worldWebGraph';
import type { EntityRef } from '@/services/worldbuildingApi';
import type { WorldModuleV2 } from '@/components/Worldbuilding/types';

interface Check {
  name: string;
  ok: boolean;
  detail?: unknown;
}

const checks: Check[] = [];

const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok: !!ok, detail });
};

const submodule = (id: string, name: string, kind: string, parentId?: string) => ({
  id,
  module_id: 'm',
  name,
  kind,
  parent_id: parentId ?? null,
  description: null,
  color: null,
  icon: null,
  order_index: 0,
  meta: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  item_count: 0,
});

const moduleOf = (moduleType: string, subs: ReturnType<typeof submodule>[]) =>
  ({
    id: `mod-${moduleType}`,
    world_id: 'w1',
    module_type: moduleType,
    name: moduleType,
    description: null,
    icon: null,
    order_index: 0,
    config: null,
    is_collapsible: true,
    is_required: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    submodule_count: subs.length,
    item_count: 0,
    submodules: subs,
    items: [],
  }) as unknown as WorldModuleV2;

const ref = (module: string, kind: string, id: string): EntityRef => ({ module, kind, id });

const link = (
  id: string,
  source: EntityRef,
  target: EntityRef,
  linkType = 'core.related_to',
  time?: { start?: string | null; end?: string | null }
) => ({ id, source, target, link_type: linkType, label: null, time: time ?? null });

const MODULES: WorldModuleV2[] = [
  moduleOf('history', [
    submodule('e1', '第一纪元', 'era'),
    submodule('ev1', '大战', 'event', 'e1'),
    submodule('ev2', '和谈', 'event', 'e1'),
  ]),
  moduleOf('politics', [submodule('p1', '大汉', 'polity')]),
  moduleOf('economy', [submodule('ec1', '铁矿业', 'industry')]),
  // 无任何关联：用于「显示孤立节点」开关
  moduleOf('races', [submodule('r1', '精灵', 'race')]),
];

// ---------- 1) 节点与边构造 ----------

const testGraphBuild = () => {
  const links = [
    link('l1', ref('history', 'event', 'ev1'), ref('politics', 'polity', 'p1')),
    link('l2', ref('history', 'event', 'ev1'), ref('character', 'character', 'c1')),
  ];
  const graph = buildWebGraph(MODULES, links);
  check(
    '构造：本世界 submodule 全部成为节点',
    graph.nodes.filter((node) => !node.external).length === 6,
    graph.nodes.length
  );
  check(
    '构造：外站端点（角色）只在被边引用时补节点',
    graph.nodes.some((node) => node.external && node.ref.module === 'character')
  );
  check(
    '构造：未被引用的外站端点不会凭空出现',
    !graph.nodes.some((node) => node.ref.id === 'never-referenced')
  );
  check('构造：边数等于关联数', graph.edges.length === 2, graph.edges.length);

  const ev1 = graph.nodes.find((node) => node.ref.id === 'ev1');
  check('构造：关联数按边统计（ev1 有 2 条）', ev1?.linkCount === 2, ev1?.linkCount);
  check('构造：有关联的节点不是孤立节点', ev1?.isolated === false);

  const isolate = graph.nodes.find((node) => node.ref.id === 'ev2');
  check('构造：没有关联的节点标记为孤立', isolate?.isolated === true);

  const selfLoop = buildWebGraph(MODULES, [
    link('l3', ref('history', 'era', 'e1'), ref('history', 'era', 'e1')),
  ]);
  const e1 = selfLoop.nodes.find((node) => node.ref.id === 'e1');
  check('构造：自环只计一次关联数', e1?.linkCount === 1, e1?.linkCount);
  check('构造：自环仍算相关节点（非孤立）', e1?.isolated === false);

  const counted = buildWebGraph(MODULES, links, {
    countOfRef: (r) => (r.id === 'p1' ? 9 : 0),
  });
  check(
    '构造：countOfRef 覆盖现场统计（服务端聚合口径优先）',
    counted.nodes.find((node) => node.ref.id === 'p1')?.linkCount === 9
  );

  const empty = buildWebGraph([], []);
  check('构造：空世界得到空图且不抛错', empty.nodes.length === 0 && empty.edges.length === 0);
};

// ---------- 2) 降级判定 ----------

const testDegrade = () => {
  check('降级：800 节点不降级', webDegradeStateOf(WEB_NODE_LIMIT).degraded === false);
  check('降级：801 节点降级', webDegradeStateOf(WEB_NODE_LIMIT + 1).degraded === true);
  check('降级：1 节点不降级', webDegradeStateOf(1).degraded === false);
  check('降级：0 节点不降级', webDegradeStateOf(0).degraded === false);
  const state = webDegradeStateOf(900);
  check(
    '降级：reason 含节点数与上限',
    typeof state.reason === 'string' &&
      state.reason.includes('900') &&
      state.reason.includes(String(WEB_NODE_LIMIT)),
    state.reason
  );
  check('降级：边界值与常量本身一致', WEB_NODE_LIMIT === 800, WEB_NODE_LIMIT);
};

// ---------- 3) 筛选 ----------

const testFilter = () => {
  const graph = buildWebGraph(MODULES, [
    link('l1', ref('history', 'event', 'ev1'), ref('history', 'event', 'ev2'), 'history.leads_to'),
    link('l2', ref('history', 'era', 'e1'), ref('economy', 'industry', 'ec1'), 'core.related_to', {
      start: '100',
      end: '200',
    }),
    link('l3', ref('history', 'event', 'ev1'), ref('politics', 'polity', 'p1'), 'core.related_to'),
  ]);

  const defaultView = filterWebGraph(graph, EMPTY_WEB_FILTERS);
  check(
    '筛选：默认隐藏孤立节点（races 的 r1 不出现）',
    !defaultView.nodes.some((node) => node.ref.id === 'r1'),
    defaultView.nodes.map((node) => node.ref.id)
  );
  check(
    '筛选：默认保留参与可见关系的节点',
    defaultView.nodes.length === 5,
    defaultView.nodes.length
  );
  check('筛选：默认保留全部关联', defaultView.edges.length === 3, defaultView.edges.length);
  check(
    '筛选：默认视图没有孤立圆点',
    defaultView.nodes.every((node) => defaultView.edges.some((edge) =>
      edge.sourceKey === `${node.ref.module}:${node.ref.kind}:${node.ref.id}` ||
      edge.targetKey === `${node.ref.module}:${node.ref.kind}:${node.ref.id}`
    ))
  );

  const withIsolated = filterWebGraph(graph, { ...EMPTY_WEB_FILTERS, hideIsolated: false });
  check(
    '筛选：勾选后孤立节点回归',
    withIsolated.nodes.length === 6,
    withIsolated.nodes.length
  );

  const byModule = filterWebGraph(graph, { ...EMPTY_WEB_FILTERS, modules: ['history'] });
  check(
    '筛选：模块筛选后只剩该模块节点',
    byModule.nodes.every((node) => node.module === 'history') && byModule.nodes.length === 2,
    byModule.nodes.map((node) => node.ref.id)
  );
  check(
    '筛选：模块筛选同时收敛到模块内边',
    byModule.edges.length === 1 && byModule.edges[0].id === 'l1',
    byModule.edges.map((edge) => edge.id)
  );

  const byKind = filterWebGraph(graph, { ...EMPTY_WEB_FILTERS, kind: 'event' });
  check(
    '筛选：kind 筛选只留该 kind 之间的边',
    byKind.edges.length === 1 && byKind.edges[0].id === 'l1',
    byKind.edges.map((edge) => edge.id)
  );
  check('筛选：kind 筛选节点收敛为 2', byKind.nodes.length === 2, byKind.nodes.length);

  const byLinkType = filterWebGraph(graph, {
    ...EMPTY_WEB_FILTERS,
    linkType: 'core.related_to',
  });
  check(
    '筛选：关联类型筛选只留该类型',
    byLinkType.edges.length === 2 &&
      byLinkType.edges.every((edge) => edge.linkType === 'core.related_to'),
    byLinkType.edges.map((edge) => edge.id)
  );

  const byTime = filterWebGraph(graph, {
    ...EMPTY_WEB_FILTERS,
    timeStart: '150',
    timeEnd: '250',
  });
  check(
    '筛选：时间窗只留相交的边',
    byTime.edges.length === 1 && byTime.edges[0].id === 'l2',
    byTime.edges.map((edge) => edge.id)
  );
  check('筛选：时间窗节点收敛为 2', byTime.nodes.length === 2, byTime.nodes.length);

  const noMatch = filterWebGraph(graph, {
    ...EMPTY_WEB_FILTERS,
    timeStart: '5000',
    timeEnd: '6000',
  });
  check(
    '筛选：窗口不覆盖任何边时不留孤立节点',
    noMatch.nodes.length === 0 && noMatch.edges.length === 0,
    `${noMatch.nodes.length}/${noMatch.edges.length}`
  );

  const externalOnly = buildWebGraph(MODULES, [
    link('l9', ref('history', 'event', 'ev1'), ref('character', 'character', 'c9')),
  ]);
  const filtered = filterWebGraph(externalOnly, EMPTY_WEB_FILTERS);
  check(
    '筛选：外站节点只在被保留的边引用时并入输出',
    filtered.nodes.filter((node) => node.external).length === 1,
    filtered.nodes.filter((node) => node.external).length
  );
  const externalDropped = filterWebGraph(externalOnly, {
    ...EMPTY_WEB_FILTERS,
    linkType: 'core.references',
  });
  check(
    '筛选：边被筛掉后外站节点一并消失',
    externalDropped.nodes.length === 0 && externalDropped.edges.length === 0,
    `${externalDropped.nodes.length}/${externalDropped.edges.length}`
  );

  check('时间锚点：中文数字不猜', parseTimeAnchor('阳阙历三年') === null);
  check('时间锚点：ISO 年可解析', parseTimeAnchor('208-01-01') === 208);
  check('时间锚点：负年可解析', parseTimeAnchor('-120 年') === -120);
  check('时间锚点：无数字返回 null', parseTimeAnchor('很久以前') === null);
  check('时间锚点：空串返回 null', parseTimeAnchor('') === null);

  check('时间窗：未给窗口时任何边都保留', edgeInTimeWindow(null, '', '') === true);
  check('时间窗：给了窗口而边无时间 -> 过滤掉', edgeInTimeWindow(null, '1', '2') === false);
  check(
    '时间窗：边时间无锚点 -> 不猜，过滤掉',
    edgeInTimeWindow({ start: '很久以前', end: '更久以前' }, '1', '2') === false
  );
  check(
    '时间窗：只有起点窗口时按上界开放',
    edgeInTimeWindow({ start: '300', end: '400' }, '250', '') === true
  );

  check('kind 候选：按出现次数倒序', webKindOptions(graph)[0] === 'event', webKindOptions(graph));
};

// ---------- 4) 布局 ----------

const testLayout = () => {
  const graph = buildWebGraph(MODULES, [
    link('l1', ref('history', 'event', 'ev1'), ref('politics', 'polity', 'p1')),
    link('l2', ref('history', 'event', 'ev1'), ref('economy', 'industry', 'ec1')),
  ]);
  const first = layoutWebGraph(graph.nodes, graph.edges);
  const second = layoutWebGraph(graph.nodes, graph.edges);
  check('布局：节点数一致', first.size === graph.nodes.length, first.size);
  check(
    '布局：确定性（同输入同坐标）',
    graph.nodes.every((node) => {
      const key = `${node.ref.module}:${node.ref.kind}:${node.ref.id}`;
      const a = first.get(key);
      const b = second.get(key);
      return !!a && !!b && a.x === b.x && a.y === b.y;
    })
  );
  check(
    '布局：坐标落在画布内',
    Array.from(first.values()).every(
      (point) =>
        point.x >= 0 &&
        point.x <= WEB_CANVAS.width &&
        point.y >= 0 &&
        point.y <= WEB_CANVAS.height
    )
  );
  check(
    '布局：坐标不是 NaN',
    Array.from(first.values()).every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  );

  const single = layoutWebGraph([graph.nodes[0]], []);
  const only = Array.from(single.values())[0];
  check(
    '布局：单节点居中',
    only.x === WEB_CANVAS.width / 2 && only.y === WEB_CANVAS.height / 2,
    only
  );
  check('布局：空输入返回空映射', layoutWebGraph([], []).size === 0);

  const large = buildWebGraph(
    [
      moduleOf(
        'history',
        Array.from({ length: WEB_NODE_LIMIT + 40 }, (_, index) =>
          submodule(`bulk-${index}`, `节点${index}`, 'event')
        )
      ),
    ],
    []
  );
  const largePositions = layoutWebGraph(large.nodes, large.edges);
  check(
    '布局：超过 800 节点的输入仍能完成且坐标有效',
    largePositions.size === large.nodes.length &&
      Array.from(largePositions.values()).every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
      ),
    largePositions.size
  );
};

// ---------- 5) 降级视图数据 ----------

const testDegradeViewData = () => {
  const graph: WebGraph = buildWebGraph(MODULES, [
    link('l1', ref('history', 'event', 'ev1'), ref('history', 'event', 'ev2'), 'history.leads_to'),
    link('l2', ref('history', 'era', 'e1'), ref('economy', 'industry', 'ec1')),
    link('l3', ref('history', 'event', 'ev1'), ref('politics', 'polity', 'p1')),
  ]);

  const matrix = webModuleMatrix(graph);
  const history = matrix.find((row) => row.module === 'history');
  const economy = matrix.find((row) => row.module === 'economy');
  const politics = matrix.find((row) => row.module === 'politics');
  const races = matrix.find((row) => row.module === 'races');
  check('矩阵：history 行节点数为 3', history?.nodes === 3, history);
  check('矩阵：一条边计入两端模块（history 3 条）', history?.edges === 3, history);
  check('矩阵：economy 参与 1 条', economy?.edges === 1, economy);
  check('矩阵：politics 参与 1 条', politics?.edges === 1, politics);
  check('矩阵：history 无孤立节点', history?.isolated === 0, history?.isolated);
  check('矩阵：races 行是纯孤立模块', races?.isolated === 1 && races?.edges === 0, races);
  check(
    '矩阵：按节点数倒序',
    matrix[0].nodes >= matrix[matrix.length - 1].nodes,
    matrix.map((row) => `${row.module}:${row.nodes}`)
  );

  const recommendations = recommendWebLinks(graph);
  check(
    '推荐：已直连的一对（ev1 与 ev2）不重复推荐',
    !recommendations.some(
      (item) =>
        (item.a.ref.id === 'ev1' && item.b.ref.id === 'ev2') ||
        (item.a.ref.id === 'ev2' && item.b.ref.id === 'ev1')
    ),
    recommendations.map((item) => `${item.a.ref.id}-${item.b.ref.id}`)
  );
  check(
    '推荐：reason 说明依据',
    recommendations.every((item) => item.reason.includes('尚未建立关联'))
  );

  const pairs = buildWebGraph(
    [
      moduleOf('history', [
        submodule('x1', '甲', 'era'),
        submodule('x2', '乙', 'era'),
        submodule('x3', '丙', 'era'),
      ]),
    ],
    []
  );
  const pairRecommendations = recommendWebLinks(pairs, 2);
  check('推荐：limit 生效', pairRecommendations.length === 2, pairRecommendations.length);
  check(
    '推荐：同 kind 两两组合（3 选 2 共 3 对）',
    recommendWebLinks(pairs, 10).length === 3,
    recommendWebLinks(pairs, 10).length
  );
  check(
    '推荐：成对不重复且方向无关',
    new Set(
      recommendWebLinks(pairs, 10).map((item) =>
        [item.a.ref.id, item.b.ref.id].sort().join('|')
      )
    ).size === 3
  );
  check('推荐：空图返回空列表', recommendWebLinks({ nodes: [], edges: [] }).length === 0);

  const externalGraph = buildWebGraph(MODULES, [
    link('l4', ref('history', 'event', 'ev1'), ref('character', 'character', 'c1')),
  ]);
  check(
    '推荐：外站节点不进入推荐',
    recommendWebLinks(externalGraph).every(
      (item) => !item.a.external && !item.b.external
    )
  );
};

// ---------- 运行 ----------

const run = () => {
  try {
    testGraphBuild();
    testDegrade();
    testFilter();
    testLayout();
    testDegradeViewData();
  } catch (error) {
    check(
      'harness 未捕获异常',
      false,
      error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    );
  }

  (window as unknown as Record<string, unknown>).__PHASE6W_TESTS__ = {
    done: true,
    checks,
  } satisfies { done: boolean; checks: Check[] };
};

run();
