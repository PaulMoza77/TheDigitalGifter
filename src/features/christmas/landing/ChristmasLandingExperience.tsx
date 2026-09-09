import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import { AmbientSnow } from "./AmbientSnow";
import { FONT_HREF } from "./assets";
import {
  CHRISTMAS_LANDING_DEFAULT_LOCALE,
  landingDir,
} from "./copy";
import "./ChristmasLanding.css";
import {
  cardsUrl,
  messagesUrl,
  portraitUrl,
  santaExperienceUrl,
  writeSantaNameHandoff,
  type CardTheme,
  type PortraitVertical,
} from "./handoff";
import { trackHubEvent } from "./hubAnalytics";
import { AdventScene } from "./scenes/AdventScene";
import { CardsScene } from "./scenes/CardsScene";
import { FaqScene } from "./scenes/FaqScene";
import { FinalCtaScene } from "./scenes/FinalCtaScene";
import { GiftTreeLandingScene } from "./scenes/GiftTreeLandingScene";
import { ImmersiveHero } from "./scenes/ImmersiveHero";
import { MessagesScene } from "./scenes/MessagesScene";
import { PortraitScene } from "./scenes/PortraitScene";
import { SantaScene } from "./scenes/SantaScene";
import { TreeScene } from "./scenes/TreeScene";
import { WishlistScene } from "./scenes/WishlistScene";
import { WorldTransition } from "./scenes/WorldTransition";
import { christmasLandingJsonLd, upsertJsonLd } from "./seo";

const LOCALE = CHRISTMAS_LANDING_DEFAULT_LOCALE;
const CREATE_HREF = "/generator?occasion=christmas";

function ensureLandingFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
}

export function ChristmasLandingExperience() {
  const navigate = useNavigate();

  useEffect(() => {
    ensureLandingFonts();
    captureFunnelAttribution(window.location.search);
    trackHubEvent("christmas_page_view");
    upsertJsonLd("christmas-landing-jsonld", christmasLandingJsonLd(LOCALE));
    return () => {
      document.getElementById("christmas-landing-jsonld")?.remove();
    };
  }, []);

  const goCreate = useCallback(
    (surface: string) => {
      trackHubEvent("christmas_hub_cta", { surface, cta: "start_creating" }, "christmas_hub");
      void navigate(CREATE_HREF);
    },
    [navigate],
  );

  const onSantaViewed = useCallback(() => {
    trackHubEvent("christmas_hub_interact", { surface: "hub_santa", action: "section_viewed" }, "christmas_santa_video");
  }, []);

  const onSantaInputStarted = useCallback(() => {
    trackHubEvent("santa_form_started", { surface: "hub_santa", action: "input_started" }, "christmas_santa_video");
  }, []);

  return (
    <article className="xmas-landing" dir={landingDir(LOCALE)} lang={LOCALE}>
      <a className="xmas-skip" href="#christmas-world">
        Skip to Christmas world
      </a>
      <AmbientSnow />
      <ImmersiveHero
        locale={LOCALE}
        onPrimary={() => goCreate("hero")}
        onExplore={() => {
          document.getElementById("christmas-world")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <WorldTransition locale={LOCALE} />
      <GiftTreeLandingScene
        locale={LOCALE}
        onViewed={() => {
          trackHubEvent("christmas_hub_interact", { surface: "hub_gifts", action: "section_viewed" }, "christmas_gift_tree");
        }}
      />
      <PortraitScene
        locale={LOCALE}
        onToggle={(vertical: PortraitVertical) => {
          trackHubEvent("christmas_hub_interact", { surface: "hub_portraits", action: "toggle", vertical }, "christmas_photo");
        }}
        onCta={(vertical: PortraitVertical) => {
          const productKey =
            vertical === "family"
              ? "christmas_family"
              : vertical === "couples"
                ? "christmas_couple"
                : "christmas_pet";
          trackHubEvent("christmas_hub_cta", { surface: "hub_portraits", vertical }, productKey);
          void navigate(portraitUrl(vertical));
        }}
      />
      <SantaScene
        locale={LOCALE}
        onViewed={onSantaViewed}
        onInputStarted={onSantaInputStarted}
        onSubmit={(name) => {
          writeSantaNameHandoff(name);
          trackHubEvent(
            "santa_form_completed",
            { surface: "hub_santa", action: "name_submitted", has_name: true },
            "christmas_santa_video",
          );
          void navigate(santaExperienceUrl(name));
        }}
      />
      <WishlistScene
        locale={LOCALE}
        onCta={() => {
          trackHubEvent("christmas_hub_cta", { surface: "hub_wishlist" }, "christmas_wishlist");
          void navigate("/christmas/wishlist");
        }}
      />
      <TreeScene
        locale={LOCALE}
        onCta={() => {
          trackHubEvent("christmas_hub_cta", { surface: "hub_tree" }, "christmas_tree");
          void navigate("/christmas/tree");
        }}
      />
      <AdventScene
        locale={LOCALE}
        onInteract={(day) => {
          trackHubEvent("christmas_hub_interact", { surface: "hub_advent", action: "door", day }, "christmas_advent");
        }}
        onCta={() => {
          trackHubEvent("christmas_hub_cta", { surface: "hub_advent" }, "christmas_advent");
          void navigate("/christmas/advent");
        }}
      />
      <CardsScene
        locale={LOCALE}
        onCta={(theme: CardTheme) => {
          trackHubEvent("christmas_hub_cta", { surface: "hub_cards", theme }, "christmas_card");
          void navigate(cardsUrl(theme));
        }}
      />
      <MessagesScene
        locale={LOCALE}
        onCta={(recipient, tone) => {
          trackHubEvent(
            "christmas_hub_cta",
            { surface: "hub_messages", recipient_key: recipient, tone },
            "christmas_messages",
          );
          void navigate(messagesUrl(recipient, tone));
        }}
      />
      <FinalCtaScene locale={LOCALE} onCta={() => goCreate("finale")} />
      <FaqScene locale={LOCALE} />
    </article>
  );
}
