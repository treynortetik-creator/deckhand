"""Add errors table for error tracking.

Revision ID: 001_add_errors_table
Revises:
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_add_errors_table'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'errors',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('error_type', sa.String(length=255), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('traceback', sa.Text(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('request_body', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_errors_timestamp', 'errors', ['timestamp'], unique=False)
    op.create_index('ix_errors_resolved', 'errors', ['resolved'], unique=False)
    op.create_index('ix_errors_error_type', 'errors', ['error_type'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_errors_error_type', table_name='errors')
    op.drop_index('ix_errors_resolved', table_name='errors')
    op.drop_index('ix_errors_timestamp', table_name='errors')
    op.drop_table('errors')
