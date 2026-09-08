import { z } from "zod";

export const EVENT_TYPES = ["FEEDING", "DIAPER"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const FeedingDetailsSchema = z
  .object({
    amountMl: z.number().positive(),
  })
  .strict();

export const DiaperDetailsSchema = z
  .object({
    wet: z.boolean(),
    dirty: z.boolean(),
  })
  .strict();

export function detailsSchemaFor(type: EventType) {
  switch (type) {
    case "FEEDING":
      return FeedingDetailsSchema;
    case "DIAPER":
      return DiaperDetailsSchema;
  }
}

export type FeedingDetails = z.infer<typeof FeedingDetailsSchema>;
export type DiaperDetails = z.infer<typeof DiaperDetailsSchema>;
export type EventDetails = FeedingDetails | DiaperDetails;

export interface EventRecord {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  id: string;
  babyId: string;
  type: EventType;
  startTime: string;
  endTime: string | null;
  createdBy: string;
  notes?: string;
  details: EventDetails;
  createdAt: string;
}

export interface EventResponse {
  id: string;
  babyId: string;
  type: EventType;
  startTime: string;
  endTime: string | null;
  createdBy: string;
  notes?: string;
  details: EventDetails;
  createdAt: string;
}

export function toEventResponse(item: EventRecord): EventResponse {
  return {
    id: item.id,
    babyId: item.babyId,
    type: item.type,
    startTime: item.startTime,
    endTime: item.endTime ?? null,
    createdBy: item.createdBy,
    notes: item.notes,
    details: item.details,
    createdAt: item.createdAt,
  };
}

export const BABY_ID = "default";
export const BABY_PK = `BABY#${BABY_ID}`;

export function eventSK(startTime: string, id: string): string {
  return `EVENT#${startTime}#${id}`;
}

export function gsi1pkForType(type: EventType): string {
  return `${BABY_PK}#TYPE#${type}`;
}

export const CreateEventBodySchema = z.object({
  type: z.enum(EVENT_TYPES),
  startTime: z.string().min(1),
  endTime: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).optional(),
  details: z.unknown(),
});

export const UpdateEventBodySchema = z.object({
  startTime: z.string().min(1),
  /** If provided and different from `startTime`, moves the event to a new time (changes its sort key). */
  newStartTime: z.string().min(1).optional(),
  endTime: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).optional(),
  details: z.unknown().optional(),
});

// -------- Household config --------

export interface ReminderThresholds {
  feedingMin: number;
  diaperMin: number;
}

export interface LastNotifiedAt {
  feeding: string | null;
  diaper: string | null;
}

export interface ConfigRecord {
  PK: "CONFIG";
  SK: "HOUSEHOLD";
  babyName: string;
  babyBirthDate: string | null;
  reminderThresholds: ReminderThresholds;
  lastNotifiedAt: LastNotifiedAt;
}

export interface ConfigResponse {
  babyName: string;
  babyBirthDate: string | null;
  reminderThresholds: ReminderThresholds;
}

export const CONFIG_PK = "CONFIG";
export const CONFIG_SK = "HOUSEHOLD";

export function defaultConfig(): ConfigRecord {
  return {
    PK: CONFIG_PK,
    SK: CONFIG_SK,
    babyName: "Baby",
    babyBirthDate: null,
    reminderThresholds: { feedingMin: 180, diaperMin: 180 },
    lastNotifiedAt: { feeding: null, diaper: null },
  };
}

export function toConfigResponse(config: ConfigRecord): ConfigResponse {
  return {
    babyName: config.babyName,
    babyBirthDate: config.babyBirthDate,
    reminderThresholds: config.reminderThresholds,
  };
}

export const UpdateConfigBodySchema = z.object({
  babyName: z.string().trim().min(1).max(60).optional(),
  babyBirthDate: z.string().nullable().optional(),
  reminderThresholds: z
    .object({
      feedingMin: z.number().positive().optional(),
      diaperMin: z.number().positive().optional(),
    })
    .optional(),
});

// -------- Push subscriptions --------

export interface PushSubscriptionRecord {
  PK: "PUSHSUB";
  SK: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdBy: string;
  createdAt: string;
}

export const PUSHSUB_PK = "PUSHSUB";

export const PushSubscribeBodySchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

