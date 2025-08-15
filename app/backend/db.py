"""
Database connection and utilities
"""
import asyncpg
import os
from typing import Optional
import json

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

# Global connection pool
_pool: Optional[asyncpg.Pool] = None

async def init_db():
    """Initialize database connection pool"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            command_timeout=60
        )

async def get_db():
    """Get database connection from pool"""
    if _pool is None:
        await init_db()
    async with _pool.acquire() as connection:
        yield connection

async def execute_query(query: str, *args):
    """Execute a query and return results"""
    if _pool is None:
        await init_db()
    async with _pool.acquire() as connection:
        return await connection.fetch(query, *args)

async def execute_one(query: str, *args):
    """Execute a query and return single result"""
    if _pool is None:
        await init_db()
    async with _pool.acquire() as connection:
        return await connection.fetchrow(query, *args)

async def execute_transaction(queries: list):
    """Execute multiple queries in a transaction"""
    if _pool is None:
        await init_db()
    async with _pool.acquire() as connection:
        async with connection.transaction():
            results = []
            for query, args in queries:
                result = await connection.fetch(query, *args)
                results.append(result)
            return results


def get_db_pool():
    """Get the database connection pool"""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    return _pool