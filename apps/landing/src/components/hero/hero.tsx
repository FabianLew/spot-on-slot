"use client";

import { useTranslations } from "next-intl";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  HERO_BASE_IMAGE,
  HERO_CTA_COLOR,
  HERO_CTA_HOVER_COLOR,
  HERO_CTA_SHADOW_COLOR,
  HERO_REVEAL_IMAGE,
  HERO_SECTION_ID,
} from "./hero.config";
import { RevealLayer } from "./reveal-layer";
import { useInView } from "./use-in-view";

export function Hero() {
  const t = useTranslations("hero");
  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });
  const sectionRef = useRef<HTMLElement>(null);
  const heroVisible = useInView(sectionRef);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  // The loop only runs while the hero is on screen; it resumes from the last smoothed position.
  useEffect(() => {
    if (!heroVisible) return;
    const tick = () => {
      // The mask canvas is in section coordinates, so the viewport cursor is shifted by the
      // section's offset (non-zero once the page is scrolled). The offset is read every frame
      // so the spot stays under the cursor while scrolling without moving the mouse.
      const rect = sectionRef.current?.getBoundingClientRect();
      const targetX = mouse.current.x === -999 ? -999 : mouse.current.x - (rect?.left ?? 0);
      const targetY = mouse.current.y === -999 ? -999 : mouse.current.y - (rect?.top ?? 0);
      smooth.current.x += (targetX - smooth.current.x) * 0.1;
      smooth.current.y += (targetY - smooth.current.y) * 0.1;
      setCursorPos({ x: smooth.current.x, y: smooth.current.y });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [heroVisible]);

  const ctaStyle = {
    "--hero-cta": HERO_CTA_COLOR,
    "--hero-cta-hover": HERO_CTA_HOVER_COLOR,
    "--hero-cta-shadow": HERO_CTA_SHADOW_COLOR,
  } as CSSProperties;

  return (
    <div className="min-h-screen bg-black">
      <section
        ref={sectionRef}
        id={HERO_SECTION_ID}
        className="relative w-full overflow-hidden h-screen bg-black"
        style={{ height: "100dvh" }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 bg-center bg-cover bg-no-repeat hero-zoom"
          style={{ backgroundImage: `url(${HERO_BASE_IMAGE})` }}
        />

        <RevealLayer image={HERO_REVEAL_IMAGE} cursorX={cursorPos.x} cursorY={cursorPos.y} />

        <div className="absolute top-[14%] left-0 right-0 z-50 flex flex-col items-center text-center px-5 pointer-events-none">
          <h1 className="leading-[1.05]">
            <span
              className="inline-block bg-black px-3 py-1 font-display text-3xl sm:text-5xl md:text-6xl text-white hero-headline hero-anim hero-reveal"
              style={{ animationDelay: "0.25s" }}
            >
              {t("headlineLine1")}
            </span>
            <br />
            <span
              className="inline-block bg-black px-3 py-1 font-display text-3xl sm:text-5xl md:text-6xl mt-2 text-[#ffd400] hero-headline hero-anim hero-reveal"
              style={{ animationDelay: "0.42s" }}
            >
              {t("headlineLine2")}
            </span>
          </h1>
        </div>

        <div
          className="hidden sm:block absolute bottom-14 left-10 md:left-14 z-50 max-w-[260px] hero-anim hero-fade"
          style={{ animationDelay: "0.7s" }}
        >
          <p className="text-sm text-white leading-relaxed bg-black/80 border-2 border-[#ffd400] p-4">
            {t("descriptionLeft")}
          </p>
        </div>

        <div
          className="absolute bottom-10 sm:bottom-24 left-5 right-5 sm:left-auto sm:right-10 md:right-14 z-50 max-w-full sm:max-w-[260px] flex flex-col items-start gap-4 sm:gap-5 hero-anim hero-fade"
          style={{ animationDelay: "0.85s" }}
        >
          <p className="text-xs sm:text-sm text-white leading-relaxed bg-black/80 border-2 border-[#ffd400] p-4">
            {t("descriptionRight")}
          </p>
          <a
            href="#waitlist"
            className="hero-cta font-display text-black text-sm px-7 py-3 border-2 border-black transition-colors"
            style={ctaStyle}
          >
            {t("cta")}
          </a>
        </div>
      </section>
    </div>
  );
}
