"""Schemas Pydantic para mensagens de chamados."""
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class MensagemEntrada(BaseModel):
    """Texto enviado ao chat de um chamado."""
    mensagem: str = Field(min_length=1)


class MensagemSaida(BaseModel):
    """Mensagem exibida no histórico do chamado."""
    id: int
    chamado_id: int
    autor_id: int
    autor_nome: str | None = None
    mensagem: str
    criado_em: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def incluir_nome_autor(cls, dados):
        """Preenche autor_nome a partir do relacionamento, quando houver."""
        autor = getattr(dados, "autor", None)
        if autor is None:
            return dados
        return {
            "id": dados.id,
            "chamado_id": dados.chamado_id,
            "autor_id": dados.autor_id,
            "autor_nome": autor.nome,
            "mensagem": dados.mensagem,
            "criado_em": dados.criado_em,
        }