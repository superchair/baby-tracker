import { QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import webpush from "web-push";
import { ddb, TABLE_NAME } from "../shared/ddb.js";
import { getAppSecrets } from "../shared/secrets.js";
import { getOrCreateConfig, saveConfig } from "../shared/config.js";
import {
  EventRecord,
  EventType,
  PUSHSUB_PK,
  PushSubscriptionRecord,
  gsi1pkForType,
} from "../shared/types.js";

const REMINDER_TYPES: Extract<EventType, "FEEDING" | "DIAPER">[] = [
  "FEEDING",
  "DIAPER",
];

const VAPID_SUBJECT = "mailto:admin@example.com";

const TYPE_LABEL: Record<string, string> = {
  FEEDING: "feeding",
  DIAPER: "diaper change",
};

async function getMostRecentEvent(type: EventType): Promise<EventRecord | undefined> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": gsi1pkForType(type) },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );
  return result.Items?.[0] as EventRecord | undefined;
}

async function getAllPushSubscriptions(): Promise<PushSubscriptionRecord[]> {
  const items: PushSubscriptionRecord[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": PUSHSUB_PK },
        ExclusiveStartKey,
      }),
    );
    items.push(...((result.Items as PushSubscriptionRecord[]) ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function notifySubscribers(
  subscriptions: PushSubscriptionRecord[],
  payload: { title: string; body: string },
): Promise<void> {
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await ddb.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { PK: sub.PK, SK: sub.SK },
            }),
          ).catch(() => undefined);
        } else {
          console.error("push send failed", sub.SK, err);
        }
      }
    }),
  );
}

/**
 * Core reminder logic, exported as a plain function so it is unit-testable
 * independent of the Lambda/EventBridge wiring.
 */
export async function runReminderCheck(): Promise<void> {
  const secrets = await getAppSecrets();
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    secrets.vapidPublicKey,
    secrets.vapidPrivateKey,
  );

  const config = await getOrCreateConfig();
  const now = Date.now();
  let configDirty = false;

  for (const type of REMINDER_TYPES) {
    const mostRecent = await getMostRecentEvent(type);
    if (!mostRecent) {
      continue;
    }

    const thresholdMin =
      type === "FEEDING"
        ? config.reminderThresholds.feedingMin
        : config.reminderThresholds.diaperMin;
    const lastNotifiedKey = type === "FEEDING" ? "feeding" : "diaper";

    const elapsedMinutes = (now - new Date(mostRecent.startTime).getTime()) / 60000;
    const alreadyNotified =
      config.lastNotifiedAt[lastNotifiedKey] === mostRecent.startTime;

    if (elapsedMinutes >= thresholdMin && !alreadyNotified) {
      const subscriptions = await getAllPushSubscriptions();
      const hours = (elapsedMinutes / 60).toFixed(1);
      await notifySubscribers(subscriptions, {
        title: "Baby Tracker",
        body: `It's been over ${hours} hours since the last ${TYPE_LABEL[type]}`,
      });

      config.lastNotifiedAt[lastNotifiedKey] = mostRecent.startTime;
      configDirty = true;
    }
  }

  if (configDirty) {
    await saveConfig(config);
  }
}

export async function handler(): Promise<void> {
  await runReminderCheck();
}
