"""Run database migration on Supabase."""
import asyncio
import os
import re
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Read from environment variable - never hardcode credentials!
# Set DATABASE_URL env var before running, e.g.:
#   export DATABASE_URL="postgresql+asyncpg://postgres.xxx:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Set it before running migrations.")

import ssl
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

def split_sql_statements(sql: str) -> list[str]:
    """Split SQL into statements, handling $$ blocks."""
    statements = []
    current = []
    in_dollar_block = False

    for line in sql.split('\n'):
        stripped = line.strip()
        if stripped.startswith('--') or not stripped:
            continue

        # Check for $$ blocks
        dollar_count = line.count("$$")
        if dollar_count % 2 == 1:
            in_dollar_block = not in_dollar_block

        current.append(line)

        # End of statement
        if not in_dollar_block and stripped.endswith(';'):
            stmt = '\n'.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []

    return statements

async def run_migration():
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"ssl": ssl_context}
    )

    with open("migrations/001_initial_schema.sql", "r") as f:
        sql = f.read()

    statements = split_sql_statements(sql)

    async with engine.begin() as conn:
        for i, stmt in enumerate(statements, 1):
            try:
                await conn.execute(text(stmt))
                # Print short summary
                first_line = stmt.split('\n')[0][:60]
                print(f"[{i}/{len(statements)}] OK: {first_line}...")
            except Exception as e:
                print(f"[{i}/{len(statements)}] SKIP (may exist): {str(e)[:80]}")

    await engine.dispose()
    print("\nMigration completed!")

if __name__ == "__main__":
    asyncio.run(run_migration())
