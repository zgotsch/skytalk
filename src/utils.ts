import {JsonData, MySky, SkynetClient} from "skynet-js";

const dataDomain = "localhost";

type UserId = string;

export async function writeMyKey(
  mysky: MySky,
  keyPair: CryptoKeyPair
): Promise<void> {
  const [publicJWK, privateJWK] = await Promise.all([
    window.crypto.subtle.exportKey("jwk", keyPair.publicKey!),
    window.crypto.subtle.exportKey("jwk", keyPair.privateKey!),
  ]);

  try {
    await Promise.all([
      mysky.setJSON(`${dataDomain}/public.jwk`, publicJWK as JsonData),
      mysky.setJSONEncrypted(
        `${dataDomain}/private.jwk`,
        privateJWK as JsonData
      ),
    ]);
  } catch (e) {
    console.error(e);
  }

  return;
}

export async function getMyKeyPair(
  mysky: MySky
): Promise<null | CryptoKeyPair> {
  try {
    const [{data: publicJWK}, {data: privateJWK}] = await Promise.all([
      mysky.getJSON(`${dataDomain}/public.jwk`),
      mysky.getJSONEncrypted(`${dataDomain}/private.jwk`),
    ]);

    if (publicJWK == null || privateJWK == null) {
      return null;
    }

    const [publicKey, privateKey] = await Promise.all([
      window.crypto.subtle.importKey(
        "jwk",
        publicJWK as JsonWebKey,
        {
          name: "ECDH",
          namedCurve: "P-384",
        },
        false,
        []
      ),
      window.crypto.subtle.importKey(
        "jwk",
        privateJWK as JsonWebKey,
        {
          name: "ECDH",
          namedCurve: "P-384",
        },
        false,
        ["deriveKey"]
      ),
    ]);

    return {publicKey, privateKey};
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getUserPublicKey(
  skynetClient: SkynetClient,
  userId: UserId
): Promise<null | CryptoKey> {
  try {
    const {data: publicJWK} = await skynetClient.file.getJSON(
      userId,
      `${dataDomain}/public.jwk`
    );
    if (publicJWK == null) {
      return null;
    }

    return window.crypto.subtle.importKey(
      "jwk",
      publicJWK as JsonWebKey,
      {
        name: "ECDH",
        namedCurve: "P-384",
      },
      false,
      []
    );
  } catch (e) {
    console.error(e);
    return null;
  }
}
