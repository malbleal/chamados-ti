# app/core/config.py
"""Configurações centrais: lê o .env e valida os tipos com Pydantic."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracoes(BaseSettings):
    """Cada atributo busca automaticamente a variável de mesmo nome no .env."""
    database_url: str
    secret_key: str
    default_password: str

    # extra="ignore": ignora as variáveis de SMTP/webhook por enquanto
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


configuracoes = Configuracoes()