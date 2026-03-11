# backend/test_schemas.py
from app.schemas import ProjectCreate, FolderCreate, NoteCreate, VolumeNode

# 测试 Pydantic 验证
def test():
    # 1. 测试项目创建
    p_data = {"title": "我的小说"}
    p = ProjectCreate(**p_data)
    print(f"✅ Project Schema OK: {p.title}")

    # 2. 测试文件夹
    f_data = {"name": "第一卷", "type": "volume", "project_id": "xxx"}
    f = FolderCreate(**f_data)
    print(f"✅ Folder Schema OK: {f.name}")

    # 3. 测试笔记
    n_data = {"title": "第一章", "folder_id": "yyy", "project_id": "xxx"}
    n = NoteCreate(**n_data)
    print(f"✅ Note Schema OK: {n.title}")

    # 4. 测试目录树节点
    # 注意：VolumeNode 需要 children 列表，这里测试简单的叶子节点情况
    vol_node = VolumeNode(id="vol_1", name="第一卷", order=0, children=[])
    print(f"✅ Directory Node OK: {vol_node.name}")

    print("\n所有 Schema 定义无误！")

if __name__ == "__main__":
    test()
