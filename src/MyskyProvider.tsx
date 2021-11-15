import {createContext, useContext, useEffect, useState} from "react";
import {MySky} from "skynet-js";
import skynetClient, {dataDomain} from "./skynetClient";

type Payload = {
  mysky: null | MySky;
  loginStatus: "unknown" | "loggedIn" | "loggedOut";
  userId: null | string;
  tryLogin: null | (() => Promise<boolean>);
  logout: null | (() => Promise<void>);
};
const MyskyContext = createContext<null | Payload>(null);

export default function MyskyProvider({children}: {children: React.ReactNode}) {
  // Load mysky
  const [mysky, setMysky] = useState<MySky>();
  const [loginStatus, setLoginStatus] = useState(
    "unknown" as "unknown" | "loggedIn" | "loggedOut"
  );
  const [userId, setUserId] = useState<null | string>(null);

  // Load mysky
  useEffect(() => {
    async function loadMySky() {
      const mysky = await skynetClient.loadMySky(dataDomain);
      setMysky(mysky);
      setLoginStatus((await mysky.checkLogin()) ? "loggedIn" : "loggedOut");
    }
    loadMySky();
  }, []);

  useEffect(() => {
    if (mysky == null) {
      return;
    }
    if (loginStatus !== "loggedIn") {
      return;
    }
    mysky.userID().then((userId) => {
      setUserId(userId);
    });
  }, [mysky, loginStatus]);

  let value: Payload = {
    mysky: null,
    loginStatus: "unknown",
    userId: null,
    tryLogin: null,
    logout: null,
  };
  if (mysky != null) {
    value = {
      mysky,
      loginStatus,
      userId,
      tryLogin: async () => {
        const loggedIn = await mysky.requestLoginAccess();
        setLoginStatus("loggedIn");
        return loggedIn;
      },
      logout: async () => {
        await mysky.logout();
        setLoginStatus("loggedOut");
        return;
      },
    };
  }

  return (
    <MyskyContext.Provider value={value}>{children}</MyskyContext.Provider>
  );
}

export function useMysky(): Payload {
  const value = useContext(MyskyContext);
  if (value == null) {
    throw new Error("useMysky must be used within a MyskyProvider");
  }
  return value;
}
