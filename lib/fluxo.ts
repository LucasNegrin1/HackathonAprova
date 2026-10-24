import { categoriaPorId, normalizar } from "./catalogo";
import { extrairIdentificadores } from "./extracao";
import { SLA_HORAS } from "./gestao";
import { detectarPerfil, extrairCorrecao, extrairResposta, interpretarRelato } from "./interpretacao";
import { buscarArtigos } from "./knowledge";
import { abrirChamado, camposDe, classificar, CONFIRMACAO, faltando, NAO_SEI, NEGATIVA, registrar, type ChamadoAberto } from "./tools";
import type { Conversa, Perfil } from "./types";

// Roteiro do atendimento, conduzido pelo código:
//   relato → (base de conhecimento) → perfil → checklist, um campo por vez → resumo → "sim" → ticket no Supabase.
// O modelo só interpreta texto livre (lib/interpretacao.ts). Assim o fluxo não depende de o modelo
// lembrar o que perguntou nem de chamar ferramentas na hora certa.

export interface Resposta {
  textos: string[];
  /** Respostas rápidas exibidas como botões no chat. */
  opcoes?: string[];
}

export interface EntradaUsuario {
  texto: string;
  imagem?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
}

const OPCOES_KB = ["Sim, resolveu", "Não resolveu"];
const OPCOES_PERFIL = ["Sou servidor da prefeitura", "Sou cidadão ou profissional"];
const OPCOES_CONFIRMAR = ["Sim, pode abrir", "Corrigir uma informação"];

const RESOLVEU = /^(sim|s|resolveu|deu certo|funcionou|consegui|ok)\b/;

export async function conduzir(conversa: Conversa, entrada: EntradaUsuario): Promise<Resposta> {
  const fluxo = (conversa.fluxo ??= { etapa: "inicio" });
  const texto = entrada.texto.trim();
  const t = normalizar(texto);

  switch (fluxo.etapa) {
    case "inicio": {
      // Mensagem vaga ("oi", "quero abrir um ticket"): pede o relato antes de interpretar.
      if (texto.split(/\s+/).length < 4 && !entrada.imagem) {
        return { textos: ["Me conte o que está acontecendo: em qual tela ou serviço, e o que aparece para você."] };
      }
      fluxo.relato = texto;
      const interpretacao = await interpretarRelato(texto, conversa.conta);
      // Perfil só com pista explícita no texto; o palpite do modelo não basta. Sem pista, o bot pergunta.
      const perfil: Perfil | null = detectarPerfil(texto);
      fluxo.tipo = interpretacao.tipo;
      fluxo.resumo = interpretacao.resumo;
      fluxo.perfilDefinido = perfil !== null;
      classificar(conversa, interpretacao.categoria, perfil ?? "municipe");
      registrar(conversa, interpretacao.campos);
      if (entrada.imagem) registrarImagem(conversa, texto);

      // Base de conhecimento antes de abrir chamado (não vale para sugestão ou nova configuração).
      if (fluxo.tipo !== "sugestao" && fluxo.tipo !== "parametrizacao") {
        const [melhor] = buscarArtigos(texto, 1);
        if (melhor) {
          fluxo.etapa = "kb";
          fluxo.artigo = melhor.artigo.id;
          conversa.artigosSugeridos.push(melhor.artigo.id);
          const passos = melhor.artigo.solucao.map((p, i) => `${i + 1}. ${p}`).join("\n");
          return { textos: [`Isso costuma resolver (*${melhor.artigo.titulo}*):\n${passos}`, "Funcionou?"], opcoes: OPCOES_KB };
        }
      }
      return proximo(conversa, `Entendi. Vou registrar um chamado de *${categoriaPorId(conversa.categoria)!.nome.toLowerCase()}*.`);
    }

    case "kb": {
      if (RESOLVEU.test(t)) {
        conversa.status = "resolvida_autoatendimento";
        conversa.artigoQueResolveu = fluxo.artigo;
        fluxo.etapa = "encerrado";
        return { textos: ["Que bom que resolveu! Se precisar de novo, é só chamar por aqui."] };
      }
      return proximo(conversa, "Tudo bem, vou abrir um chamado para o suporte. Preciso de alguns dados.");
    }

    case "perfil": {
      const perfil = perfilDaResposta(t);
      if (!perfil && !fluxo.repetiu) {
        fluxo.repetiu = true;
        return { textos: ["Só para eu encaminhar certo: você trabalha na prefeitura ou é cidadão/profissional?"], opcoes: OPCOES_PERFIL };
      }
      conversa.perfil = perfil ?? "municipe";
      fluxo.perfilDefinido = true;
      fluxo.repetiu = false;
      return proximo(conversa);
    }

    case "coletando": {
      const campo = camposDe(conversa).find((c) => c.id === fluxo.perguntando)!;
      if (entrada.imagem) {
        registrarImagem(conversa, texto);
      } else if (NAO_SEI.test(t)) {
        registrar(conversa, [{ id: campo.id, valor: "não sabe" }]);
      } else if (NEGATIVA.test(t)) {
        registrar(conversa, [{ id: campo.id, valor: texto }]);
      } else {
        const pendentes = faltando(conversa);
        const extraido = await extrairResposta(texto, campo, pendentes);
        const recusados = registrar(conversa, [...extraido.campos, ...extrairIdentificadores(texto)]);
        if (recusados.includes("email_retorno")) {
          return { textos: ["Esse e-mail parece incompleto. Pode conferir e mandar de novo?"] };
        }
        if (!conversa.campos[campo.id]) {
          // O modelo achou que a resposta não respondeu a pergunta: pergunta de novo uma vez.
          if (extraido.usouModelo && !fluxo.repetiu) {
            fluxo.repetiu = true;
            return { textos: [`Não entendi bem. ${campo.pergunta_amigavel}`] };
          }
          registrar(conversa, [{ id: campo.id, valor: texto }]);
        }
      }
      fluxo.repetiu = false;
      return proximo(conversa);
    }

    case "confirmar": {
      if (CONFIRMACAO.test(t) && !/corrig/.test(t)) {
        const resultado = await abrirChamado(conversa, resumoDoChamado(conversa), fluxo.tipo ?? "problema");
        fluxo.etapa = "encerrado";
        return { textos: mensagemDoResultado(conversa, resultado) };
      }
      if (/corrig/.test(t) && texto.split(/\s+/).length <= 4) {
        fluxo.etapa = "corrigindo";
        return { textos: ["O que precisa corrigir? Escreva a informação certa, por exemplo: \"o prazo é 20/11\"."] };
      }
      return corrigir(conversa, texto);
    }

    case "corrigindo":
      return corrigir(conversa, texto);

    default:
      return { textos: ["Este atendimento já foi encerrado. Abra um novo atendimento para outro assunto."] };
  }
}

/** Próximo passo: perfil, se ainda não se sabe; senão o próximo campo do checklist; senão o resumo. */
function proximo(conversa: Conversa, prefixo?: string): Resposta {
  const fluxo = conversa.fluxo!;
  const juntar = (texto: string) => [prefixo, texto].filter(Boolean) as string[];

  if (!fluxo.perfilDefinido) {
    fluxo.etapa = "perfil";
    return {
      textos: juntar("Para encaminhar certo: você é servidor da prefeitura ou cidadão/profissional (engenheiro, arquiteto, requerente)?"),
      opcoes: OPCOES_PERFIL,
    };
  }

  const [campo] = faltando(conversa);
  if (campo) {
    fluxo.etapa = "coletando";
    fluxo.perguntando = campo.id;
    // Para cidadão/profissional, "prefeitura" vira "cidade": quem pergunta "de qual prefeitura você é" é o servidor.
    const pergunta =
      campo.id === "municipio" && conversa.perfil === "municipe" ? "De qual cidade é o processo ou serviço?" : campo.pergunta_amigavel;
    return { textos: juntar(pergunta) };
  }

  fluxo.etapa = "confirmar";
  return { textos: juntar(resumoParaConfirmar(conversa)), opcoes: OPCOES_CONFIRMAR };
}

async function corrigir(conversa: Conversa, texto: string): Promise<Resposta> {
  const fluxo = conversa.fluxo!;
  const campos = await extrairCorrecao(texto, camposDe(conversa));
  registrar(conversa, [...campos, ...extrairIdentificadores(texto)]);
  fluxo.etapa = "confirmar";
  const aviso = campos.length ? "Atualizei." : "Não consegui identificar o que mudar. Se algo estiver errado, escreva o dado certo.";
  return { textos: [aviso, resumoParaConfirmar(conversa)], opcoes: OPCOES_CONFIRMAR };
}

function perfilDaResposta(t: string): Perfil | null {
  if (/servidor|prefeitura|analista|secretaria|fiscal/.test(t)) return "analista_prefeitura";
  if (/cidad|profission|engenheir|arquitet|municipe|morador|requerente|contribuinte/.test(t)) return "municipe";
  return detectarPerfil(t);
}

/** Imagem enviada: vale como evidência do primeiro campo pendente que pede print ou comprovante. */
function registrarImagem(conversa: Conversa, texto: string) {
  const campo = faltando(conversa).find((c) => c.evidencia);
  if (campo) registrar(conversa, [{ id: campo.id, valor: texto ? `${texto} (imagem enviada)` : "imagem enviada pelo usuário" }]);
}

function resumoParaConfirmar(conversa: Conversa): string {
  const linhas = camposDe(conversa).map((c) => `• ${c.rotulo}: ${conversa.campos[c.id].valor}`);
  const perfil = conversa.perfil === "analista_prefeitura" ? "servidor da prefeitura" : "cidadão/profissional";
  return `Confere o resumo antes de eu abrir o chamado:\n• Você é: ${perfil}\n${linhas.join("\n")}\n\nPosso abrir?`;
}

function resumoDoChamado(conversa: Conversa): string {
  const fluxo = conversa.fluxo!;
  const base = (fluxo.resumo || fluxo.relato || "").trim().replace(/[.!?]*$/, "");
  const dados = camposDe(conversa)
    .filter((c) => c.id !== "nome" && c.id !== "email_retorno")
    .map((c) => `${c.rotulo}: ${conversa.campos[c.id]?.valor}`)
    .join("; ");
  return `${base}. Relato: "${fluxo.relato}". ${dados}.`;
}

/** O que aconteceu com o chamado no fluxo do Supabase, contado ao usuário. */
function mensagemDoResultado(conversa: Conversa, r: ChamadoAberto): string[] {
  const retorno = `O retorno chega no e-mail ${conversa.email}.`;
  if (r.status === "backlog_produto") {
    return [
      `Pedido registrado! Protocolo *${r.protocolo}*.`,
      `Como é uma sugestão ou uma nova configuração, ele vai para avaliação do time de produto, fora da fila de suporte. ${retorno}`,
    ];
  }
  if (r.pai) {
    return [
      `Chamado registrado! Protocolo *${r.protocolo}*.`,
      `Já havia um chamado aberto sobre o mesmo problema (*${r.pai}*). Vinculei o seu a ele: a equipe trata os dois juntos, e quanto mais pessoas afetadas, maior a prioridade. ${retorno}`,
    ];
  }
  const prioridade = r.prioridade as keyof typeof SLA_HORAS | null;
  const prazo = prioridade
    ? new Date(Date.now() + SLA_HORAS[prioridade] * 3_600_000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
    : null;
  return [
    `Chamado aberto! Protocolo *${r.protocolo}*${prioridade ? `, prioridade *${prioridade}*` : ""}.`,
    [
      prazo ? `O suporte responde até ${prazo}.` : "O suporte vai analisar o seu chamado.",
      r.revisarP1 ? "Como a sua prefeitura já está no limite de chamados críticos, um gestor vai confirmar essa prioridade." : null,
      retorno,
    ]
      .filter(Boolean)
      .join(" "),
  ];
}
