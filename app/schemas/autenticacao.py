"""Schemas Pydantic para entrada de autenticação."""
from pydantic import BaseModel, Field


class LoginEntrada(BaseModel):
    """Dados enviados para entrar no sistema."""
    matricula: str = Field(min_length=1, max_length=50)
    senha: str = Field(min_length=1)


class TrocaSenhaEntrada(BaseModel):
    """Nova senha enviada na troca obrigatória."""
    nova_senha: str = Field(min_length=1)