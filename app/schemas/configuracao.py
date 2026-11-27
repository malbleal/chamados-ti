"""Schemas Pydantic para a configuração (tabela chave -> valor)."""
from pydantic import BaseModel, Field


class ConfiguracaoAtualizacaoEntrada(BaseModel):
    """Pares chave -> valor a gravar na tabela config."""
    valores: dict[str, str] = Field(min_length=1)


class ConfiguracaoItemSaida(BaseModel):
    """Uma linha da tabela config."""
    chave: str
    valor: str

    model_config = {"from_attributes": True}