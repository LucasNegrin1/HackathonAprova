import { artigos, categoriaPorId, normalizar } from "./catalogo";
import { buscarArtigos } from "./knowledge";
import { dataIso, extrairIdentificadores } from "./extracao";
import { camposDe, checklist, executarFerramenta } from "./tools";
import type { EntradaUsuario } from "./agent";
import type { Conversa } from "./types";

// Modo demonstração: roda sem chave de API (plano B da apresentação).
// Usa as MESMAS ferramentas do agente, com um roteiro fixo no lugar do Claude.

const PALAVRAS_CATEGORIA: Record<string, string[]> = {
  acesso_login: ["senha", "login", "entrar", "acesso", "gov.br", "conta", "cadastro"],
  pagamento_taxa: ["paguei", "pagamento", "guia", "boleto", "taxa", "pix"],
  envio_documentos: ["anexar", "anexo", "upload", "arquivo", "documento", "pdf", "enviar"],
  andamento_processo: ["parado", "andamento", "status", "exigencia", "demora", "analise"],
  erro_sistema: ["erro", "bug", "tela", "travou", "lento", "relatorio", "botao", "nao carrega"],
  configuracao_fluxo: ["configurar", "fluxo", "alterar", "mudar", "permissao", "formulario", "incluir campo"],
};

const SIM = /^(sim|s|isso|resolveu|deu certo|funcionou|pode|ok|confirmo|claro)\b/;
const NAO_SABE = /^(nao sei|n sei|nao lembro|nao tenho|sei la)/;

function classificar(relato: string): string {
  const texto = normalizar(relato);
  let melhor = "erro_sistema";
  let maior = 0;
  for (const [id, palavras] of Object.entries(PALAVRAS_CATEGORIA)) {
    const pontos = palavras.filter((p) => texto.includes(p)).length;
    if (pontos > maior) [melhor, maior] = [id, pontos];
  }
  return melhor;
}

/** Extrai do relato livre o que dá para extrair com regra simples. */
function extrair(relato: string, comImagem: boolean): { id: string; valor: string }[] {
  const achados: { id: string; valor: string }[] = [];
  achados.push(...extrairIdentificadores(relato));
  const cidade = relato.match(/(?:prefeitura de|cidade de|munic[ií]pio de|aqui em|sou de)\s+([A-ZÀ-Ú][\wÀ-ú]+(?:\s(?:d[aeo]s?\s)?[A-ZÀ-Ú][\wÀ-ú]+)*)/);
  if (cidade) achados.push({ id: "municipio", valor: cidade[1] });
  const data = relato.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|ontem|hoje|anteontem)\b/i);
  if (data) achados.push({ id: "data_pagamento", valor: data[1] }, { id: "desde_quando", valor: data[1] });
  const erro = relato.match(/["“]([^"”]{4,})["”]/);
  if (erro) achados.push({ id: "mensagem_erro", valor: erro[1] });
  if (comImagem) achados.push({ id: "comprovante", valor: "imagem enviada pelo usuário" }, { id: "mensagem_erro", valor: "print enviado pelo usuário" });
  return achados;
}


function perguntarProximo(conversa: Conversa, prefixo = ""): string[] {
  const { faltando, completo } = checklist(conversa);
  const estado = conversa.demo!;
  if (completo) {
    estado.etapa = "confirmar";
    const linhas = camposDe(conversa).map((c) => `• ${c.rotulo}: ${conversa.campos[c.id].valor}`);
    return [prefixo, `Confere o resumo antes de eu abrir o chamado:\n${linhas.join("\n")}\n\nPosso abrir? Responda *sim* ou me diga o que corrigir.`].filter(Boolean);
  }
  estado.etapa = "coletando";
  estado.perguntando = faltando[0].id;
  return [prefixo, faltando[0].pergunta_amigavel].filter(Boolean);
}

export async function responderDemo(conversa: Conversa, entrada: EntradaUsuario): Promise<string[]> {
  const estado = (conversa.demo ??= { etapa: "inicio" });
  const texto = normalizar(entrada.texto);

  if (estado.etapa === "inicio") {
    estado.relato = entrada.texto;
    const [melhor] = buscarArtigos(entrada.texto, 1);
    if (melhor) {
      await executarFerramenta(conversa, "buscar_solucao", { consulta: entrada.texto });
      estado.etapa = "kb";
      estado.artigo = melhor.artigo.id;
      const passos = melhor.artigo.solucao.map((p, i) => `${i + 1}. ${p}`).join("\n");
      return [`Isso costuma resolver (${melhor.artigo.titulo}):\n${passos}`, "Funcionou? Responda *sim* ou *não*."];
    }
    return iniciarChamado(conversa, entrada, entrada.texto);
  }

  if (estado.etapa === "kb") {
    if (SIM.test(texto)) {
      await executarFerramenta(conversa, "encerrar_resolvido", { artigo_id: estado.artigo });
      return ["Que bom que resolveu! Se precisar de novo, é só chamar por aqui."];
    }
    return iniciarChamado(conversa, entrada, `${estado.relato} ${entrada.texto}`, "Tudo bem, vou abrir um chamado para o suporte. Antes, preciso de alguns dados.");
  }

  if (estado.etapa === "coletando" && estado.perguntando) {
    const valor = NAO_SABE.test(texto) ? "não sabe" : entrada.imagem ? `${entrada.texto || "print"} (imagem enviada)` : entrada.texto;
    await executarFerramenta(conversa, "registrar_informacoes", { campos: [{ id: estado.perguntando, valor }] });
    return perguntarProximo(conversa);
  }

  if (estado.etapa === "confirmar") {
    if (!SIM.test(texto)) {
      estado.relato = `${estado.relato}\nCorreção do usuário: ${entrada.texto}`;
      return ["Anotei a correção. Posso abrir o chamado agora? Responda *sim*."];
    }
    const categoria = categoriaPorId(conversa.categoria)!;
    const resumo = `${(estado.relato ?? "").trim().replace(/[.!?]*$/, "")}. Categoria: ${categoria.nome}. Artigos já sugeridos sem sucesso: ${conversa.artigosSugeridos.join(", ") || "nenhum"}.`;
    const tipo_sugerido = conversa.categoria === "configuracao_fluxo" ? "parametrizacao" : "problema";
    const r = (await executarFerramenta(conversa, "abrir_chamado", { resumo, tipo_sugerido, prazo_data: dataIso(conversa.campos.prazo?.valor), confirmado_pelo_usuario: true })) as { protocolo?: string; prazo_atendimento?: string; erro?: string };
    if (r.erro) return [r.erro];
    const retorno = conversa.email ? `O retorno chega no e-mail ${conversa.email}.` : "O acompanhamento chega por aqui mesmo.";
    return [`Chamado aberto! Protocolo *${r.protocolo}*.`, `O suporte responde até ${r.prazo_atendimento}. ${retorno}`];
  }

  return ["Este atendimento já foi encerrado. Mande uma nova mensagem para começar outro."];
}

async function iniciarChamado(conversa: Conversa, entrada: EntradaUsuario, relato: string, prefixo = ""): Promise<string[]> {
  const artigo = artigos.find((a) => a.id === conversa.demo?.artigo);
  const categoria = artigo?.categoria ?? classificar(relato);
  await executarFerramenta(conversa, "classificar_chamado", { categoria, perfil: conversa.perfil });
  await executarFerramenta(conversa, "registrar_informacoes", { campos: extrair(relato, !!entrada.imagem) });
  return perguntarProximo(conversa, prefixo);
}
