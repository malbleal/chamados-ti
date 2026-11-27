"""converte status fechado em resolvido

Revision ID: 91bb3517c07d
Revises: 259ef3059f98
Create Date: 2026-11-26 10:09:22.131967

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '91bb3517c07d'
down_revision: Union[str, Sequence[str], None] = '259ef3059f98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE chamados SET status = 'resolvido' WHERE status = 'fechado'")
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
