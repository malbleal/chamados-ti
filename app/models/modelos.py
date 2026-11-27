"""Models SQLAlchemy do sistema de chamados."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    cargo: Mapped[str] = mapped_column(String(120), nullable=False)
    # A senha deve ser armazenada somente como hash bcrypt.
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    aprovado_por: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    aprovado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chamados: Mapped[list["Chamado"]] = relationship(back_populates="usuario")
    solicitacoes_revisadas: Mapped[list["SolicitacaoCadastro"]] = relationship(
        back_populates="revisor",
        foreign_keys="SolicitacaoCadastro.revisada_por",
    )


class SolicitacaoCadastro(Base):
    __tablename__ = "solicitacoes_cadastro"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pendente', 'aprovada', 'recusada')",
            name="ck_solicitacoes_cadastro_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matricula: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    cargo: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pendente", nullable=False)
    solicitado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revisada_por: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    revisada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    revisor: Mapped[Usuario | None] = relationship(
        back_populates="solicitacoes_revisadas",
        foreign_keys=[revisada_por],
    )

class Unidade(Base):
    __tablename__ = "unidades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    ativa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chamados: Mapped[list["Chamado"]] = relationship(back_populates="unidade")

class Chamado(Base):
    __tablename__ = "chamados"
    __table_args__ = (
        CheckConstraint(
            "status IN ('aberto', 'em_atendimento', 'resolvido')",
            name="ck_chamados_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    categoria: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="aberto", nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fechado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    unidade_id: Mapped[int | None] = mapped_column(ForeignKey("unidades.id"), nullable=True, index=True)
    unidade: Mapped["Unidade | None"] = relationship(back_populates="chamados")

    usuario: Mapped[Usuario] = relationship(back_populates="chamados")
    mensagens: Mapped[list["ChamadoMensagem"]] = relationship(back_populates="chamado")
    eventos: Mapped[list["ChamadoEvento"]] = relationship(back_populates="chamado")


class ChamadoMensagem(Base):
    __tablename__ = "chamado_mensagens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chamado_id: Mapped[int] = mapped_column(ForeignKey("chamados.id"), nullable=False, index=True)
    autor_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chamado: Mapped[Chamado] = relationship(back_populates="mensagens")
    autor: Mapped[Usuario] = relationship()


class ChamadoEvento(Base):
    __tablename__ = "chamado_eventos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chamado_id: Mapped[int] = mapped_column(ForeignKey("chamados.id"), nullable=False, index=True)
    evento: Mapped[str] = mapped_column(String(100), nullable=False)
    ator_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chamado: Mapped[Chamado] = relationship(back_populates="eventos")
    ator: Mapped[Usuario] = relationship()


class Configuracao(Base):
    __tablename__ = "config"

    chave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[str] = mapped_column(Text, nullable=False)