# app/routers/cadastro.py
"""Rotas de cadastro: solicitação pública e revisão pelo admin."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import configuracoes
from app.core.seguranca import hash_senha
from app.crud.usuarios import (
    buscar_usuario_por_matricula,
    criar_solicitacao,
    existe_solicitacao_pendente,
)
from app.db.sessao import obter_sessao
from app.models.modelos import SolicitacaoCadastro, Usuario
from app.routers.autenticacao import usuario_atual
from app.schemas.cadastro import SolicitacaoCadastroEntrada, SolicitacaoCadastroSaida

router = APIRouter(prefix="/cadastro", tags=["Cadastro"])


def exigir_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    """Proteção extra: só deixa passar administrador."""
    if not usuario.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem fazer isso.",
        )
    return usuario


@router.post("/solicitacao", status_code=status.HTTP_201_CREATED)
def enviar_solicitacao(
    dados: SolicitacaoCadastroEntrada, sessao: Session = Depends(obter_sessao)
) -> dict:
    """Público: qualquer colaborador pode pedir acesso."""
    if buscar_usuario_por_matricula(sessao, dados.matricula) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com essa matrícula.",
        )
    if existe_solicitacao_pendente(sessao, dados.matricula):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma solicitação pendente para essa matrícula.",
        )
    solicitacao = criar_solicitacao(sessao, dados)
    return {"id": solicitacao.id, "status": solicitacao.status}


@router.get("/pendentes", response_model=list[SolicitacaoCadastroSaida])
def listar_pendentes(
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> list[SolicitacaoCadastro]:
    stmt = (
        select(SolicitacaoCadastro)
        .where(SolicitacaoCadastro.status == "pendente")
        .order_by(SolicitacaoCadastro.solicitado_em)
    )
    return list(sessao.scalars(stmt))


@router.post("/{solicitacao_id}/aprovar")
def aprovar(
    solicitacao_id: int,
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> dict:
    """Aprova e cria o usuário: ativo, com a senha padrão do .env e
    must_change_password=True para forçar a troca no primeiro login."""
    solicitacao = sessao.get(SolicitacaoCadastro, solicitacao_id)
    if solicitacao is None or solicitacao.status != "pendente":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada ou já revisada.",
        )
    if buscar_usuario_por_matricula(sessao, solicitacao.matricula) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com essa matrícula.",
        )

    agora = datetime.now(timezone.utc)
    novo_usuario = Usuario(
        matricula=solicitacao.matricula,
        nome=solicitacao.nome,
        cargo=solicitacao.cargo,
        senha_hash=hash_senha(configuracoes.default_password),
        is_admin=False,
        must_change_password=True,
        is_active=True,
        aprovado_por=admin.id,
        aprovado_em=agora,
    )
    solicitacao.status = "aprovada"
    solicitacao.revisada_por = admin.id
    solicitacao.revisada_em = agora
    sessao.add(novo_usuario)
    sessao.commit()
    return {"mensagem": f"Cadastro aprovado para {novo_usuario.nome}."}


@router.post("/{solicitacao_id}/recusar")
def recusar(
    solicitacao_id: int,
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> dict:
    """Recusa a solicitação pendente."""
    solicitacao = sessao.get(SolicitacaoCadastro, solicitacao_id)
    if solicitacao is None or solicitacao.status != "pendente":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitação não encontrada ou já revisada.",
        )
    solicitacao.status = "recusada"
    solicitacao.revisada_por = admin.id
    solicitacao.revisada_em = datetime.now(timezone.utc)
    sessao.commit()
    return {"mensagem": "Solicitação recusada."}