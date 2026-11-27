# app/routers/unidades.py
"""Rotas de unidades: leitura para qualquer usuário, gestão restrita ao admin."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud.unidades import (
    atualizar_unidade,
    buscar_unidade_por_id,
    criar_unidade,
    existe_unidade_com_nome,
    listar_unidades,
)
from app.db.sessao import obter_sessao
from app.models.modelos import Usuario
from app.routers.autenticacao import usuario_atual
from app.routers.cadastro import exigir_admin
from app.schemas.unidade import (
    UnidadeAtualizacaoEntrada,
    UnidadeCriacaoEntrada,
    UnidadeSaida,
)

router = APIRouter(prefix="/unidades", tags=["Unidades"])


@router.get("", response_model=list[UnidadeSaida])
def listar_ativas(
    _: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> list:
    """Lista as unidades ativas (para o formulário de novo chamado)."""
    return listar_unidades(sessao)


@router.get("/admin", response_model=list[UnidadeSaida])
def listar_todas(
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> list:
    """Lista todas as unidades, inclusive inativas (visão do admin)."""
    return listar_unidades(sessao, incluir_inativas=True)


@router.post("", response_model=UnidadeSaida, status_code=status.HTTP_201_CREATED)
def criar(
    dados: UnidadeCriacaoEntrada,
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
):
    """Cria uma unidade (nome único)."""
    if existe_unidade_com_nome(sessao, dados.nome):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma unidade com esse nome.",
        )
    return criar_unidade(sessao, dados)


##########
@router.get("", response_model=list[UnidadeSaida])
def listar_unidades_ativas(
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> list:
    """Unidades ativas, para o formulário de novo chamado (qualquer logado)."""
    return (
        sessao.execute(
            select(Unidade).where(Unidade.ativa.is_(True)).order_by(Unidade.nome)
        )
        .scalars()
        .all()
    )
##########

@router.put("/{unidade_id}", response_model=UnidadeSaida)
def atualizar(
    unidade_id: int,
    dados: UnidadeAtualizacaoEntrada,
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
):
    """Renomeia e/ou ativa/desativa uma unidade."""
    unidade = buscar_unidade_por_id(sessao, unidade_id)
    if unidade is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unidade não encontrada.",
        )
    if (
        dados.nome is not None
        and dados.nome != unidade.nome
        and existe_unidade_com_nome(sessao, dados.nome)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma unidade com esse nome.",
        )
    return atualizar_unidade(sessao, unidade, dados)