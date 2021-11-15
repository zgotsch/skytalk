import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import {combineMessage, decrypt, encrypt, extractMessage} from "./crypto";
import {useSharedKey} from "./KeyProvider";

export type Message = {
  id: number;
  sentAt: string;
  receivedAt: string;
  author: string;
  content: string;
  // and no mac, because this is a hackathon
};
type UserId = string;

type State = {
  myEncryptedMessages: Map<UserId, ArrayBuffer>;
  theirEncryptedMessages: Map<UserId, ArrayBuffer>;
  // myMessages: Map<UserId, ReadonlyArray<Message>>,
  // theirMessages: Map<UserId, ReadonlyArray<Message>>,
};

type Payload = {
  state: State;
  requestRefresh: (userId: UserId) => void;
  sendMessage: (userId: UserId, message: string) => void;
};

const MessagesContext = createContext<null | Payload>(null);

type Action =
  | {
      type: "RECEIVED_MY_ENCRYPTED_MESSAGES";
      counterparty: UserId;
      data: ArrayBuffer;
    }
  | {
      type: "RECEIVED_THEIR_ENCRYPTED_MESSAGES";
      userId: UserId;
      data: ArrayBuffer;
    }
  | {
      type: "RECEIVED_KEYS";
    };

function messagesReducer(state: State, action: Action): State {
  switch (action.type) {
    case "RECEIVED_MY_ENCRYPTED_MESSAGES":
      const newMyEncryptedMessages = new Map(state.myEncryptedMessages);
      newMyEncryptedMessages.set(action.counterparty, action.data);
      return {
        ...state,
        myEncryptedMessages: newMyEncryptedMessages,
      };
    case "RECEIVED_THEIR_ENCRYPTED_MESSAGES":
      const newTheirEncryptedMessages = new Map(state.theirEncryptedMessages);
      newTheirEncryptedMessages.set(action.userId, action.data);
      return {
        ...state,
        theirEncryptedMessages: newTheirEncryptedMessages,
      };
    case "RECEIVED_KEYS":
      throw new Error("foo");
    default:
      return state;
  }
}

export default function MessagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(messagesReducer, {
    myEncryptedMessages: new Map(),
    theirEncryptedMessages: new Map(),
    // myMessages: new Map(),
    // theirMessages: new Map(),
  });

  return (
    <MessagesContext.Provider
      value={{
        state,
        requestRefresh: (userId: UserId) => {
          console.log("requestRefresh");
        },
        sendMessage: (userId: UserId, message: string) => {
          console.log("sendMessage");
        },
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}

async function decryptMessages(
  key: CryptoKey,
  fileData: ArrayBuffer
): Promise<Array<Message>> {
  const message = extractMessage(fileData);

  const decrypted = await decrypt(key, message);
  const decoded = JSON.parse(decrypted);
  return decoded.messages;
}

async function encryptMessages(
  key: CryptoKey,
  messages: Array<Message>
): Promise<ArrayBuffer> {
  const message = JSON.stringify({messages});
  const encrypted = await encrypt(key, message);
  return combineMessage(encrypted);
}

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

  mergedMessages.sort((a, b) => (a.receivedAt > b.receivedAt ? -1 : 1));
  return mergedMessages;
}

export function useMessages(counterpartyId: UserId): null | Array<Message> {
  const messagesContext = useContext(MessagesContext);
  if (messagesContext == null) {
    throw new Error("useMessages must be used within a MessagesProvider");
  }

  const sharedKey = useSharedKey(counterpartyId);

  const [myMessages, setMyMessages] = useState<Array<Message> | null>(null);
  const [theirMessages, setTheirMessages] = useState<Array<Message> | null>(
    null
  );

  const {state, requestRefresh} = messagesContext;
  const {myEncryptedMessages, theirEncryptedMessages} = state;
  const myEncryptedChat = myEncryptedMessages.get(counterpartyId);
  const theirEncryptedChat = theirEncryptedMessages.get(counterpartyId);

  const [messages, setMessages] = useState<Array<Message> | null>(null);

  useEffect(() => {
    async function go() {
      if (sharedKey == null) {
        return null;
      }
      if (myEncryptedChat == null || theirEncryptedChat == null) {
        return null;
      }

      const [myMessages, theirMessages] = await Promise.all([
        decryptMessages(sharedKey, myEncryptedChat),
        decryptMessages(sharedKey, theirEncryptedChat),
      ]);
      setMyMessages(myMessages);
      setTheirMessages(theirMessages);
    }
    go();
  }, [myEncryptedChat, theirEncryptedChat, sharedKey]);

  useEffect(() => {
    if (myMessages == null || theirMessages == null) {
      return;
    }
    const mergedMessages = mergeMessages(myMessages, theirMessages);
    if (mergedMessages !== myMessages) {
      // update
      console.log("todo update my file");
    }

    setMessages(mergedMessages);
  }, [myMessages, theirMessages]);

  return messages;
}
