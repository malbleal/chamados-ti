"""Schemas Pydantic para chamados."""
from datetime import datetime

from pydantic import BaseModel, Field


class ChamadoEntrada(BaseModel):
    """Dados enviados para abrir um chamado."""
    titulo: str = Field(min_length=1, max_length=200)
    descricao: str = Field(min_length=1)
    categoria: str = Field(min_length=1, max_length=100)
    unidade_id: int
    
class ChamadoSaida(BaseModel):
    """Dados exibidos de um chamado."""
    id: int
    usuario_id: int
    titulo: str
    descricao: str
    categoria: str
    status: str
    criado_em: datetime
    fechado_em: datetime | None = None

    model_config = {"from_attributes": True}

class StatusEntrada(BaseModel):
    """Novo status enviado pelo admin."""
    novo_status: str