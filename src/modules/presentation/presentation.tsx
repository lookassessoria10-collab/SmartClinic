"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile } from "./content";
import { Deck } from "./deck";
import { Home } from "./home";
import { deckSlides, hashFor, parseHash, type View } from "./route";

/**
 * Apresentação pública: página inicial ou lâminas, conforme o hash da URL. Entrar na
 * apresentação cria uma entrada no histórico (o "voltar" do navegador sai dela); avançar
 * lâminas só troca o endereço, para não encher o histórico.
 */
export function Presentation() {
  const [view, setView] = useState<View>({ mode: "home", anchor: "" });

  useEffect(() => {
    const sync = () => setView(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const start = useCallback((trail: Profile | null, index: number) => {
    window.location.hash = hashFor(trail, index);
  }, []);

  const exit = useCallback(() => {
    history.replaceState(null, "", "#inicio");
    setView({ mode: "home", anchor: "inicio" });
    window.scrollTo({ top: 0 });
  }, []);

  if (view.mode === "deck") {
    const slides = deckSlides(view.trail);
    return (
      <Deck
        slides={slides}
        index={view.index}
        trail={view.trail}
        onExit={exit}
        onIndex={(index) => {
          history.replaceState(null, "", hashFor(view.trail, index));
          setView({ ...view, index });
        }}
      />
    );
  }
  return <Home onStart={start} />;
}
