"use strict";

// ---- Service worker (PWA) ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js");
}

// ---- Utilidades ----
function salvarSessao(resposta, matricula) {
  localStorage.setItem("token", resposta.access_token);
  localStorage.setItem("isAdmin", resposta.is_admin ? "1" : "0");
  // Guardamos a matricula para a regra "a senha nao pode conter a matricula"
  if (matricula) localStorage.setItem("matricula", matricula);
}

function esquecerSessao() {
  localStorage.removeItem("token");
  localStorage.removeItem("isAdmin");
  localStorage.removeItem("matricula");
}

function mostrarMsg(texto, tipo) {
  const p = document.getElementById("msg");
  if (!p) return;
  p.textContent = texto;
  p.className = "msg " + (tipo || "");
}

function esc(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cabecalhoAuth() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("token"),
  };
}

// ---- Estado global do chat aberto (uma tela por pagina) ----
let chamadoAbertoId = null;   // tela do usuario
let chamadoAdminId = null;    // painel do admin
let chatAssinatura = "";      // conteudo atual do chat, para so re-renderizar se mudar

// ---- Navegação centralizada: mostra UMA seção e esconde todas as outras ----
function mostrarSecao(secaoAlvo) {
  const secoes = document.querySelectorAll(
    "main.lista, #secao-historico, #secao-detalhe, " +
      "#secao-historico-admin, #secao-unidades-admin, " +
      "#secao-solicitacoes-admin, #secao-usuarios-admin, #secao-detalhe-admin"
  );
  for (const secao of secoes) secao.classList.add("oculto");
  if (secaoAlvo) secaoAlvo.classList.remove("oculto");
  window.scrollTo(0, 0);
}

function irParaPrincipal() {
  mostrarSecao(document.querySelector("main.lista"));
  chamadoAbertoId = null;
  chamadoAdminId = null;
  chatAssinatura = "";
}

// ---- Renderização do chat (compartilhada entre as duas telas) ----
function renderizarMensagensEm(containerId, mensagens) {
  const divMsgs = document.getElementById(containerId);
  if (!divMsgs) return;
  divMsgs.textContent = "";
  if (!mensagens.length) {
    const p = document.createElement("p");
    p.textContent = "Sem mensagens ainda.";
    divMsgs.appendChild(p);
    return;
  }
  for (const m of mensagens) {
    const div = document.createElement("div");
    div.className = "mensagem";
    const autor = document.createElement("strong");
    autor.textContent = m.autor_nome || "Usuario " + m.autor_id;
    div.appendChild(autor);
    div.appendChild(document.createTextNode(" — " + m.mensagem));
    divMsgs.appendChild(div);
  }
}

function renderizarEventosEm(containerId, eventos) {
  const divEv = document.getElementById(containerId);
  if (!divEv) return;
  divEv.textContent = "";
  for (const e of eventos) {
    const div = document.createElement("div");
    div.className = "evento";
    div.textContent =
      (e.evento ?? e.tipo ?? "") + " · " +
      new Date(e.criado_em).toLocaleString("pt-BR");
    divEv.appendChild(div);
  }
}

// ---- Atualização automática do chat aberto (a cada 5 segundos) ----
// Antes, a resposta do outro lado só aparecia se você saísse e reabrisse
// o chamado. Agora o chat se atualiza sozinho enquanto estiver na tela.
function contextoChatAtivo() {
  const contextos = [
    {
      secaoId: "secao-detalhe",
      msgsId: "detalhe-mensagens",
      eventosId: "detalhe-eventos",
      idAtual: () => chamadoAbertoId,
    },
    {
      secaoId: "secao-detalhe-admin",
      msgsId: "detalhe-mensagens-admin",
      eventosId: "detalhe-eventos-admin",
      idAtual: () => chamadoAdminId,
    },
  ];
  for (const ctx of contextos) {
    const secao = document.getElementById(ctx.secaoId);
    if (secao && !secao.classList.contains("oculto") && ctx.idAtual()) return ctx;
  }
  return null;
}

async function atualizarChatAberto() {
  const ctx = contextoChatAtivo();
  if (!ctx) return;
  try {
    const resposta = await fetch("/chamados/" + ctx.idAtual(), {
      headers: cabecalhoAuth(),
    });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    const assinatura = JSON.stringify([dados.mensagens, dados.eventos]);
    if (assinatura === chatAssinatura) return; // nada mudou; nao pisca a tela
    chatAssinatura = assinatura;
    renderizarMensagensEm(ctx.msgsId, dados.mensagens);
    renderizarEventosEm(ctx.eventosId, dados.eventos);
  } catch (erro) {
    // sem conexao agora; tenta de novo no proximo ciclo
  }
}

setInterval(atualizarChatAberto, 5000);

// ---- Política de senha (mesmas regras validadas no backend,
//      em app/core/seguranca.py -> validar_nova_senha) ----
function temSequenciaDeDigitos(valor) {
  for (let i = 0; i < valor.length - 2; i++) {
    const a = valor.charCodeAt(i);
    const b = valor.charCodeAt(i + 1);
    const c = valor.charCodeAt(i + 2);
    const tresDigitos =
      /[0-9]/.test(valor[i]) &&
      /[0-9]/.test(valor[i + 1]) &&
      /[0-9]/.test(valor[i + 2]);
    if (
      tresDigitos &&
      ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1))
    ) {
      return true; // 123 (crescente) ou 987 (decrescente)
    }
  }
  return false;
}

function regrasDeSenha() {
  const matricula = (localStorage.getItem("matricula") || "").toLowerCase();
  return [
    { id: "regra-tamanho", ok: (v) => v.length >= 8 },
    {
      id: "regra-letra",
      ok: (v) => [...v].some((ch) => ch.toUpperCase() !== ch.toLowerCase()),
    },
    { id: "regra-sequencia", ok: (v) => !temSequenciaDeDigitos(v) },
    {
      id: "regra-matricula",
      ok: (v) => !matricula || !v.toLowerCase().includes(matricula),
    },
  ];
}

function senhaAtendeRegras(valor) {
  let todasOk = true;
  for (const regra of regrasDeSenha()) {
    const passou = regra.ok(valor);
    const item = document.getElementById(regra.id);
    if (item) item.classList.toggle("ok", passou);
    if (!passou) todasOk = false;
  }
  return todasOk;
}

// ---- Login ----
const formLogin = document.getElementById("form-login");
if (formLogin) {
  formLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const matricula = document.getElementById("matricula").value.trim();
    const senha = document.getElementById("senha").value;
    mostrarMsg("Verificando...", "");
    try {
      const resposta = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula, senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        mostrarMsg(dados.detail || "Nao foi possivel entrar.", "erro");
        return;
      }
      salvarSessao(dados, matricula);
      if (dados.must_change_password) {
        window.location.href = "/static/trocar-senha.html";
      } else {
        window.location.href = dados.is_admin
          ? "/static/admin.html"
          : "/static/chamados.html";
      }
    } catch (erro) {
      mostrarMsg("Falha de conexao com o servidor.", "erro");
    }
  });
}

// ---- Solicitação de acesso (tela de login) ----
const btnMostrarSolicitacao = document.getElementById("btn-mostrar-solicitacao");
const btnVoltarLogin = document.getElementById("btn-voltar-login");
const formSolicitacao = document.getElementById("form-solicitacao");

if (btnMostrarSolicitacao && formLogin && formSolicitacao) {
  btnMostrarSolicitacao.addEventListener("click", () => {
    formLogin.classList.add("oculto");
    formSolicitacao.classList.remove("oculto");
  });
}
if (btnVoltarLogin && formLogin && formSolicitacao) {
  btnVoltarLogin.addEventListener("click", () => {
    formSolicitacao.classList.add("oculto");
    formLogin.classList.remove("oculto");
  });
}
if (formSolicitacao) {
  formSolicitacao.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const msgSol = document.getElementById("msg-solicitacao");
    msgSol.textContent = "Enviando...";
    msgSol.className = "msg";
    try {
      const resposta = await fetch("/cadastro/solicitacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula: document.getElementById("sol-matricula").value.trim(),
          nome: document.getElementById("sol-nome").value.trim(),
          cargo: document.getElementById("sol-cargo").value.trim(),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        msgSol.textContent = dados.detail || "Nao foi possivel enviar a solicitacao.";
        msgSol.className = "msg erro";
        return;
      }
      msgSol.textContent =
        "Solicitacao enviada! Aguarde a aprovacao do administrador e faca login com a senha inicial.";
      msgSol.className = "msg ok";
      formSolicitacao.reset();
    } catch (erro) {
      msgSol.textContent = "Falha de conexao com o servidor.";
      msgSol.className = "msg erro";
    }
  });
}

// ---- Troca obrigatória de senha (com checklist das regras) ----
const formTroca = document.getElementById("form-troca-senha");
const campoNovaSenha = document.getElementById("nova-senha");
if (formTroca && campoNovaSenha) {
  if (!localStorage.getItem("token")) {
    window.location.href = "/static/index.html";
  }
  // Marca as regras ao vivo enquanto o usuario digita
  campoNovaSenha.addEventListener("input", () => {
    senhaAtendeRegras(campoNovaSenha.value);
  });
  senhaAtendeRegras(campoNovaSenha.value);

  formTroca.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nova = campoNovaSenha.value;
    const confirma = document.getElementById("confirma-senha").value;
    if (!senhaAtendeRegras(nova)) {
      mostrarMsg("A senha nao atende as regras destacadas acima.", "erro");
      return;
    }
    if (nova !== confirma) {
      mostrarMsg("As senhas nao coincidem.", "erro");
      return;
    }
    try {
      const resposta = await fetch("/auth/trocar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ nova_senha: nova }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        mostrarMsg(dados.detail || "Nao foi possivel trocar a senha.", "erro");
        return;
      }
      esquecerSessao();
      mostrarMsg(dados.mensagem || "Senha alterada. Faca login novamente.", "ok");
      setTimeout(() => (window.location.href = "/static/index.html"), 2000);
    } catch (erro) {
      mostrarMsg("Falha de conexao com o servidor.", "erro");
    }
  });
}

// ---- Tela de chamados (lista, novo chamado, detalhe/chat) ----
const listaChamados = document.getElementById("lista-chamados");
if (listaChamados) {
  if (!localStorage.getItem("token")) {
    window.location.href = "/static/index.html";
  } else {
    carregarMeusChamados();
    carregarUnidadesFormulario();
  }
}

const btnSair = document.getElementById("btn-sair");
if (btnSair) {
  btnSair.addEventListener("click", () => {
    esquecerSessao();
    window.location.href = "/static/index.html";
  });
}

const btnInicio = document.getElementById("btn-inicio");
if (btnInicio) {
  btnInicio.addEventListener("click", () => {
    irParaPrincipal();
    carregarMeusChamados();
  });
}

const formNovo = document.getElementById("form-novo-chamado");
if (formNovo) {
  formNovo.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const msgNovo = document.getElementById("msg-novo");
    msgNovo.textContent = "Enviando...";
    msgNovo.className = "msg";
    try {
      const resposta = await fetch("/chamados", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({
          titulo: document.getElementById("titulo").value.trim(),
          categoria: document.getElementById("categoria").value,
          unidade_id: Number(document.getElementById("unidade").value),
          descricao: document.getElementById("descricao").value.trim(),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        msgNovo.textContent = dados.detail || "Nao foi possivel abrir o chamado.";
        msgNovo.className = "msg erro";
        return;
      }
      msgNovo.textContent = "Chamado #" + dados.id + " aberto com sucesso!";
      msgNovo.className = "msg ok";
      formNovo.reset();
      carregarMeusChamados();
    } catch (erro) {
      msgNovo.textContent = "Falha de conexao com o servidor.";
      msgNovo.className = "msg erro";
    }
  });
}

// ---- Unidades ativas no formulário de novo chamado ----
async function carregarUnidadesFormulario() {
  const select = document.getElementById("unidade");
  if (!select) return;
  try {
    const resposta = await fetch("/unidades", { headers: cabecalhoAuth() });
    if (!resposta.ok) return;
    const unidades = await resposta.json();
    for (const u of unidades) {
      if (!u.ativa) continue;
      const opcao = document.createElement("option");
      opcao.value = u.id;
      opcao.textContent = u.nome;
      select.appendChild(opcao);
    }
  } catch (erro) {
    // sem unidades no select; o backend recusa o chamado sem unidade
  }
}

function renderizarChamados(container, itens, vazio, funcaoAbrir) {
  container.textContent = "";
  if (!itens.length) {
    const p = document.createElement("p");
    p.textContent = vazio;
    container.appendChild(p);
    return;
  }
  container.innerHTML = itens
    .map(
      (c) => `
      <article class="chamado" data-id="${c.id}">
        <h3>#${c.id} — ${esc(c.titulo)}</h3>
        <p class="meta">${esc(c.categoria)}${c.unidade_nome ? " · " + esc(c.unidade_nome) : ""} · aberto em ${new Date(c.criado_em).toLocaleString("pt-BR")}</p>
        <span class="selo ${esc(c.status)}">${esc(c.status)}</span>
      </article>`
    )
    .join("");
  container.querySelectorAll(".chamado").forEach((el) =>
    el.addEventListener("click", () => funcaoAbrir(Number(el.dataset.id)))
  );
}

async function carregarMeusChamados() {
  const msgLista = document.getElementById("msg-lista");
  try {
    const resposta = await fetch("/chamados/meus", { headers: cabecalhoAuth() });
    if (resposta.status === 401) {
      window.location.href = "/static/index.html";
      return;
    }
    const todos = await resposta.json();
    const ativos = todos.filter((c) => c.status !== "resolvido");
    const resolvidos = todos.filter((c) => c.status === "resolvido");
    renderizarChamados(
      listaChamados,
      ativos,
      "Nenhum chamado em aberto. Abra um no formulario acima.",
      (id) => abrirDetalhe(id)
    );
    renderizarChamados(
      document.getElementById("lista-historico"),
      resolvidos,
      "Nenhum chamado resolvido ainda.",
      (id) => abrirDetalhe(id)
    );
  } catch (erro) {
    msgLista.textContent = "Falha ao carregar chamados.";
    msgLista.className = "msg erro";
  }
}

async function abrirDetalhe(id) {
  try {
    const resposta = await fetch("/chamados/" + id, { headers: cabecalhoAuth() });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    chamadoAbertoId = id;

    document.getElementById("detalhe-titulo").textContent =
      "#" + dados.chamado.id + " — " + dados.chamado.titulo;
    document.getElementById("detalhe-info").textContent = infoChamado(dados.chamado);
    document.getElementById("detalhe-descricao").textContent = dados.chamado.descricao;

    const formStatusUsuario = document.getElementById("form-status-usuario");
    if (formStatusUsuario && localStorage.getItem("isAdmin") === "1") {
      document.getElementById("novo-status-usuario").value = dados.chamado.status;
      formStatusUsuario.classList.remove("oculto");
    }

    chatAssinatura = JSON.stringify([dados.mensagens, dados.eventos]);
    renderizarMensagensEm("detalhe-mensagens", dados.mensagens);
    renderizarEventosEm("detalhe-eventos", dados.eventos);

    mostrarSecao(document.getElementById("secao-detalhe"));
  } catch (erro) {
    // detalhe falhou; a lista continua funcionando
  }
}

function infoChamado(c) {
  return (
    c.categoria +
    (c.unidade_nome ? " · " + c.unidade_nome : "") +
    " · status: " +
    c.status
  );
}

const formMensagem = document.getElementById("form-mensagem");
if (formMensagem) {
  formMensagem.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!chamadoAbertoId) return;
    const campo = document.getElementById("mensagem");
    const msgChat = document.getElementById("msg-mensagem");
    try {
      const resposta = await fetch("/chamados/" + chamadoAbertoId + "/mensagens", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({ mensagem: campo.value.trim() }),
      });
      if (resposta.ok) {
        campo.value = "";
        if (msgChat) msgChat.textContent = "";
        abrirDetalhe(chamadoAbertoId);
      } else {
        const dados = await resposta.json().catch(() => ({}));
        if (msgChat) {
          msgChat.textContent = dados.detail || "Nao foi possivel enviar a mensagem.";
          msgChat.className = "msg erro";
        }
      }
    } catch (erro) {
      if (msgChat) {
        msgChat.textContent = "Falha de conexao com o servidor.";
        msgChat.className = "msg erro";
      }
    }
  });
}

// ---- Painel do admin ----
const listaTodos = document.getElementById("lista-todos");

if (listaTodos) {
  if (localStorage.getItem("token") && localStorage.getItem("isAdmin") === "1") {
    carregarTodosChamados();
  } else {
    window.location.href = "/static/index.html";
  }
  const btnSairAdmin = document.getElementById("btn-sair-admin");
  if (btnSairAdmin)
    btnSairAdmin.addEventListener("click", () => {
      esquecerSessao();
      window.location.href = "/static/index.html";
    });
}

const btnInicioAdmin = document.getElementById("btn-inicio-admin");
if (btnInicioAdmin) {
  btnInicioAdmin.addEventListener("click", () => {
    irParaPrincipal();
    carregarTodosChamados();
  });
}

async function carregarTodosChamados() {
  const msgAdmin = document.getElementById("msg-admin");
  try {
    const resposta = await fetch("/chamados/todos", { headers: cabecalhoAuth() });
    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/static/index.html";
      return;
    }
    const todos = await resposta.json();
    const ativos = todos.filter((c) => c.status !== "resolvido");
    const resolvidos = todos.filter((c) => c.status === "resolvido");
    renderizarChamados(
      listaTodos,
      ativos,
      "Nenhum chamado em aberto.",
      (id) => abrirDetalheAdmin(id)
    );
    renderizarChamados(
      document.getElementById("lista-historico-admin"),
      resolvidos,
      "Nenhum chamado resolvido ainda.",
      (id) => abrirDetalheAdmin(id)
    );
  } catch (erro) {
    msgAdmin.textContent = "Falha ao carregar chamados.";
    msgAdmin.className = "msg erro";
  }
}

async function abrirDetalheAdmin(id) {
  try {
    const resposta = await fetch("/chamados/" + id, { headers: cabecalhoAuth() });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    chamadoAdminId = id;
    document.getElementById("detalhe-titulo-admin").textContent =
      "#" + dados.chamado.id + " — " + dados.chamado.titulo;
    document.getElementById("detalhe-info-admin").textContent = infoChamado(dados.chamado);
    document.getElementById("novo-status").value = dados.chamado.status;
    document.getElementById("detalhe-descricao-admin").textContent = dados.chamado.descricao;

    chatAssinatura = JSON.stringify([dados.mensagens, dados.eventos]);
    renderizarMensagensEm("detalhe-mensagens-admin", dados.mensagens);
    renderizarEventosEm("detalhe-eventos-admin", dados.eventos);

    mostrarSecao(document.getElementById("secao-detalhe-admin"));
  } catch (erro) {
    // detalhe falhou; a lista continua funcionando
  }
}

const formStatus = document.getElementById("form-status");
if (formStatus) {
  formStatus.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!chamadoAdminId) return;
    const msgStatus = document.getElementById("msg-status");
    try {
      const resposta = await fetch("/chamados/" + chamadoAdminId + "/status", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({ novo_status: document.getElementById("novo-status").value }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        msgStatus.textContent = dados.detail || "Nao foi possivel alterar o status.";
        msgStatus.className = "msg erro";
        return;
      }
      msgStatus.textContent = "Status alterado para " + dados.status + ".";
      msgStatus.className = "msg ok";
      document.getElementById("detalhe-info-admin").textContent = infoChamado(dados);
      carregarTodosChamados();
    } catch (erro) {
      msgStatus.textContent = "Falha de conexao com o servidor.";
      msgStatus.className = "msg erro";
    }
  });
}

const formMensagemAdmin = document.getElementById("form-mensagem-admin");
if (formMensagemAdmin) {
  formMensagemAdmin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!chamadoAdminId) return;
    const campo = document.getElementById("mensagem-admin");
    const msgChat = document.getElementById("msg-mensagem-admin");
    try {
      const resposta = await fetch("/chamados/" + chamadoAdminId + "/mensagens", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({ mensagem: campo.value.trim() }),
      });
      if (resposta.ok) {
        campo.value = "";
        if (msgChat) msgChat.textContent = "";
        abrirDetalheAdmin(chamadoAdminId);
      } else {
        const dados = await resposta.json().catch(() => ({}));
        if (msgChat) {
          msgChat.textContent = dados.detail || "Nao foi possivel enviar a mensagem.";
          msgChat.className = "msg erro";
        }
      }
    } catch (erro) {
      if (msgChat) {
        msgChat.textContent = "Falha de conexao com o servidor.";
        msgChat.className = "msg erro";
      }
    }
  });
}

// ---- Navegação: Histórico ----
const btnHistorico = document.getElementById("btn-historico");
if (btnHistorico) {
  btnHistorico.addEventListener("click", () => {
    carregarMeusChamados();
    mostrarSecao(document.getElementById("secao-historico"));
  });
}

const btnHistoricoAdmin = document.getElementById("btn-historico-admin");
if (btnHistoricoAdmin) {
  btnHistoricoAdmin.addEventListener("click", () => {
    carregarTodosChamados();
    carregarMetricas();
    mostrarSecao(document.getElementById("secao-historico-admin"));
  });
}

// ---- Métricas mensais (tela de Histórico do admin) ----
const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
let abaAnoMetricas = null;

function linhaMensagemMetricas(corpo, texto) {
  corpo.textContent = "";
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 3;
  td.textContent = texto;
  tr.appendChild(td);
  corpo.appendChild(tr);
}

async function carregarMetricas() {
  const corpo = document.getElementById("corpo-metricas");
  const abas = document.getElementById("abas-anos-metricas");
  if (!corpo) return;
  try {
    const resposta = await fetch("/admin/metricas", { headers: cabecalhoAuth() });
    if (!resposta.ok) {
      if (abas) abas.textContent = "";
      linhaMensagemMetricas(corpo, "Erro ao carregar metricas (HTTP " + resposta.status + ").");
      return;
    }
    const linhas = await resposta.json();
    if (!linhas.length) {
      if (abas) abas.textContent = "";
      linhaMensagemMetricas(corpo, "Sem dados ainda.");
      return;
    }

    // agrupa por ano: { "2026": [ {mes, abertos, resolvidos}, ... ] }
    const porAno = {};
    for (const linha of linhas) {
      const ano = linha.mes.slice(0, 4);
      if (!porAno[ano]) porAno[ano] = [];
      porAno[ano].push(linha);
    }
    const anos = Object.keys(porAno).sort((a, b) => b.localeCompare(a));
    const anoCorrente = String(new Date().getFullYear());
    if (!abaAnoMetricas || !porAno[abaAnoMetricas]) {
      abaAnoMetricas = porAno[anoCorrente] ? anoCorrente : anos[0];
    }

    if (abas) {
      abas.textContent = "";
      for (const ano of anos) {
        const btn = document.createElement("button");
        btn.textContent = ano;
        btn.className = "aba-ano" + (ano === abaAnoMetricas ? " ativa" : "");
        btn.addEventListener("click", () => {
          abaAnoMetricas = ano;
          carregarMetricas();
        });
        abas.appendChild(btn);
      }
    }

    corpo.textContent = "";
    const doAno = [...porAno[abaAnoMetricas]].sort((a, b) => a.mes.localeCompare(b.mes));
    for (const linha of doAno) {
      const nomeMes = NOMES_MESES[Number(linha.mes.slice(5, 7)) - 1];
      const tr = document.createElement("tr");
      const tdMes = document.createElement("td");
      tdMes.textContent = nomeMes;
      tr.appendChild(tdMes);
      for (const valor of [String(linha.abertos), String(linha.resolvidos)]) {
        const td = document.createElement("td");
        td.textContent = valor;
        tr.appendChild(td);
      }
      corpo.appendChild(tr);
    }
  } catch (erro) {
    linhaMensagemMetricas(corpo, "Falha de conexao ao carregar metricas.");
  }
}

// ---- Alterar status pela tela do usuário (somente admin) ----
const formStatusUsuario = document.getElementById("form-status-usuario");
if (formStatusUsuario) {
  formStatusUsuario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!chamadoAbertoId) return;
    const msgStatusUsuario = document.getElementById("msg-status-usuario");
    try {
      const resposta = await fetch("/chamados/" + chamadoAbertoId + "/status", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({
          novo_status: document.getElementById("novo-status-usuario").value,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        msgStatusUsuario.textContent = dados.detail || "Nao foi possivel alterar o status.";
        msgStatusUsuario.className = "msg erro";
        return;
      }
      msgStatusUsuario.textContent = "Status alterado para " + dados.status + ".";
      msgStatusUsuario.className = "msg ok";
      document.getElementById("novo-status-usuario").value = dados.status;
      document.getElementById("detalhe-info").textContent = infoChamado(dados);
      carregarMeusChamados();
    } catch (erro) {
      msgStatusUsuario.textContent = "Falha de conexao com o servidor.";
      msgStatusUsuario.className = "msg erro";
    }
  });
}

// ---- Gestão de unidades (admin) ----
async function carregarUnidades() {
  const lista = document.getElementById("lista-unidades");
  if (!lista) return;
  try {
    const resposta = await fetch("/unidades/admin", { headers: cabecalhoAuth() });
    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/static/index.html";
      return;
    }
    const unidades = await resposta.json();
    lista.textContent = "";
    if (!unidades.length) {
      const p = document.createElement("p");
      p.textContent = "Nenhuma unidade cadastrada ainda.";
      lista.appendChild(p);
      return;
    }
    for (const u of unidades) {
      const div = document.createElement("div");
      div.className = "chamado";
      const h3 = document.createElement("h3");
      h3.textContent = u.nome;
      div.appendChild(h3);
      const selo = document.createElement("span");
      selo.className = "selo " + (u.ativa ? "aberto" : "resolvido");
      selo.textContent = u.ativa ? "ativa" : "inativa";
      div.appendChild(selo);
      const acoes = document.createElement("p");
      acoes.className = "meta acoes-unidade";
      const btnAtiva = document.createElement("button");
      btnAtiva.textContent = u.ativa ? "Desativar" : "Ativar";
      btnAtiva.addEventListener("click", () => alterarUnidade(u.id, { ativa: !u.ativa }));
      const btnRenomear = document.createElement("button");
      btnRenomear.textContent = "Renomear";
      btnRenomear.addEventListener("click", () => {
        const novo = prompt("Novo nome da unidade:", u.nome);
        if (novo && novo.trim() && novo.trim() !== u.nome) {
          alterarUnidade(u.id, { nome: novo.trim() });
        }
      });
      acoes.appendChild(btnAtiva);
      acoes.appendChild(btnRenomear);
      div.appendChild(acoes);
      lista.appendChild(div);
    }
  } catch (erro) {
    lista.textContent = "";
    const p = document.createElement("p");
    p.textContent = "Falha ao carregar unidades.";
    lista.appendChild(p);
  }
}

async function alterarUnidade(id, dados) {
  try {
    const resposta = await fetch("/unidades/" + id, {
      method: "PUT",
      headers: cabecalhoAuth(),
      body: JSON.stringify(dados),
    });
    const corpo = await resposta.json();
    if (!resposta.ok) {
      alert(corpo.detail || "Nao foi possivel atualizar a unidade.");
      return;
    }
    carregarUnidades();
  } catch (erro) {
    alert("Falha de conexao com o servidor.");
  }
}

const formNovaUnidade = document.getElementById("form-nova-unidade");
if (formNovaUnidade) {
  formNovaUnidade.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const msgUnidade = document.getElementById("msg-unidade");
    const campo = document.getElementById("nome-unidade");
    try {
      const resposta = await fetch("/unidades", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({ nome: campo.value.trim() }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        msgUnidade.textContent = dados.detail || "Nao foi possivel criar a unidade.";
        msgUnidade.className = "msg erro";
        return;
      }
      msgUnidade.textContent = "Unidade \"" + dados.nome + "\" criada.";
      msgUnidade.className = "msg ok";
      formNovaUnidade.reset();
      carregarUnidades();
    } catch (erro) {
      msgUnidade.textContent = "Falha de conexao com o servidor.";
      msgUnidade.className = "msg erro";
    }
  });
}

const btnUnidadesAdmin = document.getElementById("btn-unidades-admin");
if (btnUnidadesAdmin) {
  btnUnidadesAdmin.addEventListener("click", () => {
    carregarUnidades();
    mostrarSecao(document.getElementById("secao-unidades-admin"));
  });
}

// ---- Solicitações de cadastro (admin) ----
async function carregarSolicitacoes() {
  const lista = document.getElementById("lista-solicitacoes");
  if (!lista) return;
  try {
    const resposta = await fetch("/cadastro/pendentes", { headers: cabecalhoAuth() });
    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/static/index.html";
      return;
    }
    const pendentes = await resposta.json();
    lista.textContent = "";
    if (!pendentes.length) {
      const p = document.createElement("p");
      p.textContent = "Nenhuma solicitacao pendente.";
      lista.appendChild(p);
      return;
    }
    for (const s of pendentes) {
      const div = document.createElement("div");
      div.className = "chamado";
      const h3 = document.createElement("h3");
      h3.textContent = s.nome;
      div.appendChild(h3);
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = "Matricula: " + s.matricula + " · Cargo: " + s.cargo;
      div.appendChild(meta);
      const acoes = document.createElement("p");
      acoes.className = "meta acoes-unidade";
      const btnAprovar = document.createElement("button");
      btnAprovar.textContent = "Aprovar";
      btnAprovar.addEventListener("click", () => revisarSolicitacao(s.id, "aprovar"));
      const btnRecusar = document.createElement("button");
      btnRecusar.textContent = "Recusar";
      btnRecusar.addEventListener("click", () => revisarSolicitacao(s.id, "recusar"));
      acoes.appendChild(btnAprovar);
      acoes.appendChild(btnRecusar);
      div.appendChild(acoes);
      lista.appendChild(div);
    }
  } catch (erro) {
    lista.textContent = "";
    const p = document.createElement("p");
    p.textContent = "Falha ao carregar solicitacoes.";
    lista.appendChild(p);
  }
}

async function revisarSolicitacao(id, acao) {
  try {
    const resposta = await fetch("/cadastro/" + id + "/" + acao, {
      method: "POST",
      headers: cabecalhoAuth(),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      alert(dados.detail || "Nao foi possivel revisar a solicitacao.");
      return;
    }
    alert(dados.mensagem);
    carregarSolicitacoes();
  } catch (erro) {
    alert("Falha de conexao com o servidor.");
  }
}

const btnSolicitacoesAdmin = document.getElementById("btn-solicitacoes-admin");
if (btnSolicitacoesAdmin) {
  btnSolicitacoesAdmin.addEventListener("click", () => {
    carregarSolicitacoes();
    mostrarSecao(document.getElementById("secao-solicitacoes-admin"));
  });
}

// ---- Usuários: criar novos administradores (admin) ----
async function carregarUsuarios() {
  const lista = document.getElementById("lista-usuarios");
  if (!lista) return;
  try {
    const resposta = await fetch("/admin/usuarios", { headers: cabecalhoAuth() });
    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = "/static/index.html";
      return;
    }
    const usuarios = await resposta.json();
    lista.textContent = "";
    if (!usuarios.length) {
      const p = document.createElement("p");
      p.textContent = "Nenhum usuario cadastrado ainda.";
      lista.appendChild(p);
      return;
    }
    for (const u of usuarios) {
      const div = document.createElement("div");
      div.className = "chamado";
      const h3 = document.createElement("h3");
      h3.textContent = u.nome;
      div.appendChild(h3);
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent =
        "Matricula: " + u.matricula +
        (u.cargo ? " · " + u.cargo : "") +
        (u.is_active ? "" : " · INATIVO");
      div.appendChild(meta);
      const selo = document.createElement("span");
      selo.className = "selo " + (u.is_admin ? "em_atendimento" : "fechado");
      selo.textContent = u.is_admin ? "admin" : "colaborador";
      div.appendChild(selo);
      if (u.is_admin) {
        const p = document.createElement("p");
        p.className = "meta";
        p.textContent = "Voce";
        div.appendChild(p);
      } else {
        const acoes = document.createElement("p");
        acoes.className = "meta acoes-unidade";
        const btnPromover = document.createElement("button");
        btnPromover.textContent = "Tornar admin";
        btnPromover.addEventListener("click", () => promoverUsuario(u.id, u.nome));
        acoes.appendChild(btnPromover);
        div.appendChild(acoes);
      }
      lista.appendChild(div);
    }
  } catch (erro) {
    lista.textContent = "";
    const p = document.createElement("p");
    p.textContent = "Falha ao carregar usuarios.";
    lista.appendChild(p);
  }
}

async function promoverUsuario(id, nome) {
  if (!confirm("Tornar " + nome + " administrador? Essa pessoa podera aprovar cadastros, ver metricas e gerenciar todos os chamados.")) {
    return;
  }
  try {
    const resposta = await fetch("/admin/usuarios/" + id + "/promover", {
      method: "POST",
      headers: cabecalhoAuth(),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      alert(dados.detail || "Nao foi possivel promover o usuario.");
      return;
    }
    alert(dados.mensagem);
    carregarUsuarios();
  } catch (erro) {
    alert("Falha de conexao com o servidor.");
  }
}

const btnUsuariosAdmin = document.getElementById("btn-usuarios-admin");
if (btnUsuariosAdmin) {
  btnUsuariosAdmin.addEventListener("click", () => {
    carregarUsuarios();
    mostrarSecao(document.getElementById("secao-usuarios-admin"));
  });
}