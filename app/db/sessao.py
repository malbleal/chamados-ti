# app/db/sessao.py
"""Engine único da aplicação e sessões por requisição."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import configuracoes

# pool_pre_ping=True: testa a conexão antes de usar — importante com o
# pooler do Neon, que fecha conexões ociosas por conta própria
engine = create_engine(
    configuracoes.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessaoLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def obter_sessao() -> Generator[Session]:
    """Dependência do FastAPI: abre uma sessão e fecha ao fim da requisição."""
    sessao = SessaoLocal()
    try:
        yield sessao
    finally:
        sessao.close()