import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { characterApi } from '@/services/characterApi';
import { CharacterLevelColors, RelationTypeColors, CharacterLevelLabels, RelationTypeLabels } from '@/types/character';
import type { Character, CharacterRelationship, CharacterLevel, RelationType } from '@/types/character';
import { ZoomIn, ZoomOut, Maximize2, Users, GitBranch } from 'lucide-react';

interface CharacterCloudViewProps {
  projectId: string;
  onSelectCharacter: (characterId: string) => void;
  selectedCharacterId: string | null;
}

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface CloudNode {
  character: Character;
  position: NodePosition;
  radius: number;
}

interface CloudLink {
  source: string;
  target: string;
  relationship: CharacterRelationship;
}

/**
 * 人物关系云图组件
 *
 * 使用力导向图展示人物关系网络
 */
export const CharacterCloudView = ({
  projectId,
  onSelectCharacter,
  selectedCharacterId,
}: CharacterCloudViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const animationRef = useRef<number>();
  const nodesRef = useRef<Map<string, CloudNode>>(new Map());
  const linksRef = useRef<CloudLink[]>([]);

  // 获取人物列表（包含完整详情）
  const { data: characters = [], isLoading } = useQuery({
    queryKey: ['characters-with-details', projectId],
    queryFn: async () => {
      const list = await characterApi.getCharacters(projectId, {
        sort_by: 'order_index',
        sort_order: 'asc',
      });
      // 获取每个人物的完整详情（包含关系）
      const details = await Promise.all(
        list.map((item) => characterApi.getCharacter(projectId, item.id))
      );
      return details;
    },
    enabled: !!projectId,
  });

  // 计算节点半径（根据角色等级）
  const getNodeRadius = useCallback((level: CharacterLevel) => {
    switch (level) {
      case 'protagonist':
        return 40;
      case 'major_support':
        return 32;
      case 'support':
        return 24;
      case 'minor':
        return 18;
      default:
        return 20;
    }
  }, []);

  // 初始化节点位置
  useEffect(() => {
    if (characters.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // 初始化或更新节点
    const newNodes = new Map<string, CloudNode>();
    characters.forEach((character, index) => {
      const existingNode = nodesRef.current.get(character.id);
      if (existingNode) {
        newNodes.set(character.id, existingNode);
      } else {
        // 螺旋布局初始化
        const angle = (index / characters.length) * Math.PI * 2;
        const radius = 150 + Math.random() * 100;
        newNodes.set(character.id, {
          character,
          position: {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
          },
          radius: getNodeRadius(character.level),
        });
      }
    });

    // 移除不存在的节点
    nodesRef.current.forEach((_, id) => {
      if (!characters.find(c => c.id === id)) {
        nodesRef.current.delete(id);
      }
    });

    nodesRef.current = newNodes;

    // 构建关系链接
    const links: CloudLink[] = [];
    characters.forEach((character) => {
      character.relationships?.forEach((rel) => {
        if (rel.target_character_id) {
          links.push({
            source: character.id,
            target: rel.target_character_id,
            relationship: rel,
          });
        }
      });
    });
    linksRef.current = links;
  }, [characters, getNodeRadius]);

  // 力导向图模拟
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const links = linksRef.current;
    if (nodes.size === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // 力导向参数
    const repulsionForce = 8000;
    const springLength = 120;
    const springStrength = 0.05;
    const centerForce = 0.01;
    const damping = 0.9;

    // 计算斥力
    nodes.forEach((nodeA, idA) => {
      nodes.forEach((nodeB, idB) => {
        if (idA === idB) return;

        const dx = nodeA.position.x - nodeB.position.x;
        const dy = nodeA.position.y - nodeB.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = nodeA.radius + nodeB.radius + 20;

        if (dist < minDist * 3) {
          const force = repulsionForce / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          nodeA.position.vx += fx;
          nodeA.position.vy += fy;
        }
      });
    });

    // 计算弹簧力（关系牵引）
    links.forEach((link) => {
      const sourceNode = nodes.get(link.source);
      const targetNode = nodes.get(link.target);
      if (!sourceNode || !targetNode) return;

      const dx = targetNode.position.x - sourceNode.position.x;
      const dy = targetNode.position.y - sourceNode.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const force = (dist - springLength) * springStrength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      sourceNode.position.vx += fx;
      sourceNode.position.vy += fy;
      targetNode.position.vx -= fx;
      targetNode.position.vy -= fy;
    });

    // 中心引力
    nodes.forEach((node) => {
      const dx = centerX - node.position.x;
      const dy = centerY - node.position.y;
      node.position.vx += dx * centerForce;
      node.position.vy += dy * centerForce;
    });

    // 更新位置
    nodes.forEach((node) => {
      node.position.vx *= damping;
      node.position.vy *= damping;
      node.position.x += node.position.vx;
      node.position.y += node.position.vy;

      // 边界限制
      const margin = node.radius + 10;
      node.position.x = Math.max(margin, Math.min(width - margin, node.position.x));
      node.position.y = Math.max(margin, Math.min(height - margin, node.position.y));
    });
  }, []);

  // 绘制
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // 绘制关系线
    links.forEach((link) => {
      const sourceNode = nodes.get(link.source);
      const targetNode = nodes.get(link.target);
      if (!sourceNode || !targetNode) return;

      const isHighlighted =
        hoveredNode === link.source ||
        hoveredNode === link.target ||
        selectedCharacterId === link.source ||
        selectedCharacterId === link.target;

      ctx.beginPath();
      ctx.moveTo(sourceNode.position.x, sourceNode.position.y);
      ctx.lineTo(targetNode.position.x, targetNode.position.y);
      ctx.strokeStyle = RelationTypeColors[link.relationship.relation_type as RelationType] || '#999';
      ctx.lineWidth = isHighlighted ? 3 : 1.5;
      ctx.globalAlpha = isHighlighted ? 0.8 : 0.3;
      ctx.stroke();

      // 绘制关系标签
      if (isHighlighted) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;
        ctx.fillStyle = RelationTypeColors[link.relationship.relation_type as RelationType] || '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 1;
        ctx.fillText(
          RelationTypeLabels[link.relationship.relation_type as RelationType] || '',
          midX,
          midY - 8
        );
      }
    });

    ctx.globalAlpha = 1;

    // 绘制节点
    nodes.forEach((node, id) => {
      const isHovered = hoveredNode === id;
      const isSelected = selectedCharacterId === id;
      const levelColor = CharacterLevelColors[node.character.level];

      // 节点阴影
      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(node.position.x, node.position.y, node.radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = levelColor.bar + '40';
        ctx.fill();
      }

      // 节点圆形
      ctx.beginPath();
      ctx.arc(node.position.x, node.position.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = levelColor.bg;
      ctx.fill();
      ctx.strokeStyle = levelColor.bar;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // 头像或首字
      ctx.fillStyle = levelColor.bar;
      ctx.font = `${node.radius * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayChar = node.character.name.charAt(0);
      ctx.fillText(displayChar, node.position.x, node.position.y);

      // 姓名标签
      ctx.fillStyle = '#333';
      ctx.font = isHovered || isSelected ? 'bold 12px sans-serif' : '12px sans-serif';
      ctx.fillText(node.character.name, node.position.x, node.position.y + node.radius + 15);

      // 等级标签
      ctx.fillStyle = levelColor.bar;
      ctx.font = '10px sans-serif';
      ctx.fillText(
        CharacterLevelLabels[node.character.level],
        node.position.x,
        node.position.y + node.radius + 28
      );
    });

    ctx.restore();
  }, [hoveredNode, selectedCharacterId, scale, offset]);

  // 动画循环
  useEffect(() => {
    const animate = () => {
      simulate();
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulate, draw]);

  // 处理鼠标事件
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offset.x) / scale;
      const y = (e.clientY - rect.top - offset.y) / scale;

      if (isDragging) {
        setOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
        return;
      }

      // 检测悬停
      let hovered: string | null = null;
      nodesRef.current.forEach((node, id) => {
        const dx = x - node.position.x;
        const dy = y - node.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < node.radius) {
          hovered = id;
        }
      });
      setHoveredNode(hovered);
    },
    [isDragging, dragStart, scale, offset]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoveredNode) {
        onSelectCharacter(hoveredNode);
      } else {
        setIsDragging(true);
        setDragStart({
          x: e.clientX - offset.x,
          y: e.clientY - offset.y,
        });
      }
    },
    [hoveredNode, offset, onSelectCharacter]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.max(0.3, Math.min(3, prev * delta)));
    },
    []
  );

  // 缩放控制
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(3, prev * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.3, prev / 1.2));
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // 调整画布大小
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 统计信息
  const stats = useMemo(() => {
    const total = characters.length;
    const relationships = characters.reduce(
      (sum, c) => sum + (c.relationships?.length || 0),
      0
    );
    return { total, relationships };
  }, [characters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Users className="h-16 w-16 mb-4 opacity-30" />
        <p>暂无人物数据</p>
        <p className="text-sm mt-2 opacity-60">请先添加一些人物</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-gradient-to-br from-background to-accent/5">
      {/* 画布 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* 控制面板 */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg shadow-lg p-2 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-accent/20 rounded-md transition-colors"
            title="放大"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-accent/20 rounded-md transition-colors"
            title="缩小"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-accent/20 rounded-md transition-colors"
            title="重置视图"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg shadow-lg px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>{stats.total} 位人物</span>
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-accent" />
            <span>{stats.relationships} 条关系</span>
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg shadow-lg px-4 py-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">角色等级</p>
          {(['protagonist', 'major_support', 'support', 'minor'] as CharacterLevel[]).map(
            (level) => (
              <div key={level} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CharacterLevelColors[level].bar }}
                />
                <span className="text-xs">{CharacterLevelLabels[level]}</span>
              </div>
            )
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-border/40">
          <p className="text-xs font-medium text-muted-foreground mb-2">关系类型</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {(['family', 'love', 'friend', 'mentor', 'enemy', 'other'] as RelationType[]).map(
              (type) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-4 h-0.5"
                    style={{ backgroundColor: RelationTypeColors[type] }}
                  />
                  <span className="text-xs">{RelationTypeLabels[type]}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* 操作提示 */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm border border-border/60 rounded-lg shadow-lg px-4 py-2">
        <p className="text-xs text-muted-foreground">
          滚轮缩放 · 拖拽移动 · 点击选中
        </p>
      </div>
    </div>
  );
};

export default CharacterCloudView;
