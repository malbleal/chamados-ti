# PWA de Chamados de TI

Aplicação web progressiva (PWA) para abertura e acompanhamento de chamados de TI,
com **matrícula como identificador de login** — sem depender de e-mail corporativo.
Desenvolvida para uso em rede local, com backend FastAPI e banco PostgreSQL (Neon).

## Funcionalidades

- Login por matrícula e senha, com autenticação JWT
- Abertura de chamados com unidade obrigatória
- Acompanhamento de chamados com histórico de mensagens e eventos
- Painel administrativo: gestão de usuários, unidades e configurações
- Métricas mensais de chamados abertos e resolvidos (filtro por ano)
- Notificações de novos chamados e mensagens
- PWA instalável (manifest + service worker com cache offline dos estáticos)

## Stack

- **Backend:** Python + FastAPI
- **Banco de dados:** PostgreSQL (Neon) com SQLAlchemy e migrações via Alembic
- **Configuração:** pydantic-settings (`.env`)
- **Frontend:** HTML/CSS/JS servidos pelo próprio FastAPI (`/static`)

## Estrutura do projeto

```
app/
├── core/       # Configurações (.env) e segurança (hash de senha, JWT)
├── crud/       # Operações de banco (chamados, usuários, unidades, configuração)
├── db/         # Sessão e base do SQLAlchemy
├── models/     # Modelos ORM
├── routers/    # Rotas da API (autenticação, cadastro, chamados, admin, unidades)
├── schemas/    # Schemas Pydantic de entrada/saída
├── servicos/   # Serviços (notificações)
└── static/     # Frontend do PWA (HTML, CSS, JS, manifest, service worker)
migrations/     # Migrações Alembic
main.py         # Aplicação FastAPI principal
```

## Como rodar

1. Clone o repositório e entre na pasta:

   ```bash
   git clone https://github.com/malbleal/chamados-ti.git
   cd chamados-ti
   ```

2. Crie e ative um ambiente virtual:

   ```bash
   python -m venv .venv
   .venv\Scripts\activate        # Windows
   # source .venv/bin/activate   # Linux/Mac
   ```

3. Instale as dependências:

   ```bash
   pip install -r requirements.txt
   ```

4. Crie um arquivo `.env` na raiz com as variáveis abaixo (não versionado):

   ```env
   DATABASE_URL=postgresql+psycopg://usuario:senha@host/banco
   SECRET_KEY=uma-chave-secreta-forte
   DEFAULT_PASSWORD=senha-padrao-de-novos-usuarios
   ```

5. Aplique as migrações do banco:

   ```bash
   alembic upgrade head
   ```

6. Inicie o servidor:

   ```bash
   uvicorn main:app --reload
   ```

   A API responde em `http://localhost:8000` e o PWA é servido em
   `http://localhost:8000/static/index.html`.

## Segurança

O arquivo `.env` (credenciais do banco e chaves) não é versionado — veja o
`.gitignore`. Para novos ambientes, sempre crie o `.env` manualmente.