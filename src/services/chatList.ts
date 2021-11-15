import {MySky} from "skynet-js";
import {dataDomain} from "../skynetClient";

type UserId = string;

export type Chat = {
  counterpartyId: UserId;
};

const CHAT_FILE_LOCATION = `${dataDomain}/chats.json`;

export async function getChats(mysky: MySky): Promise<Array<Chat>> {
  const {data} = await mysky.getJSONEncrypted(CHAT_FILE_LOCATION);
  if (data == null) {
    return [];
  }
  return data.chats as Array<Chat>;
}

export async function addChat(
  mysky: MySky,
  counterpartyId: UserId
): Promise<void> {
  const chats = await getChats(mysky);

  const seenCounterpartyIds = new Set(chats.map((chat) => chat.counterpartyId));
  if (!seenCounterpartyIds.has(counterpartyId)) {
    chats.push({counterpartyId});
    await mysky.setJSONEncrypted(CHAT_FILE_LOCATION, {chats});
  }

  return;
}
