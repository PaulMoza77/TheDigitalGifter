import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { captureFunnelAttribution } from "@/features/pet/funnelAttribution";
import {
  christmasPathForLocale,
  parseChristmasLocalePath,
  type ChristmasLocaleCode,
} from "@/features/christmas/seo/localeRouting";
import { AmbientSnow } from "./AmbientSnow";
import { FONT_HREF } from "./assets";
import {
  landingDir,
  resolveChristmasLandingLocale,
  type ChristmasLandingLocale,
} from "./copy";
import "./ChristmasLanding.css";
import {
  cardsUrl,
  giftFinderUrl,
  messagesUrl,
  portraitUrl,
  santaExperienceUrl,
  writeSantaNameHandoff,
  type CardTheme,
  type GiftFinderRecipient,
  type PortraitVertical,
} from "./handoff";
import { trackHubEvent } from "./hubAnalytics";
import { AdventScene } from "./scenes/AdventScene";
import { CardsScene } from "./scenes/CardsScene";
import { FaqScene } from "./scenes/FaqScene";
import { FinalCtaScene } from "./scenes/FinalCtaScene";
import { GeoScene } from "./scenes/GeoScene";
import { GiftFinderScene } from "./scenes/GiftFinderScene";
import { GiftTreeLandingScene } from "./scenes/GiftTreeLandingScene";
import { ImmersiveHero } from "./scenes/ImmersiveHero";
import { MessagesScene } from "./scenes/MessagesScene";
import { PortraitScene } from "./scenes/PortraitScene";
import { SantaScene } from "./scenes/SantaScene";
import { TreeScene } from "./scenes/TreeScene";
import { WishlistScene } from "./scenes/WishlistScene";
import { christmasLandingJsonLd, upsertJsonLd } from "./seo";
import { StoryErrorBoundary } from "./StoryErrorBoundary";

const CREATE_HREF = "/generator?occasion=christmas";

function ensureLandingFonts() {
  if (document.querySelector(`link[data-xmas-fonts="1"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  link.setAttribute("data-xmas-fonts", "1");
  document.head.appendChild(link);
}

/** Prefix a product path (optionally with query) for the active Christmas locale. */
function localeProductHref(href: string, locale: ChristmasLandingLocale): string {
  const [path, query] = href.split("?");
  const localized = christmasPathForLocale(path, locale as ChristmasLocaleCode);
  return query ? `${localized}?${query}` : localized;
}

export function ChristmasLandingExperience({
  includeHero = true,
}: {
  /** When false, the cabin club hero is rendered by ChristmasClubPage instead. */
  includeHero?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const locale = useMemo(
    () => resolveChristmasLandingLocale(parseChristmasLocalePath(location.pathname).locale),
    [location.pathname],
  );

  useEffect(() => {
    ensureLandingFonts();
    captureFunnelAttribution(window.location.search);
    if (includeHero) {
      trackHubEvent("christmas_page_view");
    }
    upsertJsonLd("christmas-landing-jsonld", christmasLandingJsonLd(locale));
    return () => {
      document.getElementById("christmas-landing-jsonld")?.remove();
    };
  }, [includeHero, locale]);

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
    <article className="xmas-landing" dir={landingDir(locale)} lang={locale}>
      <a className="xmas-skip" href="#gift-tree">
        Skip to Christmas gifts
      </a>
      <AmbientSnow />
      {includeHero ? (
        <ImmersiveHero
          locale={locale}
          onPrimary={() => goCreate("hero")}
          onExplore={() => {
            document.getElementById("gift-tree")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      ) : null}
      <GiftTreeLandingScene
        locale={locale}
        onViewed={() => {
          trackHubEvent("christmas_hub_interact", { surface: "hub_gifts", action: "section_viewed" }, "christmas_gift_tree");
        }}
      />
      <GiftFinderScene
        locale={locale}
        onSelect={(recipient: GiftFinderRecipient) => {
          trackHubEvent(
            "christmas_hub_interact",
            { surface: "hub_gift_finder", action: "recipient", recipient_key: recipient },
            "christmas_gift_finder",
          );
        }}
        onCta={(recipient: GiftFinderRecipient) => {
          trackHubEvent(
            "christmas_hub_cta",
            { surface: "hub_gift_finder", recipient_key: recipient },
            "christmas_gift_finder",
          );
          void navigate(localeProductHref(giftFinderUrl(recipient), locale));
        }}
      />
      <PortraitScene
        locale={locale}
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
          void navigate(localeProductHref(portraitUrl(vertical), locale));
        }}
      />
      <SantaScene
        locale={locale}
        onViewed={onSantaViewed}
        onInputStarted={onSantaInputStarted}
        onSubmit={(name) => {
          writeSantaNameHandoff(name);
          trackHubEvent(
            "santa_form_completed",
            { surface: "hub_santa", action: "name_submitted", has_name: true },
            "christmas_santa_video",
          );
          // Preserve intentional link to localized Santa shell (noindex where unverified).
          void navigate(localeProductHref(santaExperienceUrl(name), locale));
        }}
      />
      <WishlistScene
        locale={locale}
        onCta={() => {
          trackHubEvent("christmas_hub_cta", { surface: "hub_wishlist" }, "christmas_wishlist");
          void navigate(localeProductHref("/christmas/wishlist", locale));
        }}
      />
      <TreeScene
        locale={locale}
        onCta={() => {
          trackHubEvent("christmas_hub_cta", { surface: "hub_tree" }, "christmas_tree");
          void navigate(localeProductHref("/christmas/tree", locale));
        }}
      />
      <StoryErrorBoundary>
        <AdventScene
          locale={locale}
          onInteract={(day) => {
            trackHubEvent("christmas_hub_interact", { surface: "hub_advent", action: "door", day }, "christmas_advent");
          }}
          onCta={() => {
            trackHubEvent("christmas_hub_cta", { surface: "hub_advent" }, "christmas_advent");
            void navigate(localeProductHref("/christmas/advent", locale));
          }}
        />
      </StoryErrorBoundary>
      <StoryErrorBoundary>
        <CardsScene
          locale={locale}
          onCta={(theme: CardTheme) => {
            trackHubEvent("christmas_hub_cta", { surface: "hub_cards", theme }, "christmas_card");
            void navigate(localeProductHref(cardsUrl(theme), locale));
          }}
        />
      </StoryErrorBoundary>
      <StoryErrorBoundary>
        <MessagesScene
          locale={locale}
          onCta={(recipient, tone) => {
            trackHubEvent(
              "christmas_hub_cta",
              { surface: "hub_messages", recipient_key: recipient, tone },
              "christmas_messages",
            );
            void navigate(localeProductHref(messagesUrl(recipient, tone), locale));
          }}
        />
      </StoryErrorBoundary>
      <FinalCtaScene locale={locale} onCta={() => goCreate("finale")} />
      <GeoScene locale={locale} />
      <FaqScene locale={locale} />
    </article>
  );
}
