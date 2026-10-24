import { after } from "next/server";
import { responder } from "@/lib/agent";
import { conversaDoContato } from "@/lib/store";
import { assinaturaValida, enviarTexto, extrairMensagens, paraEntrada, perfilDoNumero } from "@/lib/whatsapp";

export const maxDuration = 300;

// Verificação do webhook pela Meta.
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(url.searchParams.get("hub.challenge") ?? "");
  }
  return new Response("forbidden", { status: 403 });
}

// Mensagens recebidas: responde 200 na hora e processa depois, para a Meta não reenviar.
export async function POST(request: Request) {
  const corpo = await request.text();
  if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"))) {
    return new Response("assinatura inválida", { status: 401 });
  }

  after(async () => {
    for (const mensagem of extrairMensagens(JSON.parse(corpo))) {
      const entrada = await paraEntrada(mensagem);
      if (!entrada) {
        await enviarTexto(mensagem.from, "Por enquanto entendo texto e imagens. Pode escrever o que aconteceu?");
        continue;
      }
      const conversa = conversaDoContato("whatsapp", mensagem.from, perfilDoNumero(mensagem.from));
      for (const texto of await responder(conversa, entrada)) await enviarTexto(mensagem.from, texto);
    }
  });

  return new Response("ok");
}
