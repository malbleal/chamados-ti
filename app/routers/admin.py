# app/routers/admin.py
"""Rotas administrativas: configuração (chave -> valor) e gestão de usuários."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.configuracao import definir_valor, listar_configuracoes
from app.db.sessao import obter_sessao
from app.models.modelos import Usuario
from app.routers.cadastro import exigir_admin
from app.schemas.configuracao import (
    ConfiguracaoAtualizacaoEntrada,
    ConfiguracaoItemSaida,
)

# Toda rota deste router exige admin (que por si só já exige JWT válido)
router = APIRouter(
    prefix="/admin", tags=["Administração"], dependencies=[Depends(exigir_admin)]
)


@router.get("/config", response_model=list[ConfiguracaoItemSaida])
def ver_configuracao(sessao: Session = Depends(obter_sessao)) -> list:
    """Lista todos os pares chave -> valor gravados."""
    return listar_configuracoes(sessao)


@router.put("/config")
def gravar_configuracao(
    dados: ConfiguracaoAtualizacaoEntrada,
    sessao: Session = Depends(obter_sessao),
) -> dict:
    """Cria/atualiza um ou vários valores de uma vez; recusa chaves proibidas."""
    gravadas = []
    for chave, valor in dados.valores.items():
        try:
            item = definir_valor(sessao, chave, valor)
        except ValueError as erro:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=str(erro)
            )
        gravadas.append(item.chave)
    return {"mensagem": f"Configurações gravadas: {', '.join(gravadas)}."}


@router.post("/usuarios/{usuario_id}/promover")
def promover_admin(
    usuario_id: int,
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> dict:
    """Concede is_admin a um usuário ativo."""
    alvo = sessao.get(Usuario, usuario_id)
    if alvo is None or not alvo.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado ou inativo.",
        )
    if alvo.is_admin:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esse usuário já é administrador.",
        )
    alvo.is_admin = True
    sessao.commit()
    return {"mensagem": f"{alvo.nome} agora é administrador."}

    #####

# ---- Passo C: métricas mensais (abertos e resolvidos por mês) ----
from fastapi import APIRouter, Depends  # noqa: E402
from sqlalchemy import func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from app.db.sessao import obter_sessao  # noqa: E402
from app.models.modelos import Chamado, ChamadoEvento, Usuario  # noqa: E402
from app.routers.cadastro import exigir_admin  # noqa: E402


@router.get("/metricas")
def metricas_mensais(
    admin: Usuario = Depends(exigir_admin),
    sessao: Session = Depends(obter_sessao),
) -> list[dict]:
    """Conta aberturas e resoluções por mês, usando as datas dos registros."""
    ano_abertura = func.extract("year", Chamado.criado_em)
    mes_abertura = func.extract("month", Chamado.criado_em)

    consulta_abertos = (
        select(
            ano_abertura.label("ano"),
            mes_abertura.label("numero_mes"),
            func.count(Chamado.id).label("total"),
        )
        .group_by(ano_abertura, mes_abertura)
    )

    ano_resolucao = func.extract("year", ChamadoEvento.criado_em)
    mes_resolucao = func.extract("month", ChamadoEvento.criado_em)

    consulta_resolvidos = (
        select(
            ano_resolucao.label("ano"),
            mes_resolucao.label("numero_mes"),
            func.count(ChamadoEvento.id).label("total"),
        )
        .where(ChamadoEvento.evento == "status_resolvido")
        .group_by(ano_resolucao, mes_resolucao)
    )

    totais: dict[tuple[int, int], dict] = {}

    for ano, mes, total in sessao.execute(consulta_abertos):
        chave = (int(ano), int(mes))
        totais[chave] = {
            "mes": f"{chave[0]:04d}-{chave[1]:02d}",
            "abertos": int(total),
            "resolvidos": 0,
        }

    for ano, mes, total in sessao.execute(consulta_resolvidos):
        chave = (int(ano), int(mes))
        if chave not in totais:
            totais[chave] = {
                "mes": f"{chave[0]:04d}-{chave[1]:02d}",
                "abertos": 0,
                "resolvidos": 0,
            }
        totais[chave]["resolvidos"] = int(total)

    return [totais[chave] for chave in sorted(totais)]