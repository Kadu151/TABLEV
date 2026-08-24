const COLORS = ['#2F5D50', '#8A5A3B', '#3D5A80', '#7A6B4F'];

let columns = [
  { name: 'Número da NF', type: 'texto' },
  { name: 'Cliente', type: 'texto' },
  { name: 'Data de Emissão', type: 'data' },
  { name: 'Valor', type: 'valor' },
];

const typeLabel = {
  texto: 'Texto',
  data: 'Data',
  valor: 'Valor (R$)',
  numero: 'Número',
};

const filtrosSelecionados = new Map();
let menuFiltroAberto = null;

function renderColumnList() {
  const list = document.getElementById('colList');
  list.innerHTML = '';

  columns.forEach((col, i) => {
    const chip = document.createElement('div');

    chip.className =
      'col-chip card flex items-center justify-between px-3 py-2 text-sm';

    chip.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="type-dot shrink-0"
          style="background:${COLORS[i % COLORS.length]}"
        ></span>

        <span class="font-medium truncate">
          ${col.name}
        </span>

        <span
          class="mono text-xs shrink-0"
          style="color:var(--muted)"
        >
          ${typeLabel[col.type]}
        </span>
      </div>

      <button
        data-i="${i}"
        class="remove-col icon-btn shrink-0"
        title="Remover coluna"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    list.appendChild(chip);
  });

  list
    .querySelectorAll('.remove-col')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        columns.splice(
          Number(btn.dataset.i),
          1
        );

        filtrosSelecionados.clear();
        renderColumnList();
        renderTable();
      });
    });
}

const ANCORAS = {
  'Número da NF': [
    /DANFE[\s\S]*?N[º°.]\s*0*(\d{4,9})/i,
    /DANFE[\s\S]*?NF-?e\.?\s*0*(\d{4,9})/i,
    /N[ÚU]MERO\s*\/\s*S[ÉE]RIE\s+0*(\d{3,12})\s+NF-?E/i,
    /\b0*(\d{3,12})\s*\/\s*NF-?E\b/i,
  ],

  Cliente: [
    /NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL\s+([A-ZÀ-Ú0-9.,&\-\s]+?)\s+CNPJ/i,
    /TOMADOR\s+DE\s+SERVI[ÇC]OS[\s\S]{0,250}?NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL\s*:?\s*([A-ZÀ-Ú0-9.,&()'\-\s]+?)\s+CPF\s*\/?\s*CNPJ/i,
  ],

  'Data de Emissão': [
    /DATA\s*DE\s*EMISS[ÃA]O\s*(\d{2}\/\d{2}\/\d{4})/i,
    /\bEMISS[ÃA]O\s+(\d{2}\/\d{2}\/\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?/i,
  ],

  Valor: [
    /(?:VALOR\s*)?TOTAL\s*DA\s*NOTA\s*(?:R\$)?\s*([\d.,]+)/i,
    /VALOR\s*TOTAL\s*DA\s*NOTA\s*\(\s*R\$\s*\)[\s\S]{0,350}?\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/i,
  ],
};

function normalizarTextoDocumento(texto) {
  return String(texto || '')
    .normalize('NFC')
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarFiltro(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tentarAncoras(texto, listaRegex) {
  for (const regex of listaRegex) {
    const resultado = texto.match(regex);

    if (resultado && resultado[1]) {
      return resultado[1].trim();
    }
  }

  return null;
}

function renderTable() {
  const headRow =
    document.getElementById('headRow');

  const table =
    document.getElementById('previewTable');

  const emptyState =
    document.getElementById('emptyState');

  headRow.innerHTML = '';

  columns.forEach((coluna, indice) => {
    const th = document.createElement('th');

    th.className =
      'text-left px-4 py-3 mono text-xs font-semibold uppercase tracking-wide';

    th.style.borderTop =
      `2px solid ${COLORS[indice % COLORS.length]}`;

    const cabecalho =
      document.createElement('div');

    cabecalho.className =
      'flex items-center justify-between gap-2';

    const nome =
      document.createElement('span');

    nome.className = 'truncate';
    nome.textContent = coluna.name;

    const botaoFiltro =
      document.createElement('button');

    botaoFiltro.type = 'button';
    botaoFiltro.dataset.coluna =
      String(indice);

    botaoFiltro.className =
      'botao-filtro inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors';

    botaoFiltro.style.color =
      'var(--muted)';

    botaoFiltro.title =
      `Filtrar ${coluna.name}`;

    botaoFiltro.innerHTML = `
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8z"/>
      </svg>
    `;

    botaoFiltro.addEventListener(
      'click',
      (evento) => {
        evento.stopPropagation();

        abrirMenuFiltro(
          indice,
          botaoFiltro
        );
      }
    );

    cabecalho.append(
      nome,
      botaoFiltro
    );

    th.appendChild(cabecalho);
    headRow.appendChild(th);
  });

  const thAcao =
    document.createElement('th');

  thAcao.className =
    'px-4 py-3 text-right whitespace-nowrap';

  const limparFiltros =
    document.createElement('button');

  limparFiltros.type = 'button';
  limparFiltros.id = 'limparFiltrosBtn';

  limparFiltros.className =
    'btn btn-ghost text-xs px-2 py-1.5';

  limparFiltros.textContent =
    'Limpar filtros';

  limparFiltros.addEventListener(
    'click',
    () => {
      filtrosSelecionados.clear();
      fecharMenuFiltro();
      aplicarFiltros();
    }
  );

  thAcao.appendChild(limparFiltros);
  headRow.appendChild(thAcao);

  table.classList.toggle(
    'hidden',
    columns.length === 0
  );

  const quantidadeLinhas =
    document.querySelectorAll(
      '#bodyRows tr'
    ).length;

  emptyState.classList.toggle(
    'hidden',
    quantidadeLinhas > 0
  );

  aplicarFiltros();
}

function valoresUnicosDaColuna(indice) {
  const mapa = new Map();

  document
    .querySelectorAll('#bodyRows tr')
    .forEach((linha) => {
      const input =
        linha.querySelectorAll(
          '.cell-editavel'
        )[indice];

      const exibicao =
        input?.value.trim() ||
        PLACEHOLDER;

      const chave =
        normalizarFiltro(exibicao);

      if (!mapa.has(chave)) {
        mapa.set(chave, exibicao);
      }
    });

  return Array
    .from(mapa.entries())
    .sort((a, b) =>
      a[1].localeCompare(
        b[1],
        'pt-BR',
        {
          numeric: true,
          sensitivity: 'base',
        }
      )
    );
}

function fecharMenuFiltro() {
  if (menuFiltroAberto) {
    menuFiltroAberto.remove();
  }

  menuFiltroAberto = null;
}

function criarOpcaoFiltro(
  texto,
  marcada,
  destaque = false
) {
  const label =
    document.createElement('label');

  label.className =
    'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer';

  label.addEventListener(
    'mouseenter',
    () => {
      label.style.background =
        'var(--accent-soft)';
    }
  );

  label.addEventListener(
    'mouseleave',
    () => {
      label.style.background =
        'transparent';
    }
  );

  const checkbox =
    document.createElement('input');

  checkbox.type = 'checkbox';
  checkbox.checked = marcada;

  checkbox.style.accentColor =
    'var(--accent)';

  const span =
    document.createElement('span');

  span.className =
    'truncate flex-1';

  if (destaque) {
    span.classList.add('font-semibold');
  }

  span.textContent = texto;

  label.append(checkbox, span);

  return {
    label,
    checkbox,
  };
}

function abrirMenuFiltro(
  indice,
  botao
) {
  fecharMenuFiltro();

  const valores =
    valoresUnicosDaColuna(indice);

  const selecionadosAtuais =
    filtrosSelecionados.get(indice);

  const temporarios =
    new Set(
      selecionadosAtuais ||
      valores.map(
        ([chave]) => chave
      )
    );

  const menu =
    document.createElement('div');

  const rect =
    botao.getBoundingClientRect();

  menu.className =
    'fixed z-50 w-72 card card-elevated p-3 text-sm';

  menu.style.left =
    `${Math.max(
      8,
      Math.min(
        rect.left,
        window.innerWidth - 300
      )
    )}px`;

  menu.style.top =
    `${rect.bottom + 6}px`;

  menu.addEventListener(
    'click',
    (evento) => {
      evento.stopPropagation();
    }
  );

  const titulo =
    document.createElement('div');

  titulo.className =
    'flex items-center justify-between gap-3 pb-2 mb-2';

  titulo.style.borderBottom =
    '1px solid var(--line)';

  const nomeColuna =
    document.createElement('span');

  nomeColuna.className =
    'font-semibold text-sm truncate';

  nomeColuna.textContent =
    columns[indice].name;

  const quantidade =
    document.createElement('span');

  quantidade.className =
    'mono text-xs shrink-0';

  quantidade.style.color =
    'var(--muted)';

  quantidade.textContent =
    `${valores.length} valor(es)`;

  titulo.append(
    nomeColuna,
    quantidade
  );

  menu.appendChild(titulo);

  const lista =
    document.createElement('div');

  lista.className =
    'overflow-y-auto pr-1';

  lista.style.maxHeight =
    '280px';

  const selecionarTudo =
    criarOpcaoFiltro(
      '(Selecionar tudo)',
      temporarios.size ===
        valores.length,
      true
    );

  lista.appendChild(
    selecionarTudo.label
  );

  const separador =
    document.createElement('div');

  separador.className = 'my-1';

  separador.style.borderTop =
    '1px solid var(--line)';

  lista.appendChild(separador);

  const opcoes =
    valores.map(
      ([chave, exibicao]) => {
        const opcao =
          criarOpcaoFiltro(
            exibicao,
            temporarios.has(chave)
          );

        lista.appendChild(
          opcao.label
        );

        return {
          chave,
          checkbox:
            opcao.checkbox,
        };
      }
    );

  function atualizarSelecionarTudo() {
    selecionarTudo.checkbox.checked =
      temporarios.size ===
      valores.length;

    selecionarTudo.checkbox.indeterminate =
      temporarios.size > 0 &&
      temporarios.size <
        valores.length;
  }

  selecionarTudo.checkbox.addEventListener(
    'change',
    () => {
      temporarios.clear();

      opcoes.forEach((opcao) => {
        opcao.checkbox.checked =
          selecionarTudo.checkbox.checked;

        if (
          selecionarTudo.checkbox.checked
        ) {
          temporarios.add(
            opcao.chave
          );
        }
      });

      atualizarSelecionarTudo();
    }
  );

  opcoes.forEach((opcao) => {
    opcao.checkbox.addEventListener(
      'change',
      () => {
        if (opcao.checkbox.checked) {
          temporarios.add(
            opcao.chave
          );
        } else {
          temporarios.delete(
            opcao.chave
          );
        }

        atualizarSelecionarTudo();
      }
    );
  });

  menu.appendChild(lista);

  const acoes =
    document.createElement('div');

  acoes.className =
    'grid grid-cols-2 gap-2 mt-3 pt-3';

  acoes.style.borderTop =
    '1px solid var(--line)';

  const limpar =
    document.createElement('button');

  limpar.type = 'button';

  limpar.className =
    'btn btn-outline px-3 py-2 text-xs';

  limpar.textContent = 'Limpar';

  limpar.addEventListener(
    'click',
    () => {
      filtrosSelecionados.delete(
        indice
      );

      fecharMenuFiltro();
      aplicarFiltros();
    }
  );

  const aplicar =
    document.createElement('button');

  aplicar.type = 'button';

  aplicar.className =
    'btn btn-accent px-3 py-2 text-xs';

  aplicar.textContent = 'Aplicar';

  aplicar.addEventListener(
    'click',
    () => {
      if (
        temporarios.size ===
        valores.length
      ) {
        filtrosSelecionados.delete(
          indice
        );
      } else {
        filtrosSelecionados.set(
          indice,
          new Set(temporarios)
        );
      }

      fecharMenuFiltro();
      aplicarFiltros();
    }
  );

  acoes.append(limpar, aplicar);
  menu.appendChild(acoes);

  document.body.appendChild(menu);

  menuFiltroAberto = menu;
}

function aplicarFiltros() {
  const linhas =
    Array.from(
      document.querySelectorAll(
        '#bodyRows tr'
      )
    );

  let visiveis = 0;

  linhas.forEach((linha) => {
    const campos =
      Array.from(
        linha.querySelectorAll(
          '.cell-editavel'
        )
      );

    const corresponde =
      Array
        .from(
          filtrosSelecionados.entries()
        )
        .every(
          ([indice, permitidos]) => {
            const exibicao =
              campos[indice]
                ?.value
                .trim() ||
              PLACEHOLDER;

            return permitidos.has(
              normalizarFiltro(exibicao)
            );
          }
        );

    linha.classList.toggle(
      'hidden',
      !corresponde
    );

    if (corresponde) {
      visiveis++;
    }
  });

  const botaoLimpar =
    document.getElementById(
      'limparFiltrosBtn'
    );

  const filtrosAtivos =
    filtrosSelecionados.size > 0;

  if (botaoLimpar) {
    botaoLimpar.disabled =
      !filtrosAtivos;

    botaoLimpar.textContent =
      filtrosAtivos
        ? `Limpar (${visiveis}/${linhas.length})`
        : 'Limpar filtros';
  }

  document
    .querySelectorAll(
      '.botao-filtro'
    )
    .forEach((botao) => {
      const indice =
        Number(
          botao.dataset.coluna
        );

      const ativo =
        filtrosSelecionados.has(
          indice
        );

      botao.style.background =
        ativo
          ? 'var(--accent)'
          : 'transparent';

      botao.style.color =
        ativo
          ? '#ffffff'
          : 'var(--muted)';

      botao.style.boxShadow =
        ativo
          ? 'var(--shadow-sm)'
          : 'none';
    });
}

async function extrairTextoPDF(file) {
  const buffer =
    await file.arrayBuffer();

  const pdf =
    await pdfjsLib.getDocument({
      data: buffer,
    }).promise;

  let texto = '';

  for (
    let paginaAtual = 1;
    paginaAtual <= pdf.numPages;
    paginaAtual++
  ) {
    const pagina =
      await pdf.getPage(
        paginaAtual
      );

    const conteudo =
      await pagina.getTextContent();

    texto +=
      conteudo.items
        .map((item) => item.str)
        .join(' ') + ' ';
  }

  return normalizarTextoDocumento(
    texto
  );
}

async function renderizarPaginaPDFComoImagem(
  file
) {
  const buffer =
    await file.arrayBuffer();

  const pdf =
    await pdfjsLib.getDocument({
      data: buffer,
    }).promise;

  const pagina =
    await pdf.getPage(1);

  const viewport =
    pagina.getViewport({
      scale: 2.5,
    });

  const canvas =
    document.createElement('canvas');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await pagina.render({
    canvasContext:
      canvas.getContext('2d'),
    viewport,
  }).promise;

  return canvas;
}

async function reconhecerTexto(
  imagemOuCanvas,
  nomeArquivo,
  statusEl
) {
  const { data } =
    await Tesseract.recognize(
      imagemOuCanvas,
      'por',
      {
        logger: (mensagem) => {
          if (
            mensagem.status ===
            'recognizing text'
          ) {
            const progresso =
              Math.round(
                mensagem.progress * 100
              );

            statusEl.textContent =
              `OCR ${progresso}% — ${nomeArquivo}`;
          }
        },
      }
    );

  return {
    texto:
      normalizarTextoDocumento(
        data.text
      ),

    linhas:
      (data.lines || [])
        .map((linha) =>
          linha.text.trim()
        )
        .filter(Boolean),
  };
}

const EXT_IMAGEM = [
  'jpg',
  'jpeg',
  'png',
];

function extensao(nome) {
  return nome
    .split('.')
    .pop()
    .toLowerCase();
}

function extrairCampos(texto) {
  texto =
    normalizarTextoDocumento(texto);

  const linha = {};
  let algumaFalha = false;

  columns.forEach((coluna) => {
    const regras =
      ANCORAS[coluna.name];

    const valor = regras
      ? tentarAncoras(texto, regras)
      : null;

    linha[coluna.name] = valor;

    if (!valor) {
      algumaFalha = true;
    }
  });

  return {
    valores: linha,
    precisaRevisao: algumaFalha,
  };
}

const ROTULOS_OCR = {
  'Número da NF': [
    /N[º°.]\s*\d/i,
    /NF-?e\s*\d/i,
    /N[ÚU]MERO\s*\/\s*S[ÉE]RIE/i,
  ],

  Cliente: [
    /TOMADOR\s+DE\s+SERVI[ÇC]OS/i,
    /NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL/i,
  ],

  'Data de Emissão': [
    /DATA\s*DE\s*EMISS[ÃA]O/i,
    /\bEMISS[ÃA]O\b/i,
  ],

  Valor: [
    /(?:VALOR\s*)?TOTAL\s*DA\s*NOTA/i,
  ],
};

function extrairPeloFormato(
  nomeColuna,
  linhaDeTexto
) {
  if (nomeColuna === 'Número da NF') {
    const resultado =
      linhaDeTexto.match(
        /(?:N[º°.]|NF-?e)\.?\s*[:|]?\s*0*(\d{3,12})/i
      ) ||
      linhaDeTexto.match(
        /N[ÚU]MERO\s*\/\s*S[ÉE]RIE\s*:?\s*0*(\d{3,12})/i
      ) ||
      linhaDeTexto.match(
        /\b0*(\d{3,12})\s*\/\s*NF-?e\b/i
      );

    return resultado
      ? resultado[1]
      : null;
  }

  if (
    nomeColuna ===
    'Data de Emissão'
  ) {
    const resultado =
      linhaDeTexto.match(
        /\d{2}\/\d{2}\/\d{4}/
      );

    return resultado
      ? resultado[0]
      : null;
  }

  if (nomeColuna === 'Valor') {
    const valores =
      linhaDeTexto.match(
        /\d{1,3}(?:\.\d{3})*,\d{2}/g
      );

    return valores?.length
      ? valores[valores.length - 1]
      : null;
  }

  if (nomeColuna === 'Cliente') {
    const resultado =
      linhaDeTexto.match(
        /^([A-ZÀ-Ü][A-ZÀ-Ü0-9&.,'\-\s]*?)(?=\s\d)/
      );

    return resultado
      ? resultado[1].trim()
      : null;
  }

  return null;
}

function extrairCamposOCR(resultadoOCR) {
  const texto =
    normalizarTextoDocumento(
      resultadoOCR.texto
    );

  const linhas =
    resultadoOCR.linhas;

  const linhaResultado = {};
  let algumaFalha = false;

  columns.forEach((coluna) => {
    let valor = null;

    const rotulos =
      ROTULOS_OCR[coluna.name];

    if (
      coluna.name === 'Cliente' &&
      ANCORAS[coluna.name]
    ) {
      valor = tentarAncoras(
        texto,
        ANCORAS[coluna.name]
      );
    }

    if (!valor && rotulos) {
      const indiceRotulo =
        linhas.findIndex((linha) =>
          rotulos.some((regex) =>
            regex.test(linha)
          )
        );

      if (indiceRotulo !== -1) {
        valor = extrairPeloFormato(
          coluna.name,
          linhas[indiceRotulo]
        );

        for (
          let salto = 1;
          !valor && salto <= 3;
          salto++
        ) {
          const proximaLinha =
            linhas[indiceRotulo + salto];

          if (proximaLinha) {
            valor = extrairPeloFormato(
              coluna.name,
              proximaLinha
            );
          }
        }
      }
    }

    if (
      !valor &&
      ANCORAS[coluna.name]
    ) {
      valor = tentarAncoras(
        texto,
        ANCORAS[coluna.name]
      );
    }

    linhaResultado[coluna.name] =
      valor;

    if (!valor) {
      algumaFalha = true;
    }
  });

  return {
    valores: linhaResultado,
    precisaRevisao: algumaFalha,
  };
}

const PLACEHOLDER =
  '— não encontrado';

function adicionarLinha(
  nomeArquivo,
  resultado,
  urlArquivo,
  viaOCR
) {
  const bodyRows =
    document.getElementById(
      'bodyRows'
    );

  const tr =
    document.createElement('tr');

  atualizarDestaqueLinha(
    tr,
    resultado.precisaRevisao
  );

  columns.forEach((coluna) => {
    const td =
      document.createElement('td');

    td.className =
      'px-2 py-1.5';

    const input =
      document.createElement('input');

    const valor =
      resultado.valores[coluna.name];

    input.type = 'text';
    input.value = valor ?? '';
    input.placeholder = PLACEHOLDER;

    input.className =
      'cell-editavel w-full px-2 py-1.5 text-sm mono bg-transparent border-0';

    if (!valor) {
      input.style.color =
        'var(--warn-text)';
    }

    input.addEventListener(
      'input',
      () => {
        input.style.color =
          input.value.trim()
            ? ''
            : 'var(--warn-text)';

        aplicarFiltros();
      }
    );

    input.addEventListener(
      'keydown',
      (evento) => {
        if (evento.key === 'Enter') {
          evento.preventDefault();
          input.blur();
        }
      }
    );

    input.addEventListener(
      'blur',
      () => {
        reavaliarLinha(tr);
      }
    );

    td.appendChild(input);
    tr.appendChild(td);
  });

  const tdAcao =
    document.createElement('td');

  tdAcao.className =
    'px-4 py-3 text-right whitespace-nowrap';

  const badgeOCR = viaOCR
    ? `
      <span
        class="badge badge-ocr mr-2"
        title="Lido por reconhecimento de imagem"
      >
        OCR
      </span>
    `
    : '';

  tdAcao.innerHTML = `
    ${badgeOCR}

    <a
      href="${urlArquivo}"
      target="_blank"
      rel="noopener noreferrer"
      class="text-xs font-medium underline decoration-dotted underline-offset-2"
      style="color:var(--accent)"
    >
      ver arquivo
    </a>
  `;

  tr.appendChild(tdAcao);
  bodyRows.appendChild(tr);

  const quantidade =
    bodyRows.children.length;

  document
    .getElementById('rowCount')
    .textContent =
      String(quantidade);

  document
    .getElementById('emptyState')
    .classList.add('hidden');

  document
    .getElementById('previewTable')
    .classList.remove('hidden');

  aplicarFiltros();
}

function atualizarDestaqueLinha(
  tr,
  precisaRevisao
) {
  tr.classList.toggle(
    'linha-revisao',
    precisaRevisao
  );
}

function reavaliarLinha(tr) {
  const campos =
    tr.querySelectorAll(
      '.cell-editavel'
    );

  const aindaFaltaAlgo =
    Array.from(campos).some(
      (input) =>
        input.value.trim() === ''
    );

  atualizarDestaqueLinha(
    tr,
    aindaFaltaAlgo
  );
}

async function processarArquivos(
  fileList
) {
  const status =
    document.getElementById(
      'statusMsg'
    );

  const todos =
    Array.from(fileList);

  const arquivos =
    todos.filter((arquivo) =>
      ['pdf', ...EXT_IMAGEM].includes(
        extensao(arquivo.name)
      )
    );

  const ignorados =
    todos.length - arquivos.length;

  for (
    let indice = 0;
    indice < arquivos.length;
    indice++
  ) {
    const file = arquivos[indice];
    const ext = extensao(file.name);

    const url =
      URL.createObjectURL(file);

    status.textContent =
      `Processando ${indice + 1}/${arquivos.length}: ${file.name}...`;

    let resultadoExtracao;
    let viaOCR = false;

    try {
      if (EXT_IMAGEM.includes(ext)) {
        viaOCR = true;

        const resultadoOCR =
          await reconhecerTexto(
            file,
            file.name,
            status
          );

        resultadoExtracao =
          extrairCamposOCR(
            resultadoOCR
          );
      } else {
        const texto =
          await extrairTextoPDF(file);

        if (texto.length < 30) {
          viaOCR = true;

          const canvas =
            await renderizarPaginaPDFComoImagem(
              file
            );

          const resultadoOCR =
            await reconhecerTexto(
              canvas,
              file.name,
              status
            );

          resultadoExtracao =
            extrairCamposOCR(
              resultadoOCR
            );
        } else {
          resultadoExtracao =
            extrairCampos(texto);

          if (
            resultadoExtracao
              .precisaRevisao
          ) {
            viaOCR = true;

            const canvas =
              await renderizarPaginaPDFComoImagem(
                file
              );

            const resultadoOCR =
              await reconhecerTexto(
                canvas,
                file.name,
                status
              );

            const camposOCR =
              extrairCamposOCR(
                resultadoOCR
              );

            columns.forEach(
              (coluna) => {
                const nome =
                  coluna.name;

                if (
                  !resultadoExtracao
                    .valores[nome] &&
                  camposOCR.valores[nome]
                ) {
                  resultadoExtracao
                    .valores[nome] =
                    camposOCR.valores[nome];
                }
              }
            );

            resultadoExtracao
              .precisaRevisao =
              columns.some(
                (coluna) =>
                  !resultadoExtracao
                    .valores[
                      coluna.name
                    ]
              );
          }
        }
      }

      adicionarLinha(
        file.name,
        resultadoExtracao,
        url,
        viaOCR
      );
    } catch (erro) {
      console.error(
        `Falha ao processar ${file.name}:`,
        erro
      );

      adicionarLinha(
        file.name,
        {
          valores: {},
          precisaRevisao: true,
        },
        url,
        viaOCR
      );
    }
  }

  status.textContent =
    `${arquivos.length} arquivo(s) processado(s).` +
    (
      ignorados
        ? ` ${ignorados} ignorado(s).`
        : ''
    );
}

document
  .getElementById('addCol')
  .addEventListener(
    'click',
    () => {
      const nameInput =
        document.getElementById(
          'colName'
        );

      const typeSelect =
        document.getElementById(
          'colType'
        );

      const name =
        nameInput.value.trim();

      if (!name) {
        nameInput.focus();
        return;
      }

      columns.push({
        name,
        type: typeSelect.value,
      });

      nameInput.value = '';

      filtrosSelecionados.clear();
      renderColumnList();
      renderTable();
    }
  );

document
  .getElementById('colName')
  .addEventListener(
    'keydown',
    (evento) => {
      if (evento.key === 'Enter') {
        document
          .getElementById('addCol')
          .click();
      }
    }
  );

document
  .getElementById('generateBtn')
  .addEventListener(
    'click',
    renderTable
  );

document
  .getElementById('fileInput')
  .addEventListener(
    'change',
    async (evento) => {
      await processarArquivos(
        evento.target.files
      );

      evento.target.value = '';
    }
  );

document
  .getElementById('fileInputEmpty')
  .addEventListener(
    'change',
    async (evento) => {
      await processarArquivos(
        evento.target.files
      );

      evento.target.value = '';
    }
  );

const dropZone =
  document.getElementById('dropZone');

[
  'dragenter',
  'dragover',
].forEach((evento) => {
  dropZone.addEventListener(
    evento,
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      dropZone.classList.add(
        'is-active'
      );
    }
  );
});

[
  'dragleave',
  'drop',
].forEach((evento) => {
  dropZone.addEventListener(
    evento,
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      dropZone.classList.remove(
        'is-active'
      );
    }
  );
});

dropZone.addEventListener(
  'drop',
  (evento) => {
    if (
      evento.dataTransfer.files.length
    ) {
      processarArquivos(
        evento.dataTransfer.files
      );
    }
  }
);

async function copiarTabela() {
  const cabecalho =
    columns
      .map((coluna) => coluna.name)
      .join('\t');

  const linhasTexto =
    Array.from(
      document.querySelectorAll(
        '#bodyRows tr:not(.hidden)'
      )
    ).map((linha) => {
      const campos =
        linha.querySelectorAll(
          '.cell-editavel'
        );

      return Array
        .from(campos)
        .map((input) => input.value)
        .join('\t');
    });

  const tsv =
    [cabecalho, ...linhasTexto]
      .join('\n');

  try {
    await navigator
      .clipboard
      .writeText(tsv);
  } catch (erro) {
    const textarea =
      document.createElement(
        'textarea'
      );

    textarea.value = tsv;
    textarea.style.position =
      'fixed';

    textarea.style.opacity = '0';

    document.body.appendChild(
      textarea
    );

    textarea.select();
    document.execCommand('copy');

    document.body.removeChild(
      textarea
    );
  }

  const botao =
    document.getElementById(
      'copiarBtn'
    );

  const conteudoOriginal =
    botao.innerHTML;

  botao.textContent = 'Copiado ✓';
  botao.disabled = true;

  setTimeout(() => {
    botao.innerHTML =
      conteudoOriginal;

    botao.disabled = false;
  }, 1500);
}

document
  .getElementById('copiarBtn')
  .addEventListener(
    'click',
    copiarTabela
  );

document.addEventListener(
  'click',
  fecharMenuFiltro
);

window.addEventListener(
  'resize',
  fecharMenuFiltro
);

window.addEventListener(
  'scroll',
  fecharMenuFiltro,
  true
);

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

renderColumnList();
renderTable();
