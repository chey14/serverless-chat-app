const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,   
  QueryCommand,
  GetCommand,
} = require("@aws-sdk/lib-dynamodb");

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const CLIENTS_TABLE_NAME = "ChatConnections";
const MESSAGES_TABLE_NAME = "ChatMessages";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const apigw = new ApiGatewayManagementApiClient({
  endpoint: process.env.WSSAPIGATEWAYENDPOINT,
});

const responseOK = { statusCode: 200, body: "" };
const responseForbidden = { statusCode: 403, body: "" };

class HandlerError extends Error {}

// ================= MAIN HANDLER =================
exports.handle = async (event) => {
  console.log("EVENT:", JSON.stringify(event));

  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  try {
    switch (routeKey) {
      case "$connect":
        return handleConnect(connectionId, event.queryStringParameters);

      case "$disconnect":
        return handleDisconnect(connectionId);

      case "getClients":
        return handleGetClients(connectionId);

      case "sendMessage":
        return handleSendMessage(
          await getClient(connectionId),
          JSON.parse(event.body || "{}")
        );

      case "getMessages":
        return handleGetMessages(
          await getClient(connectionId),
          JSON.parse(event.body || "{}")
        );

      default:
        return responseForbidden;
    }
  } catch (err) {
    console.error("ERROR:", err);

    /**
     * IMPORTANT RULE:
     * - NEVER send WebSocket messages during $connect or $disconnect
     * - Only send errors for MESSAGE routes
     */

    if (
      routeKey !== "$connect" &&
      routeKey !== "$disconnect" &&
      err instanceof HandlerError
    ) {
      await postToConnection(
        connectionId,
        JSON.stringify({
          type: "error",
          message: err.message,
        })
      );
    }

    // Never throw in WebSocket Lambda
    return responseOK;
  }
};

// ================= ROUTES =================

async function handleConnect(connectionId, query) {
  if (!query || !query.nickname) return responseForbidden;

  await docClient.send(
    new PutCommand({
      TableName: CLIENTS_TABLE_NAME,
      Item: {
        connectionID: connectionId,
        nickname: query.nickname,
      },
    })
  );

  await notifyClientChange(connectionId);
  return responseOK;
}

async function handleDisconnect(connectionId) {
  await docClient.send(
    new DeleteCommand({
      TableName: CLIENTS_TABLE_NAME,
      Key: { connectionID: connectionId },
    })
  );

  await notifyClientChange(connectionId);
  return responseOK;
}

async function handleGetClients(connectionId) {
  const clients = await getAllClients();

  await postToConnection(
    connectionId,
    JSON.stringify({
      type: "clients",
      value: clients.map(c => ({ nickname: c.nickname })),
    })
  );

  return responseOK;
}

async function handleSendMessage(client, body) {
  if (!body.recipientNickname || !body.message) {
    throw new HandlerError("invalid SendMessageBody");
  }

  const nicknameToNickname = [client.nickname, body.recipientNickname]
    .sort()
    .join("#");

  await docClient.send(
    new PutCommand({
      TableName: MESSAGES_TABLE_NAME,
      Item: {
        // TABLE KEYS
        roomId: nicknameToNickname,                  // PK (String)
        timestamp: new Date().toISOString(),         // SK (String)

        // GSI KEYS (THIS WAS MISSING)
        nicknameToNickname: nicknameToNickname,      // GSI PK
        createdAt: Date.now(),                       // GSI SK (Number)

        // DATA
        sender: client.nickname,
        message: body.message,
      },
    })
  );

  const recipientConnectionId = await getConnectionIdByNickname(
    body.recipientNickname
  );

  if (recipientConnectionId) {
    await postToConnection(
      recipientConnectionId,
      JSON.stringify({
        type: "message",
        value: {
          sender: client.nickname,
          message: body.message,
        },
      })
    );
  }

  return responseOK;
}

async function handleGetMessages(client, body) {
  if (!body.targetNickname || !body.limit) {
    throw new HandlerError("invalid GetMessageBody");
  }

  const nicknameToNickname = [client.nickname, body.targetNickname]
    .sort()
    .join("#");

  const params = {
    TableName: MESSAGES_TABLE_NAME,
    IndexName: "NicknameToNicknameIndex",
    KeyConditionExpression:
      "#n = :n AND #c <= :now",
    ExpressionAttributeNames: {
      "#n": "nicknameToNickname",
      "#c": "createdAt",
    },
    ExpressionAttributeValues: {
      ":n": nicknameToNickname,
      ":now": Date.now(),
    },
    Limit: body.limit,
    ScanIndexForward: false, // newest first
  };

  const result = await docClient.send(new QueryCommand(params));

  await postToConnection(
    client.connectionID,
    JSON.stringify({
      type: "messages",
      value: {
        messages: result.Items || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
      },
    })
  );

  return responseOK;
}
// ================= HELPERS =================

async function getClient(connectionId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: CLIENTS_TABLE_NAME,
      Key: { connectionID: connectionId },
    })
  );

  if (!result.Item) throw new HandlerError("client does not exist");
  return result.Item;
}

async function getAllClients() {
  const result = await docClient.send(
    new ScanCommand({
      TableName: CLIENTS_TABLE_NAME,
    })
  );

  return (result.Items || []).map((c) => ({
    connectionId: c.connectionID,
    nickname: c.nickname,
  }));
}

async function getConnectionIdByNickname(nickname) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: CLIENTS_TABLE_NAME,
      IndexName: "NicknameIndex",
      KeyConditionExpression: "#n = :n",
      ExpressionAttributeNames: { "#n": "nickname" },
      ExpressionAttributeValues: { ":n": nickname },
    })
  );

  return result.Items?.[0]?.connectionID;
}

async function notifyClientChange(excludedConnectionId) {
  const clients = await getAllClients();

  await Promise.all(
    clients.map(async (c) => {
      if (c.connectionId === excludedConnectionId) return;

      await postToConnection(
        c.connectionId,
        JSON.stringify({ type: "clients", value: clients })
      );
    })
  );
}

async function postToConnection(connectionID, message) {
  try {
    await apigw.send(
      new PostToConnectionCommand({
        ConnectionId: connectionID,
        Data: message,
      })
    );
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 410) {
      console.log("Stale connection, deleting:", connectionID);

      await docClient.send(
        new DeleteCommand({
          TableName: CLIENTS_TABLE_NAME,
          Key: { connectionID },
        })
      );

      // IMPORTANT: do NOT throw
      return;
    }

    console.error("postToConnection failed:", err);
    throw err;
  }
}