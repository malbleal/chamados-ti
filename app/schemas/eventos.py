"""Schemas Pydantic para eventos de chamados."""
from datetime import datetime

from pydantic import BaseModel


class EventoSaida(BaseModel):
    """Evento exibido no histórico de um chamado."""
    id: int
    chamado_id: int
    evento: str
    ator_id: int
    criado_em: datetime

    model_config = {"from_attributes": True}