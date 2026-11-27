"""Schemas Pydantic para mensagens de chamados."""
from datetime import datetime

from pydantic import BaseModel, Field


class MensagemEntrada(BaseModel):
    """Texto enviado ao chat de um chamado."""
    mensagem: str = Field(min_length=1)


class MensagemSaida(BaseModel):
    """Mensagem exibida no histórico do chamado."""
    id: int
    chamado_id: int
    autor_id: int
    mensagem: str
    criado_em: datetime

    model_config = {"from_attributes": True}