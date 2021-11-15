import {MySky} from "skynet-js";
import {v4 as uuidV4} from "uuid";
import {combineMessage, decrypt, encrypt, extractMessage} from "../crypto";
import skynetClient, {dataDomain} from "../skynetClient";

type UserId = string;

export type Message = {
  id: string;
  sentAt: string;
  receivedAt: string;
  author: string;
  content: string;
  // and no mac, because this is a hackathon
};

export type MessagesResult =
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      messages: Array<Message>;
    }
  | {
      status: "counterparty_not_connected";
      counterparty: UserId;
    };

async function decryptMessages(
  key: CryptoKey,
  fileData: ArrayBuffer
): Promise<Array<Message>> {
  const message = extractMessage(fileData);

  const decrypted = await decrypt(key, message);
  const decoded = JSON.parse(decrypted);
  return decoded.messages;
}

// async function encryptMessages(
//   key: CryptoKey,
//   messages: Array<Message>
// ): Promise<ArrayBuffer> {
//   const message = JSON.stringify({messages});
//   const encrypted = await encrypt(key, message);
//   return combineMessage(encrypted);
// }

function mergeMessages(
  myMessages: Array<Message>,
  theirMessages: ReadonlyArray<Message>
): {
  merged: Array<Message>;
  needAddition: Array<Message>;
} {
  const mySeenIds = new Set(myMessages.map((m) => m.id));
  const theirMessagesById = new Map(theirMessages.map((m) => [m.id, m]));

  const mergedMessages = [...myMessages];
  const needAddition = [];
  const now = new Date().toISOString();
  for (const id of theirMessagesById.keys()) {
    if (!mySeenIds.has(id)) {
      const theirMessage = theirMessagesById.get(id)!;
      const myVersion = {...theirMessage, receivedAt: now};
      mergedMessages.push(myVersion);
      needAddition.push(myVersion);
    }
  }

  mergedMessages.sort((a, b) => (a.receivedAt > b.receivedAt ? 1 : -1));
  return {merged: mergedMessages, needAddition};
}

function arrayBufferToB64(buffer: ArrayBuffer): string {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary_string = window.atob(b64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getMyMessages(
  mysky: MySky,
  counterpartyId: UserId,
  sharedKey: CryptoKey
): Promise<null | Array<Message>> {
  const {data} = await mysky.getJSON(
    `${dataDomain}/chats/${counterpartyId}.json`
  );
  if (data == null) {
    return null;
  }
  const b64EncryptedData = data.wgmi as string;
  const encryptedData = b64ToArrayBuffer(b64EncryptedData);
  return await decryptMessages(sharedKey, encryptedData);
}

async function getCounterPartyMessages(
  mysky: MySky,
  myId: UserId,
  counterpartyId: UserId,
  sharedKey: CryptoKey
): Promise<null | ReadonlyArray<Message>> {
  const {data} = await skynetClient.file.getJSON(
    counterpartyId,
    `${dataDomain}/chats/${myId}.json`
  );
  if (data == null) {
    return null;
  }
  const b64EncryptedData = data.wgmi as string;
  const encryptedData = b64ToArrayBuffer(b64EncryptedData);
  return await decryptMessages(sharedKey, encryptedData);
}

async function writeMyMessages(
  mysky: MySky,
  counterpartyId: UserId,
  sharedKey: CryptoKey,
  messages: ReadonlyArray<Message>
): Promise<void> {
  const serialized = JSON.stringify({messages});
  const encrypted = await encrypt(sharedKey, serialized);
  const combined = combineMessage(encrypted);
  const b64EncryptedData = arrayBufferToB64(combined);
  await mysky.setJSON(`${dataDomain}/chats/${counterpartyId}.json`, {
    wgmi: b64EncryptedData,
  });
}

export async function getMessages(
  mysky: MySky,
  myId: UserId,
  counterpartyId: UserId,
  sharedKey: CryptoKey
): Promise<MessagesResult> {
  let myMessages = await getMyMessages(mysky, counterpartyId, sharedKey);
  // This is actually fine, just act like there are no messages
  if (myMessages == null) {
    myMessages = [];
  }

  let theirMessages = await getCounterPartyMessages(
    mysky,
    myId,
    counterpartyId,
    sharedKey
  );
  // This is actually fine, just act like there are no messages
  if (theirMessages == null) {
    theirMessages = [];
  }

  const {merged, needAddition} = mergeMessages(myMessages, theirMessages);

  for (const newMessage of needAddition) {
    enqueueMessage(newMessage, counterpartyId);
  }
  await drainQueue(mysky, counterpartyId, sharedKey);

  return {
    status: "success",
    messages: merged,
  };
}

export async function sendMessage(
  mysky: MySky,
  myId: UserId,
  counterpartyId: UserId,
  sharedKey: CryptoKey,
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  const newMessage = {
    id: uuidV4(),
    sentAt: now,
    receivedAt: now,
    author: myId,
    content: message,
  };

  enqueueMessage(newMessage, counterpartyId);
  await drainQueue(mysky, counterpartyId, sharedKey);
}

type QueueAction = {
  type: "addMessage";
  counterpartyId: UserId;
  message: Message;
};

let updatePending = false;
let queue: Array<QueueAction> = [];
function enqueueMessage(message: Message, counterpartyId: UserId) {
  queue.push({type: "addMessage", counterpartyId, message});
}
async function drainQueue(
  mysky: MySky,
  counterpartyId: UserId,
  sharedKey: CryptoKey
) {
  if (queue.length === 0) {
    return;
  }
  if (updatePending) {
    return;
  }
  updatePending = true;

  let myMessages = await getMyMessages(mysky, counterpartyId, sharedKey);
  if (myMessages == null) {
    console.log(
      "Got no messages in drainQueue, assuming there are no messages"
    );
    myMessages = [];
  }

  const toAdd = queue;
  queue = [];

  for (const action of toAdd) {
    if (action.counterpartyId !== counterpartyId) {
      console.log("Dropping queued message: ", action);
      continue;
    }

    const myMessageIds = new Set(myMessages.map((m) => m.id));
    if (!myMessageIds.has(action.message.id)) {
      myMessages.push(action.message);
    }
  }
  await writeMyMessages(mysky, counterpartyId, sharedKey, myMessages);

  updatePending = false;
  if (queue.length > 0) {
    await drainQueue(mysky, counterpartyId, sharedKey);
  }
}
