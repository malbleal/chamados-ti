"""Schemas Pydantic para solicitação e revisão de cadastro."""
from pydantic import BaseModel, Field


class SolicitacaoCadastroEntrada(BaseModel):
    """Dados enviados pelo colaborador para pedir acesso."""
    matricula: str = Field(min_length=1, max_length=50)
    nome: str = Field(min_length=1, max_length=150)
    cargo: str = Field(min_length=1, max_length=120)


class SolicitacaoCadastroSaida(BaseModel):
    """Dados devolvidos ao consultar uma solicitação."""
    id: int
    matricula: str
    nome: str
    cargo: str
    status: str