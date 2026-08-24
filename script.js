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

        <span class="font-medium truncate">${col.name}</span>

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

  list.querySelectorAll('.remove-col').forEach((btn) => {
    btn.addEventListener('click', () => {
      columns.splice(Number(btn.dataset.i), 1);
      renderColumnList();
    });
  });
}

/*
|--------------------------------------------------------------------------
| REGRAS DE EXTRAÇÃO
|--------------------------------------------------------------------------
|
| Cada campo possui várias regras porque DANFE e NFS-e municipais
| apresentam os dados em estruturas diferentes.
|
*/

const ANCORAS = {
  'Número da NF': [
    // DANFE tradicional: "DANFE N. 000360216"
    /DANFE[\s\S]*?N[º°.]\s*0*(\d{4,9})/i,

    // DANFE tradicional: "DANFE NF-e 000360216"
    /DANFE[\s\S]*?NF-?e\.?\s*0*(\d{4,9})/i,

    // NFS-e municipal: "Número / Série 11548 NFe"
    /N[ÚU]MERO\s*\/\s*S[ÉE]RIE\s+0*(\d{3,12})\s+NF-?E/i,

    // Cabeçalho ou rodapé: "11548/NFe"
    /\b0*(\d{3,12})\s*\/\s*NF-?E\b/i,
  ],

  Cliente: [
    // DANFE tradicional
    /NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL\s+([A-ZÀ-Ú0-9.,&\-\s]+?)\s+CNPJ/i,

    // NFS-e municipal: procura especificamente o tomador
    /TOMADOR\s+DE\s+SERVI[ÇC]OS[\s\S]{0,250}?NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL\s*:?\s*([A-ZÀ-Ú0-9.,&()'\-\s]+?)\s+CPF\s*\/?\s*CNPJ/i,
  ],

  'Data de Emissão': [
    // DANFE tradicional
    /DATA\s*DE\s*EMISS[ÃA]O\s*(\d{2}\/\d{2}\/\d{4})/i,

    // NFS-e com data e horário
    /\bEMISS[ÃA]O\s+(\d{2}\/\d{2}\/\d{4})(?:\s+\d{2}:\d{2}(?::\d{2})?)?/i,
  ],

  Valor: [
    // DANFE tradicional
    /(?:VALOR\s*)?TOTAL\s*DA\s*NOTA\s*(?:R\$)?\s*([\d.,]+)/i,

    // NFS-e: "Valor Total da Nota (R$)"
    /VALOR\s*TOTAL\s*DA\s*NOTA\s*\(\s*R\$\s*\)[\s\S]{0,350}?\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/i,
  ],
};

/*
|--------------------------------------------------------------------------
| NORMALIZAÇÃO
|--------------------------------------------------------------------------
*/

function normalizarTextoDocumento(texto) {
  return texto
    .normalize('NFC')
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
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

/*
|--------------------------------------------------------------------------
| TABELA E COLUNAS
|--------------------------------------------------------------------------
*/

function renderTable() {
  const headRow = document.getElementById('headRow');
  const table = document.getElementById('previewTable');
  const emptyState = document.getElementById('emptyState');

  headRow.innerHTML = '';

  columns.forEach((col, i) => {
    const th = document.createElement('th');

    th.className =
      'text-left px-4 py-3 mono text-xs font-semibold uppercase tracking-wide';

    th.style.borderTop = `2px solid ${COLORS[i % COLORS.length]}`;
    th.textContent = col.name;

    headRow.appendChild(th);
  });

  const thAcao = document.createElement('th');
  thAcao.className = 'px-4 py-3';
  headRow.appendChild(thAcao);

  document.getElementById('bodyRows').innerHTML = '';
  document.getElementById('rowCount').textContent = '0';

  table.classList.toggle('hidden', columns.length === 0);
  emptyState.classList.remove('hidden');
}

/*
|--------------------------------------------------------------------------
| EXTRAÇÃO DE PDF
|--------------------------------------------------------------------------
*/

async function extrairTextoPDF(file) {
  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: buffer,
  }).promise;

  let texto = '';

  for (let paginaAtual = 1; paginaAtual <= pdf.numPages; paginaAtual++) {
    const pagina = await pdf.getPage(paginaAtual);
    const conteudo = await pagina.getTextContent();

    texto += conteudo.items.map((item) => item.str).join(' ') + ' ';
  }

  return normalizarTextoDocumento(texto);
}

async function renderizarPaginaPDFComoImagem(file) {
  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: buffer,
  }).promise;

  const pagina = await pdf.getPage(1);
  const viewport = pagina.getViewport({ scale: 2.5 });

  const canvas = document.createElement('canvas');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await pagina.render({
    canvasContext: canvas.getContext('2d'),
    viewport,
  }).promise;

  return canvas;
}

/*
|--------------------------------------------------------------------------
| OCR
|--------------------------------------------------------------------------
*/

async function reconhecerTexto(imagemOuCanvas, nomeArquivo, statusEl) {
  const { data } = await Tesseract.recognize(
    imagemOuCanvas,
    'por',
    {
      logger: (mensagem) => {
        if (mensagem.status === 'recognizing text') {
          const progresso = Math.round(mensagem.progress * 100);

          statusEl.textContent =
            `OCR ${progresso}% — ${nomeArquivo}`;
        }
      },
    }
  );

  return {
    texto: normalizarTextoDocumento(data.text),

    linhas: (data.lines || [])
      .map((linha) => linha.text.trim())
      .filter(Boolean),
  };
}

const EXT_IMAGEM = ['jpg', 'jpeg', 'png'];

function extensao(nome) {
  return nome.split('.').pop().toLowerCase();
}

/*
|--------------------------------------------------------------------------
| EXTRAÇÃO DE CAMPOS EM PDF COM TEXTO
|--------------------------------------------------------------------------
*/

function extrairCampos(texto) {
  texto = normalizarTextoDocumento(texto);

  const linha = {};
  let algumaFalha = false;

  columns.forEach((coluna) => {
    const regras = ANCORAS[coluna.name];

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

/*
|--------------------------------------------------------------------------
| EXTRAÇÃO DE CAMPOS COM OCR
|--------------------------------------------------------------------------
*/

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

function extrairPeloFormato(nomeColuna, linhaDeTexto) {
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

    return resultado ? resultado[1] : null;
  }

  if (nomeColuna === 'Data de Emissão') {
    const resultado =
      linhaDeTexto.match(/\d{2}\/\d{2}\/\d{4}/);

    return resultado ? resultado[0] : null;
  }

  if (nomeColuna === 'Valor') {
    const valores =
      linhaDeTexto.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);

    if (valores && valores.length) {
      return valores[valores.length - 1];
    }

    return null;
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
    normalizarTextoDocumento(resultadoOCR.texto);

  const linhas = resultadoOCR.linhas;
  const linhaResultado = {};

  let algumaFalha = false;

  columns.forEach((coluna) => {
    let valor = null;

    const rotulos =
      ROTULOS_OCR[coluna.name];

    /*
     * Uma NFS-e possui prestador e tomador.
     * Para não retornar o prestador como cliente, a busca do cliente
     * começa obrigatoriamente na seção "Tomador de Serviços".
     */
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
      const indiceRotulo = linhas.findIndex((linha) =>
        rotulos.some((regex) => regex.test(linha))
      );

      if (indiceRotulo !== -1) {
        valor = extrairPeloFormato(
          coluna.name,
          linhas[indiceRotulo]
        );

        /*
         * O OCR pode colocar o rótulo e o valor em linhas
         * diferentes. Por isso, verifica até três linhas abaixo.
         */
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

    linhaResultado[coluna.name] = valor;

    if (!valor) {
      algumaFalha = true;
    }
  });

  return {
    valores: linhaResultado,
    precisaRevisao: algumaFalha,
  };
}

/*
|--------------------------------------------------------------------------
| LINHAS DA TABELA
|--------------------------------------------------------------------------
*/

const PLACEHOLDER = '— não encontrado';

function adicionarLinha(
  nomeArquivo,
  resultado,
  urlArquivo,
  viaOCR
) {
  const bodyRows =
    document.getElementById('bodyRows');

  const tr =
    document.createElement('tr');

  atualizarDestaqueLinha(
    tr,
    resultado.precisaRevisao
  );

  columns.forEach((coluna) => {
    const td =
      document.createElement('td');

    td.className = 'px-2 py-1.5';

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
      input.style.color = 'var(--warn-text)';
    }

    input.addEventListener('input', () => {
      input.style.color =
        input.value.trim()
          ? ''
          : 'var(--warn-text)';
    });

    input.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        input.blur();
      }
    });

    input.addEventListener('blur', () => {
      reavaliarLinha(tr);
    });

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
        title="Lido por reconhecimento de imagem — confira com mais atenção"
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

  document.getElementById('rowCount').textContent =
    String(quantidade);

  document
    .getElementById('emptyState')
    .classList.add('hidden');

  document
    .getElementById('previewTable')
    .classList.remove('hidden');
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
    tr.querySelectorAll('.cell-editavel');

  const aindaFaltaAlgo =
    Array.from(campos).some(
      (input) => input.value.trim() === ''
    );

  atualizarDestaqueLinha(
    tr,
    aindaFaltaAlgo
  );
}

/*
|--------------------------------------------------------------------------
| PROCESSAMENTO DOS ARQUIVOS
|--------------------------------------------------------------------------
*/

async function processarArquivos(fileList) {
  const status =
    document.getElementById('statusMsg');

  const todos =
    Array.from(fileList);

  const arquivos = todos.filter((arquivo) =>
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
        /*
         * JPG ou PNG: utiliza OCR diretamente.
         */
        viaOCR = true;

        const resultadoOCR =
          await reconhecerTexto(
            file,
            file.name,
            status
          );

        resultadoExtracao =
          extrairCamposOCR(resultadoOCR);
      } else {
        /*
         * PDF: tenta primeiro a camada de texto.
         */
        const texto =
          await extrairTextoPDF(file);

        if (texto.length < 30) {
          /*
           * PDF digitalizado sem camada de texto.
           */
          viaOCR = true;

          const canvas =
            await renderizarPaginaPDFComoImagem(file);

          const resultadoOCR =
            await reconhecerTexto(
              canvas,
              file.name,
              status
            );

          resultadoExtracao =
            extrairCamposOCR(resultadoOCR);
        } else {
          /*
           * PDF com texto nativo.
           */
          resultadoExtracao =
            extrairCampos(texto);

          /*
           * Alguns PDFs possuem apenas parte do conteúdo como texto.
           * Se algum campo não for encontrado, o OCR é utilizado como
           * segunda tentativa.
           */
          if (resultadoExtracao.precisaRevisao) {
            viaOCR = true;

            const canvas =
              await renderizarPaginaPDFComoImagem(file);

            const resultadoOCR =
              await reconhecerTexto(
                canvas,
                file.name,
                status
              );

            const camposOCR =
              extrairCamposOCR(resultadoOCR);

            columns.forEach((coluna) => {
              const nome =
                coluna.name;

              if (
                !resultadoExtracao.valores[nome] &&
                camposOCR.valores[nome]
              ) {
                resultadoExtracao.valores[nome] =
                  camposOCR.valores[nome];
              }
            });

            resultadoExtracao.precisaRevisao =
              columns.some(
                (coluna) =>
                  !resultadoExtracao.valores[coluna.name]
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
        ? ` ${ignorados} ignorado(s) por formato não suportado.`
        : ''
    );
}

/*
|--------------------------------------------------------------------------
| ADICIONAR COLUNA
|--------------------------------------------------------------------------
*/

document
  .getElementById('addCol')
  .addEventListener('click', () => {
    const nameInput =
      document.getElementById('colName');

    const typeSelect =
      document.getElementById('colType');

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

    renderColumnList();
    renderTable();
  });

document
  .getElementById('colName')
  .addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      document
        .getElementById('addCol')
        .click();
    }
  });

document
  .getElementById('generateBtn')
  .addEventListener('click', renderTable);

/*
|--------------------------------------------------------------------------
| INPUTS DE ARQUIVOS
|--------------------------------------------------------------------------
*/

document
  .getElementById('fileInput')
  .addEventListener('change', async (evento) => {
    await processarArquivos(evento.target.files);

    // Permite selecionar novamente o mesmo arquivo.
    evento.target.value = '';
  });

document
  .getElementById('fileInputEmpty')
  .addEventListener('change', async (evento) => {
    await processarArquivos(evento.target.files);

    evento.target.value = '';
  });

/*
|--------------------------------------------------------------------------
| ARRASTAR E SOLTAR
|--------------------------------------------------------------------------
*/

const dropZone =
  document.getElementById('dropZone');

['dragenter', 'dragover'].forEach((evento) => {
  dropZone.addEventListener(evento, (e) => {
    e.preventDefault();
    e.stopPropagation();

    dropZone.classList.add('is-active');
  });
});

['dragleave', 'drop'].forEach((evento) => {
  dropZone.addEventListener(evento, (e) => {
    e.preventDefault();
    e.stopPropagation();

    dropZone.classList.remove('is-active');
  });
});

dropZone.addEventListener('drop', (evento) => {
  if (evento.dataTransfer.files.length) {
    processarArquivos(
      evento.dataTransfer.files
    );
  }
});

/*
|--------------------------------------------------------------------------
| COPIAR PARA O EXCEL
|--------------------------------------------------------------------------
*/

async function copiarTabela() {
  const cabecalho =
    columns
      .map((coluna) => coluna.name)
      .join('\t');

  const linhasTexto =
    Array.from(
      document.querySelectorAll('#bodyRows tr')
    ).map((tr) => {
      const campos =
        tr.querySelectorAll('.cell-editavel');

      return Array.from(campos)
        .map((input) => input.value)
        .join('\t');
    });

  const tsv =
    [cabecalho, ...linhasTexto].join('\n');

  try {
    await navigator.clipboard.writeText(tsv);
  } catch (erro) {
    const textarea =
      document.createElement('textarea');

    textarea.value = tsv;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);

    textarea.select();
    document.execCommand('copy');

    document.body.removeChild(textarea);
  }

  const btn =
    document.getElementById('copiarBtn');

  const conteudoOriginal =
    btn.innerHTML;

  btn.textContent = 'Copiado ✓';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = conteudoOriginal;
    btn.disabled = false;
  }, 1500);
}

document
  .getElementById('copiarBtn')
  .addEventListener('click', copiarTabela);

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO DO PDF.JS
|--------------------------------------------------------------------------
*/

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/*
|--------------------------------------------------------------------------
| INICIALIZAÇÃO
|--------------------------------------------------------------------------
*/

renderColumnList();
renderTable();
