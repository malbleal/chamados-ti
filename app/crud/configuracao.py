# app/crud/configuracao.py
"""Operações de banco para a tabela config (chave -> valor)."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.modelos import Configuracao

# Chaves reconhecidas pelo sistema — a Etapa 6 as usa para SMTP/webhook
CHAVES_PERMITIDAS = {
    "smtp_ativo",
    "smtp_host",
    "smtp_porta",
    "smtp_usuario",
    "smtp_senha",
    "smtp_destinatario",
    "webhook_ativo",
    "webhook_url",
}


def listar_configuracoes(sessao: Session) -> list[Configuracao]:
    stmt = select(Configuracao).order_by(Configuracao.chave)
    return list(sessao.scalars(stmt))


def obter_valor(sessao: Session, chave: str) -> str | None:
    item = sessao.get(Configuracao, chave)
    return item.valor if item else None


def definir_valor(sessao: Session, chave: str, valor: str) -> Configuracao:
    """Cria ou atualiza; recusa chaves fora da lista permitida."""
    if chave not in CHAVES_PERMITIDAS:
        raise ValueError(f"Chave de configuração não permitida: {chave}")
    item = sessao.get(Configuracao, chave)
    if item is None:
        item = Configuracao(chave=chave, valor=valor)
        sessao.add(item)
    else:
        item.valor = valor
    sessao.commit()
    sessao.refresh(item)
    return item