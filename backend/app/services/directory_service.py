# backend/app/services/directory_service.py
from sqlalchemy.orm import Session
from app.models import Folder, Note
from app.schemas.directory import VolumeNode, ActNode, NoteNode
from typing import List

class DirectoryService:
    @staticmethod
    def build_tree(project_id: str, db: Session) -> List[VolumeNode]:
        """根据项目 ID 构建目录树"""
        # 1. 获取该项目的所有文件夹，按 order 排序
        folders = db.query(Folder).filter(
            Folder.project_id == project_id
        ).order_by(Folder.order).all()

        # 2. 获取该项目的所有章节，按 order 排序
        notes = db.query(Note).filter(
            Note.project_id == project_id
        ).order_by(Note.order).all()

        # 3. 建立 ID 到对象的映射
        volume_map = {}  # id -> VolumeNode
        act_map = {}     # id -> ActNode
        
        for folder in folders:
            if folder.type == "volume":
                node = VolumeNode(
                    id=folder.id, 
                    name=folder.name, 
                    order=folder.order, 
                    children=[]
                )
                volume_map[folder.id] = node
            else:  # act
                node = ActNode(
                    id=folder.id, 
                    name=folder.name, 
                    order=folder.order, 
                    children=[]
                )
                act_map[folder.id] = node

        # 4. 将章节挂载到对应的 Act 下
        for note in notes:
            note_node = NoteNode(
                id=note.id,
                title=note.title,
                order=note.order,
                created_at=note.created_at,
                word_count=note.word_count or 0
            )
            if note.folder_id in act_map:
                act_map[note.folder_id].children.append(note_node)

        # 5. 将 Act 挂载到对应的 Volume 下
        root_volumes = []
        for folder in folders:
            if folder.type == "volume":
                volume_node = volume_map.get(folder.id)
                if volume_node:
                    # 找出属于该 Volume 的 Acts
                    for act_folder in folders:
                        if act_folder.type == "act" and act_folder.parent_id == folder.id:
                            act_node = act_map.get(act_folder.id)
                            if act_node:
                                volume_node.children.append(act_node)
                    
                    # 排序 children
                    volume_node.children.sort(key=lambda x: x.order)
                    root_volumes.append(volume_node)

        return root_volumes
