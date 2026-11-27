# app/db/base.py
"""Base declarativa do SQLAlchemy 2.x — todos os models herdam daqui."""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass