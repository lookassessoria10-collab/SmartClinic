import type { Metadata, Viewport } from "next";
import { Presentation } from "@/modules/presentation/presentation";
import "./apresentacao.css";

// Página pública (fora das rotas protegidas do proxy): explica a plataforma sem login e sem dados reais.
export const metadata: Metadata = {
  title: "Apresentação",
  description: "Conheça o smartclin: agenda, pacientes, oportunidades, equipe e segurança — em uma apresentação interativa.",
};

export const viewport: Viewport = { themeColor: "#031e40" };

export default function PresentationPage() {
  return <Presentation />;
}
