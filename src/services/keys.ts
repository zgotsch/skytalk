import {MySky} from "skynet-js";
import {deriveSecretKey} from "../crypto";
import skynetClient from "../skynetClient";
import {getMyKeyPair, getUserPublicKey} from "../utils";

type UserId = string;
type GetSharedKeyResult =
  | {
      status: "success";
      key: CryptoKey;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "counterparty_no_key";
      counterpartyId: UserId;
    };

export async function getSharedKey(
  mysky: MySky,
  myId: string,
  counterpartyId: string
): Promise<GetSharedKeyResult> {
  const myPair = await getMyKeyPair(mysky);
  const theirKey = await getUserPublicKey(skynetClient, counterpartyId);

  if (myPair == null) {
    return {
      status: "error",
      message: "My key pair is not found",
    };
  }

  if (theirKey == null) {
    return {
      status: "counterparty_no_key",
      counterpartyId,
    };
  }

  const sharedKey = await deriveSecretKey(myPair.privateKey!, theirKey);
  return {
    status: "success",
    key: sharedKey,
  };
}
