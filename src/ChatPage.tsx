import {useCallback, useEffect, useRef, useState} from "react";
import {useParams} from "react-router";
import {MySky} from "skynet-js";
import AuthedContainer from "./AuthedContainer";
import {
  Message,
  getMessages as fetchMessages,
  sendMessage,
} from "./services/messages";
import {useMysky} from "./MyskyProvider";
import {getSharedKey} from "./services/keys";
import SkynetId from "./SkynetId";
import {addChat} from "./services/chatList";

type State =
  | {status: "loading"}
  | {status: "counterparty_not_connected"}
  | {status: "connected"; messages: Array<Message>}
  | {status: "error"; errorMessage: string};

type UserId = string;

function useInterval(callback: () => void, delay: number) {
  const savedCallback = useRef<undefined | (() => void)>();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current!();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}
function ChatPageInner({
  mysky,
  myId,
  counterpartyId,
}: {
  mysky: MySky;
  myId: UserId;
  counterpartyId: UserId;
}) {
  // Add this chat, in case we haven't seen it
  useEffect(() => {
    addChat(mysky, counterpartyId);
  }, [mysky, counterpartyId]);

  const [state, setState] = useState<State>({status: "loading"});
  const [sharedKey, setSharedKey] = useState<null | CryptoKey>(null);
  useEffect(() => {
    getSharedKey(mysky, myId, counterpartyId).then((res) => {
      if (res.status === "success") {
        setSharedKey(res.key);
      } else if (res.status === "counterparty_no_key") {
        setState({status: "counterparty_not_connected"});
      } else {
        console.error(res.message);
        setState({status: "error", errorMessage: res.message});
      }
    });

    return () => {
      setSharedKey(null);
      setState({
        status: "loading",
      });
    };
  }, [mysky, myId, counterpartyId]);

  const getMessages = useCallback(() => {
    if (sharedKey == null) {
      return;
    }
    fetchMessages(mysky, myId, counterpartyId, sharedKey).then((res) => {
      if (res.status === "success") {
        setState({status: "connected", messages: res.messages});
      } else if (res.status === "counterparty_not_connected") {
        setState({status: "counterparty_not_connected"});
      } else {
        console.error(res.message);
        setState({status: "error", errorMessage: res.message});
      }
    });
  }, [mysky, myId, counterpartyId, sharedKey]);

  useEffect(() => {
    getMessages();
  }, [getMessages]);

  useInterval(() => {
    getMessages();
  }, 2000);

  const [compose, setCompose] = useState("");

  let inner;
  if (state.status === "loading") {
    inner = <div>Loading...</div>;
  } else if (state.status === "counterparty_not_connected") {
    inner = (
      <div>
        <h3>
          <SkynetId id={counterpartyId} /> is not connected
        </h3>
        <p>
          They can navigate to{" "}
          <span
            style={{fontSize: "0.8em", fontWeight: "bold"}}
          >{`${window.location.origin}/#/chat/${myId}`}</span>{" "}
          to chat with you.
        </p>
      </div>
    );
  } else if (state.status === "connected") {
    inner = (
      <div
        style={{
          display: "flex",
          flex: "1",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingBottom: "1em",
          minHeight: 0,
        }}
      >
        <ul
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            margin: 0,
            padding: 0,
            overflowY: "scroll",
            minHeight: 0,
          }}
        >
          {state.messages
            .slice(0)
            .reverse()
            .map((m) => (
              <li
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  listStyle: "none",
                  margin: "0.4em 0",
                }}
                key={m.id}
              >
                <SkynetId id={m.author} />
                <div style={{marginLeft: "0.5em"}}>{m.content}</div>
              </li>
            ))}
        </ul>
        <form
          style={{display: "flex"}}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            sendMessage(mysky, myId, counterpartyId, sharedKey!, compose);
            setCompose("");
          }}
        >
          <SkynetId
            id={myId}
            style={{alignSelf: "center", marginRight: "0.5em"}}
          />
          <textarea
            style={{flex: "1", fontSize: "1em", fontFamily: "sans-serif"}}
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
          />
          <button
            onClick={() => {
              if (sharedKey == null) {
                throw new Error("todo");
              }
            }}
          >
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <h2>
        Chatting with <SkynetId id={counterpartyId} />
      </h2>
      <div style={{marginBottom: "2em"}}>
        They can chat with you at{" "}
        <span
          style={{fontSize: "0.8em", fontWeight: "bold"}}
        >{`${window.location.origin}/#/chat/${myId}`}</span>
      </div>
      {inner}
    </div>
  );
}

export default function ChatPage() {
  const {mysky, userId, logout} = useMysky();
  const {counterpartyId} = useParams();

  if (mysky == null || userId == null || counterpartyId == null) {
    return <div>Loading...</div>;
  }

  return (
    <AuthedContainer
      onLogout={() => {
        if (logout == null) {
          throw new Error("Tried logging out before mysky was loaded");
        }
        logout();
      }}
    >
      <ChatPageInner
        mysky={mysky}
        myId={userId}
        counterpartyId={counterpartyId}
      />
    </AuthedContainer>
  );
}
