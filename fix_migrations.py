#!/usr/bin/env python3
"""
数据库迁移修复工具
用于处理 Alembic 迁移冲突和 SQLite 兼容性问题
"""

import os
import sys
import re
from pathlib import Path


def fix_migration_file(filepath: Path) -> bool:
    """修复单个迁移文件，添加存在性检查和 batch mode"""
    
    content = filepath.read_text(encoding='utf-8')
    
    # 检查是否已经修复过
    if 'batch_alter_table' in content or 'inspector.get_columns' in content:
        print(f"  ✓ 已修复: {filepath.name}")
        return False
    
    # 检查是否是 SQLite 不兼容的操作
    needs_fix = False
    
    # 检测 add_column + create_foreign_key 模式
    if 'op.add_column' in content and 'op.create_foreign_key' in content:
        needs_fix = True
    
    # 检测直接的约束操作
    if 'op.create_foreign_key' in content or 'op.create_unique_constraint' in content:
        needs_fix = True
    
    if not needs_fix:
        return False
    
    print(f"  🔧 修复中: {filepath.name}")
    
    # 这里可以添加自动修复逻辑
    # 但由于每个迁移的具体逻辑不同，建议手动修复
    
    print(f"  ⚠️  请手动检查此文件: {filepath}")
    return True


def scan_migrations(backend_dir: Path) -> list[Path]:
    """扫描所有迁移文件"""
    migrations_dir = backend_dir / 'migrations' / 'versions'
    if not migrations_dir.exists():
        print(f"❌ 未找到迁移目录: {migrations_dir}")
        return []
    
    return list(migrations_dir.glob('*.py'))


def check_migration_chain(backend_dir: Path) -> bool:
    """检查迁移链是否完整"""
    migrations = scan_migrations(backend_dir)
    
    revisions = {}
    for m in migrations:
        content = m.read_text(encoding='utf-8')
        
        # 提取 revision
        rev_match = re.search(r"revision:\s*str\s*=\s*['\"]([^'\"]+)['\"]", content)
        down_rev_match = re.search(r"down_revision:\s*\w+\s*=\s*([^\n]+)", content)
        
        if rev_match:
            rev_id = rev_match.group(1)
            down_rev = None
            if down_rev_match:
                down_rev_str = down_rev_match.group(1).strip()
                if down_rev_str != 'None':
                    down_rev_match2 = re.search(r"['\"]([^'\"]+)['\"]", down_rev_str)
                    if down_rev_match2:
                        down_rev = down_rev_match2.group(1)
            
            revisions[rev_id] = {
                'file': m,
                'down_revision': down_rev
            }
    
    # 检查是否有孤立的迁移
    all_revs = set(revisions.keys())
    referenced_revs = set()
    for rev_id, info in revisions.items():
        if info['down_revision']:
            referenced_revs.add(info['down_revision'])
    
    # 找到没有 down_revision 的根迁移
    root_revs = all_revs - referenced_revs
    
    print(f"\n📊 迁移统计:")
    print(f"  总迁移数: {len(revisions)}")
    print(f"  根迁移数: {len(root_revs)}")
    
    if len(root_revs) > 1:
        print(f"\n⚠️  警告: 发现 {len(root_revs)} 个根迁移，可能存在分支:")
        for rev in root_revs:
            print(f"    - {rev}")
        return False
    
    return True


def main():
    """主函数"""
    backend_dir = Path(__file__).parent / 'backend'
    
    if not backend_dir.exists():
        print(f"❌ 未找到 backend 目录: {backend_dir}")
        sys.exit(1)
    
    print("🔍 扫描迁移文件...")
    migrations = scan_migrations(backend_dir)
    
    if not migrations:
        print("❌ 未找到迁移文件")
        sys.exit(1)
    
    print(f"  找到 {len(migrations)} 个迁移文件")
    
    # 检查每个迁移文件
    needs_attention = []
    for m in migrations:
        if fix_migration_file(m):
            needs_attention.append(m)
    
    # 检查迁移链
    print("\n🔗 检查迁移链...")
    if not check_migration_chain(backend_dir):
        print("\n⚠️  迁移链可能有问题，请检查 down_revision 设置")
    
    if needs_attention:
        print(f"\n⚠️  有 {len(needs_attention)} 个文件需要手动检查")
        print("建议按照以下模板修复:\n")
        print("""
# 在 upgrade() 函数中添加存在性检查:
def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('table_name')]
    
    if 'column_name' in columns:
        return  # 已存在，跳过
    
    # 使用 batch mode 支持 SQLite
    with op.batch_alter_table('table_name', schema=None) as batch_op:
        batch_op.add_column(sa.Column('column_name', sa.String(36), nullable=True))
        # 其他操作...
""")
    else:
        print("\n✅ 所有迁移文件检查完成")


if __name__ == '__main__':
    main()
