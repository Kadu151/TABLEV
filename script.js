  const COLORS = ['#2F5D50', '#8A5A3B', '#3D5A80', '#7A6B4F'];
  let columns = [
    { name: 'Número da NF', type: 'texto' },
    { name: 'Cliente', type: 'texto' },
    { name: 'Data de Emissão', type: 'data' },
    { name: 'Valor', type: 'valor' },
  ];

  const typeLabel = { texto: 'Texto', data: 'Data', valor: 'Valor (R$)', numero: 'Número' };

  function renderColumnList() {
    const list = document.getElementById('colList');
    list.innerHTML = '';
    columns.forEach((col, i) => {
      const chip = document.createElement('div');
      chip.className = 'col-chip card flex items-center justify-between px-3 py-2 text-sm';
      chip.innerHTML = `
        <div class="flex items-center gap-2 min-w-0">
          <span class="type-dot shrink-0" style="background:${COLORS[i % COLORS.length]}; color:${COLORS[i % COLORS.length]}"></span>
          <span class="font-medium truncate">${col.name}</span>
          <span class="mono text-xs shrink-0" style="color:var(--muted)">${typeLabel[col.type]}</span>
        </div>
        <button data-i="${i}" class="remove-col icon-btn shrink-0" title="Remover coluna">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      `;
      list.appendChild(chip);
    });
    list.querySelectorAll('.remove-col').forEach(btn => {
      btn.addEventListener('click', () => {
        columns.splice(Number(btn.dataset.i), 1);
        renderColumnList();
      });
    });
  }

  // ---------------------------------------------------------------
  // MAPA DE ÂNCORAS: liga cada coluna "padrão" ao(s) jeito(s) que o
  // rótulo pode aparecer no documento. Cada coluna tem uma LISTA de
  // variações — a primeira que der match "vence". Isso é o mecanismo
  // que lida com variação de layout: quando aparecer uma nota com um
  // rótulo escrito diferente (ex: "TOTAL DA NOTA" em vez de "VALOR
  // TOTAL DA NOTA"), a correção é ADICIONAR mais uma opção na lista,
  // sem precisar reescrever a lógica. Isso é o "template" que a Fase
  // 3 do projeto vai tornar editável pela interface — por enquanto
  // está fixo aqui no código.
  // ---------------------------------------------------------------
  const ANCORAS = {
    'Número da NF': [
      /DANFE[\s\S]*?N[º°.]\s*0*(\d{4,9})/i,          // "N. 000360216"
      /DANFE[\s\S]*?NF-?e\.?\s*0*(\d{4,9})/i,        // "NF-e 000360216"
    ],
    'Cliente': [
      /NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL\s+([A-ZÀ-Ú0-9.,&\-\s]+?)\s+CNPJ/i,
    ],
    'Data de Emissão': [
      /DATA\s*DE\s*EMISS[ÃA]O\s*(\d{2}\/\d{2}\/\d{4})/i,
    ],
    'Valor': [
      /(?:VALOR\s*)?TOTAL\s*DA\s*NOTA\s*(?:R\$)?\s*([\d.,]+)/i, // "VALOR TOTAL DA NOTA" OU só "TOTAL DA NOTA"
    ],
  };

  // Testa uma LISTA de regex contra o texto e devolve o primeiro
  // valor capturado que der certo — é assim que a ferramenta lida
  // com variação de rótulo entre layouts diferentes de nota.
  function tentarAncoras(texto, listaRegex) {
    for (const regex of listaRegex) {
      const m = texto.match(regex);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  }

  let ultimosArquivos = []; // guarda File + url pra abrir o PDF na revisão

  function renderTable() {
    const headRow = document.getElementById('headRow');
    const table = document.getElementById('previewTable');
    const emptyState = document.getElementById('emptyState');

    headRow.innerHTML = '';
    columns.forEach((col, i) => {
      const th = document.createElement('th');
      th.className = 'text-left px-4 py-3 mono text-xs font-semibold uppercase tracking-wide';
      th.style.borderTop = `2px solid ${COLORS[i % COLORS.length]}`;
      th.textContent = col.name;
      headRow.appendChild(th);
    });
    const thAcao = document.createElement('th');
    thAcao.className = 'px-4 py-3';
    headRow.appendChild(thAcao);

    document.getElementById('bodyRows').innerHTML = '';
    table.classList.toggle('hidden', columns.length === 0);
    emptyState.classList.toggle('hidden', columns.length === 0);
  }

  // Extrai o texto de todas as páginas de um PDF usando PDF.js
  async function extrairTextoPDF(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      texto += content.items.map(it => it.str).join(' ') + ' ';
    }
    return texto.replace(/\s+/g, ' ').trim();
  }

  // Renderiza a página 1 de um PDF sem camada de texto como imagem,
  // pra poder passar pro OCR (Tesseract só lê pixels, não PDF).
  async function renderizarPaginaPDFComoImagem(file) {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 }); // resolução maior = OCR mais preciso
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return canvas;
  }

  // Roda o OCR (Tesseract.js, em português) sobre uma imagem/canvas
  // e reporta progresso na barra de status enquanto processa.
  // Devolve tanto o texto corrido quanto as LINHAS separadas — o
  // Tesseract já identifica onde cada linha visual termina, e é isso
  // que a extração de tabela precisa pra achar "o valor que está na
  // linha de baixo do rótulo", não só "logo depois do rótulo".
  async function reconhecerTexto(imagemOuCanvas, nomeArquivo, statusEl) {
    const { data } = await Tesseract.recognize(imagemOuCanvas, 'por', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          statusEl.textContent = `OCR ${Math.round(m.progress * 100)}% — ${nomeArquivo}`;
        }
      },
    });
    return {
      texto: data.text.replace(/\s+/g, ' ').trim(),
      linhas: (data.lines || []).map(l => l.text.trim()).filter(Boolean),
    };
  }

  const EXT_IMAGEM = ['jpg', 'jpeg', 'png'];
  function extensao(nome) { return nome.split('.').pop().toLowerCase(); }

  // Aplica as âncoras conhecidas sobre o texto extraído de UM pdf
  // e devolve um valor por coluna configurada + se algo falhou.
  // Usada para texto nativo de PDF, onde rótulo e valor normalmente
  // vêm colados no fluxo do documento.
  function extrairCampos(texto) {
    const linha = {};
    let algumaFalha = false;
    columns.forEach(col => {
      const valor = ANCORAS[col.name] ? tentarAncoras(texto, ANCORAS[col.name]) : null;
      linha[col.name] = valor;
      if (!valor) algumaFalha = true;
    });
    return { valores: linha, precisaRevisao: algumaFalha };
  }

  // ---------------------------------------------------------------
  // Rótulo de cada coluna — em LISTA, pelo mesmo motivo do ANCORAS
  // acima (layouts diferentes escrevem o rótulo diferente). Usado
  // pra achar em qual LINHA o rótulo está, já que em OCR de tabela
  // uma linha de rótulos costuma vir seguida de uma linha só de
  // valores (rótulo e valor acabam em linhas diferentes).
  // ---------------------------------------------------------------
  const ROTULOS_OCR = {
    'Número da NF':    [/N[º°.]\s*\d/i, /NF-?e\s*\d/i],
    'Cliente':         [/NOME\s*\/?\s*RAZ[ÃA]O\s*SOCIAL/i],
    'Data de Emissão': [/DATA\s*DE\s*EMISS[ÃA]O/i],
    'Valor':           [/(?:VALOR\s*)?TOTAL\s*DA\s*NOTA/i],
  };

  // Dado o nome da coluna, extrai o valor certo de dentro de uma
  // linha de texto, usando o FORMATO esperado (data, dinheiro, nome,
  // número da nota) em vez de depender de estar logo após o rótulo.
  function extrairPeloFormato(nomeColuna, linhaDeTexto) {
    if (nomeColuna === 'Número da NF') {
      const m = linhaDeTexto.match(/(?:N[º°.]|NF-?e)\.?\s*[:\|]?\s*0*(\d{4,9})/i);
      return m ? m[1] : null;
    }
    if (nomeColuna === 'Data de Emissão') {
      const m = linhaDeTexto.match(/\d{2}\/\d{2}\/\d{4}/);
      return m ? m[0] : null;
    }
    if (nomeColuna === 'Valor') {
      // o valor total é sempre a ÚLTIMA coluna da linha —
      // pega o ÚLTIMO valor monetário encontrado, não o primeiro.
      const nums = linhaDeTexto.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g);
      return nums && nums.length ? nums[nums.length - 1] : null;
    }
    if (nomeColuna === 'Cliente') {
      // nome do cliente é a primeira coisa na linha — captura tudo
      // até o primeiro número (onde começa o CNPJ da coluna vizinha).
      const m = linhaDeTexto.match(/^([A-ZÀ-Ü][A-ZÀ-Ü0-9&.,\-\s]*?)(?=\s\d)/);
      return m ? m[1].trim() : null;
    }
    return null;
  }

  // Extração usada quando o texto veio de OCR. Pra cada coluna com
  // rótulo conhecido: acha a linha do rótulo, tenta extrair PELO
  // FORMATO na própria linha (campos compactos, ex: "NF-e 000360216")
  // e, se não achar, na linha seguinte (campos de tabela, onde a
  // linha de baixo tem só os valores). Só usa a âncora genérica de
  // "mesma linha" (ANCORAS) como último recurso, pra colunas que o
  // usuário criou e não têm regra de tabela — nunca pra essas 4,
  // porque pegar "o próximo texto depois do rótulo" costuma pegar o
  // valor da coluna vizinha errada, não o certo.
  function extrairCamposOCR(resultadoOCR) {
    const { texto, linhas } = resultadoOCR;
    const linhaResultado = {};
    let algumaFalha = false;

    columns.forEach(col => {
      let valor = null;
      const rotulos = ROTULOS_OCR[col.name];

      if (rotulos) {
        const idx = linhas.findIndex(l => rotulos.some(regex => regex.test(l)));
        if (idx !== -1) {
          valor = extrairPeloFormato(col.name, linhas[idx]);          // própria linha
          if (!valor && linhas[idx + 1]) {
            valor = extrairPeloFormato(col.name, linhas[idx + 1]);    // linha seguinte
          }
        }
      }

      if (!valor && ANCORAS[col.name]) {
        valor = tentarAncoras(texto, ANCORAS[col.name]);
      }

      linhaResultado[col.name] = valor;
      if (!valor) algumaFalha = true;
    });

    return { valores: linhaResultado, precisaRevisao: algumaFalha };
  }

  const PLACEHOLDER = '— não encontrado';

  function adicionarLinha(nomeArquivo, resultado, urlArquivo, viaOCR) {
    const bodyRows = document.getElementById('bodyRows');
    const tr = document.createElement('tr');
    atualizarDestaqueLinha(tr, resultado.precisaRevisao);

    columns.forEach(col => {
      const td = document.createElement('td');
      td.className = 'px-2 py-1.5';

      const input = document.createElement('input');
      input.type = 'text';
      const valor = resultado.valores[col.name];
      input.value = valor ?? '';
      input.placeholder = PLACEHOLDER;
      input.className = 'cell-editavel w-full px-2 py-1.5 text-sm mono bg-transparent border-0';
      if (!valor) input.style.color = 'var(--warn-text)';

      input.addEventListener('input', () => {
        input.style.color = input.value.trim() ? '' : 'var(--warn-text)';
      });

      // Enter confirma a edição (tira o foco) em vez de fazer nada
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      });

      // ao sair do campo, reavalia se a linha ainda precisa de revisão
      input.addEventListener('blur', () => reavaliarLinha(tr));

      td.appendChild(input);
      tr.appendChild(td);
    });

    const tdAcao = document.createElement('td');
    tdAcao.className = 'px-4 py-3 text-right whitespace-nowrap';
    tdAcao.innerHTML = `${viaOCR ? '<span class="badge badge-ocr mr-2" title="Lido por reconhecimento de imagem — confira com mais atenção">OCR</span>' : ''}<a href="${urlArquivo}" target="_blank" class="text-xs font-medium underline decoration-dotted underline-offset-2" style="color:var(--accent)">ver arquivo</a>`;
    tr.appendChild(tdAcao);
    bodyRows.appendChild(tr);

    const count = bodyRows.children.length;
    document.getElementById('rowCount').textContent = String(count);
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('previewTable').classList.remove('hidden');
  }

  function atualizarDestaqueLinha(tr, precisaRevisao) {
    tr.classList.toggle('linha-revisao', precisaRevisao);
  }

  // Depois de editar uma célula, verifica se ainda sobra algum campo
  // "não encontrado" nessa linha — só assim ela continua marcada
  // para revisão; se o usuário já preencheu tudo, o destaque some.
  function reavaliarLinha(tr) {
    const campos = tr.querySelectorAll('.cell-editavel');
    const aindaFaltaAlgo = Array.from(campos).some(input => input.value.trim() === '');
    atualizarDestaqueLinha(tr, aindaFaltaAlgo);
  }

  async function processarArquivos(fileList) {
    const status = document.getElementById('statusMsg');
    const todos = Array.from(fileList);
    const arquivos = todos.filter(f => ['pdf', ...EXT_IMAGEM].includes(extensao(f.name)));
    const ignorados = todos.length - arquivos.length;

    for (let i = 0; i < arquivos.length; i++) {
      const file = arquivos[i];
      const ext = extensao(file.name);
      const url = URL.createObjectURL(file);
      status.textContent = `processando ${i + 1}/${arquivos.length}: ${file.name}...`;
      let resultadoExtracao;
      let viaOCR = false;

      try {
        if (EXT_IMAGEM.includes(ext)) {
          // imagem (foto/print de nota): direto pro OCR
          viaOCR = true;
          const ocr = await reconhecerTexto(file, file.name, status);
          resultadoExtracao = extrairCamposOCR(ocr);
        } else {
          // PDF: tenta texto nativo primeiro (rápido)
          const texto = await extrairTextoPDF(file);
          if (texto.length < 30) {
            // sem camada de texto (digitalização) → cai pro OCR
            viaOCR = true;
            const canvas = await renderizarPaginaPDFComoImagem(file);
            const ocr = await reconhecerTexto(canvas, file.name, status);
            resultadoExtracao = extrairCamposOCR(ocr);
          } else {
            resultadoExtracao = extrairCampos(texto);
          }
        }
        adicionarLinha(file.name, resultadoExtracao, url, viaOCR);
      } catch (err) {
        adicionarLinha(file.name, { valores: {}, precisaRevisao: true }, url, viaOCR);
        console.error('Falha ao ler', file.name, err);
      }
    }
    status.textContent = `${arquivos.length} arquivo(s) processado(s).` + (ignorados ? ` ${ignorados} ignorado(s) (formato não suportado).` : '');
  }

  document.getElementById('addCol').addEventListener('click', () => {
    const nameInput = document.getElementById('colName');
    const typeSelect = document.getElementById('colType');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    columns.push({ name, type: typeSelect.value });
    nameInput.value = '';
    renderColumnList();
    renderTable();
  });

  document.getElementById('colName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('addCol').click();
  });

  document.getElementById('generateBtn').addEventListener('click', renderTable);
  document.getElementById('fileInput').addEventListener('change', (e) => processarArquivos(e.target.files));
  document.getElementById('fileInputEmpty').addEventListener('change', (e) => processarArquivos(e.target.files));

  // --- Arrastar-e-soltar em lote ---
  const dropZone = document.getElementById('dropZone');
  ['dragenter', 'dragover'].forEach(evento => {
    dropZone.addEventListener(evento, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('is-active');
    });
  });
  ['dragleave', 'drop'].forEach(evento => {
    dropZone.addEventListener(evento, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('is-active');
    });
  });
  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) processarArquivos(e.dataTransfer.files);
  });

  // --- Copiar tabela em formato TSV (colável direto no Excel) ---
  // Excel/Google Sheets reconhecem texto separado por TAB entre
  // colunas e quebra de linha entre linhas como uma tabela — não
  // precisa gerar arquivo nenhum, só copiar nesse formato.
  async function copiarTabela() {
    const cabecalho = columns.map(c => c.name).join('\t');
    const linhasTexto = Array.from(document.querySelectorAll('#bodyRows tr')).map(tr => {
      const campos = tr.querySelectorAll('.cell-editavel');
      return Array.from(campos).map(input => input.value).join('\t');
    });
    const tsv = [cabecalho, ...linhasTexto].join('\n');

    try {
      await navigator.clipboard.writeText(tsv);
    } catch (err) {
      // alguns navegadores bloqueiam a API de clipboard ao abrir o
      // arquivo direto do disco (file://) — usa um jeito alternativo
      const textarea = document.createElement('textarea');
      textarea.value = tsv;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    const btn = document.getElementById('copiarBtn');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Copiado ✓';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = textoOriginal; btn.disabled = false; }, 1500);
  }
  document.getElementById('copiarBtn').addEventListener('click', copiarTabela);

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  renderColumnList();
  renderTable();