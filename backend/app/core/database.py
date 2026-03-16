# backend/app/core/database.py
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import time
import logging
import re

from app.core.config import settings

logger = logging.getLogger(__name__)

SENSITIVE_PATTERNS = [
    (r'\bpassword\s*=\s*[^\s,)]+', 'password=***'),
    (r'\btoken\s*=\s*[^\s,)]+', 'token=***'),
    (r'\bkey\s*=\s*[^\s,)]+', 'key=***'),
    (r'\bsecret\s*=\s*[^\s,)]+', 'secret=***'),
    (r'\bapi_key\s*=\s*[^\s,)]+', 'api_key=***'),
    (r'\baccess_token\s*=\s*[^\s,)]+', 'access_token=***'),
    (r'\brefresh_token\s*=\s*[^\s,)]+', 'refresh_token=***'),
    (r"'[^']*password[^']*'\s*:\s*'[^']*'", "'password': '***'"),
    (r"'[^']*token[^']*'\s*:\s*'[^']*'", "'token': '***'"),
]


def sanitize_sql(statement: str) -> str:
    for pattern, replacement in SENSITIVE_PATTERNS:
        statement = re.sub(pattern, replacement, statement, flags=re.IGNORECASE)
    return statement


engine = create_engine(
    settings.DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=settings.DATABASE_ECHO
)

@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.time()
    sanitized = sanitize_sql(statement)
    logger.debug(f"SQL: {sanitized[:100]}..." if len(sanitized) > 100 else f"SQL: {sanitized}")

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total_time = time.time() - context._query_start_time
    if total_time > 0.1:
        sanitized = sanitize_sql(statement)
        logger.warning(f"Slow query ({total_time*1000:.2f}ms): {sanitized[:200]}")
    else:
        logger.debug(f"Query executed in {total_time*1000:.2f}ms")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
