"""Schemas Pydantic para unidades."""
from datetime import datetime

from pydantic import BaseModel, Field


class UnidadeCriacaoEntrada(BaseModel):
    """Dados para criar uma unidade."""
    nome: str = Field(min_length=1, max_length=120)


class UnidadeAtualizacaoEntrada(BaseModel):
    """Campos opcionais para renomear e/ou ligar/desligar."""
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    ativa: bool | None = None


class UnidadeSaida(BaseModel):
    """Uma unidade cadastrada."""
    id: int
    nome: str
    ativa: bool
    criado_em: datetime

    model_config = {"from_attributes": True}