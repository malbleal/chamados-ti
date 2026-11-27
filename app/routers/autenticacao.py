# app/routers/autenticacao.py
"""Rotas de autenticação: login e troca obrigatória de senha."""
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sqlalchemy.orm import Session

from app.core.seguranca import (
    criar_token_acesso,
    decodificar_token,
    hash_senha,
    validar_nova_senha,
    verificar_senha,
)
from app.crud.usuarios import buscar_usuario_por_matricula
from app.db.sessao import obter_sessao
from app.models.modelos import Usuario
from app.schemas.autenticacao import LoginEntrada, TrocaSenhaEntrada

oauth2_esquema = HTTPBearer()

router = APIRouter(prefix="/auth", tags=["Autenticação"])


@router.post("/login")
def login(dados: LoginEntrada, sessao: Session = Depends(obter_sessao)) -> dict:
    """Autentica pela matrícula e devolve o JWT."""
    usuario = buscar_usuario_por_matricula(sessao, dados.matricula)
    if usuario is None or not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Matrícula ou senha incorretos.",
        )
    if not usuario.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cadastro ainda não ativado pelo admin de TI.",
        )
    token = criar_token_acesso(
        usuario.id, usuario.matricula, usuario.is_admin, usuario.must_change_password
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_admin": usuario.is_admin,
        "must_change_password": usuario.must_change_password,
    }


#def usuario_atual(
#    token: str = Depends(oauth2_esquema), sessao: Session = Depends(obter_sessao)
#) -> Usuario:
#    """Dependência de proteção: exige JWT válido e usuário ativo."""
#    try:
#        payload = decodificar_token(token)
#    except jwt.InvalidTokenError:
#        raise HTTPException(
#            status_code=status.HTTP_401_UNAUTHORIZED,
#            detail="Sessão inválida ou expirada; entre novamente.",
#        )
#    usuario = buscar_usuario_por_matricula(sessao, payload["matricula"])
#    if usuario is None or not usuario.is_active:
#        raise HTTPException(
#            status_code=status.HTTP_401_UNAUTHORIZED,
#            detail="Usuário não encontrado ou inativo.",
#        )
#    return usuario

def usuario_atual(
    credenciais: HTTPAuthorizationCredentials = Depends(oauth2_esquema),
    sessao: Session = Depends(obter_sessao),
) -> Usuario:
    token = credenciais.credentials
    try:
        payload = decodificar_token(token)
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessao invalida ou expirada; entre novamente.",
        )
    usuario = buscar_usuario_por_matricula(sessao, payload["matricula"])
    if usuario is None or not usuario.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario nao encontrado ou inativo.",
        )
    return usuario

@router.post("/trocar-senha")
def trocar_senha(
    dados: TrocaSenhaEntrada,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> dict:
    """Troca a senha (obrigatória no primeiro acesso) e libera o usuário."""
    try:
        validar_nova_senha(dados.nova_senha, usuario.matricula)
    except ValueError as erro:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(erro)
        )
    usuario.senha_hash = hash_senha(dados.nova_senha)
    usuario.must_change_password = False
    sessao.commit()
    return {"mensagem": "Senha alterada com sucesso. Faça login novamente."}