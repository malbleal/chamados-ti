"""Schemas Pydantic para chamados."""
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


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
    unidade_id: int | None = None
    unidade_nome: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def incluir_unidade(cls, dados):
        """Preenche unidade_nome a partir do relacionamento, quando houver."""
        unidade = getattr(dados, "unidade", None)
        if unidade is None:
            return dados
        return {
            "id": dados.id,
            "usuario_id": dados.usuario_id,
            "titulo": dados.titulo,
            "descricao": dados.descricao,
            "categoria": dados.categoria,
            "status": dados.status,
            "criado_em": dados.criado_em,
            "fechado_em": dados.fechado_em,
            "unidade_id": dados.unidade_id,
            "unidade_nome": unidade.nome,
        }


class StatusEntrada(BaseModel):
    """Novo status enviado pelo admin."""
    novo_status: str