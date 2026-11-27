"""cria tabela unidades

Revision ID: c991fa303ad3
Revises: 91bb3517c07d
Create Date: 2026-11-26 17:25:00.827195

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c991fa303ad3'
down_revision: Union[str, Sequence[str], None] = '91bb3517c07d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) Tabela de unidades
    op.create_table(
        "unidades",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("ativa", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nome", name="uq_unidades_nome"),
    )

    # 2) Chamados passam a referenciar a unidade.
    #    Fica nulo para os chamados antigos; a exigência vale para novos chamados.
    op.add_column("chamados", sa.Column("unidade_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_chamados_unidade_id", "chamados", "unidades",
        ["unidade_id"], ["id"],
    )
    op.create_index("ix_chamados_unidade_id", "chamados", ["unidade_id"])

    # 3) Alinha a constraint de status: 'fechado' saiu do fluxo (virou 'resolvido')
    op.drop_constraint("ck_chamados_status", "chamados", type_="check")
    op.create_check_constraint(
        "ck_chamados_status",
        "chamados",
        "status IN ('aberto', 'em_atendimento', 'resolvido')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_chamados_status", "chamados", type_="check")
    op.create_check_constraint(
        "ck_chamados_status",
        "chamados",
        "status IN ('aberto', 'em_atendimento', 'resolvido', 'fechado')",
    )
    op.drop_index("ix_chamados_unidade_id", table_name="chamados")
    op.drop_constraint("fk_chamados_unidade_id", "chamados", type_="foreignkey")
    op.drop_column("chamados", "unidade_id")
    op.drop_table("unidades")