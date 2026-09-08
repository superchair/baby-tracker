import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE_NAME } from "./ddb.js";
import { CONFIG_PK, CONFIG_SK, ConfigRecord, defaultConfig } from "./types.js";

/**
 * Reads the singleton household config item, lazily creating it with
 * defaults if it doesn't exist yet.
 */
export async function getOrCreateConfig(): Promise<ConfigRecord> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: CONFIG_PK, SK: CONFIG_SK },
    }),
  );

  if (result.Item) {
    return result.Item as ConfigRecord;
  }

  const defaults = defaultConfig();
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: defaults,
      // Avoid clobbering a concurrent writer that created it first.
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  ).catch((err) => {
    // If another request created it concurrently, that's fine.
    if (err?.name !== "ConditionalCheckFailedException") {
      throw err;
    }
  });

  return defaults;
}

export async function saveConfig(config: ConfigRecord): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: config,
    }),
  );
}
