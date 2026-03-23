#!/usr/bin/env python3
"""
迁移文件合并工具
用于将多个迁移合并为一个初始迁移（仅适用于开发环境重置）
警告：这会删除所有现有迁移，现有数据库将无法使用！
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
from datetime import datetime


def merge_migrations(auto_confirm=False):
    """合并所有迁移为一个初始迁移"""
    
    backend_dir = Path(__file__).parent / 'backend'
    migrations_dir = backend_dir / 'migrations' / 'versions'
    
    if not migrations_dir.exists():
        print("❌ 未找到迁移目录")
        sys.exit(1)
    
    # 备份现有迁移
    backup_dir = backend_dir / 'migrations' / 'versions_backup'
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    
    # 复制当前迁移作为备份
    shutil.copytree(migrations_dir, backup_dir)
    print(f"✅ 已备份现有迁移到: {backup_dir}")
    
    # 获取所有模型定义
    models_file = backend_dir / 'app' / 'models' / '__init__.py'
    if not models_file.exists():
        print("❌ 未找到模型文件")
        sys.exit(1)
    
    if not auto_confirm:
        print("\n⚠️  警告: 此操作将删除所有现有迁移并创建新的初始迁移！")
        print("⚠️  现有数据库将无法使用，需要重新初始化！")
        print()
        
        confirm = input("确定要继续吗？输入 'MERGE' 确认: ")
        if confirm != 'MERGE':
            print("已取消")
            sys.exit(0)
    else:
        print("\n⚠️  自动确认模式：将删除所有现有迁移并创建新的初始迁移")
    
    # 删除现有迁移文件
    for f in migrations_dir.glob('*.py'):
        if f.name != '__init__.py':
            f.unlink()
    print("✅ 已删除旧迁移文件")
    
    # 删除数据库
    data_dir = backend_dir / 'data'
    for db_file in data_dir.glob('*.db'):
        db_file.unlink()
        print(f"✅ 已删除数据库: {db_file}")
    
    # 删除 alembic 版本表记录
    print("\n📝 创建新的初始迁移...")
    
    # 使用 alembic 生成新的初始迁移
    import subprocess
    result = subprocess.run(
        ['alembic', 'revision', '--autogenerate', '-m', 'initial_schema'],
        cwd=backend_dir,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ 创建迁移失败: {result.stderr}")
        # 恢复备份
        shutil.rmtree(migrations_dir)
        shutil.move(backup_dir, migrations_dir)
        print("✅ 已恢复备份")
        sys.exit(1)
    
    print("✅ 新的初始迁移已创建")
    print(f"\n输出: {result.stdout}")
    
    # 应用新迁移
    result = subprocess.run(
        ['alembic', 'upgrade', 'head'],
        cwd=backend_dir,
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ 应用迁移失败: {result.stderr}")
        sys.exit(1)
    
    print("✅ 新迁移已应用")
    print("\n🎉 迁移合并完成！")
    print(f"备份保存在: {backup_dir}")
    print("如果需要恢复，请手动将 backup 目录中的文件复制回 versions 目录")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='合并 Alembic 迁移文件')
    parser.add_argument('--auto', action='store_true', help='自动确认模式（用于脚本调用）')
    args = parser.parse_args()
    
    merge_migrations(auto_confirm=args.auto)
