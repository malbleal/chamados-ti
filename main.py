# main.py
"""Aplicação FastAPI principal do PWA de Chamados de TI."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from app.routers import admin, autenticacao, cadastro, chamados, unidades

app = FastAPI(
    title="PWA de Chamados de TI",
    version="0.1.0",
    description="Chamados de TI com matrícula como identificador, sem e-mail corporativo.",
)

# Liberado só para origens de desenvolvimento. Quando o PWA for servido
# pelo próprio FastAPI (Etapa 7), essa lista pode ser restringida.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(autenticacao.router)
app.include_router(cadastro.router)
app.include_router(chamados.router)
app.include_router(admin.router)
app.include_router(unidades.router)


# Etapa 6.5 — serve os arquivos do PWA (HTML/CSS/JS) pelo próprio FastAPI.
# BASE_DIR amarra o caminho à raiz do projeto, independente de onde o
# uvicorn for executado.
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "app" / "static"), name="static")

@app.get("/")
def raiz() -> dict:
    return {"status": "ok", "servico": "PWA de Chamados de TI"}