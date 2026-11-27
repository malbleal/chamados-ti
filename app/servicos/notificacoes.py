# app/servicos/notificacoes.py
"""Notificações SMTP e webhook, controladas pela tabela config."""
import logging
import smtplib
from email.message import EmailMessage

import requests
from sqlalchemy.orm import Session

from app.crud.configuracao import obter_valor
from app.db.sessao import SessaoLocal

logger = logging.getLogger("notificacoes")


def notificar(assunto: str, texto: str) -> None:
    """Ponto de entrada: envia o que estiver ligado na config, nunca levanta
    exceção — falha de notificação não pode derrubar a requisição."""
    with SessaoLocal() as sessao:
        if obter_valor(sessao, "smtp_ativo") == "true":
            _enviar_email(sessao, assunto, texto)
        if obter_valor(sessao, "webhook_ativo") == "true":
            _enviar_webhook(sessao, assunto, texto)


def _enviar_email(sessao: Session, assunto: str, texto: str) -> None:
    """Envia por SMTP com STARTTLS (porta 587 nos provedores comuns)."""
    try:
        host = obter_valor(sessao, "smtp_host")
        porta = obter_valor(sessao, "smtp_porta")
        usuario = obter_valor(sessao, "smtp_usuario")
        senha = obter_valor(sessao, "smtp_senha")
        destinatario = obter_valor(sessao, "smtp_destinatario")
        if not all([host, porta, usuario, senha, destinatario]):
            logger.warning(
                "SMTP ativo, mas há chaves faltando na config; e-mail não enviado."
            )
            return
        mensagem = EmailMessage()
        mensagem["Subject"] = assunto
        mensagem["From"] = usuario
        mensagem["To"] = destinatario
        mensagem.set_content(texto)
        with smtplib.SMTP(host, int(porta), timeout=15) as smtp:
            smtp.starttls()
            smtp.login(usuario, senha)
            smtp.send_message(mensagem)
        logger.info("E-mail enviado: %s", assunto)
    except Exception:
        logger.exception("Falha ao enviar e-mail; a requisição segue normalmente.")


def _enviar_webhook(sessao: Session, assunto: str, texto: str) -> None:
    """Payload {'text': ...} funciona no Slack e em fluxos do Teams."""
    try:
        url = obter_valor(sessao, "webhook_url")
        if not url:
            logger.warning("Webhook ativo, mas webhook_url vazia na config.")
            return
        resposta = requests.post(url, json={"text": f"{assunto}\n{texto}"}, timeout=15)
        resposta.raise_for_status()
        logger.info("Webhook disparado: %s", assunto)
    except Exception:
        logger.exception("Falha no webhook; a requisição segue normalmente.")