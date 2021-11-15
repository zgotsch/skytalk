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

// HACK:
// Contract: if merge does not add any new messages, it will be equal to the first argument
function mergeMessages(
  myMessages: Array<Message>,
  theirMessages: ReadonlyArray<Message>
): Array<Message> {
  const mySeenIds = new Set(myMessages.map((m) => m.id));
  const theirMessagesById = new Map(theirMessages.map((m) => [m.id, m]));

  let sawNewMessage = false;
  const mergedMessages = [...myMessages];
  const now = new Date().toISOString();
  for (const id of theirMessagesById.keys()) {
    if (!mySeenIds.has(id)) {
      sawNewMessage = true;
      const theirMessage = theirMessagesById.get(id)!;
      const myVersion = {...theirMessage, receivedAt: now};
      mergedMessages.push(myVersion);
    }
  }

  if (!sawNewMessage) {
    return myMessages;
  }

  mergedMessages.sort((a, b) => (a.receivedAt > b.receivedAt ? 1 : -1));
  return mergedMessages;
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

export async function messages(
  mysky: MySky,
  myId: UserId,
  counterpartyId: UserId,
  sharedKey: CryptoKey
): Promise<MessagesResult> {
  let myMessages = await getMyMessages(mysky, counterpartyId, sharedKey);
  if (myMessages == null) {
    myMessages = [];
    writeMyMessages(mysky, counterpartyId, sharedKey, myMessages);
  }

  let theirMessages = await getCounterPartyMessages(
    mysky,
    myId,
    counterpartyId,
    sharedKey
  );
  if (theirMessages == null) {
    return {
      status: "counterparty_not_connected",
      counterparty: counterpartyId,
    };
  }

  const merged = mergeMessages(myMessages, theirMessages);
  if (merged !== myMessages) {
    writeMyMessages(mysky, counterpartyId, sharedKey, merged);
  }

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
  const myMessage = {
    id: uuidV4(),
    sentAt: now,
    receivedAt: now,
    author: myId,
    content: message,
  };

  let myMessages = await getMyMessages(mysky, counterpartyId, sharedKey);
  if (myMessages == null) {
    myMessages = [];
  }
  myMessages.push(myMessage);
  return writeMyMessages(mysky, counterpartyId, sharedKey, myMessages);
}
