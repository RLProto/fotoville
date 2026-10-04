import "server-only";
import { describeError, logError } from "../error-log";
import { onlyDigits } from "../format";
import { site } from "../site";
import type { Parcel, ShippingOption } from "../types";
import { correiosQuote, hasCorreios } from "./correios";
import { estimateFromTable } from "./estimate-table";

const ORIGIN_CEP = onlyDigits(process.env.SHIPPING_ORIGIN_CEP ?? site.address.cep);

const LABELS = { pac: "Correios PAC", sedex: "Correios SEDEX" } as const;

/** Opções de entrega para um CEP. Sempre inclui retirada na loja. */
export async function quoteShipping(cepDestino: string, parcel: Parcel): Promise<ShippingOption[]> {
  const cep = onlyDigits(cepDestino);
  if (cep.length !== 8) throw new Error("CEP inválido");

  const services = ["pac", "sedex"] as const;
  const options = await Promise.all(
    services.map(async (service): Promise<ShippingOption> => {
      if (hasCorreios) {
        try {
          const quote = await correiosQuote(service, ORIGIN_CEP, cep, parcel);
          return { service, label: LABELS[service], ...quote, estimated: false };
        } catch (err) {
          await logError({
            source: "server",
            scope: "frete",
            level: "warning",
            ...describeError(err),
            detail: { etapa: `Correios ${service} falhou, usado o valor estimado`, cep },
          });
        }
      }
      return { service, label: LABELS[service], ...estimateFromTable(service, cep, parcel), estimated: true };
    }),
  );

  options.push({
    service: "retirada",
    label: `Retirar na loja (${site.address.district}, ${site.address.city})`,
    price_cents: 0,
    days: 0,
    estimated: false,
  });

  return options;
}
