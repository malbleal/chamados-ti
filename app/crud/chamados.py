# app/crud/chamados.py
"""Operações de banco para chamados, mensagens e eventos."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.modelos import Chamado, ChamadoEvento, ChamadoMensagem
from app.schemas.chamados import ChamadoEntrada

STATUS_VALIDOS = ("aberto", "em_atendimento", "resolvido")


def buscar_chamado_por_id(sessao: Session, chamado_id: int) -> Chamado | None:
    return sessao.get(Chamado, chamado_id)


def listar_chamados_do_usuario(sessao: Session, usuario_id: int) -> list[Chamado]:
    stmt = (
        select(Chamado)
        .where(Chamado.usuario_id == usuario_id)
        .order_by(Chamado.criado_em.desc())
    )
    return list(sessao.scalars(stmt))


def listar_todos_chamados(sessao: Session) -> list[Chamado]:
    """Para o painel do admin."""
    stmt = select(Chamado).order_by(Chamado.criado_em.desc())
    return list(sessao.scalars(stmt))


def criar_chamado(
    sessao: Session, usuario_id: int, dados: ChamadoEntrada
) -> Chamado:
    novo = Chamado(
        usuario_id=usuario_id,
        titulo=dados.titulo,
        descricao=dados.descricao,
        categoria=dados.categoria,
    )
    sessao.add(novo)
    sessao.commit()
    sessao.refresh(novo)
    return novo


def alterar_status(
    sessao: Session, chamado: Chamado, novo_status: str, ator_id: int
) -> Chamado:
    """Troca o status e registra o evento de auditoria (métricas derivam daqui)."""
    if novo_status not in STATUS_VALIDOS:
        raise ValueError(f"Status inválido: {novo_status}")
    chamado.status = novo_status
    if novo_status == "resolvido":
        chamado.fechado_em = datetime.now(timezone.utc)
    else:
        chamado.fechado_em = None
    registrar_evento(sessao, chamado.id, f"status_{novo_status}", ator_id)
    sessao.commit()
    sessao.refresh(chamado)
    return chamado


def listar_mensagens_do_chamado(
    sessao: Session, chamado_id: int
) -> list[ChamadoMensagem]:
    stmt = (
        select(ChamadoMensagem)
        .where(ChamadoMensagem.chamado_id == chamado_id)
        .order_by(ChamadoMensagem.criado_em)
    )
    return list(sessao.scalars(stmt))


def adicionar_mensagem(
    sessao: Session, chamado_id: int, autor_id: int, mensagem: str
) -> ChamadoMensagem:
    nova = ChamadoMensagem(
        chamado_id=chamado_id, autor_id=autor_id, mensagem=mensagem
    )
    sessao.add(nova)
    sessao.commit()
    sessao.refresh(nova)
    return nova


def listar_eventos_do_chamado(sessao: Session, chamado_id: int) -> list[ChamadoEvento]:
    stmt = (
        select(ChamadoEvento)
        .where(ChamadoEvento.chamado_id == chamado_id)
        .order_by(ChamadoEvento.criado_em)
    )
    return list(sessao.scalars(stmt))


def registrar_evento(
    sessao: Session, chamado_id: int, evento: str, ator_id: int
) -> ChamadoEvento:
    novo = ChamadoEvento(chamado_id=chamado_id, evento=evento, ator_id=ator_id)
    sessao.add(novo)
    sessao.commit()
    sessao.refresh(novo)
    return novo