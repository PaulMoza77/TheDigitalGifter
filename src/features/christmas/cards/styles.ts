/** Card style/layout registry — preferred import path for the canvas renderer. */

export {
  CARD_LAYOUTS,
  CARD_STYLES,
  CARD_STYLE_KEYS,
  CARD_LAYOUT_KEYS,
  getCardStyle,
  findCardStyle,
  getCardLayout,
  adaptiveFontSize,
  maxLinesForLayout,
  charsPerLineForLayout,
  type CardLayoutKey,
  type CardStyleKey,
  type CardStyleDef,
} from "./cardStyles";

export { MAX_CARD_MESSAGE_CHARS } from "./taxonomy";
