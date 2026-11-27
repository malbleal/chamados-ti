"""Funções de segurança para senhas."""
from passlib.hash import bcrypt

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import configuracoes

def hash_senha(senha: str) -> str:
    """Gera e retorna o hash bcrypt da senha."""
    if not senha:
        raise ValueError("A senha não pode ser vazia.")
    return bcrypt.hash(senha)


def verificar_senha(senha: str, hash_armazenado: str) -> bool:
    """Verifica se a senha corresponde ao hash armazenado."""
    return bcrypt.verify(senha, hash_armazenado)


######## JWT ########

TEMPO_EXPIRACAO_TOKEN_MINUTOS = 30
ALGORITMO_JWT = "HS256"


def criar_token_acesso(
    usuario_id: int,
    matricula: str,
    is_admin: bool,
    must_change_password: bool,
) -> str:
    """Cria um JWT de acesso com validade de 30 minutos."""
    agora = datetime.now(timezone.utc)

    payload = {
        "sub": str(usuario_id),
        "matricula": matricula,
        "is_admin": is_admin,
        "must_change_password": must_change_password,
        "iat": agora,
        "exp": agora + timedelta(minutes=TEMPO_EXPIRACAO_TOKEN_MINUTOS),
    }

    return jwt.encode(
        payload,
        configuracoes.secret_key,
        algorithm=ALGORITMO_JWT,
    )


def decodificar_token(token: str) -> dict[str, Any]:
    """Valida assinatura e validade do JWT e retorna suas informações."""
    return jwt.decode(
        token,
        configuracoes.secret_key,
        algorithms=[ALGORITMO_JWT],
        options={
            "require": [
                "sub",
                "matricula",
                "is_admin",
                "must_change_password",
                "iat",
                "exp",
            ]
        },
    )

######## Política de senha ########
 
def validar_nova_senha(senha: str, matricula: str) -> bool:
    """Aplica a política de senha. Levanta ValueError com o motivo se inválida."""
    if len(senha) < 8:
        raise ValueError("A senha deve ter no mínimo 8 caracteres.")
    if not any(c.isalpha() for c in senha):
        raise ValueError("A senha deve conter pelo menos 1 letra.")
    if matricula and matricula in senha:
        raise ValueError("A senha não pode conter a sua matrícula.")

    # Procura qualquer janela de 3 dígitos consecutivos em sequência
    # crescente (123, 456...) ou decrescente (987, 321...)
    for i in range(len(senha) - 2):
        a, b, c = senha[i], senha[i + 1], senha[i + 2]
        if a.isdigit() and b.isdigit() and c.isdigit():
            if ord(b) - ord(a) == 1 and ord(c) - ord(b) == 1:
                raise ValueError(
                    "A senha não pode conter 3 ou mais dígitos em sequência "
                    "crescente (ex.: 123)."
                )
            if ord(a) - ord(b) == 1 and ord(b) - ord(c) == 1:
                raise ValueError(
                    "A senha não pode conter 3 ou mais dígitos em sequência "
                    "decrescente (ex.: 987)."
                )
    return True


