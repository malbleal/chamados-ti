# app/routers/chamados.py
"""Rotas de chamados: abertura, listagem, detalhe, chat e status."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.servicos.notificacoes import notificar

from app.crud.chamados import (
    adicionar_mensagem,
    alterar_status,
    buscar_chamado_por_id,
    criar_chamado,
    listar_chamados_do_usuario,
    listar_eventos_do_chamado,
    listar_mensagens_do_chamado,
    listar_todos_chamados,
    registrar_evento,
)
from app.db.sessao import obter_sessao
from app.models.modelos import Chamado, ChamadoMensagem, Unidade ,Usuario
from app.routers.autenticacao import usuario_atual
from app.routers.cadastro import exigir_admin
from app.schemas.chamados import ChamadoEntrada, ChamadoSaida, StatusEntrada
from app.schemas.eventos import EventoSaida
from app.schemas.mensagens import MensagemEntrada, MensagemSaida

router = APIRouter(prefix="/chamados", tags=["Chamados"])


def obter_chamado_permitido(
    chamado_id: int, usuario: Usuario, sessao: Session
) -> Chamado:
    """Carrega o chamado e garante que só o dono ou um admin o acessem."""
    chamado = buscar_chamado_por_id(sessao, chamado_id)
    if chamado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chamado não encontrado."
        )
    if chamado.usuario_id != usuario.id and not usuario.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este chamado não pertence a você.",
        )
    return chamado


@router.post("", response_model=ChamadoSaida, status_code=status.HTTP_201_CREATED)
def abrir_chamado(
    dados: ChamadoEntrada,
    background_tasks: BackgroundTasks,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> Chamado:
    """Qualquer usuário ativo pode abrir um chamado, sempre com una unidade."""
    unidade = sessao.get(Unidade, dados.unidade_id)
    if unidade is None or not unidade.ativa:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unidade inválida ou inativa.",
        )
    chamado = criar_chamado(sessao, usuario.id, dados)
    chamado.unidade_id = dados.unidade_id
    sessao.commit()
    sessao.refresh(chamado)
    registrar_evento(sessao, chamado.id, "chamado_aberto", usuario.id)
    background_tasks.add_task(
        notificar,
        f"Novo chamado #{chamado.id}: {chamado.titulo}",
        f"Aberto por {usuario.nome} (matrícula {usuario.matricula}).\n"
        f"Categoria: {chamado.categoria}\nUnidade: {unidade.nome}\n"
        f"Descrição: {chamado.descricao}",
    )
    return chamado


@router.get("/meus", response_model=list[ChamadoSaida])
def meus_chamados(
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> list[Chamado]:
    return listar_chamados_do_usuario(sessao, usuario.id)


@router.get("/todos", response_model=list[ChamadoSaida])
def todos_chamados(
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> list[Chamado]:
    """Painel do admin: todos os chamados."""
    return listar_todos_chamados(sessao)


# Atenção: /meus e /todos vêm ANTES de /{chamado_id} para o FastAPI
# não interpretar "meus"/"todos" como id.


@router.get("/{chamado_id}")
def detalhar_chamado(
    chamado_id: int,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> dict:
    """Detalhe do chamado com o chat (mensagens) e o histórico (eventos)."""
    chamado = obter_chamado_permitido(chamado_id, usuario, sessao)
    return {
        "chamado": ChamadoSaida.model_validate(chamado),
        "mensagens": [
            MensagemSaida.model_validate(m)
            for m in listar_mensagens_do_chamado(sessao, chamado_id)
        ],
        "eventos": [
            EventoSaida.model_validate(e)
            for e in listar_eventos_do_chamado(sessao, chamado_id)
        ],
    }


@router.post("/{chamado_id}/mensagens", response_model=MensagemSaida)
def enviar_mensagem(
    chamado_id: int,
    dados: MensagemEntrada,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> ChamadoMensagem:
    """Chatbox do chamado: dono e admin conversam."""
    chamado = obter_chamado_permitido(chamado_id, usuario, sessao)
    if chamado.status == "fechado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chamado fechado não recebe novas mensagens.",
        )
    return adicionar_mensagem(sessao, chamado_id, usuario.id, dados.mensagem)


@router.post("/{chamado_id}/status", response_model=ChamadoSaida)
def mudar_status(
    chamado_id: int,
    dados: StatusEntrada,
    background_tasks: BackgroundTasks,
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> Chamado:
    """Admin muda o status; o CRUD grava o evento de auditoria."""
    chamado = buscar_chamado_por_id(sessao, chamado_id)
    if chamado is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chamado não encontrado."
        )
    status_antigo = chamado.status
    try:
        resultado = alterar_status(sessao, chamado, dados.novo_status, admin.id)
    except ValueError as erro:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(erro))
    background_tasks.add_task(
        notificar,
        f"Chamado #{chamado.id}: status alterado",
        f'"{chamado.titulo}" passou de "{status_antigo}" para "{resultado.status}" '
        f"por {admin.nome}.",
    )
    return resultado