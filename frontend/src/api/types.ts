// Shared types for the Baby Tracker API contract.

export type EventType = 'FEEDING' | 'DIAPER';

export interface FeedingDetails {
  amountMl: number;
}

export interface DiaperDetails {
  wet: boolean;
  dirty: boolean;
}

interface BaseEvent {
  id: string;
  babyId: string;
  startTime: string;
  endTime: string | null;
  createdBy: string;
  notes?: string;
  createdAt: string;
}

export interface FeedingEvent extends BaseEvent {
  type: 'FEEDING';
  details: FeedingDetails;
}

export interface DiaperEvent extends BaseEvent {
  type: 'DIAPER';
  details: DiaperDetails;
}

export type Event = FeedingEvent | DiaperEvent;

export interface CreateEventRequest {
  type: EventType;
  startTime: string;
  endTime?: string | null;
  notes?: string;
  details: FeedingDetails | DiaperDetails;
}

export interface UpdateEventRequest {
  /** The event's original startTime - required, used server-side to locate it. */
  startTime: string;
  /** If provided and different from `startTime`, moves the event to a new time. */
  newStartTime?: string;
  endTime?: string;
  notes?: string;
  details?: FeedingDetails | DiaperDetails;
}

export interface GetEventsQuery {
  [key: string]: string | undefined;
  from?: string;
  to?: string;
  type?: EventType;
  /** Caps the number of most-recent events returned (server still sorts newest-first). */
  limit?: string;
}

export interface GetEventsResponse {
  events: Event[];
}

export interface ReminderThresholds {
  feedingMin: number;
  diaperMin: number;
}

export interface BabyConfig {
  babyName: string;
  babyBirthDate: string | null;
  reminderThresholds: ReminderThresholds;
}

export type UpdateConfigRequest = Partial<Omit<BabyConfig, 'reminderThresholds'>> & {
  reminderThresholds?: Partial<ReminderThresholds>;
};

export interface VapidPublicKeyResponse {
  key: string;
}

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscribeRequest {
  endpoint: string;
  keys: PushSubscriptionKeys;
}
