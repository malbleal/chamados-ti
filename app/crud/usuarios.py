# app/crud/usuarios.py
"""Operações de banco para usuários e solicitações de cadastro."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.modelos import SolicitacaoCadastro, Usuario
from app.schemas.cadastro import SolicitacaoCadastroEntrada


def buscar_usuario_por_matricula(sessao: Session, matricula: str) -> Usuario | None:
    """Localiza o usuário pela matrícula (identificador do sistema)."""
    return sessao.scalar(select(Usuario).where(Usuario.matricula == matricula))


def buscar_usuario_por_id(sessao: Session, usuario_id: int) -> Usuario | None:
    return sessao.get(Usuario, usuario_id)


def existe_solicitacao_pendente(sessao: Session, matricula: str) -> bool:
    """True se já há pedido de cadastro aguardando revisão dessa matrícula."""
    stmt = select(SolicitacaoCadastro).where(
        SolicitacaoCadastro.matricula == matricula,
        SolicitacaoCadastro.status == "pendente",
    )
    return sessao.scalar(stmt) is not None


def criar_solicitacao(
    sessao: Session, dados: SolicitacaoCadastroEntrada
) -> SolicitacaoCadastro:
    """Grava a solicitação. As regras de duplicidade ficam na rota."""
    nova = SolicitacaoCadastro(
        matricula=dados.matricula,
        nome=dados.nome,
        cargo=dados.cargo,
    )
    sessao.add(nova)
    sessao.commit()
    sessao.refresh(nova)
    return nova