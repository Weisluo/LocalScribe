# backend/app/services/directory_service.py
from sqlalchemy.orm import Session, joinedload
from app.models import Folder, Note
from app.schemas.directory import VolumeNode, ActNode, NoteNode
from typing import List
from app.core.logging import get_logger
import time

logger = get_logger(__name__)

class DirectoryService:
    @staticmethod
    def build_tree(project_id: str, db: Session) -> List[VolumeNode]:
        """根据项目 ID 构建目录树（优化版：减少数据库查询次数）"""
        start_time = time.time()
        logger.debug(f"Building directory tree for project: {project_id}")
        
        folders = db.query(Folder).filter(
            Folder.project_id == project_id
        ).order_by(Folder.order).all()
        
        notes = db.query(Note).filter(
            Note.project_id == project_id,
            Note.deleted_at.is_(None)
        ).order_by(Note.order).all()
        
        volume_map = {}
        act_map = {}
        
        for folder in folders:
            if folder.type == "volume":
                node = VolumeNode(
                    id=folder.id, 
                    name=folder.name, 
                    order=folder.order, 
                    children=[]
                )
                volume_map[folder.id] = node
            else:
                node = ActNode(
                    id=folder.id, 
                    name=folder.name, 
                    order=folder.order, 
                    children=[]
                )
                act_map[folder.id] = node

        notes_by_folder: dict = {}
        for note in notes:
            if note.folder_id not in notes_by_folder:
                notes_by_folder[note.folder_id] = []
            notes_by_folder[note.folder_id].append(note)
        
        for folder_id, folder_notes in notes_by_folder.items():
            if folder_id in act_map:
                for note in folder_notes:
                    note_node = NoteNode(
                        id=note.id,
                        title=note.title,
                        order=note.order,
                        created_at=note.created_at,
                        word_count=note.word_count or 0
                    )
                    act_map[folder_id].children.append(note_node)

        acts_by_parent: dict = {}
        for folder in folders:
            if folder.type == "act" and folder.parent_id:
                if folder.parent_id not in acts_by_parent:
                    acts_by_parent[folder.parent_id] = []
                acts_by_parent[folder.parent_id].append(act_map.get(folder.id))

        root_volumes = []
        for folder in folders:
            if folder.type == "volume":
                volume_node = volume_map.get(folder.id)
                if volume_node:
                    if folder.id in acts_by_parent:
                        for act_node in acts_by_parent[folder.id]:
                            if act_node:
                                volume_node.children.append(act_node)
                    
                    volume_node.children.sort(key=lambda x: x.order)
                    root_volumes.append(volume_node)

        elapsed = (time.time() - start_time) * 1000
        logger.debug(f"Directory tree built in {elapsed:.2f}ms - {len(root_volumes)} volumes, {len(folders)} folders, {len(notes)} notes")
        
        return root_volumes
