"use strict";

// ---- Service worker (PWA) ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js");
}

// ---- Utilidades ----
function salvarSessao(resposta) {
  localStorage.setItem("token", resposta.access_token);
  localStorage.setItem("isAdmin", resposta.is_admin ? "1" : "0");
}

function mostrarMsg(texto, tipo) {
  const p = document.getElementById("msg");
  if (!p) return;
  p.textContent = texto;
  p.className = "msg " + (tipo || "");
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
      salvarSessao(dados);
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

// ---- Troca obrigatória de senha ----
const formTroca = document.getElementById("form-troca-senha");
if (formTroca) {
  if (!localStorage.getItem("token")) {
    window.location.href = "/static/index.html";
  }
  formTroca.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const nova = document.getElementById("nova-senha").value;
    const confirma = document.getElementById("confirma-senha").value;
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
      localStorage.removeItem("token");
      localStorage.removeItem("isAdmin");
      mostrarMsg(dados.mensagem || "Senha alterada. Faca login novamente.", "ok");
      setTimeout(() => (window.location.href = "/static/index.html"), 2000);
    } catch (erro) {
      mostrarMsg("Falha de conexao com o servidor.", "erro");
    }
  });
}

// ---- Tela de chamados (lista, novo chamado, detalhe/chat) ----
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
    localStorage.removeItem("token");
    localStorage.removeItem("isAdmin");
    window.location.href = "/static/index.html";
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

// ---- Passo D-c: unidades ativas no formulário de novo chamado ----
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
        <p class="meta">${esc(c.categoria)} · aberto em ${new Date(c.criado_em).toLocaleString("pt-BR")}</p>
        <span class="selo ${esc(c.status)}">${esc(c.status)}</span>
      </article>`
    )
    .join("");
  container.querySelectorAll(".chamado").forEach((el) =>
    el.addEventListener("click", () => funcaoAbrir(Number(el.dataset.id)))
  );
}

let veioDoHistorico = false;

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
      (id) => {
        veioDoHistorico = false;
        abrirDetalhe(id);
      }
    );
    renderizarChamados(
      document.getElementById("lista-historico"),
      resolvidos,
      "Nenhum chamado resolvido ainda.",
      (id) => {
        veioDoHistorico = true;
        abrirDetalhe(id);
      }
    );
  } catch (erro) {
    msgLista.textContent = "Falha ao carregar chamados.";
    msgLista.className = "msg erro";
  }
}

let chamadoAbertoId = null;

async function abrirDetalhe(id) {
  try {
    const resposta = await fetch("/chamados/" + id, { headers: cabecalhoAuth() });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    chamadoAbertoId = id;

    document.getElementById("detalhe-titulo").textContent =
      "#" + dados.chamado.id + " — " + dados.chamado.titulo;
    document.getElementById("detalhe-info").textContent =
      dados.chamado.categoria + " · status: " + dados.chamado.status;
    document.getElementById("detalhe-descricao").textContent = dados.chamado.descricao;

    const formStatusUsuario = document.getElementById("form-status-usuario");
    if (formStatusUsuario && localStorage.getItem("isAdmin") === "1") {
      document.getElementById("novo-status-usuario").value = dados.chamado.status;
      formStatusUsuario.classList.remove("oculto");
    }

    const divMsgs = document.getElementById("detalhe-mensagens");
    divMsgs.textContent = "";
    if (!dados.mensagens.length) {
      const p = document.createElement("p");
      p.textContent = "Sem mensagens ainda.";
      divMsgs.appendChild(p);
    }
    for (const m of dados.mensagens) {
      const div = document.createElement("div");
      div.className = "mensagem";
      const autor = document.createElement("strong");
      autor.textContent = "Usuario " + m.autor_id;
      div.appendChild(autor);
      div.appendChild(document.createTextNode(" — " + m.mensagem));
      divMsgs.appendChild(div);
    }

    const divEv = document.getElementById("detalhe-eventos");
    divEv.textContent = "";
    for (const e of dados.eventos) {
      const div = document.createElement("div");
      div.className = "evento";
      div.textContent =
        (e.evento ?? e.tipo ?? "") + " · " +
        new Date(e.criado_em).toLocaleString("pt-BR");
      divEv.appendChild(div);
    }

    document.querySelector("main.lista").classList.add("oculto");
    const histUsuario = document.getElementById("secao-historico");
    if (histUsuario) histUsuario.classList.add("oculto");
    document.getElementById("secao-detalhe").classList.remove("oculto");
    window.scrollTo(0, 0);
  } catch (erro) {
    // detalhe falhou; a lista continua funcionando
  }
}

const btnVoltar = document.getElementById("btn-voltar");
if (btnVoltar) {
  btnVoltar.addEventListener("click", () => {
    document.getElementById("secao-detalhe").classList.add("oculto");
    if (veioDoHistorico) {
      document.getElementById("secao-historico").classList.remove("oculto");
    } else {
      document.querySelector("main.lista").classList.remove("oculto");
    }
    veioDoHistorico = false;
    chamadoAbertoId = null;
  });
}

const formMensagem = document.getElementById("form-mensagem");
if (formMensagem) {
  formMensagem.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!chamadoAbertoId) return;
    const campo = document.getElementById("mensagem");
    try {
      const resposta = await fetch("/chamados/" + chamadoAbertoId + "/mensagens", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({ mensagem: campo.value.trim() }),
      });
      if (resposta.ok) {
        campo.value = "";
        abrirDetalhe(chamadoAbertoId);
      }
    } catch (erro) {
      // mensagem nao enviada; tenta novamente
    }
  });
}

// ---- Painel do admin ----
const listaTodos = document.getElementById("lista-todos");
let chamadoAdminId = null;

if (listaTodos) {
  if (localStorage.getItem("token") && localStorage.getItem("isAdmin") === "1") {
    carregarTodosChamados();
  } else {
    window.location.href = "/static/index.html";
  }
  const btnMeus = document.getElementById("btn-meus");
  if (btnMeus) btnMeus.addEventListener("click", () => (window.location.href = "/static/chamados.html"));
  const btnSairAdmin = document.getElementById("btn-sair-admin");
  if (btnSairAdmin)
    btnSairAdmin.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("isAdmin");
      window.location.href = "/static/index.html";
    });
}

let veioDoHistoricoAdmin = false;

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
      (id) => {
        veioDoHistoricoAdmin = false;
        abrirDetalheAdmin(id);
      }
    );
    renderizarChamados(
      document.getElementById("lista-historico-admin"),
      resolvidos,
      "Nenhum chamado resolvido ainda.",
      (id) => {
        veioDoHistoricoAdmin = true;
        abrirDetalheAdmin(id);
      }
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
    document.getElementById("detalhe-info-admin").textContent =
      dados.chamado.categoria + " · status: " + dados.chamado.status;
    document.getElementById("novo-status").value = dados.chamado.status;
    document.getElementById("detalhe-descricao-admin").textContent = dados.chamado.descricao;

    const divMsgs = document.getElementById("detalhe-mensagens-admin");
    divMsgs.textContent = "";
    if (!dados.mensagens.length) {
      const p = document.createElement("p");
      p.textContent = "Sem mensagens ainda.";
      divMsgs.appendChild(p);
    }
    for (const m of dados.mensagens) {
      const div = document.createElement("div");
      div.className = "mensagem";
      const autor = document.createElement("strong");
      autor.textContent = "Usuario " + m.autor_id;
      div.appendChild(autor);
      div.appendChild(document.createTextNode(" — " + m.mensagem));
      divMsgs.appendChild(div);
    }

    const divEv = document.getElementById("detalhe-eventos-admin");
    divEv.textContent = "";
    for (const e of dados.eventos) {
      const div = document.createElement("div");
      div.className = "evento";
      div.textContent = e.evento + " · " + new Date(e.criado_em).toLocaleString("pt-BR");
      divEv.appendChild(div);
    }

    document.querySelector("main.lista").classList.add("oculto");
    const histAdmin = document.getElementById("secao-historico-admin");
    if (histAdmin) histAdmin.classList.add("oculto");
    document.getElementById("secao-detalhe-admin").classList.remove("oculto");
    window.scrollTo(0, 0);
  } catch (erro) {
    // detalhe falhou; a lista continua funcionando
  }
}

const btnVoltarAdmin = document.getElementById("btn-voltar-admin");
if (btnVoltarAdmin) {
  btnVoltarAdmin.addEventListener("click", () => {
    document.getElementById("secao-detalhe-admin").classList.add("oculto");
    if (veioDoHistoricoAdmin) {
      document.getElementById("secao-historico-admin").classList.remove("oculto");
    } else {
      document.querySelector("main.lista").classList.remove("oculto");
    }
    veioDoHistoricoAdmin = false;
    chamadoAdminId = null;
    carregarTodosChamados();
  });
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
      document.getElementById("detalhe-info-admin").textContent =
        dados.categoria + " · status: " + dados.status;
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
    try {
      const resposta = await fetch("/chamados/" + chamadoAdminId + "/mensagens", {
        method: "POST",
        headers: cabecalhoAuth(),
        body: JSON.stringify({ mensagem: campo.value.trim() }),
      });
      if (resposta.ok) {
        campo.value = "";
        abrirDetalheAdmin(chamadoAdminId);
      }
    } catch (erro) {
      // mensagem nao enviada; tenta novamente
    }
  });
}

// Botao "Painel" na tela de chamados, visivel so para admin
const btnPainel = document.getElementById("btn-painel");
if (btnPainel && localStorage.getItem("isAdmin") === "1") {
  btnPainel.classList.remove("oculto");
  btnPainel.addEventListener("click", () => (window.location.href = "/static/admin.html"));
}

// ---- Navegação para o Histórico ----
const btnHistorico = document.getElementById("btn-historico");
if (btnHistorico) {
  btnHistorico.addEventListener("click", () => {
    carregarMeusChamados();
    document.querySelector("main.lista").classList.add("oculto");
    document.getElementById("secao-historico").classList.remove("oculto");
    window.scrollTo(0, 0);
  });
}
const btnVoltarHistorico = document.getElementById("btn-voltar-historico");
if (btnVoltarHistorico) {
  btnVoltarHistorico.addEventListener("click", () => {
    document.getElementById("secao-historico").classList.add("oculto");
    document.querySelector("main.lista").classList.remove("oculto");
    carregarMeusChamados();
  });
}

const btnHistoricoAdmin = document.getElementById("btn-historico-admin");
if (btnHistoricoAdmin) {
  btnHistoricoAdmin.addEventListener("click", () => {
    carregarTodosChamados();
    carregarMetricas();
    document.querySelector("main.lista").classList.add("oculto");
    document.getElementById("secao-historico-admin").classList.remove("oculto");
    window.scrollTo(0, 0);
  });
}

const btnVoltarHistoricoAdmin = document.getElementById("btn-voltar-historico-admin");
if (btnVoltarHistoricoAdmin) {
  btnVoltarHistoricoAdmin.addEventListener("click", () => {
    document.getElementById("secao-historico-admin").classList.add("oculto");
    document.querySelector("main.lista").classList.remove("oculto");
    carregarTodosChamados();
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
      document.getElementById("detalhe-info").textContent =
        dados.categoria + " · status: " + dados.status;
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
      acoes.className = "meta";
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
    document.querySelector("main.lista").classList.add("oculto");
    document.getElementById("secao-unidades-admin").classList.remove("oculto");
    window.scrollTo(0, 0);
  });
}

const btnVoltarUnidadesAdmin = document.getElementById("btn-voltar-unidades-admin");
if (btnVoltarUnidadesAdmin) {
  btnVoltarUnidadesAdmin.addEventListener("click", () => {
    document.getElementById("secao-unidades-admin").classList.add("oculto");
    document.querySelector("main.lista").classList.remove("oculto");
  });
}
