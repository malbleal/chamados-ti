# app/crud/unidades.py
"""Operações de banco para unidades."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.modelos import Unidade
from app.schemas.unidade import UnidadeAtualizacaoEntrada, UnidadeCriacaoEntrada


def listar_unidades(sessao: Session, incluir_inativas: bool = False) -> list[Unidade]:
    """Lista unidades por nome; por padrão só as ativas."""
    stmt = select(Unidade).order_by(Unidade.nome)
    if not incluir_inativas:
        stmt = stmt.where(Unidade.ativa.is_(True))
    return list(sessao.scalars(stmt))


def buscar_unidade_por_id(sessao: Session, unidade_id: int) -> Unidade | None:
    return sessao.get(Unidade, unidade_id)


def existe_unidade_com_nome(sessao: Session, nome: str) -> bool:
    stmt = select(Unidade).where(Unidade.nome == nome)
    return sessao.scalar(stmt) is not None


def criar_unidade(sessao: Session, dados: UnidadeCriacaoEntrada) -> Unidade:
    """Grava a unidade. A regra de nome repetido fica na rota."""
    nova = Unidade(nome=dados.nome)
    sessao.add(nova)
    sessao.commit()
    sessao.refresh(nova)
    return nova


def atualizar_unidade(
    sessao: Session, unidade: Unidade, dados: UnidadeAtualizacaoEntrada
) -> Unidade:
    """Renomeia e/ou liga/desliga. A regra de nome repetido fica na rota."""
    if dados.nome is not None:
        unidade.nome = dados.nome
    if dados.ativa is not None:
        unidade.ativa = dados.ativa
    sessao.commit()
    sessao.refresh(unidade)
    return unidade