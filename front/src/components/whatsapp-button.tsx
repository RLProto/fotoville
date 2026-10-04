import { WhatsappLogoIcon } from "@phosphor-icons/react/ssr";
import { whatsappLink } from "@/lib/site";

export function WhatsAppButton() {
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Fotoville pelo WhatsApp"
      className="fixed right-4 bottom-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#128c4b] text-white shadow-lift transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 print:hidden"
    >
      <WhatsappLogoIcon size={30} weight="fill" aria-hidden />
    </a>
  );
}
