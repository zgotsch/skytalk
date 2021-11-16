import {createContext, useContext, useEffect, useState} from "react";
import {MySky} from "skynet-js";
import {UserProfileDAC} from "@skynethub/userprofile-library";
import skynetClient, {dataDomain} from "./skynetClient";
import {IUserProfile} from "@skynethub/userprofile-library/dist/types";

type UserId = string;
type Payload = {
  mysky: null | MySky;
  loginStatus: "unknown" | "loggedIn" | "loggedOut";
  userId: null | string;
  getUserProfile: null | ((userId: UserId) => Promise<IUserProfile>);
  tryLogin: null | (() => Promise<boolean>);
  logout: null | (() => Promise<void>);
};
const MyskyContext = createContext<null | Payload>(null);

// HACK: global profile cache
type UserProfileCacheEntry =
  | {
      status: "loaded";
      profile: IUserProfile;
    }
  | {
      status: "loading";
      profile: Promise<IUserProfile>;
    }
  | {
      status: "error";
      errorMessage: string;
    };
const userProfileCache = new Map<UserId, UserProfileCacheEntry>();

export default function MyskyProvider({children}: {children: React.ReactNode}) {
  // Load mysky
  const [mysky, setMysky] = useState<MySky>();
  const [userProfileDac, setUserProfileDac] = useState<UserProfileDAC>();
  const [loginStatus, setLoginStatus] = useState(
    "unknown" as "unknown" | "loggedIn" | "loggedOut"
  );
  const [userId, setUserId] = useState<null | string>(null);

  // Load mysky
  useEffect(() => {
    async function loadMySky() {
      const mysky = await skynetClient.loadMySky(dataDomain);

      const userProfileDac = new UserProfileDAC();
      await mysky.loadDacs(userProfileDac);

      setMysky(mysky);
      setUserProfileDac(userProfileDac);
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
    getUserProfile: null,
    tryLogin: null,
    logout: null,
  };
  if (mysky != null) {
    value = {
      mysky,
      loginStatus,
      userId,
      getUserProfile: async (userId: UserId) => {
        let cached = userProfileCache.get(userId);
        if (cached == null) {
          const request = userProfileDac!.getProfile(userId);
          request.then(
            (profile) => {
              userProfileCache.set(userId, {status: "loaded", profile});
            },
            (e) => {
              userProfileCache.set(userId, {
                status: "error",
                errorMessage: e.message,
              });
            }
          );
          cached = {status: "loading", profile: request};
          userProfileCache.set(userId, cached);
          return request;
        }
        if (cached.status === "error") {
          return Promise.reject(new Error(cached.errorMessage));
        }
        return cached.profile;
      },
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
