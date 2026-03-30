import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { worldbuildingApi } from '@/services/worldbuildingApi';
import { Sparkles, Plus } from 'lucide-react';
import {
  EconomicEntity,
  EconomicRelation,
  EconomicItem,
  EconomyModuleConfig,
  EconomyViewProps,
  EntityTypeConfig,
  RelationTypeConfig,
  LevelConfig,
} from './EconomyView/types';
import {
  DEFAULT_ENTITY_TYPE_CONFIGS,
  DEFAULT_RELATION_TYPE_CONFIGS,
  DEFAULT_LEVEL_CONFIGS,
  parseEntityType,
  parseEntityLevel,
  formatEntityType,
  animationConfig,
  getEntityTypeConfig,
  getLevelConfig,
} from './EconomyView/config';
import { EntityTypeTabs } from './EconomyView/components/EntityTypeTabs';
import { FilterPanel } from './EconomyView/components/FilterPanel';
import { EconomicCard } from './EconomyView/components/EconomicCard';
import { AddEntityModal } from './EconomyView/modals/AddEntityModal';
import { EditEntityModal } from './EconomyView/modals/EditEntityModal';
import { AddRelationModal } from './EconomyView/modals/AddRelationModal';
import { EditRelationModal } from './EconomyView/modals/EditRelationModal';
import { ConfigModal } from './EconomyView/modals/ConfigModal';
import { AddItemModal } from './EconomyView/modals/AddItemModal';
import { EditItemModal } from './EconomyView/modals/EditItemModal';
import { DeleteConfirmModal } from './EconomyView/modals/DeleteConfirmModal';

function validateModuleConfig(content: unknown): EconomyModuleConfig | null {
  if (typeof content !== 'object' || content === null) {
    return null;
  }

  const config = content as Record<string, unknown>;
  
  if (!Array.isArray(config.entityTypes) || !Array.isArray(config.relationTypes) || !Array.isArray(config.levels)) {
    return null;
  }

  const isValidEntityType = (item: unknown): item is EntityTypeConfig => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.id === 'string' && typeof obj.name === 'string';
  };

  const isValidRelationType = (item: unknown): item is RelationTypeConfig => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.id === 'string' && typeof obj.name === 'string';
  };

  const isValidLevel = (item: unknown): item is LevelConfig => {
    if (typeof item !== 'object' || item === null) return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.id === 'string' && typeof obj.name === 'string';
  };

  if (!config.entityTypes.every(isValidEntityType) || 
      !config.relationTypes.every(isValidRelationType) || 
      !config.levels.every(isValidLevel)) {
    return null;
  }

  return content as unknown as EconomyModuleConfig;
}

export const EconomyView = ({ moduleId }: EconomyViewProps) => {
  const queryClient = useQueryClient();
  const [activeEntityType, setActiveEntityType] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | undefined>();
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const [showAddEntityModal, setShowAddEntityModal] = useState(false);
  const [showEditEntityModal, setShowEditEntityModal] = useState(false);
  const [showAddRelationModal, setShowAddRelationModal] = useState(false);
  const [showEditRelationModal, setShowEditRelationModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const [selectedEntity, setSelectedEntity] = useState<EconomicEntity | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<EconomicRelation | null>(null);
  const [selectedItem, setSelectedItem] = useState<EconomicItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [createItemError, setCreateItemError] = useState<string | null>(null);
  const [editItemError, setEditItemError] = useState<string | null>(null);
  const [createRelationError, setCreateRelationError] = useState<string | null>(null);
  const [editRelationError, setEditRelationError] = useState<string | null>(null);

  const { data: submodules, isLoading } = useQuery({
    queryKey: ['worldbuilding', 'submodules', moduleId],
    queryFn: () => worldbuildingApi.getSubmodules(moduleId),
  });

  const { data: items } = useQuery({
    queryKey: ['worldbuilding', 'items', moduleId],
    queryFn: () => worldbuildingApi.getItems(moduleId, { include_all: true }),
  });

  const configItem = useMemo(() => {
    return items?.find((item) => item.name === 'moduleConfig');
  }, [items]);

  useEffect(() => {
    if (!isLoading && submodules) {
      setIsFirstLoad(false);
    }
  }, [isLoading, submodules]);

  const moduleConfig: EconomyModuleConfig = useMemo(() => {
    if (!configItem?.content) {
      return {
        entityTypes: DEFAULT_ENTITY_TYPE_CONFIGS,
        relationTypes: DEFAULT_RELATION_TYPE_CONFIGS,
        levels: DEFAULT_LEVEL_CONFIGS,
      };
    }

    const validated = validateModuleConfig(configItem.content);
    if (!validated) {
      console.warn('Invalid module config format, using defaults');
      return {
        entityTypes: DEFAULT_ENTITY_TYPE_CONFIGS,
        relationTypes: DEFAULT_RELATION_TYPE_CONFIGS,
        levels: DEFAULT_LEVEL_CONFIGS,
      };
    }

    return validated;
  }, [configItem]);

  useEffect(() => {
    if (moduleConfig.entityTypes.length > 0 && !activeEntityType) {
      setActiveEntityType(moduleConfig.defaultEntityType || moduleConfig.entityTypes[0].id);
    }
  }, [moduleConfig, activeEntityType]);

  const parseItemsFromItems = (entityId: string): EconomicItem[] => {
    return (items || [])
      .filter((item) => item.name !== 'relations' && item.name !== 'customFields' && item.name !== 'specification' && item.submodule_id === entityId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        content: item.content,
        order_index: item.order_index,
      }));
  };

  const parseCustomFields = (entityId: string): Record<string, string | string[] | number> | undefined => {
    const customFieldsItem = (items || []).find(
      (item) => item.name === 'customFields' && item.submodule_id === entityId
    );
    return customFieldsItem?.content as unknown as Record<string, string | string[] | number> | undefined;
  };

  const parseSpecification = (entityId: string): Record<string, string> | undefined => {
    const specificationItem = (items || []).find(
      (item) => item.name === 'specification' && item.submodule_id === entityId
    );
    return specificationItem?.content as Record<string, string> | undefined;
  };

  const parseUnit = (entityId: string): string | undefined => {
    const spec = parseSpecification(entityId);
    return spec?.['单位'];
  };

  const entities = useMemo(() => {
    const baseEntities: EconomicEntity[] = (submodules || []).map((sub) => {
      const entityType = parseEntityType(sub.color);
      const level = parseEntityLevel(sub.color);
      const specification = parseSpecification(sub.id);

      return {
        id: sub.id,
        name: sub.name,
        description: sub.description,
        entityType: entityType || '',
        level,
        color: sub.color,
        icon: sub.icon,
        order_index: sub.order_index,
        unit: parseUnit(sub.id),
        items: parseItemsFromItems(sub.id),
        customFields: parseCustomFields(sub.id),
        specification,
        relations: [],
      };
    });

    const parseRelationsFromItems = (entityId: string, allEntities: EconomicEntity[]): EconomicRelation[] => {
      const relationItems = (items || []).filter(
        (item) => item.name === 'relations' && item.submodule_id === entityId
      );

      const relations: EconomicRelation[] = [];
      relationItems.forEach((item) => {
        Object.entries(item.content).forEach(([key, value]) => {
          const parts = value.split(':');
          if (parts.length >= 2) {
            const targetId = parts[1];
            const targetEntity = allEntities.find((e) => e.id === targetId);
            relations.push({
              id: key,
              target_id: targetId,
              target_name: targetEntity?.name || targetId,
              relationType: parts[0],
              volume: parts[2] || undefined,
              startDate: parts[3] || undefined,
              endDate: parts[4] || undefined,
            });
          }
        });
      });

      return relations;
    };

    baseEntities.forEach((entity) => {
      entity.relations = parseRelationsFromItems(entity.id, baseEntities);
    });

    return baseEntities;
  }, [submodules, items]);

  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      if (entity.entityType !== activeEntityType) return false;

      if (selectedLevel && entity.level !== selectedLevel) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesEntity =
          entity.name.toLowerCase().includes(query) ||
          (entity.description?.toLowerCase().includes(query));
        const matchesItems = entity.items.some(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            Object.values(item.content).some((v) => v.toLowerCase().includes(query))
        );
        if (!matchesEntity && !matchesItems) return false;
      }

      return true;
    });
  }, [entities, activeEntityType, selectedLevel, searchQuery]);

  const sortedEntities = useMemo(() => {
    return [...filteredEntities].sort((a, b) => {
      const levelOrder = ['global', 'national', 'regional', 'local'];
      const aIndex = levelOrder.indexOf(a.level);
      const bIndex = levelOrder.indexOf(b.level);
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.order_index - b.order_index;
    });
  }, [filteredEntities]);

  const createEntityMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      entityType: string;
      level: string;
      icon: string;
      unit?: string;
      customFields?: Record<string, string | string[] | number>;
    }) => {
      const submodule = await worldbuildingApi.createSubmodule(moduleId, {
        name: data.name,
        description: data.description,
        color: formatEntityType(data.entityType, data.level),
        icon: data.icon || undefined,
      });
      
      if (data.customFields && Object.keys(data.customFields).length > 0) {
        await worldbuildingApi.createItem(moduleId, {
          name: 'customFields',
          content: data.customFields as unknown as Record<string, string>,
          submodule_id: submodule.id,
        });
      }
      
      if (data.unit && data.unit.trim()) {
        await worldbuildingApi.createItem(moduleId, {
          name: 'specification',
          content: { '单位': data.unit.trim() },
          submodule_id: submodule.id,
        });
      }
      
      return submodule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowAddEntityModal(false);
      setCreateError(null);
    },
    onError: (error: Error) => {
      console.error('创建实体失败:', error);
      setCreateError(error.message || '创建失败，请稍后重试');
    },
  });

  const updateEntityMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description: string;
      entityType: string;
      level: string;
      icon: string;
      unit?: string;
      customFields?: Record<string, string | string[] | number>;
    }) => {
      if (!selectedEntity) {
        return Promise.reject(new Error('请先选择一个实体'));
      }
      
      await worldbuildingApi.updateSubmodule(selectedEntity.id, {
        name: data.name,
        description: data.description,
        color: formatEntityType(data.entityType, data.level),
        icon: data.icon || undefined,
      });
      
      const existingCustomFieldsItem = (items || []).find(
        (item) => item.name === 'customFields' && item.submodule_id === selectedEntity.id
      );
      
      if (data.customFields && Object.keys(data.customFields).length > 0) {
        if (existingCustomFieldsItem) {
          await worldbuildingApi.updateItem(existingCustomFieldsItem.id, {
            name: 'customFields',
            content: data.customFields as unknown as Record<string, string>,
          });
        } else {
          await worldbuildingApi.createItem(moduleId, {
            name: 'customFields',
            content: data.customFields as unknown as Record<string, string>,
            submodule_id: selectedEntity.id,
          });
        }
      } else if (existingCustomFieldsItem) {
        await worldbuildingApi.deleteItem(existingCustomFieldsItem.id);
      }
      
      const existingSpecItem = (items || []).find(
        (item) => item.name === 'specification' && item.submodule_id === selectedEntity.id
      );
      
      if (data.unit && data.unit.trim()) {
        const currentSpec = (existingSpecItem?.content as Record<string, string>) || {};
        const newSpec = { ...currentSpec, '单位': data.unit.trim() };
        
        if (existingSpecItem) {
          await worldbuildingApi.updateItem(existingSpecItem.id, {
            name: 'specification',
            content: newSpec,
          });
        } else {
          await worldbuildingApi.createItem(moduleId, {
            name: 'specification',
            content: newSpec,
            submodule_id: selectedEntity.id,
          });
        }
      } else if (existingSpecItem) {
        const currentSpec = { ...(existingSpecItem.content as Record<string, string>) };
        delete currentSpec['单位'];
        
        if (Object.keys(currentSpec).length > 0) {
          await worldbuildingApi.updateItem(existingSpecItem.id, {
            name: 'specification',
            content: currentSpec,
          });
        } else {
          await worldbuildingApi.deleteItem(existingSpecItem.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowEditEntityModal(false);
      setSelectedEntity(null);
      setEditError(null);
    },
    onError: (error: Error) => {
      console.error('更新实体失败:', error);
      setEditError(error.message || '更新失败，请稍后重试');
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: (entityId: string) => worldbuildingApi.deleteSubmodule(entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
    },
  });

  const updateDescriptionMutation = useMutation({
    mutationFn: (data: { entityId: string; description: string }) => {
      return worldbuildingApi.updateSubmodule(data.entityId, {
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'submodules', moduleId] });
    },
    onError: (error: Error) => {
      console.error('更新描述失败:', error);
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: { name: string; content: Record<string, string> }) => {
      if (!selectedEntity) {
        return Promise.reject(new Error('请先选择一个实体'));
      }
      return worldbuildingApi.createItem(moduleId, {
        name: data.name,
        content: data.content,
        submodule_id: selectedEntity.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowAddItemModal(false);
      setCreateItemError(null);
    },
    onError: (error: Error) => {
      console.error('创建条目失败:', error);
      setCreateItemError(error.message || '创建失败，请稍后重试');
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: (data: { name: string; content: Record<string, string> }) => {
      if (!selectedItem) {
        return Promise.reject(new Error('请先选择一个条目'));
      }
      return worldbuildingApi.updateItem(selectedItem.id, {
        name: data.name,
        content: data.content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowEditItemModal(false);
      setSelectedItem(null);
      setEditItemError(null);
    },
    onError: (error: Error) => {
      console.error('更新条目失败:', error);
      setEditItemError(error.message || '更新失败，请稍后重试');
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => worldbuildingApi.deleteItem(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] }),
  });

  const createRelationMutation = useMutation({
    mutationFn: (data: {
      targetId: string;
      relationType: string;
      description: string;
      volume?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      if (!selectedEntity) {
        return Promise.reject(new Error('请先选择一个实体'));
      }
      const relationValue = `${data.relationType}:${data.targetId}:${data.volume || ''}:${data.startDate || ''}:${data.endDate || ''}`;
      const relationId = `rel_${Date.now()}`;
      return worldbuildingApi.createItem(moduleId, {
        name: 'relations',
        content: { [relationId]: relationValue },
        submodule_id: selectedEntity.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowAddRelationModal(false);
      setCreateRelationError(null);
    },
    onError: (error: Error) => {
      console.error('创建关系失败:', error);
      setCreateRelationError(error.message || '创建失败，请稍后重试');
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: (data: {
      targetId: string;
      relationType: string;
      description: string;
      volume?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      if (!selectedEntity || !selectedRelation) {
        return Promise.reject(new Error('请先选择关系'));
      }
      const relationValue = `${data.relationType}:${data.targetId}:${data.volume || ''}:${data.startDate || ''}:${data.endDate || ''}`;
      const relationItems = (items || []).filter(
        (item) => item.name === 'relations' && item.submodule_id === selectedEntity.id
      );
      if (relationItems.length === 0) {
        return Promise.reject(new Error('未找到关系数据'));
      }
      const relationItem = relationItems[0];
      const newContent = { ...relationItem.content };
      newContent[selectedRelation.id] = relationValue;
      return worldbuildingApi.updateItem(relationItem.id, {
        content: newContent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowEditRelationModal(false);
      setSelectedRelation(null);
      setEditRelationError(null);
    },
    onError: (error: Error) => {
      console.error('更新关系失败:', error);
      setEditRelationError(error.message || '更新失败，请稍后重试');
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: (config: EconomyModuleConfig) => {
      if (configItem) {
        return worldbuildingApi.updateItem(configItem.id, {
          name: 'moduleConfig',
          content: config as unknown as Record<string, string>,
        });
      } else {
        return worldbuildingApi.createItem(moduleId, {
          name: 'moduleConfig',
          content: config as unknown as Record<string, string>,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'config', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      setShowConfigModal(false);
    },
  });

  const handleDeleteEntity = (entityId: string, entityName: string) => {
    setDeleteTarget({ id: entityId, name: entityName });
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteEntity = () => {
    if (deleteTarget) {
      deleteEntityMutation.mutate(deleteTarget.id);
      setShowDeleteConfirmModal(false);
      setDeleteTarget(null);
    }
  };

  const handleEditEntity = (entity: EconomicEntity) => {
    setSelectedEntity(entity);
    setShowEditEntityModal(true);
  };

  const handleAddItem = (entity: EconomicEntity) => {
    setSelectedEntity(entity);
    setShowAddItemModal(true);
  };

  const handleEditItem = (entity: EconomicEntity, item: EconomicItem) => {
    setSelectedEntity(entity);
    setSelectedItem(item);
    setShowEditItemModal(true);
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItemMutation.mutate(itemId);
  };

  const handleUpdateDescription = (entity: EconomicEntity, description: string) => {
    updateDescriptionMutation.mutate({ entityId: entity.id, description });
  };

  const handleUpdateSpecification = (entity: EconomicEntity, specification: Record<string, string>) => {
    const existingSpecItem = (items || []).find(
      (item) => item.name === 'specification' && item.submodule_id === entity.id
    );
    
    if (Object.keys(specification).length > 0) {
      if (existingSpecItem) {
        worldbuildingApi.updateItem(existingSpecItem.id, {
          name: 'specification',
          content: specification,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
        });
      } else {
        worldbuildingApi.createItem(moduleId, {
          name: 'specification',
          content: specification,
          submodule_id: entity.id,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
        });
      }
    } else if (existingSpecItem) {
      worldbuildingApi.deleteItem(existingSpecItem.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
      });
    }
  };

  const handleAddRelation = (entity: EconomicEntity) => {
    setSelectedEntity(entity);
    setShowAddRelationModal(true);
  };

  const handleEditRelation = (entity: EconomicEntity, relation: EconomicRelation) => {
    setSelectedEntity(entity);
    setSelectedRelation(relation);
    setShowEditRelationModal(true);
  };

  const handleDeleteRelation = (entityId: string, relationId: string) => {
    if (confirm('确定要删除此经济关系吗？')) {
      const relationItems = (items || []).filter(
        (item) => item.name === 'relations' && item.submodule_id === entityId
      );
      if (relationItems.length > 0) {
        const relationItem = relationItems[0];
        const newContent = { ...relationItem.content };
        delete newContent[relationId];
        worldbuildingApi.updateItem(relationItem.id, {
          content: newContent,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['worldbuilding', 'items', moduleId] });
        });
      }
    }
  };

  const handleAddEntityType = () => {
    setShowConfigModal(true);
  };

  const handleOpenConfig = () => {
    setShowConfigModal(true);
  };

  if (isLoading && isFirstLoad) {
    return (
      <div className="relative h-full overflow-auto bg-background">
        <div className="p-6">
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-24 h-10 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="w-full max-w-md h-10 bg-muted/30 rounded-lg animate-pulse mb-6" />
          <div className="flex flex-wrap gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-[1_1_calc(33.333%-12px)] min-h-[130px] bg-muted/30 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-background">
      <div className="p-6">
        <EntityTypeTabs
          entityTypes={moduleConfig.entityTypes}
          activeType={activeEntityType}
          onTypeChange={setActiveEntityType}
          onAddType={handleAddEntityType}
          onOpenConfig={handleOpenConfig}
        />

        <div className="flex items-center justify-between mb-6">
          <FilterPanel
            levels={moduleConfig.levels}
            selectedLevel={selectedLevel}
            onLevelChange={setSelectedLevel}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <motion.button
            onClick={() => setShowAddEntityModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            添加实体
          </motion.button>
        </div>

        {entities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={animationConfig.spring}
            className="text-center py-24"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, ...animationConfig.spring }}
              className="relative inline-flex items-center justify-center w-28 h-28 mb-8"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-accent/15 to-primary/20 animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/10 via-accent/10 to-primary/10" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary via-primary/90 to-accent flex items-center justify-center shadow-xl shadow-primary/25">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
            </motion.div>
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold mb-3 text-foreground"
            >
              构建您的经济体系
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed"
            >
              创建货币、商品、资源等经济实体，<br />构建完整的世界经济网络。
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center gap-4"
            >
              <motion.button
                onClick={() => setShowAddEntityModal(true)}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 flex items-center gap-2 font-semibold"
              >
                <Plus className="h-4 w-4" />
                创建第一个实体
              </motion.button>
            </motion.div>
          </motion.div>
        ) : sortedEntities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={animationConfig.spring}
            className="text-center py-24"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, ...animationConfig.spring }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/20 mb-6"
            >
              <Sparkles className="h-10 w-10 text-muted-foreground/60" />
            </motion.div>
            <h3 className="text-xl font-bold text-foreground mb-3">未找到匹配结果</h3>
            <p className="text-sm text-muted-foreground mb-6">
              没有找到符合条件的经济实体
            </p>
            <motion.button
              onClick={() => {
                setSearchQuery('');
                setSelectedLevel(undefined);
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 text-sm bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors font-medium"
            >
              清除筛选
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.06, delayChildren: 0.05 }
              }
            }}
            className="flex flex-wrap gap-4"
          >
            <AnimatePresence mode="popLayout">
              {sortedEntities.map((entity) => {
                const entityTypeConfig = getEntityTypeConfig(entity.entityType, moduleConfig.entityTypes);
                const levelConfig = getLevelConfig(entity.level, moduleConfig.levels);

                return (
                  <EconomicCard
                    key={entity.id}
                    entity={entity}
                    entityTypeConfig={entityTypeConfig}
                    levelConfig={levelConfig}
                    allEntities={entities}
                    relationTypes={moduleConfig.relationTypes}
                    onEdit={() => handleEditEntity(entity)}
                    onDelete={() => handleDeleteEntity(entity.id, entity.name)}
                    onAddItem={() => handleAddItem(entity)}
                    onEditItem={(item) => handleEditItem(entity, item)}
                    onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                    onAddRelation={() => handleAddRelation(entity)}
                    onEditRelation={(relation) => handleEditRelation(entity, relation)}
                    onDeleteRelation={(relationId) => handleDeleteRelation(entity.id, relationId)}
                    onUpdateDescription={(desc) => handleUpdateDescription(entity, desc)}
                    onUpdateSpecification={(spec) => handleUpdateSpecification(entity, spec)}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <AddEntityModal
        isOpen={showAddEntityModal}
        onClose={() => {
          setShowAddEntityModal(false);
          setCreateError(null);
        }}
        onSubmit={(data) => createEntityMutation.mutate(data)}
        entityTypes={moduleConfig.entityTypes}
        levels={moduleConfig.levels}
        selectedEntityType={activeEntityType}
        isLoading={createEntityMutation.isPending}
        error={createError}
      />

      <EditEntityModal
        isOpen={showEditEntityModal}
        onClose={() => {
          setShowEditEntityModal(false);
          setSelectedEntity(null);
          setEditError(null);
        }}
        onSubmit={(data) => updateEntityMutation.mutate(data)}
        entity={selectedEntity}
        entityTypes={moduleConfig.entityTypes}
        levels={moduleConfig.levels}
        isLoading={updateEntityMutation.isPending}
        error={editError}
      />

      <AddRelationModal
        isOpen={showAddRelationModal}
        onClose={() => {
          setShowAddRelationModal(false);
          setSelectedEntity(null);
          setCreateRelationError(null);
        }}
        onSubmit={(data) => createRelationMutation.mutate(data)}
        entities={entities}
        relationTypes={moduleConfig.relationTypes}
        currentEntityId={selectedEntity?.id || ''}
        isLoading={createRelationMutation.isPending}
        error={createRelationError}
      />

      <EditRelationModal
        isOpen={showEditRelationModal}
        onClose={() => {
          setShowEditRelationModal(false);
          setSelectedRelation(null);
          setEditRelationError(null);
        }}
        onSubmit={(data) => updateRelationMutation.mutate(data)}
        relation={selectedRelation}
        entities={entities}
        relationTypes={moduleConfig.relationTypes}
        currentEntityId={selectedEntity?.id || ''}
        isLoading={updateRelationMutation.isPending}
        error={editRelationError}
      />

      <ConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={moduleConfig}
        onSave={(config) => saveConfigMutation.mutate(config)}
        isLoading={saveConfigMutation.isPending}
      />

      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => {
          setShowAddItemModal(false);
          setSelectedEntity(null);
          setCreateItemError(null);
        }}
        onSubmit={(data) => createItemMutation.mutate(data)}
        isLoading={createItemMutation.isPending}
        error={createItemError}
      />

      <EditItemModal
        isOpen={showEditItemModal}
        onClose={() => {
          setShowEditItemModal(false);
          setSelectedItem(null);
          setEditItemError(null);
        }}
        onSubmit={(data) => updateItemMutation.mutate(data)}
        item={selectedItem}
        isLoading={updateItemMutation.isPending}
        error={editItemError}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirmModal}
        onClose={() => {
          setShowDeleteConfirmModal(false);
          setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteEntity}
        title="确认删除"
        message={`确定要删除经济实体"${deleteTarget?.name || ''}"吗？所有相关条目和关系也将被删除。`}
        isLoading={deleteEntityMutation.isPending}
      />
    </div>
  );
};
