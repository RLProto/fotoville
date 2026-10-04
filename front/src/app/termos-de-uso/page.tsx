import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Termos de uso" };

/**
 * Texto-base adaptado dos termos do site anterior. Revisar com o responsável
 * jurídico da loja antes de publicar.
 */
export default function TermosPage() {
  return (
    <>
      <PageHeader title="Termos de uso" />
      <div className="container-page prose-site max-w-3xl py-10">
        <p>
          Estes termos regem o uso do site da {site.name}, com sede em {site.address.street},{" "}
          {site.address.district}, {site.address.city}/{site.address.state}, CEP {site.address.cep}, e a
          prestação dos serviços de impressão de imagens digitais. Ao criar uma conta você declara que leu e
          concorda com eles.
        </p>

        <h2>1. Cadastro</h2>
        <ul>
          <li>Para enviar fotos e comprar é preciso criar uma conta com dados verdadeiros e atualizados.</li>
          <li>A senha é pessoal e intransferível. Você responde pelo uso da sua conta.</li>
          <li>Menores de 18 anos só podem contratar com a assistência dos responsáveis.</li>
        </ul>

        <h2>2. O serviço</h2>
        <ul>
          <li>Imprimimos em papel fotográfico as imagens enviadas nos formatos JPG, PNG e WebP.</li>
          <li>
            As fotos são impressas com o enquadramento que você definir no site. Confira o corte de cada foto
            antes de fechar o pedido.
          </li>
          <li>
            A qualidade da impressão depende da resolução do arquivo. O site avisa quando a resolução é baixa
            para o tamanho escolhido; nesses casos a impressão pode sair sem nitidez.
          </li>
          <li>Pequenas variações de cor entre a tela e o papel são normais.</li>
        </ul>

        <h2>3. Preços, pagamento e cupons</h2>
        <ul>
          <li>Os preços válidos são os exibidos no site no momento do pedido.</li>
          <li>O pagamento é processado pelo Mercado Pago. A {site.name} não armazena dados de cartão.</li>
          <li>Só é possível usar um cupom por pedido.</li>
          <li>
            Pacotes pré-pagos geram um cupom com créditos de fotos, que pode ser usado em um ou mais pedidos. O
            frete de cada pedido é cobrado à parte.
          </li>
        </ul>

        <h2>4. Produção e entrega</h2>
        <ul>
          <li>
            Os prazos de produção e de transporte estão em <Link href="/prazos-e-frete">Prazos e frete</Link> e
            são contados a partir da aprovação do pagamento.
          </li>
          <li>A entrega é feita pelos Correios no endereço informado, ou por retirada na loja.</li>
          <li>
            Pedidos devolvidos por endereço incompleto, incorreto ou destinatário ausente dependem do pagamento
            de novo frete para reenvio.
          </li>
        </ul>

        <h2>5. Suas obrigações</h2>
        <ul>
          <li>Enviar apenas imagens que você tem o direito de reproduzir.</li>
          <li>
            Não enviar conteúdo ilegal ou que viole direitos de terceiros. A {site.name} pode recusar a
            impressão e excluir esse conteúdo.
          </li>
          <li>
            Manter cópia dos seus arquivos originais. O site não é um serviço de armazenamento: as fotos podem
            ser apagadas dos nossos servidores depois da conclusão do pedido.
          </li>
        </ul>

        <h2>6. Problemas com o pedido</h2>
        <p>
          Se o produto chegar danificado ou com defeito de impressão, entre em contato pelos canais da página{" "}
          <Link href="/contato">Contato</Link>. Aplicam-se as garantias do Código de Defesa do Consumidor. Por
          se tratar de produto personalizado, feito sob encomenda, não há troca por arrependimento depois de
          iniciada a produção.
        </p>

        <h2>7. Privacidade</h2>
        <p>
          O tratamento dos seus dados está descrito na{" "}
          <Link href="/politica-de-privacidade">Política de privacidade</Link>.
        </p>

        <h2>8. Alterações e foro</h2>
        <p>
          Estes termos podem ser atualizados; a versão vigente é a publicada nesta página. Fica eleito o foro
          da comarca de {site.address.city}/{site.address.state}, sem prejuízo do direito do consumidor de
          demandar em seu domicílio.
        </p>
      </div>
    </>
  );
}
