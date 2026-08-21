import type {
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  CreatePetOrderRequest,
  CreatePetOrderResponse,
  CreateStripeCheckoutRequest,
  CreateStripeCheckoutResponse,
  CreateUpsellCheckoutRequest,
  CreateUpsellCheckoutResponse,
  GetOrderByPublicTokenRequest,
  GetOrderResultsRequest,
  GetSignedUploadUrlRequest,
  ListMyPetGalleriesResponse,
  PetFunnelApiErrorCode,
  PetGenerationProgress,
  PetOrder,
  PetOrderResults,
  PollGenerationProgressRequest,
  PublicPetOffer,
  SignedUploadUrlResponse,
} from "./types";
import { checkoutAnalyticsContext } from "./funnelInternal";

/**
 * Typed client contract for the pet funnel.
 * The Supabase agent should implement this interface and pass it into the pages.
 * This file must not call fetch, Supabase, or Stripe.
 */
export interface PetFunnelApi {
  createOrder(input: CreatePetOrderRequest): Promise<CreatePetOrderResponse>;
  getSignedUploadUrl(
    input: GetSignedUploadUrlRequest
  ): Promise<SignedUploadUrlResponse>;
  confirmUpload(input: ConfirmUploadRequest): Promise<ConfirmUploadResponse>;
  createStripeCheckout(
    input: CreateStripeCheckoutRequest
  ): Promise<CreateStripeCheckoutResponse>;
  createUpsellCheckout(
    input: CreateUpsellCheckoutRequest
  ): Promise<CreateUpsellCheckoutResponse>;
  getOrderByPublicToken(input: GetOrderByPublicTokenRequest): Promise<PetOrder>;
  pollGenerationProgress(
    input: PollGenerationProgressRequest
  ): Promise<PetGenerationProgress>;
  getOrderResults(input: GetOrderResultsRequest): Promise<PetOrderResults>;
  listMyPetGalleries(): Promise<ListMyPetGalleriesResponse>;
  getPublicOffer?(): Promise<PublicPetOffer>;
}

export class PetApiError extends Error {
  readonly code: PetFunnelApiErrorCode;
  readonly status: number;

  constructor(code: PetFunnelApiErrorCode, message: string, status = 500) {
    super(message);
    this.name = "PetApiError";
    this.code = code;
    this.status = status;
  }
}

export function createUnimplementedPetApi(): PetFunnelApi {
  const reject = (operation: keyof PetFunnelApi) => {
    return async () => {
      throw new PetApiError(
        "PET_API_NOT_CONNECTED",
        `Pet funnel API is not connected yet (${operation}).`,
        501
      );
    };
  };

  return {
    createOrder: reject("createOrder"),
    getSignedUploadUrl: reject("getSignedUploadUrl"),
    confirmUpload: reject("confirmUpload"),
    createStripeCheckout: reject("createStripeCheckout"),
    createUpsellCheckout: reject("createUpsellCheckout"),
    getOrderByPublicToken: reject("getOrderByPublicToken"),
    pollGenerationProgress: reject("pollGenerationProgress"),
    getOrderResults: reject("getOrderResults"),
    listMyPetGalleries: reject("listMyPetGalleries"),
    getPublicOffer: async () => ({
      sku: "pet-secret-life-12",
      name: "My Pet’s Secret Life",
      amountCents: PET_PRICE_CENTS,
      currency: "usd",
      imageCount: 12,
      videoCount: 2,
      subscription: false,
      active: true,
      priceDisplay: PET_PRICE_DISPLAY,
      deliveryEstimate: "Usually ready in a few minutes after payment",
    }),
  };
}

export const unimplementedPetApi: PetFunnelApi = createUnimplementedPetApi();

export async function uploadPhotoToSignedUrl(
  signed: SignedUploadUrlResponse,
  file: File
): Promise<void> {
  if (signed.skipNetworkUpload) {
    return;
  }

  const response = await fetch(signed.uploadUrl, {
    method: signed.method,
    headers: signed.headers,
    body: file,
  });

  if (!response.ok) {
    throw new PetApiError(
      "UPLOAD_FAILED",
      `Photo upload failed (${response.status}).`,
      response.status
    );
  }
}

export type StartPetCheckoutInput = {
  api: PetFunnelApi;
  email: string;
  petName: string;
  species: CreatePetOrderRequest["species"];
  personality: CreatePetOrderRequest["personality"];
  photo: CreatePetOrderRequest["photo"];
  file: File;
  successUrl: string;
  cancelUrl: string;
  promoCode?: string;
  subtype?: CreatePetOrderRequest["subtype"];
  subtypeDetail?: CreatePetOrderRequest["subtypeDetail"];
};

export type StartPetCheckoutResult = {
  orderId: string;
  publicToken: string;
  checkoutUrl: string | null;
  sessionId: string;
  status?: "open" | "payment_processing" | "comped";
  eventId?: string;
  purchaseEventId?: string;
  amountCents?: number;
  chargedAmountCents?: number;
};

/**
 * Canonical checkout orchestration for the future backend.
 * Pages call this instead of inventing a second sequence.
 */
export async function startPetCheckout(
  input: StartPetCheckoutInput
): Promise<StartPetCheckoutResult> {
  const order = await input.api.createOrder({
    email: input.email,
    petName: input.petName,
    species: input.species,
    personality: input.personality,
      photo: input.photo,
      sku: "pet-secret-life-12",
      subtype: input.subtype ?? null,
      subtypeDetail: input.subtypeDetail ?? null,
    });

  const signed = await input.api.getSignedUploadUrl({
    orderId: order.orderId,
    publicToken: order.publicToken,
    contentType: input.photo.contentType,
    fileName: input.photo.fileName,
    byteSize: input.photo.byteSize,
  });

  await uploadPhotoToSignedUrl(signed, input.file);

  await input.api.confirmUpload({
    orderId: order.orderId,
    publicToken: order.publicToken,
    objectPath: signed.objectPath,
  });

  const checkout = await input.api.createStripeCheckout({
    orderId: order.orderId,
    publicToken: order.publicToken,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    customerEmail: input.email,
    promoCode: input.promoCode,
    ...checkoutAnalyticsContext(),
  });

  return {
    orderId: order.orderId,
    publicToken: order.publicToken,
    checkoutUrl: checkout.checkoutUrl,
    sessionId: checkout.sessionId,
    status: checkout.status,
    eventId: checkout.eventId,
    purchaseEventId: checkout.purchaseEventId,
    amountCents: checkout.amountCents,
    chargedAmountCents: checkout.chargedAmountCents,
  };
}
