import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Política de privacidade" };

/**
 * Texto-base alinhado à LGPD e aos serviços que o site realmente usa.
 * Revisar com o responsável jurídico da loja antes de publicar.
 */
export default function PrivacidadePage() {
  return (
    <>
      <PageHeader title="Política de privacidade" />
      <div className="container-page prose-site max-w-3xl py-10">
        <p>
          Esta política explica quais dados a {site.name} coleta, para que servem e quais são os seus direitos,
          conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>

        <h2>Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail, WhatsApp e senha (armazenada de forma criptografada).
          </li>
          <li>
            <strong>Pedido:</strong> CPF, endereço de entrega, itens comprados e situação do pagamento.
          </li>
          <li>
            <strong>Fotos:</strong> os arquivos que você envia para impressão e os ajustes de enquadramento.
          </li>
          <li>
            <strong>Navegação:</strong> cookies necessários para manter você conectado.
          </li>
        </ul>

        <h2>Para que usamos</h2>
        <ul>
          <li>Produzir, enviar e acompanhar os seus pedidos.</li>
          <li>Falar com você sobre o pedido, por e-mail ou WhatsApp.</li>
          <li>Cumprir obrigações legais e fiscais.</li>
        </ul>
        <p>Não vendemos seus dados e não usamos suas fotos para nenhuma outra finalidade.</p>

        <h2>Com quem compartilhamos</h2>
        <ul>
          <li>
            <strong>Mercado Pago</strong>, para processar o pagamento. Os dados do cartão são informados
            diretamente a ele e não passam pelos nossos servidores.
          </li>
          <li>
            <strong>Correios</strong>, que recebem nome, endereço e CPF do destinatário para a entrega.
          </li>
          <li>
            <strong>Provedores de infraestrutura</strong> (banco de dados e armazenamento de arquivos), que
            guardam as informações em nosso nome, com acesso restrito.
          </li>
        </ul>

        <h2>Suas fotos</h2>
        <p>
          As fotos ficam em armazenamento privado, acessível só por você e pela equipe que produz o pedido. Fotos
          no carrinho podem ser apagadas por você a qualquer momento. Fotos de pedidos concluídos são mantidas
          pelo tempo necessário para atender eventuais reimpressões e depois são excluídas.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir a confirmação, o acesso, a correção ou a exclusão dos seus dados, e revogar
          consentimentos. Para isso, escreva para <a href={`mailto:${site.email}`}>{site.email}</a>. Dados
          exigidos por lei, como os fiscais, são mantidos pelo prazo legal.
        </p>

        <h2>Segurança</h2>
        <p>
          O site usa conexão criptografada (HTTPS), controle de acesso por conta e URLs temporárias para os
          arquivos. Nenhum sistema é infalível; se identificarmos um incidente que afete seus dados, você será
          avisado.
        </p>

        <h2>Contato</h2>
        <p>
          {site.name}, {site.address.street}, {site.address.district}, {site.address.city}/{site.address.state},
          CEP {site.address.cep}. <a href={`mailto:${site.email}`}>{site.email}</a>
        </p>
      </div>
    </>
  );
}
