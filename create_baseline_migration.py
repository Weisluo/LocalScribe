#!/usr/bin/env python3
"""
创建基线迁移（Squash）
在保留历史的同时，为新环境提供优化的迁移路径

工作流程:
1. 备份现有迁移文件到归档目录
2. 从当前数据库导出完整 schema
3. 创建新的基线迁移文件（包含完整的表结构）
4. 可选: 清理旧迁移文件（仅保留基线迁移）
"""

import os
import sys
import re
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from typing import Optional
import subprocess


def run_alembic_command(
    backend_dir: Path,
    args: list[str],
    check: bool = True
) -> subprocess.CompletedProcess:
    """运行 alembic 命令"""
    result = subprocess.run(
        ['alembic'] + args,
        cwd=backend_dir,
        capture_output=True,
        text=True
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"Alembic 命令失败: {result.stderr}")
    return result


def get_current_revision(backend_dir: Path) -> Optional[str]:
    """获取当前数据库版本"""
    try:
        result = run_alembic_command(backend_dir, ['current'], check=False)
        if result.returncode != 0:
            return None
        # 解析输出，格式如: a72273cf3782 (head)
        match = re.search(r'^([a-f0-9]+)', result.stdout.strip())
        return match.group(1) if match else None
    except Exception:
        return None


def get_migration_history(backend_dir: Path) -> list[dict]:
    """获取迁移历史列表"""
    result = run_alembic_command(backend_dir, ['history', '--verbose'])
    migrations = []

    # 解析历史输出
    for line in result.stdout.split('\n'):
        # 格式: a72273cf3782 -> b82273cf3783 (head), add_performance_indexes
        match = re.search(
            r'^([a-f0-9]+)\s*->\s*([a-f0-9]+)\s*\([^)]+\),\s*(.+)$',
            line.strip()
        )
        if match:
            migrations.append({
                'from': match.group(1),
                'to': match.group(2),
                'name': match.group(3).strip()
            })

    return migrations


def backup_migrations(backend_dir: Path) -> Path:
    """备份现有迁移文件"""
    versions_dir = backend_dir / 'migrations' / 'versions'
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    archive_dir = backend_dir / 'migrations' / f'archive_{timestamp}'

    if not versions_dir.exists():
        raise FileNotFoundError(f"迁移目录不存在: {versions_dir}")

    # 创建归档目录
    archive_dir.mkdir(parents=True, exist_ok=True)

    # 复制所有迁移文件（保留 __init__.py）
    for file in versions_dir.glob('*.py'):
        if file.name == '__init__.py':
            continue
        shutil.copy2(file, archive_dir / file.name)

    print(f"✅ 已备份 {len(list(archive_dir.glob('*.py')))} 个迁移文件到: {archive_dir}")
    return archive_dir


def export_schema_sql(backend_dir: Path, db_file: Path) -> str:
    """从 SQLite 数据库导出 schema SQL"""
    result = subprocess.run(
        ['sqlite3', str(db_file), '.schema'],
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout


def parse_schema_to_sqlalchemy(schema_sql: str) -> str:
    """将 SQLite schema SQL 转换为 Alembic/SQLAlchemy 操作

    这是一个简化的转换器，处理常见的 CREATE TABLE 语句
    """
    operations = []

    # 提取 CREATE TABLE 语句
    table_pattern = re.compile(
        r'CREATE TABLE\s+(\w+)\s*\((.+?)\);',
        re.DOTALL | re.IGNORECASE
    )

    for match in table_pattern.finditer(schema_sql):
        table_name = match.group(1)
        columns_def = match.group(2)

        # 跳过 alembic_version 表
        if table_name == 'alembic_version':
            continue

        operations.append(f"    # Table: {table_name}")
        operations.append(f"    op.execute('''{match.group(0)}''')")
        operations.append("")

    # 提取 CREATE INDEX 语句
    index_pattern = re.compile(
        r'CREATE INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\);',
        re.IGNORECASE
    )

    for match in index_pattern.finditer(schema_sql):
        index_name = match.group(1)
        table_name = match.group(2)
        columns = match.group(3)

        operations.append(f"    # Index: {index_name} on {table_name}")
        operations.append(f"    op.execute('''{match.group(0)}''')")
        operations.append("")

    return '\n'.join(operations) if operations else "    pass"


def generate_baseline_migration(
    backend_dir: Path,
    revision_id: str,
    description: str
) -> Path:
    """生成基线迁移文件"""

    # 使用时间戳生成新的 revision ID
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    new_revision = f"baseline_{timestamp}"

    # 获取数据库 schema
    db_file = backend_dir / 'data' / 'local_scribe.db'
    if not db_file.exists():
        raise FileNotFoundError(f"数据库文件不存在: {db_file}")

    schema_sql = export_schema_sql(backend_dir, db_file)

    # 生成迁移文件内容
    migration_content = f'''"""{description}

Revision ID: {new_revision}
Revises: None
Create Date: {datetime.now().isoformat()}

这是基线迁移，包含当前数据库的完整 schema。
新环境可以直接使用此迁移初始化，无需执行历史迁移。

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '{new_revision}'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """应用基线 schema"""
    # 使用原生 SQL 创建完整的数据库结构
    # 这样可以避免 SQLAlchemy 模型和迁移之间的复杂映射

{parse_schema_to_sqlalchemy(schema_sql)}

    print("✅ 基线迁移已应用")


def downgrade() -> None:
    """降级：删除所有表（危险操作）"""
    # 获取所有表名并删除
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 按依赖顺序删除表（先删除有外键的表）
    tables = inspector.get_table_names()

    # 排除 alembic_version 表
    tables = [t for t in tables if t != 'alembic_version']

    # 删除所有表
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {{table}}")

    print("✅ 所有表已删除")
'''

    # 写入迁移文件
    versions_dir = backend_dir / 'migrations' / 'versions'
    migration_file = versions_dir / f'{new_revision}_baseline_schema.py'
    migration_file.write_text(migration_content, encoding='utf-8')

    return migration_file


def archive_old_migrations(backend_dir: Path, archive_dir: Path):
    """将旧迁移文件移动到归档目录（保留 __init__.py）"""
    versions_dir = backend_dir / 'migrations' / 'versions'

    moved_count = 0
    for file in versions_dir.glob('*.py'):
        if file.name == '__init__.py':
            continue
        if 'baseline' in file.name:
            # 保留基线迁移
            continue

        # 移动到归档目录
        dest = archive_dir / file.name
        if dest.exists():
            dest.unlink()
        shutil.move(file, dest)
        moved_count += 1

    print(f"✅ 已归档 {moved_count} 个旧迁移文件")


def create_baseline(auto_confirm: bool = False, keep_old: bool = False):
    """创建基线迁移的主函数"""

    backend_dir = Path(__file__).parent / 'backend'

    print("=" * 60)
    print("📝 创建基线迁移")
    print("=" * 60)
    print()
    print("这将创建一个新的基线迁移，包含当前数据库的完整 schema。")
    print("新环境可以直接使用此迁移，而无需执行所有历史迁移。")
    print()

    # 检查当前数据库状态
    current_rev = get_current_revision(backend_dir)
    if not current_rev:
        print("❌ 无法获取当前数据库版本，请确保数据库已初始化")
        sys.exit(1)

    print(f"📊 当前数据库版本: {current_rev}")

    # 获取迁移历史
    try:
        history = get_migration_history(backend_dir)
        print(f"📚 迁移历史: {len(history)} 个迁移")
    except Exception as e:
        print(f"⚠️  无法获取迁移历史: {e}")
        history = []

    # 确认操作
    if not auto_confirm:
        print()
        print("⚠️  此操作将:")
        print("   1. 备份现有迁移文件")
        print("   2. 创建新的基线迁移")
        if not keep_old:
            print("   3. 归档旧迁移文件（保留在 archive 目录）")
        print()

        confirm = input("确定要继续吗？输入 'BASELINE' 确认: ")
        if confirm != 'BASELINE':
            print("已取消")
            sys.exit(0)
    else:
        print("\n⚠️  自动确认模式")

    try:
        # 1. 备份现有迁移
        print("\n📦 步骤 1: 备份现有迁移...")
        archive_dir = backup_migrations(backend_dir)

        # 2. 生成基线迁移
        print("\n🔨 步骤 2: 生成基线迁移...")
        migration_file = generate_baseline_migration(
            backend_dir,
            current_rev,
            "baseline_schema"
        )
        print(f"✅ 基线迁移已创建: {migration_file.name}")

        # 3. 归档旧迁移（如果不保留）
        if not keep_old:
            print("\n📂 步骤 3: 归档旧迁移文件...")
            archive_old_migrations(backend_dir, archive_dir)

        # 4. 更新当前数据库的 alembic 版本
        print("\n🔄 步骤 4: 更新数据库版本标记...")
        new_revision = migration_file.stem.split('_')[0]
        run_alembic_command(backend_dir, ['stamp', new_revision])
        print(f"✅ 数据库已标记为版本: {new_revision}")

        print()
        print("=" * 60)
        print("🎉 基线迁移创建完成！")
        print("=" * 60)
        print()
        print("📋 后续步骤:")
        print(f"   1. 新基线迁移: {migration_file.name}")
        print(f"   2. 旧迁移备份: {archive_dir}")
        print()
        print("💡 提示:")
        print("   - 新环境可以直接运行 alembic upgrade head 初始化")
        print("   - 如需恢复旧迁移，从 archive 目录复制回 versions 目录")
        print()

    except Exception as e:
        print(f"\n❌ 错误: {e}")
        print("\n⚠️  如果部分文件已修改，请手动检查:")
        print(f"   - 迁移目录: {backend_dir / 'migrations' / 'versions'}")
        print(f"   - 备份目录: {backend_dir / 'migrations' / 'archive_*'}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='创建基线迁移（Squash）- 将多个迁移合并为一个初始迁移'
    )
    parser.add_argument(
        '--auto', '-a',
        action='store_true',
        help='自动确认模式（用于脚本调用）'
    )
    parser.add_argument(
        '--keep-old', '-k',
        action='store_true',
        help='保留旧迁移文件（不移到 archive 目录）'
    )
    parser.add_argument(
        '--dry-run', '-d',
        action='store_true',
        help='试运行模式（仅显示将要执行的操作）'
    )

    args = parser.parse_args()

    if args.dry_run:
        print("🔍 试运行模式 - 将要执行的操作:")
        print("   1. 备份现有迁移文件到 archive 目录")
        print("   2. 从当前数据库导出 schema")
        print("   3. 创建新的基线迁移文件")
        print("   4. 归档旧迁移文件" if not args.keep_old else "   4. 保留旧迁移文件")
        print("   5. 更新数据库版本标记")
        sys.exit(0)

    create_baseline(auto_confirm=args.auto, keep_old=args.keep_old)


if __name__ == '__main__':
    main()
