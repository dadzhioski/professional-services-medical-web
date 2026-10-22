import "server-only";
import { PriceCurrencyEnum, ServicesApi, type Price, type ServiceResponse, type UpdateServiceRequest } from "@dadzhioski/professional-services-api-client";
import { amountPattern } from "@/lib/price";
import { changeRecord, identifier, listRecords, optionalText, removeRecord } from "./owned-records";
import type { ApplySession } from "./session-transport";

export type ServiceDraft = Omit<UpdateServiceRequest, "version">;

const currencies: readonly string[] = Object.values(PriceCurrencyEnum);

function validPrice(price: Price | null | undefined) {
  return price === undefined || price === null ||
    (typeof price.amount === "string" && amountPattern.test(price.amount) && currencies.includes(price.currency));
}

function valid(service: ServiceResponse | null | undefined): service is ServiceResponse {
  return !!service && identifier(service.serviceId) && Number.isSafeInteger(service.version) &&
    optionalText(service.name) && optionalText(service.description) && validPrice(service.price) &&
    (service.locationIds === undefined || service.locationIds === null ||
      (Array.isArray(service.locationIds) && service.locationIds.every(identifier)));
}

export const listServices = (session?: string) =>
  listRecords(session, configuration => new ServicesApi(configuration).listServices(), valid);

export const createService = (origin: string | null, session: string | undefined, apply: ApplySession, draft: ServiceDraft) =>
  changeRecord(origin, session, apply,
    (configuration, init) => new ServicesApi(configuration).createService({ createServiceRequest: draft }, init), valid);

// The API replaces every field, the price and the linked locations, so the full draft is always sent.
export const updateService = (origin: string | null, session: string | undefined, apply: ApplySession,
  serviceId: string, draft: ServiceDraft, version: number) =>
  changeRecord(origin, session, apply,
    (configuration, init) => new ServicesApi(configuration).updateService({ serviceId, updateServiceRequest: { ...draft, version } }, init),
    valid, configuration => new ServicesApi(configuration).getService({ serviceId }));

export const deleteService = (origin: string | null, session: string | undefined, apply: ApplySession, serviceId: string) =>
  removeRecord(origin, session, apply, (configuration, init) => new ServicesApi(configuration).deleteService({ serviceId }, init));
