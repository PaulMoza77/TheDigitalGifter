/**
 * Client-visible P2B editorial sections for portrait verticals
 * (couples / pets / dogs / cats). Family has its own experience copy.
 * Keep claims aligned with SSR depth in christmasContentDepthP2b.mjs.
 */

import { Link } from "react-router-dom";
import type { ChristmasPortraitVerticalId } from "../portraitVerticals";

type SeoSection = {
  h2: string;
  body: string;
  list?: string[];
  linkHref?: string;
  linkLabel?: string;
};

type VerticalSeo = {
  geo: { h2: string; body: string };
  sections: SeoSection[];
  faqs: Array<{ q: string; a: string }>;
};

const COUPLES: VerticalSeo = {
  geo: {
    h2: "What is a couple Christmas photo generator?",
    body:
      "A couple Christmas photo generator turns a photo of two people into a romantic or cozy Christmas couple portrait. Upload one photo that includes both of you, choose a couple Christmas style, and create a downloadable portrait you can share privately or use in a Christmas card.",
  },
  sections: [
    {
      h2: "Create a Christmas Portrait Together",
      body:
        "This experience is for two people — partners, engaged couples, husband and wife, or boyfriend and girlfriend. Upload one photo with both of you clearly visible, pick a Christmas look, and create a portrait made for the two of you.",
    },
    {
      h2: "Christmas Couple Photo Ideas",
      body: "Use cases this portrait often fits — as inspiration, not separate product modes:",
      list: [
        "First Christmas together",
        "Engaged couple Christmas portrait",
        "Husband and wife holiday portrait",
        "Boyfriend and girlfriend Christmas photo",
        "Long-distance Christmas surprise to share digitally",
        "Couple Christmas card photo",
      ],
    },
    {
      h2: "Romantic Christmas Styles",
      body:
        "Couple styles available today include Romantic Snowfall, Cozy Fireplace, Christmas Movie, Elegant Christmas, Winter City, Christmas Market, Classic Portrait, and Vintage Christmas.",
    },
    {
      h2: "What Couple Photos Work Best?",
      body:
        "Use one clear photo where both faces are visible and neither person is heavily cropped out. Good lighting helps. Selfies can work when both people are recognizable.",
    },
    {
      h2: "Make It a Christmas Card",
      body: "After you create a couple portrait, you can bring it into the Christmas Card Maker.",
      linkHref: "/christmas/cards",
      linkLabel: "Turn your couple portrait into a Christmas card",
    },
  ],
  faqs: [
    {
      q: "Can I use a selfie?",
      a: "Yes, when both people are clearly visible and recognizable in the same photo.",
    },
    {
      q: "Can both people stay recognizable?",
      a: "That’s the goal. Start with a clear photo of both faces — avoid extreme blur or one person mostly out of frame.",
    },
    {
      q: "Can I create a romantic Christmas portrait?",
      a: "Yes. Choose romantic or cozy couple styles such as Romantic Snowfall, Cozy Fireplace, or Elegant Christmas.",
    },
    {
      q: "Can I try different styles?",
      a: "Yes. Pick from the couple Christmas styles on the page before you create.",
    },
    {
      q: "Can I use the result as a Christmas card?",
      a: "Yes. Portrait handoff into the Christmas Card Maker is supported.",
    },
    {
      q: "Can I download it?",
      a: "Yes. Download the finished couple portrait from the result screen when it’s ready.",
    },
    {
      q: "What kind of photo should I upload?",
      a: "One clear photo that includes both of you. Faces should be visible; JPEG, PNG, or WebP works.",
    },
  ],
};

const PETS: VerticalSeo = {
  geo: {
    h2: "What is a Christmas pet photo generator?",
    body:
      "A Christmas pet photo generator turns a photo of a dog, cat, or other pet into a festive Christmas pet portrait. This Pets page is the hub for animal Christmas portraits, with specialized routes for dogs and cats.",
  },
  sections: [
    {
      h2: "Turn Your Pet Into Christmas Magic",
      body:
        "Upload a clear pet photo, choose a Christmas pet style, and create a festive portrait of the animal you love. This is the general pet hub — not a Secret Life comic pack.",
    },
    {
      h2: "Christmas Portraits for Dogs and Cats",
      body: "Want a clearer start for one species? Use the specialized dog or cat routes.",
      list: [
        "Christmas Dog Photo Generator → /christmas/dogs",
        "Christmas Cat Photo Generator → /christmas/cats",
      ],
    },
    {
      h2: "Pet Christmas Photo Examples",
      body: "Demo directions for pet Christmas portraits. Samples are inspiration, not customer photos.",
      list: [
        "Dog Christmas portrait in a festive scene",
        "Cat Christmas portrait by a tree or fireplace look",
        "Cozy sweater or Santa-inspired pet portrait styles",
      ],
    },
    {
      h2: "Christmas Styles for Pets",
      body:
        "Pet styles available today include Santa Pet, Cozy Christmas, North Pole, Christmas Sweater, Snow Portrait, Christmas Card, Royal Christmas, and Vintage Christmas.",
    },
    {
      h2: "What Pet Photos Work Best?",
      body:
        "Choose a clear photo with the pet’s face and eyes visible, decent lighting, and without extreme blur. If more than one pet should appear, make sure each animal is visible in the upload.",
    },
    {
      h2: "Pet Christmas Cards",
      body: "You can carry a finished pet portrait into the Christmas Card Maker.",
      linkHref: "/christmas/cards",
      linkLabel: "Turn your pet portrait into a Christmas card",
    },
  ],
  faqs: [
    {
      q: "Can I create a Christmas portrait of my dog?",
      a: "Yes. Start here or go to the dedicated Christmas dog portrait page for a dog-focused path.",
    },
    {
      q: "Can I create one for my cat?",
      a: "Yes. Use this Pets hub or the dedicated Christmas cat portrait page.",
    },
    {
      q: "Can I include more than one pet?",
      a: "If multiple pets are clearly visible in one photo, you can try that upload. Results are best when each animal’s face is easy to see.",
    },
    {
      q: "Can I include myself with my pet?",
      a: "This route is optimized for the pet as the star. For people-plus-pet family frames, the Family Christmas experience is often a better start.",
    },
    {
      q: "Which photos work best?",
      a: "Clear pet photos with visible eyes and face, good lighting, and limited blur.",
    },
    {
      q: "Can I download the image?",
      a: "Yes. Download from the result screen when your pet portrait is ready.",
    },
    {
      q: "Can I use it on a Christmas card?",
      a: "Yes. Portrait handoff into the Christmas Card Maker is supported.",
    },
  ],
};

const DOGS: VerticalSeo = {
  geo: {
    h2: "What is a Christmas dog photo generator?",
    body:
      "A Christmas dog photo generator creates a festive Christmas portrait from a photo of your dog. Upload a clear dog photo, choose a Christmas pet style, and download a dog-focused holiday portrait.",
  },
  sections: [
    {
      h2: "Create a Christmas Portrait of Your Dog",
      body:
        "This page is dog-specific. Upload a photo of your dog, pick a Christmas style, and create a holiday portrait that keeps the dog as the clear subject.",
    },
    {
      h2: "Christmas Dog Portrait Examples",
      body: "Demonstration directions for dog Christmas portraits — inspiration samples, not customer photos.",
      list: [
        "Dog beside a decorated Christmas tree look",
        "Cozy fireplace dog Christmas portrait",
        "Snowy Christmas dog portrait",
        "Santa-inspired or sweater-style dog Christmas portrait",
      ],
    },
    {
      h2: "Christmas Styles for Dogs",
      body:
        "Dog portraits use the Christmas pet style set: Santa Pet, Cozy Christmas, North Pole, Christmas Sweater, Snow Portrait, Christmas Card, Royal Christmas, and Vintage Christmas.",
    },
    {
      h2: "How to Choose a Good Dog Photo",
      body:
        "Pick a photo where your dog’s eyes and face are visible, the head isn’t heavily cropped, and blur is minimal. For more than one dog, make sure every dog you want in the portrait is clearly in the frame.",
    },
    {
      h2: "Christmas Cards With Your Dog",
      body: "Finished dog portraits can continue into the Christmas Card Maker.",
      linkHref: "/christmas/cards",
      linkLabel: "Make a Christmas card with your dog portrait",
    },
  ],
  faqs: [
    {
      q: "Can I create a Christmas portrait of my dog?",
      a: "Yes. Upload a clear dog photo on this page, choose a Christmas style, and create the portrait.",
    },
    {
      q: "What if I upload a cat photo by mistake?",
      a: "You’ll get a prompt to switch to the Christmas cat portrait experience.",
    },
    {
      q: "Can I include more than one dog?",
      a: "Yes if every dog is clearly visible in the same photo. Faces and eyes should be easy to see.",
    },
    {
      q: "Which dog photos work best?",
      a: "Clear face and eyes, limited blur, and avoid cropping off the ears or head.",
    },
    {
      q: "Can I try different Christmas styles for my dog?",
      a: "Yes. Choose from the dog-ready Christmas pet styles listed on the page.",
    },
    {
      q: "Can I download the dog portrait?",
      a: "Yes. Download it from the result screen when ready.",
    },
    {
      q: "Can I put my dog on a Christmas card?",
      a: "Yes. Use the Christmas Card Maker handoff after your portrait is ready.",
    },
  ],
};

const CATS: VerticalSeo = {
  geo: {
    h2: "What is a Christmas cat photo generator?",
    body:
      "A Christmas cat photo generator creates a festive Christmas portrait from a photo of your cat. Upload a clear cat photo, choose a Christmas pet style, and download a cat-focused holiday portrait.",
  },
  sections: [
    {
      h2: "Create a Magical Christmas Portrait of Your Cat",
      body:
        "This page is cat-specific. Upload a photo of your cat, choose a Christmas look, and create a holiday portrait with the cat as the star.",
    },
    {
      h2: "Christmas Cat Portrait Examples",
      body: "Demonstration directions featuring cats — inspiration samples, not customer photos.",
      list: [
        "Cat by a Christmas tree look",
        "Fireplace cozy cat Christmas portrait",
        "Snowy or elegant Christmas cat portrait",
        "Royal or vintage Christmas cat portrait styles",
      ],
    },
    {
      h2: "Christmas Styles for Cats",
      body:
        "Cat portraits use the Christmas pet style set: Santa Pet, Cozy Christmas, North Pole, Christmas Sweater, Snow Portrait, Christmas Card, Royal Christmas, and Vintage Christmas.",
    },
    {
      h2: "How to Choose a Good Cat Photo",
      body:
        "Choose a photo where your cat’s eyes and face are sharp and visible. Avoid extreme blur, heavy shadow across the face, or tight crops that cut off the ears and whiskers.",
    },
    {
      h2: "Turn Your Cat Portrait Into a Christmas Card",
      body: "After creating a cat Christmas portrait, you can continue into the Christmas Card Maker.",
      linkHref: "/christmas/cards",
      linkLabel: "Make a Christmas card with your cat portrait",
    },
  ],
  faqs: [
    {
      q: "Can I create a Christmas portrait of my cat?",
      a: "Yes. Upload a clear cat photo here, choose a Christmas style, and create the portrait.",
    },
    {
      q: "What if I upload a dog photo?",
      a: "You’ll be guided to switch to the Christmas dog portrait page.",
    },
    {
      q: "Do whiskers and face detail matter?",
      a: "Yes. Clear face and eye detail usually produce a stronger cat Christmas portrait.",
    },
    {
      q: "Can I try elegant or cozy looks for my cat?",
      a: "Yes. Styles include Cozy Christmas, Royal Christmas, Vintage Christmas, Snow Portrait, and more.",
    },
    {
      q: "Can I download the cat portrait?",
      a: "Yes. Download from the result screen when it’s ready.",
    },
    {
      q: "Can I use my cat portrait on a Christmas card?",
      a: "Yes. Card Maker handoff is supported after the portrait is created.",
    },
    {
      q: "Is this different from the Pets page?",
      a: "Yes. Pets is the general animal hub; this page is specifically for cats.",
    },
  ],
};

const BY_VERTICAL: Partial<Record<ChristmasPortraitVerticalId, VerticalSeo>> = {
  couples: COUPLES,
  pets: PETS,
  dogs: DOGS,
  cats: CATS,
};

function renderListItem(item: string) {
  const parts = item.includes(" → ") ? item.split(" → ") : null;
  if (parts && parts[1]?.startsWith("/")) {
    return (
      <li key={item}>
        <Link to={parts[1]}>{parts[0]}</Link>
      </li>
    );
  }
  return <li key={item}>{item}</li>;
}

/** Editorial SEO/GEO block shown below the portrait funnel for P2B verticals. */
export function PortraitVerticalSeoSections({
  verticalId,
}: {
  verticalId: ChristmasPortraitVerticalId;
}) {
  const seo = BY_VERTICAL[verticalId];
  if (!seo) return null;

  return (
    <div className="pg-seo-depth" style={{ marginTop: "3rem", color: "#fffaf1" }}>
      {seo.sections.map((section) => (
        <section key={section.h2} className="pg-section" aria-labelledby={`pv-${section.h2}`}>
          <h2 id={`pv-${section.h2}`} className="xmas-display" style={{ fontSize: "1.5rem" }}>
            {section.h2}
          </h2>
          <p className="xmas-lede">{section.body}</p>
          {section.list?.length ? <ul>{section.list.map(renderListItem)}</ul> : null}
          {section.linkHref && section.linkLabel ? (
            <p>
              <Link className="xmas-btn xmas-btn--ghost" to={section.linkHref}>
                {section.linkLabel}
              </Link>
            </p>
          ) : null}
        </section>
      ))}

      <section className="pg-section pg-geo" aria-labelledby="pv-geo">
        <h2 id="pv-geo">{seo.geo.h2}</h2>
        <p>{seo.geo.body}</p>
      </section>

      <section className="pg-section pg-faq" aria-labelledby="pv-faq">
        <h2 id="pv-faq">Frequently Asked Questions</h2>
        <dl>
          {seo.faqs.map((item) => (
            <div key={item.q} style={{ marginBottom: "1rem" }}>
              <dt style={{ fontWeight: 600 }}>{item.q}</dt>
              <dd className="xmas-lede">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
