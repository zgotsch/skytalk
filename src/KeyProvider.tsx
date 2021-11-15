import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {deriveSecretKey, generateKeyPair} from "./crypto";
import {useMysky} from "./MyskyProvider";
import {getMyKeyPair, writeMyKey} from "./utils";

type UserId = string;
type Payload = {
  myPrivateKey: CryptoKey;
  publicKeysByUser: Map<UserId, CryptoKey>;
  sharedKeyCache: Map<UserId, CryptoKey>;
  receivePublicKey: (userId: UserId, publicKey: CryptoKey) => void;
  setSharedKey: (userId: UserId, sharedKey: CryptoKey) => void;
};

const KeyContext = createContext<null | Payload>(null);

export default function KeyProvider({children}: {children: React.ReactNode}) {
  const {mysky, userId} = useMysky();
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null);
  const [publicKeys, setPublicKeys] = useState<Map<UserId, CryptoKey>>(
    new Map()
  );
  const [sharedKeyCache, setSharedKeyCache] = useState<Map<UserId, CryptoKey>>(
    new Map()
  );

  useEffect(() => {
    async function go() {
      if (mysky == null || userId == null) {
        return;
      }
      if (myPrivateKey == null) {
        const myKeyPair = await getMyKeyPair(mysky);
        if (myKeyPair == null) {
          const newKeyPair = await generateKeyPair();
          setMyPrivateKey(newKeyPair.privateKey!);
          writeMyKey(mysky, newKeyPair);
        }
      }
    }
    go();
  }, [mysky, userId, myPrivateKey]);

  const receivePublicKey = useCallback(
    (userId: UserId, publicKey: CryptoKey) => {
      const newPublicKeys = new Map(publicKeys);
      newPublicKeys.set(userId, publicKey);
      setPublicKeys(newPublicKeys);
    },
    [publicKeys]
  );

  const setSharedKey = useCallback(
    (userId: UserId, sharedKey: CryptoKey) => {
      const newSharedKeyCache = new Map(sharedKeyCache);
      newSharedKeyCache.set(userId, sharedKey);
      setSharedKeyCache(newSharedKeyCache);
    },
    [sharedKeyCache]
  );

  let value: null | Payload = null;
  if (myPrivateKey != null) {
    value = {
      myPrivateKey,
      publicKeysByUser: publicKeys,
      sharedKeyCache,
      setSharedKey,
      receivePublicKey,
    };
  }

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export function useSharedKey(counterpartyId: UserId): null | CryptoKey {
  const keyContext = useContext(KeyContext);
  if (keyContext == null) {
    return null;
  }

  const {myPrivateKey, publicKeysByUser, sharedKeyCache, setSharedKey} =
    keyContext;
  if (sharedKeyCache.has(counterpartyId)) {
    return sharedKeyCache.get(counterpartyId)!;
  }

  const counterpartyKey = publicKeysByUser.get(counterpartyId);
  if (counterpartyKey == null) {
    console.error("No public key for user", counterpartyId);
    return null;
  }
  deriveSecretKey(myPrivateKey, counterpartyKey).then((sharedKey) => {
    setSharedKey(counterpartyId, sharedKey);
  });
  return null;
}
